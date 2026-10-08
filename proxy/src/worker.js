import { blocks } from "./registry.js";
import { clearance, developmentMisconfigured } from "./turnstile.js";
import { sha256 } from "./hash.js";
import { json } from "./http.js";
import { DEFAULT_MODEL, JEV_MODEL, browserPrices } from "./prices.js";
import { CAP_MESSAGES } from "./limits.js";
import { noticeConfig } from "../../lib/data-notice.js";
export { CostGuard } from "./cost-guard.js";

const MAX_FIELD = 2000;
const MAX_BODY_BYTES = 16 * 1024;

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (!url.pathname.startsWith("/api/patterns/")) return env.ASSETS.fetch(request);
		if (url.pathname === "/api/patterns/prices.js") return new Response(browserPrices(), { headers: { "content-type": "text/javascript; charset=utf-8", "x-content-type-options": "nosniff" } });
		if (url.pathname === "/api/patterns/limits.js") return new Response(`export const CAP_MESSAGES = Object.freeze(${JSON.stringify(CAP_MESSAGES)});`, { headers: { "content-type": "text/javascript; charset=utf-8", "x-content-type-options": "nosniff" } });
		if (developmentMisconfigured(url.hostname, env)) return json({ error: "Live checks are misconfigured." }, 503);
		const provider = env.MODEL_PROVIDER ?? "clef";
		if (provider !== "clef" && provider !== "jev") return json({ error: "Invalid model provider." }, 503);
		const model = provider === "clef" ? DEFAULT_MODEL : JEV_MODEL;
		if (url.pathname === "/api/patterns/config") return json({ mock: env.JEV_MOCK === "1", siteKey: env.TURNSTILE_SITE_KEY ?? "", provider, model, ...noticeConfig(provider) });
		if (url.pathname !== "/api/patterns/ask") return json({ error: "Not found" }, 404);
		if (request.method !== "POST") return json({ error: "POST only" }, 405);
		if (env.JEV_MOCK !== "1" && ["COOKIE_SIGNING_KEY", "IP_SALT", "CACHE_KEY_SECRET"].some(key => typeof env[key] !== "string" || env[key].length < 32)) return json({ error: "Live checks are misconfigured." }, 503);
		const ip = ipKey(request.headers.get("cf-connecting-ip") ?? "local");
		if (env.LIMITER) {
			const { success } = await env.LIMITER.limit({ key: ip });
			if (!success) return json({ error: "Too many requests. Wait a minute and try again." }, 429);
		}
		const ipHash = env.JEV_MOCK === "1" ? undefined : await sha256(JSON.stringify([env.IP_SALT, ip]));
		const networkHash = env.JEV_MOCK === "1" ? undefined : await sha256(JSON.stringify([env.IP_SALT, ipKey(request.headers.get("cf-connecting-ip") ?? "local", 48)]));
		const verified = await clearance(request, env, ipHash);
		if (verified.error) return json({ error: verified.error, reason: verified.reason }, verified.status);
		const reply = (value, status = 200) => {
			const response = json(value, status);
			if (verified.cookie) response.headers.set("set-cookie", verified.cookie);
			return response;
		};

		let body;
		if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return reply({ error: "Body is too large" }, 413);
		const reader = request.body?.getReader();
		try {
			const decoder = new TextDecoder();
			let text = "", bytes = 0;
			if (reader) while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				bytes += value.byteLength;
				if (bytes > MAX_BODY_BYTES) {
					await reader.cancel();
					return reply({ error: "Body is too large" }, 413);
				}
				text += decoder.decode(value, { stream: true });
			}
			body = JSON.parse(text + decoder.decode());
		} catch { return reply({ error: "Body must be JSON" }, 400); }
		finally { reader?.releaseLock(); }
		const result = buildRequest(body, provider);
		if (result.error) return reply({ error: result.error }, 400);

		if (env.JEV_MOCK === "1") return json({ ...mockAnswers(result.questions), ms: 0, tokens: 0, mock: true });
		if (!env.COST_GUARD) return reply({ error: "Live checks are not configured yet." }, 503);
		try {
			const response = await env.COST_GUARD.get(env.COST_GUARD.idFromName("public-demos")).fetch(new Request("https://guard/ask", {
				method: "POST", body: JSON.stringify({ ...result, model, ipHash, networkHash }),
			}));
			const outgoing = new Response(response.body, response);
			if (verified.cookie) outgoing.headers.set("set-cookie", verified.cookie);
			return outgoing;
		} catch { return reply({ error: "Live checks are unavailable. Please try again later." }, 503); }
	},
};

function ipKey(ip, bits = 64) {
	if (!ip.includes(":")) return bits === 48 ? `${ip.split('.').slice(0, 3).join('.')}.0/24` : ip;
	// URL canonicalises compressed, uppercase and embedded-IPv4 IPv6 spellings.
	const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
	const [left, right = []] = canonical.split("::").map(part => part ? part.split(":") : []);
	const groups = canonical.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
	if (groups.slice(0, 5).every(part => parseInt(part, 16) === 0) && parseInt(groups[5], 16) === 0xffff) {
		const bytes = groups.slice(6).flatMap(part => [parseInt(part, 16) >> 8, parseInt(part, 16) & 255]);
		return ipKey(bytes.join('.'), bits);
	}
	return `${groups.slice(0, bits / 16).map(part => part.padStart(4, "0")).join(":")}::/${bits}`;
}

// Exported for tests. The client names a block and sends plain text fields; the questions
// always come from the server, so the key can't be used for arbitrary prompts.
export function buildRequest(body, provider = 'clef') {
	if (typeof body !== "object" || body === null || Array.isArray(body)) return { error: "Body must be an object" };
	if (typeof body.block !== "string" || !Object.hasOwn(blocks, body.block)) return { error: "Unknown block" };
	if (Object.keys(body).some(key => key !== "block" && key !== "fields")) return { error: "Unexpected request field" };
	const demo = blocks[body.block];
	const input = body.fields;
	if (typeof input !== "object" || input === null || Array.isArray(input)) return { error: "fields must be an object" };
	for (const [key, value] of Object.entries(input)) {
		if (!Object.hasOwn(demo.fields, key)) return { error: "Unexpected field" };
		if (typeof value !== "string") return { error: `${key} must be text` };
		if (value.length > Math.min(demo.fields[key], MAX_FIELD)) return { error: `${key} is too long` };
	}
	for (const key of Object.keys(demo.fields)) if (!Object.hasOwn(input, key)) return { error: `Missing field: ${key}` };
	try {
		const { state, questions } = demo.build(input);
		return { state, questions: provider === 'clef' ? demo.clefQuestions ?? questions : questions, maxInputTokens: demo.maxInputTokens, cache: demo.cache !== false };
	} catch (error) {
		return { error: error instanceof Error ? error.message : "Bad input" };
	}
}

// Local UI work without a key. Answers are fake and the page says so.
function mockAnswers(questions) {
	const answers = {};
	for (const [id, q] of Object.entries(questions)) {
		const r = Math.random();
		if (q.type === "noul") answers[id] = { noul: r };
		else if (q.type === "choice") {
			const keys = Object.keys(q.criteria);
			const choice = keys[Math.floor(r * keys.length)];
			answers[id] = { choice, confidence: 0.5, probabilities: Object.fromEntries(keys.map((k) => [k, k === choice ? 0.6 : 0.4 / Math.max(1, keys.length - 1)])) };
		} else if (q.type === "score") {
			const n = q.criteria.length;
			const level = Math.floor(r * n);
			answers[id] = { score: level, confidence: 0.5, probabilities: Object.fromEntries(q.criteria.map((_, i) => [String(i), i === level ? 1 : 0])), legend: Object.fromEntries(q.criteria.map((c, i) => [String(i), c])) };
		}
	}
	return { answers, questions };
}
