export type BusinessCardPlacement = "hq" | "field";

/** The fields a person (or an admin for them) edits. */
export interface BusinessCardFields {
	title: string;
	department: string;
	nameEn: string;
	titleEn: string;
	mobile: string;
	phone: string;
	placement: BusinessCardPlacement;
	published: boolean;
}

/** Everything a card face, a vCard or a signature is drawn from. */
export interface BusinessCardData extends BusinessCardFields {
	name: string;
	email: string;
}

/** What `/api/public/card/<token>` returns. */
export interface PublicBusinessCard extends Omit<BusinessCardData, "published"> {
	avatarUrl: string;
	pageUrl: string;
	vcfUrl: string;
	qrSvg: string;
}

/** What the settings page and the admin tab load. */
export interface BusinessCardSettings {
	card: BusinessCardData;
	userId: string;
	pageUrl: string;
	vcfUrl: string;
	qrSvg: string;
	avatarUrl: string;
	signatureHtml: string;
	/** Mailboxes the signature can go on, and whether each carries the current card signature. */
	mailboxes: { id: string; address: string; usesCardSignature: boolean; hasOtherSignature: boolean }[];
}
