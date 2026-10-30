type Guard = { isUnsafe: () => boolean; onBlocked?: () => void };

const guards = new Set<Guard>();

declare global {
	interface Window {
		__smjMailNavigation?: { prepare: () => boolean; release: () => void };
	}
}

export function registerMailNavigationGuard(isUnsafe: () => boolean, onBlocked?: () => void) {
	const guard = { isUnsafe, onBlocked };
	guards.add(guard);
	return () => { guards.delete(guard); };
}

export function canLeaveMailEditor(notify = false) {
	let allowed = true;
	for (const guard of guards) {
		if (!guard.isUnsafe()) continue;
		allowed = false;
		if (notify) guard.onBlocked?.();
	}
	return allowed;
}

export function installMailNavigationGuard() {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let wasInert = false;
	let locked = false;
	const release = () => {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		if (locked) document.documentElement.inert = wasInert;
		locked = false;
	};
	const bridge = {
		prepare: () => {
			if (locked || !canLeaveMailEditor(true)) return false;
			wasInert = Boolean(document.documentElement.inert);
			document.documentElement.inert = true;
			locked = true;
			timer = setTimeout(release, 60_000);
			return true;
		},
		release,
	};
	window.__smjMailNavigation = bridge;
	return () => {
		release();
		if (window.__smjMailNavigation === bridge) delete window.__smjMailNavigation;
	};
}
