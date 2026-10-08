import { hmac } from "./hash.js";
import { json } from "./http.js";
import { costNanoUsd, MAX_INPUT_TOKENS, DEFAULT_MODEL } from "./prices.js";
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
		this.sql.exec("CREATE TABLE IF NOT EXISTS ip_calls (day INTEGER NOT NULL, ip_hash TEXT NOT NULL, calls INTEGER NOT NULL, PRIMARY KEY(day, ip_hash))");
		this.sql.exec("CREATE TABLE IF NOT EXISTS spend (day INTEGER PRIMARY KEY, nano_usd INTEGER NOT NULL)");
	}

	async fetch(request) {
		const body = await request.json();
		if (typeof this.env.CACHE_KEY_SECRET !== "string" || this.env.CACHE_KEY_SECRET.length < 32) return json({ error: "Live checks are misconfigured." }, 503);
		const key = await hmac(this.env.CACHE_KEY_SECRET, JSON.stringify([body.model, body.state, body.questions]));
		return this.ctx.blockConcurrencyWhile(async () => {
			try { return await this.ask(body, key); }
			catch { return json({ error: "Live checks are unavailable. Please try again later." }, 502); }
		});
	}

	async ask({ model, state, questions, ipHash }, key) {
		const now = Date.now();
		const day = Math.floor(now / DAY);
		this.cleanup(now);
		await this.ctx.storage.setAlarm((day + 1) * DAY);
		const saved = this.sql.exec("SELECT value FROM results WHERE key = ? AND expires > ?", key, now).toArray()[0];
		if (saved) return json({ ...JSON.parse(saved.value), questions, costUsd: 0 });
		const limit = Number(this.env.IP_DAILY_LIMIT ?? DEFAULT_IP_DAILY_LIMIT);
		if (!Number.isSafeInteger(limit) || limit < 1) return json({ error: "Invalid daily IP limit." }, 503);
		const calls = this.sql.exec("SELECT calls FROM ip_calls WHERE day = ? AND ip_hash = ?", day, ipHash).toArray()[0]?.calls ?? 0;
		if (calls >= limit) return json({ error: CAP_MESSAGES.ip_daily, reason: "ip_daily" }, 429);
		const budget = Math.floor(Number(this.env.DAILY_BUDGET_USD ?? DEFAULT_DAILY_BUDGET_USD) * 1e9);
		if (!Number.isSafeInteger(budget) || budget < 0) return json({ error: "Invalid daily budget." }, 503);
		const spent = this.sql.exec("SELECT nano_usd FROM spend WHERE day = ?", day).toArray()[0]?.nano_usd ?? 0;
		const reservation = costNanoUsd(MAX_INPUT_TOKENS, model);
		if (spent >= budget || reservation > budget - spent) return json({ error: CAP_MESSAGES.budget, reason: "budget" }, 429);
		if (model === DEFAULT_MODEL ? !this.env.AI : !this.env.JEV_API_KEY) return json({ error: "The model provider is not configured." }, 503);
		// Persist the maximum charge before external I/O. A timeout or object restart
		// keeps it charged, since the provider may have billed a request we never heard back from.
		this.ctx.storage.transactionSync(() => {
			this.sql.exec("INSERT INTO ip_calls(day, ip_hash, calls) VALUES (?, ?, 1) ON CONFLICT(day, ip_hash) DO UPDATE SET calls = calls + 1", day, ipHash);
			this.sql.exec("INSERT INTO spend(day, nano_usd) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET nano_usd = nano_usd + excluded.nano_usd", day, reservation);
		});
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
		if (tokens > MAX_INPUT_TOKENS) throw new Error("Invalid model response");
		const result = { answers: readAnswers(data.answers, questions), ms: Date.now() - started, tokens, costUsd: actual / 1e9, model, mock: false };
		this.ctx.storage.transactionSync(() => {
			this.sql.exec("UPDATE spend SET nano_usd = nano_usd + ? WHERE day = ?", actual - reservation, day);
			this.sql.exec("INSERT OR REPLACE INTO results(key, value, expires) VALUES (?, ?, ?)", key, JSON.stringify(result), Date.now() + CACHE_TTL);
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
