import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "斯米伽邮箱",
		short_name: "斯米伽邮箱",
		description: "斯米伽（SMJ）内部邮箱",
		start_url: "/inbox",
		display: "standalone",
		background_color: "#ffffff",
		theme_color: "#034FBC",
		icons: [
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/icon-512.png", sizes: "512x512", type: "image/png" },
		],
	};
}
