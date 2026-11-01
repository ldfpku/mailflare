"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { ProgressiveAvatarImage } from "@/components/progressive-avatar-image";
import { getAvatarColorStyle } from "@/lib/avatar-colors";
import type { BookingHostAvatarProps } from "./types";

export function BookingHostAvatar({ host, currentUserId, size = "medium" }: BookingHostAvatarProps) {
	const { t } = useLanguage();
	const [imageFailed, setImageFailed] = useState(false);
	// 头像主体（host）变化时在渲染期重置失败标记，避免用 effect 造成额外渲染（React 官方「渲染期 setState + 前值比较」模式）。
	const [avatarKey, setAvatarKey] = useState(`${host.id}:${host.hasAvatar}`);
	const nextAvatarKey = `${host.id}:${host.hasAvatar}`;
	if (avatarKey !== nextAvatarKey) {
		setAvatarKey(nextAvatarKey);
		setImageFailed(false);
	}
	const imageUrl = host.id === currentUserId ? "/api/profile/avatar" : `/api/accounts/${host.id}/avatar`;
	const sizeClass = size === "small" ? "h-5 w-5 text-[10px]" : "h-8 w-8 text-sm";
	if (host.hasAvatar && !imageFailed) return <ProgressiveAvatarImage src={imageUrl} alt={t("account.profilePicture", { name: host.name || host.email })} className={`${sizeClass} shrink-0 rounded-full border border-neutral-200 object-cover`} onError={() => setImageFailed(true)} />;
	return <span aria-hidden="true" className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full font-semibold`} style={getAvatarColorStyle(host.email)}>{(host.name || host.email).slice(0, 1).toUpperCase()}</span>;
}
