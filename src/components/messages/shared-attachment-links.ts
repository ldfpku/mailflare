const LEGACY_INTRO = "Attachments (download links expire after 30 days):";
const DOWNLOAD_LABELS = new Set(["Download file", "↓"]);
const SVG_NS = "http://www.w3.org/2000/svg";

export function prepareSharedAttachmentLinks(
	content: DocumentFragment,
	origin: string,
	labels: { download: string; intro: string },
): Map<Element, string> {
	const links = new Map<Element, string>();
	for (const anchor of content.querySelectorAll("a[href]")) {
		if (!DOWNLOAD_LABELS.has(anchor.textContent?.trim() ?? "")) continue;
		let url: URL;
		try {
			url = new URL(anchor.getAttribute("href") ?? "", origin);
		} catch {
			continue;
		}
		if (url.origin !== origin || !/^\/api\/shared-files\/share_[A-Za-z0-9_-]{21}$/.test(url.pathname) || url.search || url.hash) continue;

		anchor.removeAttribute("target");
		anchor.setAttribute("download", "");
		anchor.setAttribute("aria-label", labels.download);
		anchor.setAttribute("title", labels.download);
		anchor.classList.add("mailflare-shared-download");
		const icon = document.createElementNS(SVG_NS, "svg");
		icon.setAttribute("viewBox", "0 0 24 24");
		icon.setAttribute("width", "18");
		icon.setAttribute("height", "18");
		icon.setAttribute("fill", "none");
		icon.setAttribute("stroke", "currentColor");
		icon.setAttribute("stroke-width", "2");
		icon.setAttribute("stroke-linecap", "round");
		icon.setAttribute("stroke-linejoin", "round");
		icon.setAttribute("aria-hidden", "true");
		for (const path of ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"]) {
			const element = document.createElementNS(SVG_NS, "path");
			element.setAttribute("d", path);
			icon.appendChild(element);
		}
		anchor.replaceChildren(icon);
		links.set(anchor, url.href);
		const intro = anchor.closest("div")?.querySelector("p");
		if (intro?.textContent?.trim() === LEGACY_INTRO) intro.textContent = labels.intro;
	}
	return links;
}

export async function startSharedAttachmentDownload(url: string): Promise<void> {
	const response = await fetch(url, { method: "HEAD", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer" });
	if (!response.ok) throw new Error(`Shared attachment is unavailable (${response.status})`);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = "";
	anchor.rel = "noreferrer";
	anchor.style.display = "none";
	document.body.appendChild(anchor);
	try {
		anchor.click();
	} finally {
		anchor.remove();
	}
}
