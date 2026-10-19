import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { canManageUsers, isPrimaryAdmin } from "@/lib/auth/admin";
import { parseBusinessCardInput } from "@/lib/business-card/card-utils";
import { businessCardOrigin, getBusinessCardSettings, saveBusinessCard } from "@/lib/business-card/service";
import { requireTeamAdmin } from "../../utils";
import type { AccountRouteParams } from "../types";
import { selectAccountById } from "../utils";

/** Admins keep the organisation's cards (title, department, phones) up to date from Accounts. */
export async function GET(request: Request, { params }: AccountRouteParams) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	const { id } = await params;
	const settings = await getBusinessCardSettings(access.env, id, businessCardOrigin(access.env, request));
	if (!settings) return NextResponse.json({ error: "Account not found" }, { status: 404 });
	return NextResponse.json(settings);
}

export async function PUT(request: Request, { params }: AccountRouteParams) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	const { id } = await params;
	const account = await selectAccountById(getDb(access.env), id);
	if (!account || account.deletedAt) return NextResponse.json({ error: "Account not found" }, { status: 404 });
	const actor = access.user!;
	if (!isPrimaryAdmin(actor) && !(canManageUsers(actor) && account.role === "user" && !account.isPrimaryAdmin)) {
		return NextResponse.json({ error: "You do not have permission to manage this account" }, { status: 403 });
	}
	const parsed = parseBusinessCardInput(await request.json().catch(() => null));
	if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
	const origin = businessCardOrigin(access.env, request);
	await saveBusinessCard(access.env, id, parsed.fields, origin);
	return NextResponse.json(await getBusinessCardSettings(access.env, id, origin));
}
