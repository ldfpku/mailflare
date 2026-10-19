/**
 * The meeting page: RealtimeKit's prebuilt meeting UI in SMJ colours and
 * Chinese. A participant token comes either from the URL fragment (HuLa opens
 * `/meet/<id>#t=<token>` after joining with its own credentials) or from
 * `/api/meetings/<id>/join` with the web session; without a session the page
 * sends the user to sign in and back.
 *
 * The browser build and UI Kit are served from this origin
 * (`public/vendor/realtimekit`, written by `scripts/vendor-realtimekit.mjs`,
 * which also removes the UI Kit's Google Fonts loader), so the page only ever
 * talks to us and to RealtimeKit's own `*.realtime.cloudflare.com` hosts.
 *
 * Screen sharing is the UI Kit's own button. The host may switch on "仅主持人可共享屏幕":
 * the host's page broadcasts the lock, and every other page stops a share already
 * running and refuses new ones. The presets cannot be changed from here
 * (`participants.updatePermissions` has no effect with `group_call_host`), so this is
 * enforced by the page every participant runs; a participant preset with screenshare
 * NOT_ALLOWED would make it binding. Latecomers get the lock again when they join;
 * it lasts as long as the host stays in the meeting.
 */
const REALTIMEKIT_VERSION = "2.0.2";
/** RealtimeKit's capture preset for meetings (`qvga`, `vga`, `hd`, `fhd`); the presets' own default is `vga`. */
const MEETING_VIDEO_QUALITY = "hd";
const VENDOR = `/vendor/realtimekit/${REALTIMEKIT_VERSION}`;
/** /vendor is cached as immutable: bump this whenever the patched core changes (scripts/vendor-realtimekit.mjs). */
const CORE_REVISION = "2";
const REALTIMEKIT_HOSTS = "https://*.realtime.cloudflare.com";
/** Matches the stack the vendoring script writes into the UI Kit. */
const FONT_STACK = `"Barlow", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif`;

const CSP = [
	"default-src 'self'",
	// Cloudflare Web Analytics, as on /im, in case the zone injects its beacon.
	"script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
	"style-src 'self' 'unsafe-inline'",
	"font-src 'self' data:",
	`img-src 'self' data: blob: ${REALTIMEKIT_HOSTS}`,
	`media-src 'self' blob: ${REALTIMEKIT_HOSTS}`,
	`connect-src 'self' ${REALTIMEKIT_HOSTS} wss://*.realtime.cloudflare.com https://cloudflareinsights.com`,
	"worker-src 'self' blob:",
	`frame-src 'self' ${REALTIMEKIT_HOSTS}`,
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'self'",
].join("; ");

export const MEETING_PAGE_HEADERS: Record<string, string> = {
	"Content-Type": "text/html; charset=UTF-8",
	"Cache-Control": "no-store",
	"Content-Security-Policy": CSP,
	"Permissions-Policy": "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self), autoplay=(self), geolocation=(), payment=(), usb=()",
	"Referrer-Policy": "no-referrer",
	"X-Content-Type-Options": "nosniff",
	"X-Robots-Tag": "noindex, nofollow",
};

/** The UI Kit falls back to English for any key not listed. */
const ZH: Record<string, string> = {
	join: "加入",
	leave: "离开",
	end: "结束",
	"end.all": "为所有人结束会议",
	ended: "会议已结束",
	"ended.left": "你已离开会议",
	"ended.kicked": "你已被移出会议",
	"ended.rejected": "入会请求被拒绝",
	"ended.disconnected": "连接已断开",
	"ended.network": "网络异常，已断开",
	"ended.unauthorized": "无权加入该会议",
	leave_confirmation: "确定离开会议吗？",
	cancel: "取消",
	yes: "确定",
	you: "你",
	"(you)": "（你）",
	everyone: "所有人",
	participants: "参会人",
	"participants.empty_list": "暂无参会人",
	chat: "聊天",
	"chat.message_placeholder": "输入消息",
	"chat.send_msg": "发送",
	"chat.empty_chat": "还没有消息",
	"chat.everyone": "所有人",
	polls: "投票",
	"polls.create": "发起投票",
	"polls.question": "问题",
	"polls.answers": "选项",
	plugins: "插件",
	settings: "设置",
	more: "更多",
	layout: "布局",
	"layout.auto": "自动",
	mic_on: "麦克风已开",
	mic_off: "麦克风已关",
	enable_mic: "打开麦克风",
	disable_mic: "关闭麦克风",
	video_on: "摄像头已开",
	video_off: "摄像头已关",
	enable_video: "打开摄像头",
	disable_video: "关闭摄像头",
	audio: "音频",
	video: "视频",
	camera: "摄像头",
	screen: "屏幕",
	screenshare: "共享屏幕",
	"screenshare.start": "共享屏幕",
	"screenshare.stop": "停止共享",
	"screenshare.shared": "正在共享屏幕",
	full_screen: "全屏",
	"full_screen.exit": "退出全屏",
	mute: "静音",
	mute_all: "全部静音",
	"mute_all.header": "全部静音",
	"mute_all.description": "将所有参会人静音",
	"mute_all.allow_unmute": "允许参会人自行解除静音",
	kick: "移出会议",
	pin: "置顶",
	unpin: "取消置顶",
	"settings.microphone_input": "麦克风",
	"settings.speaker_output": "扬声器",
	"settings.mirror_video": "镜像画面",
	"settings.camera_off": "摄像头已关闭",
	"setup_screen.join_in_as": "入会身份",
	"setup_screen.your_name": "你的名字",
	"notifications.joined": "加入了会议",
	"notifications.left": "离开了会议",
	"network.reconnecting": "正在重新连接…",
	"network.restored": "网络已恢复",
	"network.lost": "网络已断开",
	"network.delay": "网络较慢",
	perm_denied: "没有权限",
	"perm_denied.audio": "无法使用麦克风",
	"perm_denied.video": "无法使用摄像头",
	"perm_denied.screenshare": "无法共享屏幕",
	"perm_sys_denied": "系统未授权",
	"perm_sys_denied.audio": "系统未允许使用麦克风",
	"perm_sys_denied.video": "系统未允许使用摄像头",
	"perm_sys_denied.screenshare": "系统未允许共享屏幕",
	"init.auth_error": "入会凭证无效，请重新打开会议链接",
	"init.network_error": "网络错误，无法连接会议",
	"init.default_error": "会议加载失败",
	"join.network_error": "网络错误，无法加入会议",
	"join.media_error": "无法打开摄像头或麦克风",
	"join.default_error": "加入会议失败",
	"cta.reload": "重新加载",
	"cta.continue": "继续",
	"cta.system_settings": "打开系统设置",
	"recording.indicator": "录制中",
	"date.today": "今天",
	"date.yesterday": "昨天",
	"list.empty": "暂无内容",
	"dialog.close": "关闭",
	"breakout_rooms": "分组讨论",
	"breakout_rooms.main_room": "主会场",
};

/** Broadcast type of the host's screen share lock. */
const SCREEN_LOCK_MESSAGE = "smj-screenshare-lock";

export function renderMeetingPage(id: string, hostPreset = "group_call_host"): string {
	const config = JSON.stringify({ id, hostPreset, videoQuality: MEETING_VIDEO_QUALITY, lockMessage: SCREEN_LOCK_MESSAGE, core: `${VENDOR}/core`, coreRevision: CORE_REVISION, ui: `${VENDOR}/ui`, font: FONT_STACK, zh: ZH }).replace(/</g, "\\u003c");
	return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>视频会议 · 斯米伽 SMJ</title>
<style>
:root { --smj-blue: #034fbc; --smj-navy: #1a2b4a; --smj-muted: #5b6b85; --smj-line: #e3e8f0; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #ffffff; color: var(--smj-navy); font-family: ${FONT_STACK}; }
body { display: flex; flex-direction: column; }
header { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--smj-line); flex-wrap: wrap; }
.brand { font-weight: 700; color: var(--smj-blue); white-space: nowrap; }
.title { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { color: var(--smj-muted); font-size: 13px; white-space: nowrap; }
.spacer { flex: 1; }
button, a.button { font: inherit; font-size: 13px; border: 1px solid var(--smj-line); background: #fff; color: var(--smj-navy); padding: 6px 12px; border-radius: 6px; cursor: pointer; text-decoration: none; }
button.primary { background: var(--smj-blue); border-color: var(--smj-blue); color: #fff; }
button:disabled { opacity: 0.5; cursor: default; }
.lock { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; white-space: nowrap; cursor: pointer; }
.lock[hidden], .notice[hidden] { display: none; }
.lock input { accent-color: var(--smj-blue); margin: 0; }
.notice { font-size: 13px; color: var(--smj-muted); white-space: nowrap; }
main { flex: 1; min-height: 0; position: relative; }
/* The UI Kit lays out its grid and control bar as a flex column; display: block collapses the video area to zero height. */
rtk-meeting { display: flex; flex-direction: column; height: 100%; width: 100%; }
#status { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center; padding: 24px; }
#status[hidden] { display: none; }
#status p { margin: 0; color: var(--smj-muted); }
#invite-dialog { border: 1px solid var(--smj-line); border-radius: 10px; padding: 0; width: min(420px, calc(100vw - 32px)); color: var(--smj-navy); }
#invite-dialog::backdrop { background: rgba(26, 43, 74, 0.35); }
#invite-dialog form { display: flex; flex-direction: column; gap: 12px; padding: 16px; max-height: calc(100vh - 4rem); }
#invite-dialog h2 { margin: 0; font-size: 16px; }
#invite-search { font: inherit; font-size: 14px; padding: 7px 10px; border: 1px solid var(--smj-line); border-radius: 6px; }
#invite-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; min-height: 120px; max-height: 50vh; border: 1px solid var(--smj-line); border-radius: 6px; }
#invite-list li label { display: flex; align-items: center; gap: 10px; padding: 8px 10px; cursor: pointer; }
#invite-list li + li { border-top: 1px solid var(--smj-line); }
#invite-list input, #invite-mail { accent-color: var(--smj-blue); margin: 0; }
#invite-list .who { flex: 1; min-width: 0; }
#invite-list .email, #invite-list .tag, #invite-hint { color: var(--smj-muted); font-size: 12px; }
#invite-list .email { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.invite-actions { display: flex; align-items: center; gap: 8px; }
.invite-actions label { flex: 1; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
</style>
</head>
<body>
<header>
	<span class="brand">斯米伽 SMJ</span>
	<span class="title" id="title">视频会议</span>
	<span class="meta" id="meta"></span>
	<span class="spacer"></span>
	<label class="lock" id="lock" hidden><input type="checkbox" id="lock-input">仅主持人可共享屏幕</label>
	<span class="notice" id="lock-notice" hidden>主持人已限制共享屏幕</span>
	<button type="button" id="invite" hidden>添加参会人</button>
	<a class="button" id="calendar" href="/api/meetings/${id}/meeting.ics" download="meeting.ics">加入日历</a>
	<button type="button" id="copy">复制会议链接</button>
</header>
<main>
	<rtk-meeting id="meeting" mode="fill" show-setup-screen="true"></rtk-meeting>
	<div id="status"><p id="status-text">正在进入会议…</p><button type="button" class="primary" id="retry" hidden>重新进入</button></div>
</main>
<dialog id="invite-dialog">
	<form method="dialog" id="invite-form">
		<h2>添加参会人</h2>
		<input type="search" id="invite-search" placeholder="搜索姓名或邮箱" autocomplete="off">
		<ul id="invite-list"></ul>
		<p id="invite-hint" hidden></p>
		<div class="invite-actions">
			<label><input type="checkbox" id="invite-mail">同时发送邮件邀请</label>
			<button type="button" id="invite-cancel">取消</button>
			<button type="submit" class="primary" id="invite-send" disabled>邀请</button>
		</div>
	</form>
</dialog>
<script type="module">
const config = ${config};
const statusBox = document.getElementById("status");
const statusText = document.getElementById("status-text");
const retry = document.getElementById("retry");
const show = (text, canRetry) => { statusText.textContent = text; retry.hidden = !canRetry; statusBox.hidden = false; };
const link = location.origin + "/meet/" + config.id;

document.getElementById("copy").addEventListener("click", async () => {
	try { await navigator.clipboard.writeText(link); document.getElementById("copy").textContent = "已复制"; }
	catch { prompt("会议链接", link); }
});
retry.addEventListener("click", () => location.reload());

function describe(meeting) {
	if (!meeting) return;
	document.getElementById("title").textContent = meeting.title;
	document.title = meeting.title + " · 斯米伽 SMJ";
	if (meeting.startsAt) {
		const start = new Date(meeting.startsAt);
		const end = new Date(meeting.startsAt + meeting.durationMinutes * 60000);
		const day = start.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
		const time = (date) => date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
		document.getElementById("meta").textContent = day + " " + time(start) + " - " + time(end);
	}
	if (meeting.hostName) document.getElementById("meta").textContent += (meeting.startsAt ? " · " : "") + "发起人 " + meeting.hostName;
}

function loadScript(src) {
	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = src;
		script.onload = resolve;
		script.onerror = () => reject(new Error("load " + src));
		document.head.appendChild(script);
	});
}

// From /join or the link HuLa opens; the preset name is the fallback for older links.
let joinedAsHost = false;

async function participantToken() {
	const fragment = new URLSearchParams(location.hash.slice(1));
	const token = fragment.get("t");
	if (token) {
		// The token is a credential: keep it out of history, bookmarks and copied links.
		history.replaceState(null, "", location.pathname);
		try {
			const meta = JSON.parse(fragment.get("m") || "null");
			describe(meta);
			joinedAsHost = meta?.host === true;
		} catch {}
		return token;
	}
	const response = await fetch("/api/meetings/" + config.id + "/join", { method: "POST", credentials: "same-origin" });
	if (response.status === 401) {
		location.href = "/login?next=" + encodeURIComponent(location.pathname);
		return null;
	}
	const data = await response.json().catch(() => ({}));
	if (!response.ok) { show(data.error || "无法加入会议", response.status >= 500); return null; }
	describe(data.meeting);
	joinedAsHost = data.host === true;
	return data.authToken;
}

async function start() {
	const token = await participantToken();
	if (!token) return;
	const [loader] = await Promise.all([import(config.ui + "/loader/index.es2017.js"), loadScript(config.core + "/browser.js?r=" + config.coreRevision)]);
	loader.defineCustomElements();
	const element = document.getElementById("meeting");
	try {
		const ui = await import(config.ui + "/dist/esm/index.js");
		element.t = ui.useLanguage(config.zh);
		ui.provideRtkDesignSystem(document.body, {
			theme: "light",
			fontFamily: config.font,
			colors: { brand: { 300: "#4f86d6", 400: "#2a6bcb", 500: "#034fbc", 600: "#02409a", 700: "#023178" }, text: "#1a2b4a", "text-on-brand": "#ffffff" },
		});
	} catch (error) {
		// Without the helpers the meeting still works, in English and default colours.
		console.warn("RealtimeKit UI helpers unavailable", error);
	}
	// The presets default to VGA; 720p (with the UI Kit's simulcast layers) is what a meeting should look like.
	const meeting = await window.RealtimeKitClient.init({ authToken: token, defaults: { audio: true, video: true, mediaConfiguration: { video: config.videoQuality } } });
	element.showSetupScreen = true;
	element.meeting = meeting;
	statusBox.hidden = true;
	meeting.self.on("roomLeft", () => { element.hidden = true; show("你已离开会议", true); });
	setupScreenLock(meeting);
	setupInvite(token);
}

/** “添加参会人”: pick people from the directory; each gets the link in a chat from you, and optionally a mail. */
function setupInvite(token) {
	const button = document.getElementById("invite");
	const dialog = document.getElementById("invite-dialog");
	const list = document.getElementById("invite-list");
	const search = document.getElementById("invite-search");
	const hint = document.getElementById("invite-hint");
	const send = document.getElementById("invite-send");
	const mail = document.getElementById("invite-mail");
	const api = (path, init = {}) =>
		fetch("/api/meetings/" + config.id + "/" + path, { ...init, headers: { ...(init.headers || {}), Authorization: "Bearer " + token } });
	let people = [];
	const chosen = new Set();
	const say = (text) => { hint.textContent = text; hint.hidden = !text; };

	const render = () => {
		const query = search.value.trim().toLowerCase();
		list.replaceChildren(...people
			.filter((person) => !query || person.name.toLowerCase().includes(query) || person.email.toLowerCase().includes(query))
			.map((person) => {
				const item = document.createElement("li");
				const label = document.createElement("label");
				const box = document.createElement("input");
				box.type = "checkbox";
				box.checked = chosen.has(person.id);
				box.addEventListener("change", () => {
					box.checked ? chosen.add(person.id) : chosen.delete(person.id);
					send.disabled = chosen.size === 0;
				});
				const who = document.createElement("span");
				who.className = "who";
				who.textContent = person.name;
				const email = document.createElement("span");
				email.className = "email";
				email.textContent = person.email;
				who.append(email);
				label.append(box, who);
				if (person.joined || person.invited) {
					const tag = document.createElement("span");
					tag.className = "tag";
					tag.textContent = person.joined ? "已入会" : "已邀请";
					label.append(tag);
				}
				item.append(label);
				return item;
			}));
	};

	button.hidden = false;
	button.addEventListener("click", async () => {
		chosen.clear();
		send.disabled = true;
		search.value = "";
		say("正在加载通讯录…");
		dialog.showModal();
		const response = await api("people").catch(() => null);
		const data = response ? await response.json().catch(() => ({})) : {};
		if (!response || !response.ok) { people = []; render(); say(data.error || "无法加载通讯录"); return; }
		people = data.people || [];
		render();
		say(people.length ? "" : "没有可邀请的人");
		search.focus();
	});
	search.addEventListener("input", render);
	document.getElementById("invite-cancel").addEventListener("click", () => dialog.close());
	document.getElementById("invite-form").addEventListener("submit", async (event) => {
		event.preventDefault();
		if (!chosen.size) return;
		send.disabled = true;
		say("正在发送邀请…");
		const response = await api("invite", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userIds: [...chosen], sendMail: mail.checked }),
		}).catch(() => null);
		const data = response ? await response.json().catch(() => ({})) : {};
		if (!response || !response.ok) { send.disabled = false; say(data.error || "邀请失败，请重试"); return; }
		dialog.close();
		button.textContent = data.mailError ? "已邀请 " + data.invited + " 人，邮件未发出" : "已邀请 " + data.invited + " 人";
		setTimeout(() => { button.textContent = "添加参会人"; }, 4000);
	});
}

function setupScreenLock(meeting) {
	const isHost = joinedAsHost || meeting.self.presetName === config.hostPreset;
	const lockLabel = document.getElementById("lock");
	const lockInput = document.getElementById("lock-input");
	const notice = document.getElementById("lock-notice");
	let locked = false;
	const announce = () => meeting.participants.broadcastMessage(config.lockMessage, { locked }).catch((error) => console.warn("broadcast", error));

	if (isHost) {
		lockLabel.hidden = false;
		lockInput.addEventListener("change", () => {
			locked = lockInput.checked;
			void announce();
		});
		// Latecomers missed the broadcast.
		meeting.participants.joined.on("participantJoined", () => {
			if (locked) void announce();
		});
		return;
	}

	// The UI Kit's share button calls enableScreenShare: refuse it while locked.
	const enable = meeting.self.enableScreenShare.bind(meeting.self);
	meeting.self.enableScreenShare = async (...args) => {
		if (locked) {
			notice.animate([{ color: "#d5304f" }, { color: "" }], { duration: 1200 });
			return;
		}
		return enable(...args);
	};
	let stopping = false;
	const enforce = async () => {
		if (!locked || stopping || !meeting.self.screenShareEnabled) return;
		stopping = true;
		try { await meeting.self.disableScreenShare(); } catch (error) { console.warn("disableScreenShare", error); }
		finally { stopping = false; }
	};
	meeting.participants.on("broadcastedMessage", ({ type, payload }) => {
		if (type !== config.lockMessage) return;
		locked = payload && payload.locked === true;
		notice.hidden = !locked;
		void enforce();
	});
	meeting.self.on("screenShareUpdate", () => void enforce());
}

start().catch((error) => {
	console.error(error);
	const invalid = /auth token/i.test(String(error && error.message));
	show(invalid ? "入会凭证无效，请从 SMJ 客户端或邀请邮件重新打开会议" : "会议加载失败，请检查网络后重试", !invalid);
});
</script>
</body>
</html>`;
}
