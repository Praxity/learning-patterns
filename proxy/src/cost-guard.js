import { hmac } from "./hash.js";
import { json } from "./http.js";
import { costNanoUsd, DEFAULT_MODEL } from "./prices.js";
import { clef } from "./clef.js";
import { readAnswers } from "./answers.js";
import { CAP_MESSAGES, DEFAULT_IP_DAILY_LIMIT, DEFAULT_DAILY_BUDGET_USD } from "./limits.js";

const DAY = 86_400_000;
const CACHE_TTL = 30 * DAY;
const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

export class CostGuard {
	constructor(ctx, env) {
		this.ctx = ctx;
		this.env = env;
		this.sql = ctx.storage.sql;
		this.sql.exec("CREATE TABLE IF NOT EXISTS results (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL)");
		this.sql.exec("CREATE INDEX IF NOT EXISTS results_expires ON results(expires)");
		this.sql.exec("CREATE TABLE IF NOT EXISTS ip_calls (day INTEGER NOT NULL, ip_hash TEXT NOT NULL, calls INTEGER NOT NULL, PRIMARY KEY(day, ip_hash))");
		this.sql.exec("CREATE TABLE IF NOT EXISTS spend (day INTEGER PRIMARY KEY, nano_usd INTEGER NOT NULL)");
		this.pending = new Map();
		// Only initial alarm setup holds the startup gate, never provider I/O.
		this.ready = ctx.blockConcurrencyWhile(async () => {
			if (await ctx.storage.getAlarm() === null) await ctx.storage.setAlarm((Math.floor(Date.now() / DAY) + 1) * DAY);
		});
	}

	async fetch(request) {
		await this.ready;
		const body = await request.json();
		if (typeof this.env.CACHE_KEY_SECRET !== "string" || this.env.CACHE_KEY_SECRET.length < 32) return json({ error: "Live checks are misconfigured." }, 503);
		const key = body.cache === false ? undefined : await hmac(this.env.CACHE_KEY_SECRET, JSON.stringify([body.model, body.state, body.questions]));
		// Identical in-flight requests share a charge; unrelated keys run independently.
		if (key && this.pending.has(key)) return (await this.pending.get(key)).clone();
		const call = this.ask(body, key).catch(() => json({ error: "Live checks are unavailable. Please try again later." }, 502));
		if (!key) return call;
		this.pending.set(key, call);
		try { return (await call).clone(); }
		finally { this.pending.delete(key); }
	}

	async ask({ model, state, questions, ipHash, networkHash, maxInputTokens }, key) {
		const now = Date.now();
		const day = Math.floor(now / DAY);
		this.cleanup(now);
		const saved = key && this.sql.exec("SELECT value FROM results WHERE key = ? AND expires > ?", key, now).toArray()[0];
		if (saved) return json({ ...JSON.parse(saved.value), questions, costUsd: 0 });
		const limit = Number(this.env.IP_DAILY_LIMIT ?? DEFAULT_IP_DAILY_LIMIT);
		if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(limit * 3) || limit < 1) return json({ error: "Invalid daily IP limit." }, 503);
		const budget = Math.floor(Number(this.env.DAILY_BUDGET_USD ?? DEFAULT_DAILY_BUDGET_USD) * 1e9);
		if (!Number.isSafeInteger(budget) || budget < 0) return json({ error: "Invalid daily budget." }, 503);
		const reservation = costNanoUsd(maxInputTokens, model);
		// Check and reserve both daily counters and spend in one transaction.
		// Persist the bound before external I/O.
		// A timeout or object restart keeps it charged, since the provider may have
		// billed a request we never heard back from.
		const refused = this.ctx.storage.transactionSync(() => {
			for (const [hash, cap] of [[ipHash, limit], [networkHash, limit * 3]]) {
				const calls = this.sql.exec("SELECT calls FROM ip_calls WHERE day = ? AND ip_hash = ?", day, hash).toArray()[0]?.calls ?? 0;
				if (calls >= cap) return json({ error: CAP_MESSAGES.ip_daily, reason: "ip_daily" }, 429);
			}
			const spent = this.sql.exec("SELECT nano_usd FROM spend WHERE day = ?", day).toArray()[0]?.nano_usd ?? 0;
			if (spent >= budget || reservation > budget - spent) return json({ error: CAP_MESSAGES.budget, reason: "budget" }, 429);
			if (model === DEFAULT_MODEL ? !this.env.AI : !this.env.JEV_API_KEY) return json({ error: "The model provider is not configured." }, 503);
			for (const hash of [ipHash, networkHash]) this.sql.exec("INSERT INTO ip_calls(day, ip_hash, calls) VALUES (?, ?, 1) ON CONFLICT(day, ip_hash) DO UPDATE SET calls = calls + 1", day, hash);
			this.sql.exec("INSERT INTO spend(day, nano_usd) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET nano_usd = nano_usd + excluded.nano_usd", day, reservation);
		});
		if (refused) return refused;
		const started = Date.now();
		let data;
		if (model === DEFAULT_MODEL) data = await clef(this.env.AI, model, state, questions);
		else {
			const response = await fetch(ENDPOINT, {
				method: "POST", headers: { authorization: `Bearer ${this.env.JEV_API_KEY}`, "content-type": "application/json" },
				body: JSON.stringify({ state, model, questions }), signal: AbortSignal.timeout(15_000),
			});
			if (!response.ok) throw new Error("Invalid model response");
			const responseData = await response.json();
			data = { answers: responseData.answers, tokens: responseData.usage?.input_tokens };
		}
		const tokens = data.tokens;
		const actual = costNanoUsd(tokens, model);
		if (tokens > maxInputTokens) throw new Error("Invalid model response");
		const result = { answers: readAnswers(data.answers, questions), ms: Date.now() - started, tokens, costUsd: actual / 1e9, model, mock: false };
		this.ctx.storage.transactionSync(() => {
			this.sql.exec("UPDATE spend SET nano_usd = nano_usd + ? WHERE day = ?", actual - reservation, day);
			if (key) this.sql.exec("INSERT OR REPLACE INTO results(key, value, expires) VALUES (?, ?, ?)", key, JSON.stringify(result), Date.now() + CACHE_TTL);
		});
		return json({ ...result, questions });
	}

	cleanup(now) {
		this.sql.exec("DELETE FROM results WHERE expires <= ?", now);
		this.sql.exec("DELETE FROM ip_calls WHERE day <= ?", Math.floor(now / DAY) - 2);
		this.sql.exec("DELETE FROM spend WHERE day <= ?", Math.floor(now / DAY) - 2);
	}

	async alarm() {
		this.cleanup(Date.now());
		await this.ctx.storage.setAlarm((Math.floor(Date.now() / DAY) + 1) * DAY);
	}
}
