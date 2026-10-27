import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { listUserDomains } from "@/lib/domains/service";
import { getPrimaryAdminId, requireTeamAdmin } from "../utils";

/** Domains available when any admin creates an account. */
export async function GET(request: Request) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	const db = getDb(access.env);
	const ownerId = await getPrimaryAdminId(db);
	const domains = ownerId ? await listUserDomains(access.env, ownerId) : [];
	return NextResponse.json({ domains });
}
