import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.js";
import { DatabaseSync } from "node:sqlite";
import { blocks as demos } from "../src/registry.js";
import { CostGuard } from "../src/cost-guard.js";
import { buildRequest } from "../src/worker.js";

function setup(t) {
	const calls = { verify: 0, model: 0, limiter: 0, inputTokens: 1000, fail: false, hostname: "demo.example", status: 200, verifyFails: false };
	let now = Date.parse("2026-10-07T12:00:00Z");
	t.mock.method(Date, "now", () => now);
	t.mock.method(globalThis, "fetch", async (url, options) => {
		if (String(url).includes("siteverify")) {
			calls.verify++;
			if (calls.verifyFails) throw new Error("siteverify is down");
			const body = JSON.parse(options.body);
			assert.equal(body.secret, env.TURNSTILE_SECRET_KEY);
			return Response.json({ success: body.response === "XXXX.DUMMY.TOKEN.XXXX", hostname: calls.hostname });
		}
		calls.model++;
		calls.modelBody = options.body;
		if (calls.fail) throw new Error("provider timed out after billing");
		return Response.json({ answers: Object.fromEntries(Object.keys(JSON.parse(options.body).questions).map(key => [key, { noul: 0.9 }])), usage: { input_tokens: calls.inputTokens } }, { status: calls.status });
	});
	const env = {
		MODEL_PROVIDER: "jev",
		JEV_API_KEY: "test-key",
		TURNSTILE_SECRET_KEY: "production-secret",
		COOKIE_SIGNING_KEY: "test-cookie-key-with-at-least-32-bytes",
		IP_SALT: "test-ip-salt-with-at-least-32-bytes",
		CACHE_KEY_SECRET: "test-cache-key-with-at-least-32-bytes",
		LIMITER: { limit: async () => { calls.limiter++; return { success: true }; } },
	};
	const db = new DatabaseSync(":memory:");
	const writes = [];
	t.after(() => db.close());
	let object;
	let gate = Promise.resolve();
	env.COST_GUARD = {
		idFromName: (name) => name,
		get: () => ({ fetch: async (request) => {
			if (!object) {
				object = new CostGuard({
					storage: {
						sql: { exec: (query, ...params) => {
							if (/^(INSERT|UPDATE|CREATE|DELETE)/.test(query)) writes.push([query, ...params]);
							const statement = db.prepare(query);
							const rows = statement.columns().length ? statement.all(...params) : (statement.run(...params), []);
							return { toArray: () => rows };
						} },
						transactionSync: (fn) => {
							db.exec("BEGIN");
							try { const result = fn(); db.exec("COMMIT"); return result; }
							catch (error) { db.exec("ROLLBACK"); throw error; }
						},
						getAlarm: async () => calls.alarmAt ?? null,
						setAlarm: async (at) => { calls.alarmAt = at; calls.alarms = (calls.alarms ?? 0) + 1; },
					},
					blockConcurrencyWhile: (fn) => {
						const next = gate.then(fn);
						gate = next.catch(() => {});
						return next;
					},
				}, env);
			}
			return object.fetch(request);
		} }),
	};
	const ask = ({ token = "XXXX.DUMMY.TOKEN.XXXX", cookie, ip = "192.0.2.1", answer = "hello", block = "16-fixtures", fields, host = "demo.example", body, headers = {} } = {}) => worker.fetch(new Request(`https://${host}/api/patterns/ask`, {
		method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(token ? { "x-turnstile-token": token } : {}), ...(cookie ? { cookie } : {}), ...headers },
		body: body ?? JSON.stringify({ block, fields: fields ?? { answer } }),
		...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
	}), env);
	return { env, calls, ask, db, writes, advance: (ms) => { now += ms; } };
}

test("Turnstile refuses missing or bad tokens after the limiter and before model work", async (t) => {
	const s = setup(t);
	assert.equal((await s.ask({ token: null })).status, 403);
	assert.equal((await s.ask({ token: "bad" })).status, 403);
	assert.equal(s.calls.model, 0);
	assert.equal(s.calls.limiter, 2);
});

test("oversized tokens and unavailable siteverify fail before model work", async (t) => {
	const s = setup(t);
	assert.equal((await s.ask({ token: "x".repeat(2049) })).status, 403);
	assert.equal(s.calls.verify, 0);
	s.calls.verifyFails = true;
	const unavailable = await s.ask();
	assert.equal(unavailable.status, 503);
	assert.equal((await unavailable.json()).reason, "turnstile");
	assert.equal(s.calls.model, 0);
	assert.equal(s.calls.limiter, 2);
});

test("missing guard configuration and invalid limits cannot start a model call", async (t) => {
	const s = setup(t);
	const configurations = [
		["TURNSTILE_SECRET_KEY", ""], ["COOKIE_SIGNING_KEY", ""], ["IP_SALT", ""],
		["COST_GUARD", null], ["IP_DAILY_LIMIT", "invalid"], ["IP_DAILY_LIMIT", "0"],
		["IP_DAILY_LIMIT", "1.3333333333333333"], ["IP_DAILY_LIMIT", String(Number.MAX_SAFE_INTEGER)],
		["DAILY_BUDGET_USD", "invalid"], ["DAILY_BUDGET_USD", "-1"], ["JEV_API_KEY", ""],
	];
	for (const [key, value] of configurations) {
		const original = s.env[key];
		s.env[key] = value;
		assert.equal((await s.ask()).status, 503, key);
		s.env[key] = original;
	}
	s.env.DAILY_BUDGET_USD = "0";
	assert.equal((await s.ask()).status, 429);
	assert.equal(s.calls.model, 0);
});

test("unknown or invalid billed usage keeps the reservation and never caches answers", async (t) => {
	const s = setup(t);
	s.env.DAILY_BUDGET_USD = "0.000344064";
	for (const tokens of [undefined, null, -1, 0.5, 8193]) {
		s.calls.inputTokens = tokens;
		assert.equal((await s.ask({ answer: `bad usage ${tokens}` })).status, 502);
		const retry = await s.ask({ answer: `bad usage ${tokens}` });
		assert.equal(retry.status, 429);
		assert.equal((await retry.json()).reason, "budget");
		s.advance(86_400_000);
	}
	assert.equal(s.calls.model, 5);
});

test("upstream HTTP failure keeps its charge; the existing minute limiter still refuses work", async (t) => {
	const s = setup(t);
	s.env.DAILY_BUDGET_USD = "0.000344064";
	s.calls.status = 500;
	assert.equal((await s.ask()).status, 502);
	assert.equal((await s.ask({ answer: "retry" })).status, 429);
	s.env.LIMITER = { limit: async () => ({ success: false }) };
	const limited = await s.ask({ answer: "rate limited" });
	assert.equal(limited.status, 429);
	assert.match((await limited.json()).error, /Wait a minute/);
	assert.equal(s.calls.model, 1);
});

test("changing the secret salt changes the IP identity without changing the client IP", async (t) => {
	const s = setup(t);
	s.env.IP_DAILY_LIMIT = "1";
	assert.equal((await s.ask()).status, 200);
	assert.equal((await s.ask({ answer: "second" })).status, 429);
	s.env.IP_SALT = "another test salt with at least 32 bytes";
	assert.equal((await s.ask({ answer: "second" })).status, 200);
	assert.equal(s.calls.model, 2);
});

test("official test keys accept their dummy hostname, while production keys require this hostname", async (t) => {
	const s = setup(t);
	s.calls.hostname = "example.com";
	s.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
	assert.equal((await s.ask({ host: "localhost" })).status, 200);
	s.env.TURNSTILE_SECRET_KEY = "production-secret";
	assert.equal((await s.ask()).status, 403);
	assert.equal(s.calls.model, 1);
});

test("calls starting at the daily budget are refused, including after uncertain billing", async (t) => {
	const s = setup(t);
	s.env.DAILY_BUDGET_USD = "0.000344064";
	s.calls.inputTokens = 8192;
	assert.equal((await s.ask()).status, 200);
	const blocked = await s.ask({ answer: "other", ip: "192.0.2.2" });
	assert.equal(blocked.status, 429);
	assert.equal((await blocked.json()).reason, "budget");
	assert.equal(s.calls.model, 1);
	assert.equal((await s.ask()).status, 200); // Saved results survive exhausted budgets.
	s.advance(86_400_000);
	s.calls.fail = true;
	assert.equal((await s.ask({ answer: "timeout" })).status, 502);
	const retry = await s.ask({ answer: "retry" });
	assert.equal(retry.status, 429);
	assert.equal((await retry.json()).reason, "budget");
	assert.equal(s.calls.model, 2);
});

test("actual billed input tokens settle the reservation at the list price", async (t) => {
	const s = setup(t);
	s.env.DAILY_BUDGET_USD = "0.00039";
	assert.equal((await (await s.ask()).json()).costUsd, 0.000042);
	assert.equal((await s.ask({ answer: "second" })).status, 200);
	assert.equal((await s.ask({ answer: "third" })).status, 429);
	assert.equal(s.calls.model, 2);
});

test("identical requests use saved answers and spend neither IP calls nor money", async (t) => {
	const s = setup(t);
	s.env.IP_DAILY_LIMIT = "1";
	const first = await (await s.ask()).json();
	const second = await s.ask();
	assert.equal(second.status, 200);
	const saved = await second.json();
	assert.equal(saved.costUsd, 0);
	assert.deepEqual(saved.answers, first.answers);
	assert.equal(saved.costUsd, 0);
	assert.equal(s.calls.model, 1);
	assert.equal((await s.ask({ answer: "other" })).status, 429);
	assert.equal((await s.ask({ ip: "192.0.2.2" })).status, 200);
});

test("a cached request leaves both the remaining IP call and budget available", async (t) => {
	const s = setup(t);
	s.env.IP_DAILY_LIMIT = "2";
	s.env.DAILY_BUDGET_USD = "0.00039";
	assert.equal((await s.ask()).status, 200);
	assert.equal((await (await s.ask()).json()).costUsd, 0);
	assert.equal((await s.ask({ answer: "second live" })).status, 200);
	const third = await s.ask({ answer: "third live" });
	assert.equal(third.status, 429);
	assert.equal((await third.json()).reason, "ip_daily");
	assert.equal(s.calls.model, 2);
});

test("concurrent fresh calls from different IPs cannot overspend the global budget", async (t) => {
	const s = setup(t);
	s.env.DAILY_BUDGET_USD = "0.000344064";
	s.calls.inputTokens = 8192;
	const responses = await Promise.all([s.ask({ answer: "one" }), s.ask({ answer: "two", ip: "192.0.2.2" })]);
	assert.deepEqual(responses.map((response) => response.status).sort(), [200, 429]);
	const blocked = responses.find((response) => response.status === 429);
	assert.equal((await blocked.json()).reason, "budget");
	assert.equal(s.calls.model, 1);
});

test("a signed one-hour cookie skips siteverify; tampering and expiry do not", async (t) => {
	const s = setup(t);
	const first = await s.ask();
	assert.equal(first.status, 200);
	const setCookie = first.headers.get("set-cookie");
	assert.match(setCookie ?? "", /HttpOnly/);
	assert.match(setCookie, /SameSite=Strict/);
	assert.match(setCookie, /Secure/);
	assert.match(setCookie, /Max-Age=3600/);
	const cookie = setCookie.split(";")[0];
	assert.equal((await s.ask({ cookie, token: null })).status, 200);
	assert.equal(s.calls.verify, 1);
	assert.equal((await s.ask({ cookie: cookie + "x", token: null })).status, 403);
	assert.equal((await s.ask({ cookie: cookie + ".extra", token: null })).status, 403);
	s.advance(3_600_000);
	assert.equal((await s.ask({ cookie, token: null })).status, 403);
});

test("a same-size state or question edit in the same second misses; restoration uses the original cache", async (t) => {
	const s = setup(t);
	await s.ask({ answer: "aaaa" });
	assert.equal((await (await s.ask({ answer: "bbbb" })).json()).costUsd, 0.000042);
	const original = demos["16-fixtures"].build;
	const changed = t.mock.method(demos["16-fixtures"], "build", (input) => {
		const result = original(input);
		const text = result.questions.sincere.instructions.question;
		result.questions.sincere.instructions.question = text.slice(0, -1) + "!";
		return result;
	});
	assert.equal((await (await s.ask({ answer: "aaaa" })).json()).costUsd, 0.000042);
	changed.mock.restore();
	assert.equal((await (await s.ask({ answer: "aaaa" })).json()).costUsd, 0);
	assert.equal(s.calls.model, 3);
});

test("the default 21st live call is refused, another IP works, and midnight UTC resets", async (t) => {
	const s = setup(t);
	for (let i = 0; i < 20; i++) assert.equal((await s.ask({ answer: `call ${i}` })).status, 200);
	const blocked = await s.ask({ answer: "21st" });
	assert.equal(blocked.status, 429);
	assert.equal((await blocked.json()).reason, "ip_daily");
	assert.equal((await s.ask({ answer: "different IP", ip: "192.0.2.2" })).status, 200);
	s.advance(12 * 3_600_000);
	assert.equal((await s.ask({ answer: "new day" })).status, 200);
	assert.equal(s.calls.model, 22);
});

for (const [family, ips, other] of [
  ['IPv4 /24', ['192.0.2.1', '192.0.2.2', '192.0.2.255', '192.0.2.3'], '192.0.3.1'],
  ['IPv6 /48', ['2001:db8:1:1::1', '2001:0DB8:0001:0002::1', '2001:db8:1:ffff::1', '2001:db8:1:3::1'], '2001:db8:2:1::1'],
]) {
  test(`${family} shares a three-times daily cap without charging refused calls`, async (t) => {
    const s = setup(t);
    s.env.IP_DAILY_LIMIT = '2';
    for (const [index, ip] of ips.slice(0, 3).entries()) {
      for (let call = 0; call < 2; call++) assert.equal((await s.ask({ ip, answer: `${index}-${call}` })).status, 200);
    }
    const before = s.db.prepare('SELECT * FROM ip_calls ORDER BY ip_hash').all();
    const spend = s.db.prepare('SELECT * FROM spend').all();
    const blocked = await s.ask({ ip: ips[3], answer: 'over network cap' });
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).reason, 'ip_daily');
    assert.deepEqual(s.db.prepare('SELECT * FROM ip_calls ORDER BY ip_hash').all(), before);
    assert.deepEqual(s.db.prepare('SELECT * FROM spend').all(), spend);
    assert.deepEqual(before.map(row => row.calls).sort(), [2, 2, 2, 6]);
    assert.equal(s.calls.model, 6);
    assert.equal((await s.ask({ ip: other, answer: 'another network' })).status, 200);
    s.advance(12 * 3_600_000);
    assert.equal((await s.ask({ ip: ips[3], answer: 'network reset' })).status, 200);
  });
}

for (const cap of ['IP', 'network']) {
  test(`concurrent fresh calls atomically reserve both counters at the ${cap} cap`, async (t) => {
    const s = setup(t);
    s.env.IP_DAILY_LIMIT = '1';
    if (cap === 'network') {
      await s.ask({ ip: '192.0.2.10', answer: 'prime one' });
      await s.ask({ ip: '192.0.2.11', answer: 'prime two' });
    }
    const responses = await Promise.all([1, 2, 3].map(i => s.ask({ ip: cap === 'IP' ? '192.0.2.1' : `192.0.2.${i}`, answer: `concurrent ${i}` })));
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 429, 429]);
    const expected = cap === 'IP' ? 1 : 3;
    assert.equal(s.calls.model, expected);
    assert.deepEqual(s.db.prepare('SELECT calls FROM ip_calls ORDER BY calls').all().map(row => row.calls), cap === 'IP' ? [1, 1] : [1, 1, 1, 3]);
    assert.equal(s.db.prepare('SELECT nano_usd FROM spend').get().nano_usd, expected * 42000);
  });
}

test('a failed counter write rolls back both daily counters and the budget reservation', async (t) => {
  const s = setup(t);
  await s.ask();
  s.db.exec('DELETE FROM results; DELETE FROM ip_calls; DELETE FROM spend');
  s.db.exec(`CREATE TRIGGER reject_second_counter BEFORE INSERT ON ip_calls
    WHEN (SELECT count(*) FROM ip_calls) = 1 BEGIN SELECT RAISE(ABORT, 'storage failure'); END`);
  assert.equal((await s.ask({ answer: 'storage failure' })).status, 502);
  assert.equal(s.calls.model, 1);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM ip_calls').get().n, 0);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM spend').get().n, 0);
  s.db.exec('DROP TRIGGER reject_second_counter');
  assert.equal((await s.ask({ answer: 'retry storage' })).status, 200);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM ip_calls').get().n, 2);
});

test('IPv4-mapped IPv6 uses its embedded IPv4 for clearance and both caps', async (t) => {
  const s = setup(t);
  s.env.IP_DAILY_LIMIT = '1';
  const keys = [];
  s.env.LIMITER = { limit: async ({ key }) => { keys.push(key); return { success: true }; } };
  const first = await s.ask({ ip: '::ffff:198.51.100.7' });
  const cookie = first.headers.get('set-cookie').split(';')[0];
  for (const ip of ['198.51.100.7', '::FFFF:c633:6407', '0:0:0:0:0:ffff:c633:6407']) {
    assert.equal((await s.ask({ ip, cookie, token: null })).status, 200);
    assert.equal((await s.ask({ ip, cookie, token: null, answer: 'over IP cap' })).status, 429);
  }
  assert.deepEqual([...new Set(keys)], ['198.51.100.7']);
  assert.equal((await s.ask({ ip: '::ffff:203.0.113.9', cookie, token: null })).status, 403);
  assert.equal((await s.ask({ ip: '::ffff:203.0.113.9', answer: 'unrelated mapped IP' })).status, 200);
  for (const ip of ['::ffff:198.51.100.8', '198.51.100.255']) assert.equal((await s.ask({ ip, answer: ip })).status, 200);
  assert.equal((await s.ask({ ip: '::ffff:198.51.100.9', answer: 'over mapped network cap' })).status, 429);
  assert.equal((await s.ask({ ip: '::fffe:198.51.100.7', answer: 'ordinary IPv6' })).status, 200);
});

test("cache entries expire after 30 days", async (t) => {
	const s = setup(t);
	assert.equal((await s.ask()).status, 200);
	assert.equal(s.calls.model, 1);
	s.advance(30 * 86_400_000 - 1);
	assert.equal((await (await s.ask()).json()).costUsd, 0);
	s.advance(1);
	assert.equal((await (await s.ask()).json()).costUsd, 0.000042);
	assert.equal(s.calls.model, 2);
});

test('concurrent identical calls share one charge while the first model call is stalled', async (t) => {
  const s = setup(t);
  s.env.MODEL_PROVIDER = 'clef';
  let release, started;
  const entered = new Promise(resolve => { started = resolve; });
  const stalled = new Promise(resolve => { release = resolve; });
  s.env.AI = { run: async (_model, { questions }) => {
    s.calls.model++;
    if (s.calls.model === 1) { started(); await stalled; }
    return { answers: Object.fromEntries(Object.keys(questions).map(key => [key, { noul: 0.9 }])), usage: { input_tokens: 1000 } };
  } };
  const first = s.ask();
  await entered;
  const second = s.ask({ ip: '192.0.2.2' });
  let timer;
  try {
    const early = await Promise.race([second, new Promise(resolve => { timer = setTimeout(() => resolve(null), 100); })]);
    assert.equal(early, null, 'the identical follower must wait for the first model call');
    assert.equal(s.calls.model, 1);
  } finally {
    clearTimeout(timer);
    release();
    const responses = await Promise.all([first, second]);
    assert.deepEqual(responses.map(response => response.status), [200, 200]);
  }
  assert.equal(s.calls.model, 1);
  assert.deepEqual(s.db.prepare('SELECT calls FROM ip_calls').all().map(row => row.calls), [1, 1]);
  assert.equal(s.db.prepare('SELECT nano_usd FROM spend').get().nano_usd, 240000);
});

for (const provider of ['perplexity', 'clef', 'jev']) {
  test(`${provider} journal responses always make independent live calls, including identical in-flight text`, async (t) => {
    const s = setup(t);
    s.env.MODEL_PROVIDER = provider;
    s.env.PERPLEXITY_API_KEY = 'test-key';
    let release, started;
    const entered = new Promise(resolve => { started = resolve; });
    const stalled = new Promise(resolve => { release = resolve; });
    const model = async questions => {
      s.calls.model++;
      if (s.calls.model === 1) { started(); await stalled; }
      return { model: 'pplx-decider-v1.1-27b', answers: Object.fromEntries(Object.keys(questions).map(key => [key, { type: 'noul', noul: 0.9 }])), usage: { input_tokens: 1000 } };
    };
    if (provider === 'clef') s.env.AI = { run: async (_model, { questions }) => model(questions) };
    else {
      const normalFetch = globalThis.fetch;
      t.mock.method(globalThis, 'fetch', async (url, options) => String(url).includes('siteverify') ? normalFetch(url, options) : Response.json(await model(JSON.parse(options.body).questions)));
    }
    const request = { block: '13-journal', answer: 'private journal text' };
    const first = s.ask(request);
    await entered;
    const second = s.ask({ ...request, ip: '203.0.113.1' });
    let timer;
    const cost = provider === 'perplexity' ? 0.00002 : provider === 'clef' ? 0.00024 : 0.000042;
    try {
      const response = await Promise.race([second, new Promise(resolve => { timer = setTimeout(() => resolve(null), 500); })]);
      assert.ok(response, 'journal calls must not wait for another learner sending the same text');
      assert.equal(response.status, 200);
      assert.equal((await response.json()).costUsd, cost);
      assert.equal(s.calls.model, 2);
    } finally {
      clearTimeout(timer);
      release();
      assert.equal((await first).status, 200);
      await second;
    }
    assert.equal((await (await s.ask({ ...request, ip: '198.51.100.1' })).json()).costUsd, cost);
    assert.equal(s.calls.model, 3);
    assert.equal(s.db.prepare('SELECT count(*) AS n FROM results').get().n, 0);
    assert.equal(s.db.prepare('SELECT nano_usd FROM spend').get().nano_usd, Math.round(cost * 1e9) * 3);
  });
}

test("IP counters retain yesterday and delete rows two UTC days old", async (t) => {
	const s = setup(t);
	s.env.IP_DAILY_LIMIT = "1";
	assert.equal((await s.ask()).status, 200);
	assert.equal(s.calls.alarmAt, Date.parse("2026-10-08T00:00:00Z"));
	s.advance(86_400_000);
	assert.equal((await s.ask({ ip: "192.0.2.2", answer: "cleanup yesterday" })).status, 200);
	s.advance(-86_400_000);
	assert.equal((await s.ask({ answer: "yesterday retained" })).status, 429);
	s.advance(2 * 86_400_000);
	assert.equal((await s.ask({ ip: "192.0.2.2", answer: "cleanup old rows" })).status, 200);
	s.advance(-2 * 86_400_000);
	assert.equal((await s.ask({ answer: "old counter deleted" })).status, 200);
});

test("mock mode works without Turnstile secrets", async (t) => {
	const s = setup(t);
	s.env.JEV_MOCK = "1";
	delete s.env.TURNSTILE_SECRET_KEY;
	delete s.env.COOKIE_SIGNING_KEY;
	const response = await s.ask({ token: null, host: "localhost" });
	assert.equal(response.status, 200);
	assert.equal((await response.json()).mock, true);
	assert.equal(s.calls.verify, 0);
	assert.equal(s.calls.model, 0);
});

test("Clef remains selectable, needs no Jev secret and uses the tuned question set", async (t) => {
  const s = setup(t);
  s.env.MODEL_PROVIDER = 'clef';
  delete s.env.JEV_API_KEY;
  s.env.AI = { run: async (model, request) => {
    s.calls.model++;
    assert.equal(model, "@cf/cloudflare/clef");
    assert.equal(request.model, "clef");
    assert.deepEqual(request.questions, demos["16-fixtures"].clefQuestions);
    return { answers: Object.fromEntries(Object.keys(request.questions).map(key => [key, { noul: 0.9 }])), usage: { input_tokens: 1000 } };
  } };
  const response = await s.ask();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.model, "@cf/cloudflare/clef");
  assert.equal(result.costUsd, 0.00024);
  assert.equal(s.calls.model, 1);
  assert.equal((await (await s.ask()).json()).costUsd, 0);
  assert.equal(s.calls.model, 1);
});

test("Jev requires explicit provider selection and its own secret; unsupported providers refuse", async (t) => {
  const s = setup(t);
  delete s.env.JEV_API_KEY;
  assert.equal((await s.ask()).status, 503);
  s.env.MODEL_PROVIDER = "flash";
  assert.equal((await s.ask()).status, 503);
  assert.equal(s.calls.model, 0);
});

test('Perplexity is the default, keeps Jev questions and settles only reported input tokens', async t => {
  const s = setup(t);
  delete s.env.MODEL_PROVIDER;
  s.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
  const config = await (await worker.fetch(new Request('https://demo.example/api/patterns/config'), s.env)).json();
  assert.equal(config.provider, 'perplexity');
  assert.equal(config.providerName, 'Perplexity (US)');
  assert.equal(config.model, 'pplx-decider-v1.1-27b');
  s.env.AI = { run: () => assert.fail('must not select Clef') };
  const normalFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).includes('siteverify')) return normalFetch(url, options);
    s.calls.model++;
    assert.equal(url, 'https://api.perplexity.ai/v1/decisions');
    assert.equal(options.headers.authorization, 'Bearer test-perplexity-key');
    const body = JSON.parse(options.body);
    const original = demos['16-fixtures'].build({ answer: 'hello' }).questions;
    for (const [key, question] of Object.entries(body.questions)) assert.deepEqual(JSON.parse(question.instructions), original[key].instructions);
    return Response.json({ model: config.model, answers: Object.fromEntries(Object.keys(body.questions).map(key => [key, { type: 'noul', noul: 0.625 }])), usage: { input_tokens: 1500, output_tokens: 99999 } });
  });
  const response = await s.ask();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.model, config.model);
  assert.equal(result.tokens, 1500);
  assert.equal(result.costUsd, 0.00003);
  assert.equal(s.db.prepare('SELECT nano_usd FROM spend').get().nano_usd, 30000);
  assert.equal(demos['16-fixtures'].outcome(result.answers, result.model).work_deadline, 'unsure');
  assert.equal((await (await s.ask()).json()).costUsd, 0);
  assert.equal(s.calls.model, 1);
});

test('a Jev secret or Clef binding cannot enable default Perplexity without its secret', async t => {
  const s = setup(t);
  delete s.env.MODEL_PROVIDER;
  s.env.AI = { run: () => assert.fail('must not select Clef') };
  for (const key of [undefined, '', '  ']) {
    s.env.PERPLEXITY_API_KEY = key;
    assert.equal((await s.ask()).status, 503);
  }
  assert.equal(s.calls.model, 0);
  assert.equal(s.db.prepare('SELECT count(*) AS count FROM spend').get().count, 0);
  assert.equal(s.db.prepare('SELECT count(*) AS count FROM ip_calls').get().count, 0);
});

test('Perplexity HTTP 429 refunds the budget and both daily call allowances', async t => {
  const s = setup(t);
  s.env.MODEL_PROVIDER = 'perplexity';
  s.env.PERPLEXITY_API_KEY = 'test-key';
  s.env.IP_DAILY_LIMIT = '1';
  s.env.DAILY_BUDGET_USD = '0.000983041';
  s.calls.status = 429;
  for (let i = 0; i < 3; i++) assert.equal((await s.ask()).status, 429);
  s.calls.status = 200;
  const normalFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).includes('siteverify')) return normalFetch(url, options);
    s.calls.model++;
    return Response.json({ model: 'pplx-decider-v1.1-27b', answers: Object.fromEntries(Object.keys(JSON.parse(options.body).questions).map(key => [key, { type: 'noul', noul: 0.9 }])), usage: { input_tokens: 0 } });
  });
  assert.equal((await s.ask()).status, 200);
  const ipLimited = await s.ask({ answer: 'second call' });
  assert.equal(ipLimited.status, 429);
  assert.equal((await ipLimited.json()).reason, 'ip_daily');
  for (const ip of ['192.0.2.2', '192.0.2.3']) assert.equal((await s.ask({ ip, answer: ip })).status, 200);
  const networkLimited = await s.ask({ ip: '192.0.2.4', answer: 'fourth IP' });
  assert.equal(networkLimited.status, 429);
  assert.equal((await networkLimited.json()).reason, 'ip_daily');
  assert.equal(s.calls.model, 6);
});

test('a failed 429 refund rolls back spend and both daily call counters', async t => {
  const s = setup(t);
  s.env.MODEL_PROVIDER = 'perplexity';
  s.env.PERPLEXITY_API_KEY = 'test-key';
  s.env.IP_DAILY_LIMIT = '1';
  s.env.DAILY_BUDGET_USD = '0.000983041';
  s.calls.status = 429;
  assert.equal((await s.ask()).status, 429);
  s.db.exec(`CREATE TRIGGER reject_refund BEFORE UPDATE ON ip_calls
    WHEN NEW.calls < OLD.calls BEGIN SELECT RAISE(ABORT, 'storage failure'); END`);
  assert.equal((await s.ask()).status, 502);
  const budgetLimited = await s.ask({ ip: '203.0.113.1' });
  assert.equal(budgetLimited.status, 429);
  assert.equal((await budgetLimited.json()).reason, 'budget');
  s.env.DAILY_BUDGET_USD = '1';
  const ipLimited = await s.ask();
  assert.equal(ipLimited.status, 429);
  assert.equal((await ipLimited.json()).reason, 'ip_daily');
  s.db.exec('DROP TRIGGER reject_refund');
  s.calls.status = 500;
  for (const ip of ['192.0.2.2', '192.0.2.3']) assert.equal((await s.ask({ ip, answer: ip })).status, 502);
  const networkLimited = await s.ask({ ip: '192.0.2.4' });
  assert.equal(networkLimited.status, 429);
  assert.equal((await networkLimited.json()).reason, 'ip_daily');
  assert.equal(s.calls.model, 4);
});

for (const [provider, tokens, budget] of [
  ['perplexity', 57344, '0.001966081'], ['clef', 16384, '0.003932161'], ['jev', 16384, '0.000688129'],
]) {
  test(`${provider} overrun records reported cost before refusing the response`, async t => {
    const s = setup(t);
    s.env.MODEL_PROVIDER = provider;
    s.env.PERPLEXITY_API_KEY = 'test-key';
    s.env.DAILY_BUDGET_USD = budget;
    const data = questions => ({ model: 'pplx-decider-v1.1-27b', answers: Object.fromEntries(Object.keys(questions).map(key => [key, { type: 'noul', noul: 0.9 }])), usage: { input_tokens: tokens } });
    s.env.AI = { run: async (_model, { questions }) => { s.calls.model++; return data(questions); } };
    const normalFetch = globalThis.fetch;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (String(url).includes('siteverify')) return normalFetch(url, options);
      s.calls.model++;
      return Response.json(data(JSON.parse(options.body).questions));
    });
    assert.equal((await s.ask()).status, 502);
    const retry = await s.ask();
    assert.equal(retry.status, 429);
    assert.equal((await retry.json()).reason, 'budget');
    assert.equal(s.calls.model, 1);
  });
}

for (const [status, outgoing] of [[504, 502], [401, 502], [500, 502]]) {
  test(`Perplexity HTTP ${status} follows the refusal path and retains its reservation`, async t => {
    const s = setup(t);
    s.env.MODEL_PROVIDER = 'perplexity';
    s.env.PERPLEXITY_API_KEY = 'test-key';
    s.calls.status = status;
    assert.equal((await s.ask()).status, outgoing);
    assert.equal(s.db.prepare('SELECT nano_usd FROM spend').get().nano_usd, demos['16-fixtures'].perplexityMaxInputTokens * 20);
    assert.equal(s.db.prepare('SELECT count(*) AS count FROM results').get().count, 0);
  });
}

test("no submitted text enters SQL writes, database rows, alarms or Worker logs, even when echoed by Jev", async (t) => {
  const s = setup(t);
  const submitted = "private-canary-7e943: learner text must never be stored";
  const logs = [];
  for (const method of ["log", "info", "debug", "warn", "error"]) t.mock.method(console, method, (...args) => logs.push(args));
  const normalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (String(url).includes("siteverify")) return normalFetch(url, options);
    return Response.json({ answers: {
      ...Object.fromEntries(Object.keys(demos["16-fixtures"].build({ answer: submitted }).questions).map(key => [key, { noul: 0.9, explanation: submitted }])),
      [submitted]: { noul: 1 },
    }, usage: { input_tokens: 1000 }, state: submitted });
  });
  assert.equal((await s.ask({ answer: submitted })).status, 200);
  assert.equal((await (await s.ask({ answer: submitted })).json()).costUsd, 0);
  const stored = [s.writes, s.db.prepare("SELECT * FROM results").all(), s.db.prepare("SELECT * FROM ip_calls").all(), s.db.prepare("SELECT * FROM spend").all(), s.calls.alarmAt, logs];
  assert.ok(!JSON.stringify(stored).includes(submitted));
  const cached = JSON.parse(s.db.prepare("SELECT value FROM results").get().value);
  assert.equal(cached.state, undefined);
  assert.equal(cached.questions, undefined);
  assert.deepEqual(Object.keys(cached.answers), Object.keys(demos["16-fixtures"].clefQuestions));
});

for (const provider of ['perplexity', 'clef', 'jev']) {
  test(`${provider} stores no text for any registered block, including echoed provider extras and failures`, async (t) => {
    const s = setup(t);
    s.env.MODEL_PROVIDER = provider;
    s.env.PERPLEXITY_API_KEY = 'test-key';
    const submitted = 'private-canary-bc711: do not persist these learner words';
    const logs = [];
    for (const method of ['log', 'info', 'debug', 'warn', 'error']) t.mock.method(console, method, (...args) => logs.push(args));
    let invalid = false;
    const data = questions => ({ answers: Object.fromEntries(Object.entries(questions).map(([key, q]) => [key,
      q.type === 'choice' ? { type: 'choice', choice: invalid ? submitted : Object.keys(q.criteria)[0], confidence: 0.9, probabilities: Object.fromEntries(Object.keys(q.criteria).map((option, index) => [option, index === 0 ? 1 : 0])), explanation: submitted }
        : { type: 'noul', noul: invalid ? submitted : 0.9, explanation: submitted },
    ])), model: 'pplx-decider-v1.1-27b', usage: { input_tokens: 1000 }, state: submitted, explanation: submitted });
    s.env.AI = { run: async (_model, request) => data(request.questions) };
    const normalFetch = globalThis.fetch;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (String(url).includes('siteverify')) return normalFetch(url, options);
      return Response.json(data(JSON.parse(options.body).questions));
    });
    for (const [block, entry] of Object.entries(demos)) {
      const fields = Object.fromEntries(Object.keys(entry.fields).map(key => [key, key === 'node' ? 'opening' : submitted]));
      const response = await s.ask({ block, fields });
      assert.equal(response.status, 200, block);
      const result = await response.json();
      assert.deepEqual(Object.keys(result.answers), Object.keys(entry.clefQuestions ?? entry.build(fields).questions));
      assert.equal((await (await s.ask({ block, fields })).json()).costUsd, block === '13-journal' ? (provider === 'perplexity' ? 0.00002 : provider === 'clef' ? 0.00024 : 0.000042) : 0);
      invalid = true;
      const badFields = Object.fromEntries(Object.keys(entry.fields).map(key => [key, key === 'node' ? 'opening' : submitted + ' invalid']));
      assert.equal((await s.ask({ block, fields: badFields })).status, 502, block);
      invalid = false;
    }
    const rows = ['results', 'ip_calls', 'spend'].map(table => s.db.prepare(`SELECT * FROM ${table}`).all());
    assert.ok(!JSON.stringify([s.writes, rows, s.calls.alarmAt, logs]).includes(submitted));
    assert.equal(rows[0].length, Object.values(demos).filter(entry => entry.cache !== false).length);
    for (const row of rows[0]) {
      assert.match(row.key, /^[a-f0-9]{64}$/);
      const cached = JSON.parse(row.value);
      assert.equal(cached.state, undefined);
      assert.equal(cached.questions, undefined);
    }
  });
}

test('Clef missing binding fails before charging; missing usage or provider errors retain the reservation', async (t) => {
  const s = setup(t);
  s.env.MODEL_PROVIDER = 'clef';
  s.env.DAILY_BUDGET_USD = '0.001966081';
  assert.equal((await s.ask()).status, 503);
  assert.equal(s.db.prepare('SELECT count(*) AS count FROM spend').get().count, 0);
  for (const invalid of [undefined, null, -1, 0.5, 8193, 'provider-error']) {
    s.env.AI = { run: async () => {
      if (invalid === 'provider-error') throw new Error('private error from provider');
      return { answers: { sincere: { noul: 0.9 } }, usage: { input_tokens: invalid } };
    } };
    assert.equal((await s.ask({ answer: `bad usage ${invalid}` })).status, 502);
    assert.equal(s.db.prepare('SELECT value FROM results').all().length, 0);
    assert.equal((await s.ask({ answer: 'retry' })).status, 429);
    s.advance(86_400_000);
  }
});

test('Jev and Clef caches stay separate when explicitly selected', async (t) => {
  const s = setup(t);
  assert.equal((await s.ask()).status, 200);
  s.env.MODEL_PROVIDER = 'clef';
  s.env.AI = { run: async (_model, request) => {
    s.calls.model++;
    return { answers: Object.fromEntries(Object.keys(request.questions).map(key => [key, { noul: 0.9 }])), usage: { input_tokens: 1000 } };
  } };
  const clef = await (await s.ask()).json();
  assert.equal(clef.costUsd, 0.00024);
  assert.equal(clef.model, '@cf/cloudflare/clef');
  assert.equal((await (await s.ask()).json()).costUsd, 0);
  s.env.MODEL_PROVIDER = 'jev';
  assert.equal((await (await s.ask()).json()).costUsd, 0);
  assert.equal(s.calls.model, 2);
});

test('unregistered blocks refuse at the Worker without charging or calling a provider', async (t) => {
  const s = setup(t);
  for (const block of ['01-rubric', '17-parity', 'constructor', '__proto__']) {
    assert.equal((await s.ask({ block })).status, 400);
  }
  assert.equal(s.calls.model, 0);
  assert.equal(s.writes.length, 0);
});

test('malformed provider answer fields never enter the cache and keep the maximum charge', async (t) => {
  const s = setup(t);
  const good = Object.fromEntries(Object.keys(demos['16-fixtures'].clefQuestions).map(key => [key, { noul: 0.9 }]));
  const branch = { branch: { type: 'choice', choice: 'acknowledge', confidence: 0.9, probabilities: { acknowledge: 0.9 } } };
  const cases = [
    ['16-fixtures', null], ['16-fixtures', []], ['16-fixtures', {}],
    ...[-0.1, 1.1, null, 'raw learner words'].map(noul => ['16-fixtures', { ...good, sincere: { noul } }]),
    ['16-fixtures', { ...good, sincere: { type: 'choice', noul: 0.9 } }],
    ...[null, -0.1, 1.1, 'raw learner words'].map(confidence => ['03-branch', { branch: { ...branch.branch, confidence } }]),
    ...[[], null, { acknowledge: 'raw learner words' }, { 'raw learner words': 0.9 }, { acknowledge: 1.1 }].map(probabilities => ['03-branch', { branch: { ...branch.branch, probabilities } }]),
  ];
  const normalFetch = globalThis.fetch;
  let answers;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).includes('siteverify')) return normalFetch(url, options);
    return Response.json({ answers, usage: { input_tokens: 1000 } });
  });
  for (const [index, [block, invalid]] of cases.entries()) {
    answers = invalid;
    const fields = block === '03-branch' ? { node: 'opening', reply: `Malformed reply ${index}` } : { answer: `Malformed answer ${index}` };
    assert.equal((await s.ask({ block, fields })).status, 502);
  }
  assert.equal(s.db.prepare('SELECT count(*) AS count FROM results').get().count, 0);
  assert.equal(s.db.prepare('SELECT nano_usd FROM spend').get().nano_usd, cases.length * 344064);
});

test('IPv6 rotations and alternate spellings share clearance and both limits within a /64', async (t) => {
  const s = setup(t);
  s.env.IP_DAILY_LIMIT = '2';
  const keys = [];
  s.env.LIMITER = { limit: async ({ key }) => { keys.push(key); return { success: true }; } };
  const first = await s.ask({ ip: '2001:db8:1:2::1' });
  const cookie = first.headers.get('set-cookie').split(';')[0];
  assert.equal((await s.ask({ ip: '2001:0DB8:0001:0002:ffff::2', cookie, token: null, answer: 'second' })).status, 200);
  for (let i = 3; i < 23; i++) {
    assert.equal((await s.ask({ ip: `2001:db8:1:2::${i}`, cookie, token: null, answer: `rotation ${i}` })).status, 429);
  }
  assert.equal(new Set(keys).size, 1);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM ip_calls').get().n, 2);
  assert.equal(s.calls.verify, 1);
  assert.equal((await s.ask({ ip: '2001:db8:1:3::1', cookie, token: null })).status, 403);
});

test('clearance refuses another IPv4 address and its MAC covers the IP hash', async (t) => {
  const s = setup(t);
  const first = await s.ask();
  const cookie = first.headers.get('set-cookie').split(';')[0];
  assert.equal((await s.ask({ ip: '192.0.2.2', cookie, token: null })).status, 403);
  const second = await s.ask({ ip: '192.0.2.2', answer: 'second IPv4' });
  const otherCookie = second.headers.get('set-cookie').split(';')[0];
  const parts = cookie.split('.');
  parts[1] = otherCookie.split('.')[1];
  assert.equal((await s.ask({ ip: '192.0.2.2', cookie: parts.join('.'), token: null })).status, 403);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM ip_calls').get().n, 3);
});

test('the burst limiter rejects junk tokens before siteverify', async (t) => {
  const s = setup(t);
  s.env.LIMITER = { limit: async () => ({ success: false }) };
  assert.equal((await s.ask({ token: 'junk' })).status, 429);
  assert.equal(s.calls.verify, 0);
});

test('mock mode and all Turnstile test secrets fail closed on public hosts, including config', async (t) => {
  const s = setup(t);
  for (const [key, value] of [['JEV_MOCK', '1'], ...[1, 2, 3].map(n => ['TURNSTILE_SECRET_KEY', `${n}x0000000000000000000000000000000AA`])]) {
    const original = s.env[key];
    s.env[key] = value;
    for (const host of ['demo.example', 'learning-patterns.x.workers.dev', 'localhost.example', '0.0.0.0']) {
      const response = await s.ask({ host, token: null });
      assert.equal(response.status, 503, `${key} at ${host}`);
      assert.match((await response.json()).error, /misconfigured/i);
      assert.equal((await worker.fetch(new Request(`https://${host}/api/patterns/config`), s.env)).status, 503);
    }
    s.env[key] = original;
  }
  assert.equal(s.calls.verify, 0);
  assert.equal(s.calls.model, 0);
});

test('mock and dummy Turnstile credentials work on the three allowed local hosts', async (t) => {
  const s = setup(t);
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    s.env.JEV_MOCK = '1';
    assert.equal((await s.ask({ host, token: null })).status, 200);
    delete s.env.JEV_MOCK;
    s.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
    s.calls.hostname = 'example.com';
    assert.equal((await s.ask({ host })).status, 200);
  }
});

test('all signing and hashing secrets fail closed below 32 characters', async (t) => {
  const s = setup(t);
  for (const key of ['COOKIE_SIGNING_KEY', 'IP_SALT', 'CACHE_KEY_SECRET']) {
    const original = s.env[key];
    for (const value of [undefined, '', 'x'.repeat(31)]) {
      s.env[key] = value;
      assert.equal((await s.ask()).status, 503, key);
    }
    s.env[key] = original;
  }
  assert.equal(s.calls.verify, 0);
  assert.equal(s.calls.model, 0);
});

test('cache keys are HMAC-SHA-256 with their own secret, independent of the IP salt', async (t) => {
  const s = setup(t);
  const answer = 'I feel unsafe at home';
  await s.ask({ answer });
  const built = buildRequest({ block: '16-fixtures', fields: { answer } }, 'jev');
  const input = JSON.stringify(['jev-1.13.0', built.state, built.questions]);
  const { createHash, createHmac } = await import('node:crypto');
  const stored = s.db.prepare('SELECT key FROM results').get().key;
  assert.notEqual(stored, createHash('sha256').update(input).digest('hex'));
  assert.equal(stored, createHmac('sha256', s.env.CACHE_KEY_SECRET).update(input).digest('hex'));
  s.env.IP_SALT = 'changed-ip-salt-with-at-least-32-bytes';
  await s.ask({ answer });
  assert.equal(s.calls.model, 1);
  s.env.CACHE_KEY_SECRET = 'changed-cache-key-with-at-least-32-bytes';
  await s.ask({ answer });
  assert.equal(s.calls.model, 2);
});

test('the 16 KiB body cap covers declared, undeclared and multibyte bodies', async (t) => {
  const s = setup(t);
  const body = JSON.stringify({ block: '16-fixtures', fields: { answer: 'hello' } });
  assert.equal((await s.ask({ body, headers: { 'content-length': '16385' } })).status, 413);
  assert.equal((await s.ask({ body: body.padEnd(16385) })).status, 413);
  assert.equal((await s.ask({ body: 'é'.repeat(8193) })).status, 413);
  assert.equal((await s.ask({ body: body.padEnd(16384), headers: { 'content-length': '16384' } })).status, 200);
  assert.equal(s.calls.model, 1);
});

test('the streamed body cap cancels before pulling a large upload in full', async (t) => {
  const s = setup(t);
  let pulled = 0, cancelled = false;
  const chunk = new Uint8Array(1024).fill(32);
  const body = new ReadableStream({
    pull(controller) {
      if (pulled === 32 * 1024 * 1024) return controller.close();
      pulled += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel() { cancelled = true; },
  });
  assert.equal((await s.ask({ body })).status, 413);
  assert.equal(cancelled, true);
  assert.ok(pulled <= 18 * 1024, `pulled ${pulled} bytes before refusing`);
  assert.equal(s.calls.model, 0);
});

test('streamed JSON decodes UTF-8 characters split across chunks at the exact body cap', async (t) => {
  const s = setup(t);
  const text = JSON.stringify({ block: '16-fixtures', fields: { answer: '\u00e9\u6f22' } });
  const encoded = new TextEncoder().encode(text);
  const bytes = new TextEncoder().encode(text + ' '.repeat(16384 - encoded.length));
  const split = encoded.indexOf(0xc3) + 1;
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(bytes.slice(0, split));
    controller.enqueue(bytes.slice(split));
    controller.close();
  } });
  assert.equal((await s.ask({ body })).status, 200);
  assert.equal(s.calls.model, 1);
  // A character split across chunks must reach the model intact, not as two U+FFFD.
  assert.ok(s.calls.modelBody.includes('é漢'), 'learner text corrupted before the model call');
});

test('paths outside the API preserve the asset response before checking proxy configuration', async (t) => {
  const s = setup(t);
  const served = [];
  const page = new Response('<html>Course page</html>', { headers: { 'content-type': 'text/html', etag: 'page' } });
  const missing = new Response('Asset not found', { status: 404, headers: { 'content-type': 'text/plain', 'x-asset-miss': 'true' } });
  s.env.ASSETS = { fetch: async request => { served.push(request); return new URL(request.url).pathname === '/' ? page : missing; } };
  s.env.JEV_MOCK = '1';
  s.env.MODEL_PROVIDER = 'invalid';
  for (const [path, expected] of [['/', page], ['/wp-login.php', missing], ['/api', missing], ['/api/patterns', missing], ['/api/patterns-other/ask', missing]]) {
    const request = new Request(`https://demo.example${path}`);
    assert.equal(await worker.fetch(request, s.env), expected);
    assert.equal(served.at(-1), request);
  }
  assert.equal((await worker.fetch(new Request('https://demo.example/api/patterns/ask'), s.env)).status, 503);
  assert.equal(served.length, 5);
  assert.equal(s.calls.verify, 0);
  assert.equal(s.calls.limiter, 0);
  assert.equal(s.calls.model, 0);
  assert.equal(s.writes.length, 0);
});

test('public errors never echo input or provider details and all API content uses nosniff', async (t) => {
  const s = setup(t);
  const canary = '<learner-private-words>';
  for (const fields of [{ answer: 'hello', [canary]: 'hello' }, { node: canary, reply: 'hello' }]) {
    const response = await s.ask({ block: fields.node ? '03-branch' : '16-fixtures', fields });
    assert.equal(response.status, 400);
    assert.ok(!(await response.text()).includes(canary));
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
  s.calls.status = 401;
  const response = await s.ask();
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'Live checks are unavailable. Please try again later.' });
  for (const path of ['config', 'prices.js', 'limits.js', 'unknown']) {
    const response = await worker.fetch(new Request(`https://demo.example/api/patterns/${path}`), s.env);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
});

test('public responses expose no cached membership flag', async (t) => {
  const s = setup(t);
  for (let i = 0; i < 2; i++) {
    const response = await s.ask();
    assert.equal(response.status, 200);
    assert.equal(Object.hasOwn(await response.json(), 'cached'), false);
  }
  assert.equal(s.calls.model, 1);
});

test('a cache hit and another live request finish while a model call remains in flight', async (t) => {
  const s = setup(t);
  s.env.MODEL_PROVIDER = 'clef';
  let release, started;
  const entered = new Promise(resolve => { started = resolve; });
  const stalled = new Promise(resolve => { release = resolve; });
  const data = questions => ({ answers: Object.fromEntries(Object.keys(questions).map(key => [key, { noul: 0.9 }])), usage: { input_tokens: 1000 } });
  s.env.AI = { run: async (_model, { state, questions }) => {
    s.calls.model++;
    if (state.answer === 'stall') { started(); await stalled; }
    return data(questions);
  } };
  await s.ask({ answer: 'warm' });
  const slow = s.ask({ answer: 'stall', ip: '192.0.2.2' });
  await entered;
  let timer;
  try {
    const responses = await Promise.race([
      Promise.all([s.ask({ answer: 'warm' }), s.ask({ answer: 'independent', ip: '192.0.2.3' })]),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), 500); }),
    ]);
    assert.ok(responses, 'cache hits and independent live calls must not wait for the stalled model');
    assert.deepEqual(responses.map(response => response.status), [200, 200]);
    assert.equal(s.calls.model, 3);
  } finally {
    clearTimeout(timer);
    release();
    await slow;
  }
});

test('Clef has a 15 second deadline and late success keeps the failed reservation charged', async (t) => {
  const s = setup(t);
  s.env.MODEL_PROVIDER = 'clef';
  s.env.DAILY_BUDGET_USD = '1';
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let release, started, response;
  const entered = new Promise(resolve => { started = resolve; });
  const stalled = new Promise(resolve => { release = resolve; });
  s.env.AI = { run: () => { started(); return stalled; } };
  const pending = s.ask().then(value => { response = value; });
  await entered;
  try {
    t.mock.timers.tick(14999);
    await new Promise(setImmediate);
    assert.equal(response, undefined);
    t.mock.timers.tick(1);
    await new Promise(setImmediate);
    assert.equal(response?.status, 502);
  } finally {
    release({ answers: Object.fromEntries(Object.keys(demos['16-fixtures'].clefQuestions).map(key => [key, { noul: 0.9 }])), usage: { input_tokens: 1000 } });
    await pending;
  }
  assert.equal(s.db.prepare('SELECT nano_usd FROM spend').get().nano_usd, 1966080);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM results').get().n, 0);
  s.env.DAILY_BUDGET_USD = '0.00196608';
  assert.equal((await s.ask({ answer: 'after timeout' })).status, 429);
});

test('each registered block retains only its 8192 token reservation on failed calls', async (t) => {
  const s = setup(t);
  s.calls.fail = true;
  for (const [block, entry] of Object.entries(demos)) {
    const fields = Object.fromEntries(Object.keys(entry.fields).map(key => [key, key === 'node' ? 'opening' : 'failure']));
    assert.equal((await s.ask({ block, fields })).status, 502);
    assert.equal(entry.maxInputTokens, 8192, block);
  }
  assert.equal(s.db.prepare('SELECT nano_usd FROM spend').get().nano_usd, Object.keys(demos).length * 344064);
  s.calls.fail = false;
  s.calls.inputTokens = 8193;
  assert.equal((await s.ask({ answer: 'over bound' })).status, 502);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM results').get().n, 0);
});

test('02-live Perplexity calls use fixed questions, retain failed reservations and enforce the budget', async t => {
  const s = setup(t);
  s.env.MODEL_PROVIDER = 'perplexity';
  s.env.PERPLEXITY_API_KEY = 'test-key';
  s.env.DAILY_BUDGET_USD = '0.0008192';
  const normalFetch = globalThis.fetch;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).includes('siteverify')) return normalFetch(url, options);
    calls++;
    assert.equal(url, 'https://api.perplexity.ai/v1/decisions');
    const request = JSON.parse(options.body);
    assert.equal(request.model, 'pplx-decider-v1.1-27b');
    assert.deepEqual(Object.keys(request.questions), ['three_actions', 'observable', 'when', 'commitments']);
    return Response.json({ model: request.model, answers: Object.fromEntries(Object.keys(request.questions).map(key => [key, { type: 'noul', noul: .65 }])), usage: {} });
  });
  assert.equal((await s.ask({ block: '02-live', fields: { answer: 'x'.repeat(1201) } })).status, 400);
  assert.equal(calls, 0);
  assert.equal((await s.ask({ block: '02-live', answer: 'A plan with uncertain billing.' })).status, 502);
  assert.equal(s.db.prepare('SELECT nano_usd FROM spend').get().nano_usd, 819200);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM results').get().n, 0);
  const blocked = await s.ask({ block: '02-live', answer: 'A different action plan.' });
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).reason, 'budget');
  assert.equal(calls, 1);
});

for (const block of ['20-faq', '21-sections']) test(`${block} preserves Choice probabilities and charges bounded failed Perplexity calls`, async t => {
  const s = setup(t);
  s.env.MODEL_PROVIDER = 'perplexity'; s.env.PERPLEXITY_API_KEY = 'test-key';
  const normalFetch = globalThis.fetch;
  let calls = 0, fail = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).includes('siteverify')) return normalFetch(url, options);
    calls++;
    const request = JSON.parse(options.body), keys = Object.keys(request.questions.lookup.criteria);
    assert.deepEqual(Object.keys(request.questions), ['lookup']);
    assert.equal(request.questions.lookup.type, 'choice');
    const probabilities = Object.fromEntries(keys.map((id, index) => [id, index === 0 ? .5 : index === 1 ? .4 : id === 'none' ? .1 : 0]));
    return Response.json({ model: request.model, answers: { lookup: { type: 'choice', choice: keys[0], confidence: .5, probabilities } }, usage: fail ? {} : { input_tokens: 1000 } });
  });
  assert.equal((await s.ask({ block, fields: { question: 'x'.repeat(501) } })).status, 400);
  assert.equal(calls, 0);
  const success = await s.ask({ block, fields: { question: 'A question about the course.' } });
  assert.equal(success.status, 200);
  const data = await success.json();
  assert.equal(data.answers.lookup.probabilities[data.answers.lookup.choice], .5);
  assert.equal(Object.keys(data.answers.lookup.probabilities).length, Object.keys(demos[block].build(demos[block].sample).questions.lookup.criteria).length);
  fail = true;
  assert.equal((await s.ask({ block, fields: { question: 'A different question with uncertain billing.' } })).status, 502);
  assert.equal(s.db.prepare('SELECT nano_usd FROM spend').get().nano_usd, 183840);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM results').get().n, 1);
  s.env.DAILY_BUDGET_USD = '0.00018384';
  const blocked = await s.ask({ block, fields: { question: 'Another question over budget.' } });
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).reason, 'budget');
  assert.equal(calls, 2);
});

test('daily cleanup uses the expiry index and only schedules an alarm once per object', async (t) => {
  const s = setup(t);
  await s.ask();
  await s.ask();
  await s.ask({ answer: 'another' });
  assert.equal(s.calls.alarms, 1);
  const plan = s.db.prepare('EXPLAIN QUERY PLAN DELETE FROM results WHERE expires <= ?').all(Date.now());
  assert.ok(plan.some(row => /USING INDEX results_expires/.test(row.detail)), JSON.stringify(plan));
});
