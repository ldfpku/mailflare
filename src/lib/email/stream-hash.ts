import { createHash } from "node:crypto";

export async function sha256Stream(stream: ReadableStream<Uint8Array>, expectedSize: number): Promise<string> {
	const hash = createHash("sha256");
	const reader = stream.getReader();
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > expectedSize) throw new Error("Attachment size does not match");
			hash.update(value);
		}
		if (size !== expectedSize) throw new Error("Attachment size does not match");
		return hash.digest("hex");
	} catch (error) {
		try { await reader.cancel(error); } catch (cancelError) { console.error("Could not cancel attachment stream", cancelError); }
		throw error;
	} finally {
		reader.releaseLock();
	}
}
