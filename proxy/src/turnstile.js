const COOKIE = "live_clearance";
const HOUR = 3_600_000;
// Cloudflare's always-pass test secret returns a dummy hostname such as example.com.
const TEST_SECRET = "1x0000000000000000000000000000000AA";
const TEST_SECRETS = new Set([TEST_SECRET, "2x0000000000000000000000000000000AA", "3x0000000000000000000000000000000AA"]);
const encoder = new TextEncoder();
const hex = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");

async function signingKey(secret) {
	return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export function developmentMisconfigured(hostname, env) {
	return (env.JEV_MOCK === "1" || TEST_SECRETS.has(env.TURNSTILE_SECRET_KEY)) && !["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

export async function clearance(request, env, ipHash) {
	if (developmentMisconfigured(new URL(request.url).hostname, env)) return { status: 503, error: "Live checks are misconfigured." };
	if (env.JEV_MOCK === "1") return {};
	if (!env.TURNSTILE_SECRET_KEY || typeof env.COOKIE_SIGNING_KEY !== "string" || env.COOKIE_SIGNING_KEY.length < 32 || !ipHash) return { status: 503, error: "Live checks are misconfigured." };
	const key = await signingKey(env.COOKIE_SIGNING_KEY);
	const value = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
	if (value) {
		const [expiry, prefixHash, signature] = value.split(".");
		const expires = Number(expiry);
		if (/^\d+\.[0-9a-f]{64}\.[0-9a-f]{64}$/.test(value) && prefixHash === ipHash && Number.isSafeInteger(expires) && expires > Date.now() && expires <= Date.now() + HOUR) {
			const bytes = Uint8Array.from(signature.match(/../g), (pair) => parseInt(pair, 16));
			if (await crypto.subtle.verify("HMAC", key, bytes, encoder.encode(`${COOKIE}.${expiry}.${prefixHash}`))) return {};
		}
	}
	const token = request.headers.get("x-turnstile-token");
	if (!token || token.length > 2048) return { status: 403, reason: "turnstile", error: "Live checks need Turnstile. Please reload and try again." };
	try {
		const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
			method: "POST", headers: { "content-type": "application/json" },
			body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
			signal: AbortSignal.timeout(5000),
		});
		const result = await response.json();
		const hostnameMatches = result.hostname === new URL(request.url).hostname || env.TURNSTILE_SECRET_KEY === TEST_SECRET;
		if (!response.ok || result.success !== true || !hostnameMatches) return { status: 403, reason: "turnstile", error: "Live checks need Turnstile. Please reload and try again." };
	} catch {
		return { status: 503, reason: "turnstile", error: "Turnstile is unavailable. Please reload and try again." };
	}
	const expiry = String(Date.now() + HOUR);
	const signature = hex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${COOKIE}.${expiry}.${ipHash}`)));
	return { cookie: `${COOKIE}=${expiry}.${ipHash}.${signature}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=3600` };
}
