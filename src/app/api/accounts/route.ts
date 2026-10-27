import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { createUserAccountSchema } from "@/lib/validators";
import { deleteAccounts } from "@/lib/accounts/deletion";
import { createAccountResponse } from "./create";
import { accountListItemFromUser, listAccountsForAdmin, requireTeamAdmin } from "./utils";

export async function GET(request: Request) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	const rows = await listAccountsForAdmin(getDb(access.env));
	return NextResponse.json({
		accounts: rows.map((row) => accountListItemFromUser(row)),
	});
}

export async function POST(request: Request) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	const parsed = createUserAccountSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}
	return createAccountResponse(access.env, access.user!.id, parsed.data);
}

export async function DELETE(request: Request) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	const body = (await request.json().catch(() => null)) as { ids?: unknown; transferToId?: unknown; permanent?: unknown } | null;
	const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string" && !!id) : [];
	const transferToId = typeof body?.transferToId === "string" ? body.transferToId : null;
	const permanent = body?.permanent === true;
	const result = await deleteAccounts(access.env, access.user!, { ids, transferToId, permanent });
	if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
	return NextResponse.json({ ok: true, deleted: result.deleted });
}
