import { driveContentDisposition } from "@/lib/drive/utils";

export function getAttachmentContentDisposition(filename: string, inline: boolean): string {
	return driveContentDisposition(filename, inline);
}
