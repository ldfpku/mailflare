"use client";

import clsx from "clsx";
import { useBranding } from "./branding-provider";

// Without an uploaded icon the SMJ symbol is shown on its own, with no tile behind it (BIS v1.5 B4, B8):
// the two-colour version on light themes, the reverse version (orange and white) on dark.
export function BrandIcon({ className, alt = "" }: { className?: string; alt?: string }) {
	const branding = useBranding();
	// 尺寸完全由调用方传入的 className（如 h-20 w-20）决定，且品牌图是矢量 SVG / 动态上传 URL，不经优化器；
	// next/image 需要已知宽高或带定位的父容器，这里改用它会破坏由 className 驱动的布局，故保留 <img>。
	// eslint-disable-next-line @next/next/no-img-element
	if (branding.hasCustomIcon) return <img src={branding.iconUrl} alt={alt} className={clsx("shrink-0 object-contain", className)} />;
	return (
		<span role={alt ? "img" : undefined} aria-label={alt || undefined} className={clsx("inline-flex shrink-0", className)}>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src="/brand/smj-symbol-color.svg" alt="" className="h-full w-full object-contain dark:hidden" />
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src="/brand/smj-symbol-reverse.svg" alt="" className="hidden h-full w-full object-contain dark:block" />
		</span>
	);
}
