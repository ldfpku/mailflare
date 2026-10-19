/**
 * The meeting page's "背景" button: a panel of the same backgrounds as the
 * one-to-one call in the SMJ client, applied through a RealtimeKit video
 * middleware that draws `processor.ts`'s output onto the canvas RealtimeKit
 * sends. Bundled by `scripts/vendor-video-background.mjs` into
 * `public/vendor/video-background/<version>/smj-video-background.js`, next to
 * the wasm, model and background images it loads.
 *
 * The choice is kept under the same localStorage key and shape as the web
 * client's Pinia store (`videoBackground`: `{ selected, customImage }`), so a
 * background picked in a call on /im is already on in the next meeting.
 */
import { type BackgroundEffect, preloadSegmenter, VideoBackgroundProcessor } from "./processor";

type Choice = "none" | "blur" | "smj-hook" | "smj-split" | "smj-wall" | "custom";

type VideoMiddleware = (helpers: { canvas: HTMLCanvasElement }) => Promise<void>;

type Meeting = {
	self: {
		rawVideoTrack?: MediaStreamTrack;
		setVideoMiddlewareGlobalConfig(config: { disablePerFrameCanvasRendering: boolean }): Promise<void>;
		addVideoMiddleware(middleware: VideoMiddleware): Promise<unknown>;
		removeVideoMiddleware(middleware: VideoMiddleware): Promise<unknown>;
	};
};

const STORAGE_KEY = "videoBackground";
const ASSETS = new URL("./", import.meta.url).pathname;
const BRAND: { id: Choice; label: string }[] = [
	{ id: "smj-hook", label: "钩纹" },
	{ id: "smj-split", label: "错位" },
	{ id: "smj-wall", label: "品牌墙" },
];
const CUSTOM_MAX_WIDTH = 1280;
const CUSTOM_MAX_HEIGHT = 720;

type Saved = { selected: Choice; customImage: string };

function readSaved(): Saved {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
		return { selected: saved.selected || "none", customImage: saved.customImage || "" };
	} catch {
		return { selected: "none", customImage: "" };
	}
}

function writeSaved(saved: Saved) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
	} catch (error) {
		console.warn("video background: could not save the choice", error);
	}
}

function effectOf({ selected, customImage }: Saved): BackgroundEffect {
	if (selected === "blur") return { type: "blur" };
	if (selected === "custom") return customImage ? { type: "image", src: customImage } : { type: "none" };
	if (BRAND.some((item) => item.id === selected)) return { type: "image", src: `${ASSETS}backgrounds/${selected}.jpg` };
	return { type: "none" };
}

function readImageFile(file: File) {
	return new Promise<string>((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			const scale = Math.min(1, CUSTOM_MAX_WIDTH / image.naturalWidth, CUSTOM_MAX_HEIGHT / image.naturalHeight);
			const canvas = document.createElement("canvas");
			canvas.width = Math.round(image.naturalWidth * scale);
			canvas.height = Math.round(image.naturalHeight * scale);
			canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
			resolve(canvas.toDataURL("image/jpeg", 0.85));
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("unreadable image"));
		};
		image.src = url;
	});
}

export async function setupVideoBackground(meeting: Meeting, elements: { button: HTMLButtonElement; panel: HTMLElement; toast: HTMLElement }) {
	const { button, panel, toast } = elements;
	if (!(await VideoBackgroundProcessor.checkSupport())) {
		button.hidden = false;
		button.title = "当前浏览器不支持视频背景，请使用最新版 Chrome 或 Edge";
		button.disabled = true;
		return;
	}

	let saved = readSaved();
	let effect = effectOf(saved);
	let processor: VideoBackgroundProcessor | null = null;
	let attached = false;
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	const say = (text: string) => {
		toast.textContent = text;
		toast.hidden = false;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast.hidden = true), 4000);
	};

	// RealtimeKit calls this with a fresh canvas whenever the camera track changes and sends what is drawn on it.
	const middleware: VideoMiddleware = async ({ canvas }) => {
		processor?.stop();
		const raw = meeting.self.rawVideoTrack;
		const current = new VideoBackgroundProcessor({
			assetsBase: ASSETS,
			canvas,
			onDegrade: () => say("设备性能有限，已自动降低背景处理帧率"),
			onOverload: () => {
				say("设备性能不足，已关闭视频背景");
				void select("none");
			},
		});
		processor = current;
		try {
			await current.setEffect(effect);
		} catch (error) {
			console.warn("video background: image failed, sending the camera as is", error);
		}
		if (!raw) return;
		await current.start(raw);
		raw.addEventListener("ended", () => current.stop(), { once: true });
	};

	let applying = Promise.resolve();
	const apply = () => {
		applying = applying.then(async () => {
			if (effect.type === "none") {
				if (attached) {
					attached = false;
					await meeting.self.removeVideoMiddleware(middleware);
				}
				processor?.stop();
				processor = null;
				return;
			}
			if (attached) {
				await processor?.setEffect(effect);
				return;
			}
			// Load the model first: a middleware that throws would leave RealtimeKit without a video track.
			button.classList.add("loading");
			const ready = await preloadSegmenter(ASSETS);
			button.classList.remove("loading");
			if (!ready) throw new Error("segmenter unavailable");
			await meeting.self.setVideoMiddlewareGlobalConfig({ disablePerFrameCanvasRendering: true });
			attached = true;
			await meeting.self.addVideoMiddleware(middleware);
		}).catch((error) => {
			console.warn("video background", error);
			button.classList.remove("loading");
			say("视频背景启用失败，已恢复原始画面");
			saved = { ...saved, selected: "none" };
			effect = { type: "none" };
			writeSaved(saved);
			render();
		});
		return applying;
	};

	const select = (selected: Choice) => {
		saved = { ...saved, selected };
		effect = effectOf(saved);
		writeSaved(saved);
		render();
		button.classList.toggle("active", selected !== "none");
		return apply();
	};

	const fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.accept = "image/png,image/jpeg,image/webp";
	fileInput.hidden = true;
	fileInput.addEventListener("change", async () => {
		const file = fileInput.files?.[0];
		fileInput.value = "";
		if (!file) return;
		try {
			saved = { ...saved, customImage: await readImageFile(file) };
			await select("custom");
		} catch {
			say("图片无法读取，请换一张 JPG 或 PNG 图片");
		}
	});

	function render() {
		const options: { id: Choice; label: string; thumb?: string; style?: string }[] = [
			{ id: "none", label: "无", style: "background:#2c3644" },
			{ id: "blur", label: "模糊", style: "background:linear-gradient(135deg,#5b6b85 0%,#9aa8bd 50%,#4a5a73 100%)" },
			...BRAND.map((item) => ({ ...item, thumb: `${ASSETS}backgrounds/${item.id}.jpg` })),
			{ id: "custom", label: saved.customImage ? "自定义" : "+ 上传图片", thumb: saved.customImage || undefined, style: "background:#2c3644" },
		];
		panel.replaceChildren();
		const title = document.createElement("div");
		title.className = "bg-title";
		title.textContent = "视频背景";
		const hint = document.createElement("div");
		hint.className = "bg-hint";
		hint.textContent = "背景在本机处理，其他参会人看到的是处理后的画面";
		const grid = document.createElement("div");
		grid.className = "bg-grid";
		for (const option of options) {
			const tile = document.createElement("button");
			tile.type = "button";
			tile.className = "bg-option" + (saved.selected === option.id ? " selected" : "");
			tile.dataset.testid = `bg-option-${option.id}`;
			tile.title = option.label;
			if (option.style) tile.setAttribute("style", option.style);
			if (option.thumb) {
				const image = document.createElement("img");
				image.src = option.thumb;
				image.alt = "";
				tile.appendChild(image);
			}
			const label = document.createElement("span");
			label.textContent = option.label;
			if (option.thumb) label.className = "on-image";
			tile.appendChild(label);
			tile.addEventListener("click", () => {
				if (option.id === "custom" && !saved.customImage) fileInput.click();
				else void select(option.id);
			});
			grid.appendChild(tile);
		}
		for (const child of [title, hint, grid]) panel.appendChild(child);
		if (saved.customImage) {
			const change = document.createElement("button");
			change.type = "button";
			change.className = "bg-change";
			change.textContent = "更换自定义图片";
			change.addEventListener("click", () => fileInput.click());
			panel.appendChild(change);
		}
		panel.appendChild(fileInput);
	}

	button.hidden = false;
	button.classList.toggle("active", saved.selected !== "none");
	button.addEventListener("click", () => {
		panel.hidden = !panel.hidden;
		if (!panel.hidden) {
			render();
			void preloadSegmenter(ASSETS);
		}
	});
	// composedPath: a click on a tile re-renders the panel, so the target is no longer inside it by now.
	document.addEventListener("click", (event) => {
		const path = event.composedPath();
		if (!panel.hidden && !path.includes(panel) && !path.includes(button)) panel.hidden = true;
	});
	render();
	if (effect.type !== "none") await apply();
}
