/**
 * HuLa's client reads every API answer as `{ success, code, msg, data }` and
 * branches on `code`, not on the HTTP status: 200 succeeds, 406 makes it
 * refresh the access token and retry, 401 sends the user back to sign-in.
 */
export const IM_CODE = {
	OK: 200,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	TOKEN_EXPIRED: 406,
	CONFLICT: 409,
	MFA_REQUIRED: 428,
	TOO_MANY_REQUESTS: 429,
	NOT_IMPLEMENTED: 501,
	SERVICE_UNAVAILABLE: 503,
} as const;

export type ImCode = (typeof IM_CODE)[keyof typeof IM_CODE];

/** The message HuLa shows for a sign-in that needs the authenticator code; the client matches on it. */
export const IM_MFA_REQUIRED_MESSAGE = "MFA_REQUIRED";

const NO_STORE = { "Cache-Control": "no-store" };

export function imOk(data: unknown = null): Response {
	return Response.json({ success: true, code: IM_CODE.OK, msg: "ok", data }, { headers: NO_STORE });
}

export function imFail(code: ImCode, msg: string): Response {
	return Response.json({ success: false, code, msg, data: null }, { headers: NO_STORE });
}
