type PendingSave = { save: () => Promise<void> };

export class DraftSaveQueue {
	private pending: PendingSave | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private running: Promise<void> | null = null;

	constructor(private reportError: (error: unknown) => void = (error) => console.error("Could not save draft", error)) {}

	setErrorReporter(reportError: (error: unknown) => void) {
		this.reportError = reportError;
	}

	get hasPending() {
		return this.pending !== null || this.running !== null;
	}

	get isSaving() {
		return this.running !== null;
	}

	schedule(save: () => Promise<void>, delay = 900) {
		this.pending = { save };
		this.clearTimer();
		this.timer = setTimeout(() => {
			this.timer = null;
			void this.flush().catch(this.reportError);
		}, delay);
	}

	flush(): Promise<void> {
		this.clearTimer();
		if (this.running) return this.running.then(() => this.flush());
		const operation = this.drain();
		this.running = operation;
		void operation.then(
			() => { if (this.running === operation) this.running = null; },
			() => { if (this.running === operation) this.running = null; },
		);
		return operation;
	}

	discardPending() {
		this.clearTimer();
		this.pending = null;
	}

	waitForRunning() {
		return this.running ?? Promise.resolve();
	}

	private clearTimer() {
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = null;
	}

	private async drain() {
		while (this.pending) {
			const current = this.pending;
			await current.save();
			if (this.pending === current) this.pending = null;
		}
	}
}
