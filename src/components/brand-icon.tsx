"use client";

import clsx from "clsx";
import { useBranding } from "./branding-provider";

// Without an uploaded icon the SMJ symbol is shown on its own, with no tile behind it (BIS v1.5 B4, B8):
// the two-colour version on light themes, the reverse version (orange and white) on dark.
export function BrandIcon({ className, alt = "" }: { className?: string; alt?: string }) {
	const branding = useBranding();
	if (branding.hasCustomIcon) return <img src={branding.iconUrl} alt={alt} className={clsx("shrink-0 object-contain", className)} />;
	return (
		<span role={alt ? "img" : undefined} aria-label={alt || undefined} className={clsx("inline-flex shrink-0", className)}>
			<img src="/brand/smj-symbol-color.svg" alt="" className="h-full w-full object-contain dark:hidden" />
			<img src="/brand/smj-symbol-reverse.svg" alt="" className="hidden h-full w-full object-contain dark:block" />
		</span>
	);
}
