import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.js";
import { DatabaseSync } from "node:sqlite";
import { blocks as demos } from "../src/registry.js";

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
		if (calls.fail) throw new Error("provider timed out after billing");
		return Response.json({ answers: Object.fromEntries(Object.keys(JSON.parse(options.body).questions).map(key => [key, { noul: 0.9 }])), usage: { input_tokens: calls.inputTokens } }, { status: calls.status });
	});
	const env = {
		MODEL_PROVIDER: "jev",
		JEV_API_KEY: "test-key",
		TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
		COOKIE_SIGNING_KEY: "test-cookie-key-with-at-least-32-bytes",
		IP_SALT: "test-ip-salt-with-at-least-32-bytes",
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
				const { CostGuard } = await import("../src/cost-guard.js");
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
						setAlarm: async (at) => { calls.alarmAt = at; },
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
	const ask = ({ token = "XXXX.DUMMY.TOKEN.XXXX", cookie, ip = "192.0.2.1", answer = "hello", block = "16-fixtures", fields } = {}) => worker.fetch(new Request("https://demo.example/api/patterns/ask", {
		method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(token ? { "x-turnstile-token": token } : {}), ...(cookie ? { cookie } : {}) },
		body: JSON.stringify({ block, fields: fields ?? { answer } }),
	}), env);
	return { env, calls, ask, db, writes, advance: (ms) => { now += ms; } };
}

test("Turnstile refuses missing or bad tokens before limiter or model work", async (t) => {
	const s = setup(t);
	assert.equal((await s.ask({ token: null })).status, 403);
	assert.equal((await s.ask({ token: "bad" })).status, 403);
	assert.equal(s.calls.model, 0);
	assert.equal(s.calls.limiter, 0);
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
	assert.equal(s.calls.limiter, 0);
});

test("missing guard configuration and invalid limits cannot start a model call", async (t) => {
	const s = setup(t);
	const configurations = [
		["TURNSTILE_SECRET_KEY", ""], ["COOKIE_SIGNING_KEY", ""], ["IP_SALT", ""],
		["COST_GUARD", null], ["IP_DAILY_LIMIT", "invalid"], ["IP_DAILY_LIMIT", "0"],
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
	s.env.DAILY_BUDGET_USD = "0.002752512";
	for (const tokens of [undefined, null, -1, 0.5, 65537]) {
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
	s.env.DAILY_BUDGET_USD = "0.002752512";
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
	assert.equal((await s.ask()).status, 200);
	s.env.TURNSTILE_SECRET_KEY = "production-secret";
	assert.equal((await s.ask()).status, 403);
	assert.equal(s.calls.model, 1);
});

test("calls starting at the daily budget are refused, including after uncertain billing", async (t) => {
	const s = setup(t);
	s.env.DAILY_BUDGET_USD = "0.002752512";
	s.calls.inputTokens = 65536;
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
	s.env.DAILY_BUDGET_USD = "0.0028";
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
	assert.equal(saved.cached, true);
	assert.deepEqual(saved.answers, first.answers);
	assert.equal(saved.costUsd, 0);
	assert.equal(s.calls.model, 1);
	assert.equal((await s.ask({ answer: "other" })).status, 429);
	assert.equal((await s.ask({ ip: "192.0.2.2" })).status, 200);
});

test("a cached request leaves both the remaining IP call and budget available", async (t) => {
	const s = setup(t);
	s.env.IP_DAILY_LIMIT = "2";
	s.env.DAILY_BUDGET_USD = "0.0028";
	assert.equal((await s.ask()).status, 200);
	assert.equal((await (await s.ask()).json()).cached, true);
	assert.equal((await s.ask({ answer: "second live" })).status, 200);
	const third = await s.ask({ answer: "third live" });
	assert.equal(third.status, 429);
	assert.equal((await third.json()).reason, "ip_daily");
	assert.equal(s.calls.model, 2);
});

test("concurrent fresh calls from different IPs cannot overspend the global budget", async (t) => {
	const s = setup(t);
	s.env.DAILY_BUDGET_USD = "0.002752512";
	s.calls.inputTokens = 65536;
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
	assert.equal((await (await s.ask({ answer: "bbbb" })).json()).cached, false);
	const original = demos["16-fixtures"].build;
	const changed = t.mock.method(demos["16-fixtures"], "build", (input) => {
		const result = original(input);
		const text = result.questions.sincere.instructions.question;
		result.questions.sincere.instructions.question = text.slice(0, -1) + "!";
		return result;
	});
	assert.equal((await (await s.ask({ answer: "aaaa" })).json()).cached, false);
	changed.mock.restore();
	assert.equal((await (await s.ask({ answer: "aaaa" })).json()).cached, true);
	assert.equal(s.calls.model, 3);
});

test("the default 101st live call is refused, another IP works, and midnight UTC resets", async (t) => {
	const s = setup(t);
	for (let i = 0; i < 100; i++) assert.equal((await s.ask({ answer: `call ${i}` })).status, 200);
	const blocked = await s.ask({ answer: "101st" });
	assert.equal(blocked.status, 429);
	assert.equal((await blocked.json()).reason, "ip_daily");
	assert.equal((await s.ask({ answer: "different IP", ip: "192.0.2.2" })).status, 200);
	s.advance(12 * 3_600_000);
	assert.equal((await s.ask({ answer: "new day" })).status, 200);
	assert.equal(s.calls.model, 102);
});

test("cache entries expire after 30 days; concurrent identical calls pay once", async (t) => {
	const s = setup(t);
	const responses = await Promise.all([s.ask(), s.ask()]);
	assert.equal(responses[0].status, 200);
	assert.equal(responses[1].status, 200);
	assert.equal(s.calls.model, 1);
	s.advance(30 * 86_400_000 - 1);
	assert.equal((await (await s.ask()).json()).cached, true);
	s.advance(1);
	assert.equal((await (await s.ask()).json()).cached, false);
	assert.equal(s.calls.model, 2);
});

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
	const response = await s.ask({ token: null });
	assert.equal(response.status, 200);
	assert.equal((await response.json()).mock, true);
	assert.equal(s.calls.verify, 0);
	assert.equal(s.calls.model, 0);
});

test("Clef is the default provider, needs no Jev secret and uses the tuned question set", async (t) => {
  const s = setup(t);
  delete s.env.MODEL_PROVIDER;
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
  assert.equal((await (await s.ask()).json()).cached, true);
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
  assert.equal((await (await s.ask({ answer: submitted })).json()).cached, true);
  const stored = [s.writes, s.db.prepare("SELECT * FROM results").all(), s.db.prepare("SELECT * FROM ip_calls").all(), s.db.prepare("SELECT * FROM spend").all(), s.calls.alarmAt, logs];
  assert.ok(!JSON.stringify(stored).includes(submitted));
  const cached = JSON.parse(s.db.prepare("SELECT value FROM results").get().value);
  assert.equal(cached.state, undefined);
  assert.equal(cached.questions, undefined);
  assert.deepEqual(Object.keys(cached.answers), Object.keys(demos["16-fixtures"].clefQuestions));
});

for (const provider of ['clef', 'jev']) {
  test(`${provider} stores no text for any registered block, including echoed provider extras and failures`, async (t) => {
    const s = setup(t);
    s.env.MODEL_PROVIDER = provider;
    const submitted = 'private-canary-bc711: do not persist these learner words';
    const logs = [];
    for (const method of ['log', 'info', 'debug', 'warn', 'error']) t.mock.method(console, method, (...args) => logs.push(args));
    let invalid = false;
    const data = questions => ({ answers: Object.fromEntries(Object.entries(questions).map(([key, q]) => [key,
      q.type === 'choice' ? { type: 'choice', choice: invalid ? submitted : Object.keys(q.criteria)[0], confidence: 0.9, probabilities: { [Object.keys(q.criteria)[0]]: 0.9 }, explanation: submitted }
        : { type: 'noul', noul: invalid ? submitted : 0.9, explanation: submitted },
    ])), usage: { input_tokens: 1000 }, state: submitted, explanation: submitted });
    s.env.AI = { run: async (_model, request) => data(request.questions) };
    const normalFetch = globalThis.fetch;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (String(url).includes('siteverify')) return normalFetch(url, options);
      return Response.json(data(JSON.parse(options.body).questions));
    });
    for (const [block, entry] of Object.entries(demos)) {
      const fields = block === '03-branch' ? { node: 'opening', reply: submitted } : { answer: submitted };
      const response = await s.ask({ block, fields });
      assert.equal(response.status, 200, block);
      const result = await response.json();
      assert.deepEqual(Object.keys(result.answers), Object.keys(entry.clefQuestions));
      assert.equal((await (await s.ask({ block, fields })).json()).cached, true);
      invalid = true;
      const badFields = block === '03-branch' ? { node: 'opening', reply: submitted + ' invalid' } : { answer: submitted + ' invalid' };
      assert.equal((await s.ask({ block, fields: badFields })).status, 502, block);
      invalid = false;
    }
    const rows = ['results', 'ip_calls', 'spend'].map(table => s.db.prepare(`SELECT * FROM ${table}`).all());
    assert.ok(!JSON.stringify([s.writes, rows, s.calls.alarmAt, logs]).includes(submitted));
    assert.equal(rows[0].length, 5);
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
  s.env.DAILY_BUDGET_USD = '0.015728641';
  assert.equal((await s.ask()).status, 503);
  assert.equal(s.db.prepare('SELECT count(*) AS count FROM spend').get().count, 0);
  for (const invalid of [undefined, null, -1, 0.5, 65537, 'provider-error']) {
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

test('Jev and Clef caches stay separate and a Jev secret alone never enables Jev', async (t) => {
  const s = setup(t);
  assert.equal((await s.ask()).status, 200);
  delete s.env.MODEL_PROVIDER;
  s.env.AI = { run: async (_model, request) => {
    s.calls.model++;
    return { answers: Object.fromEntries(Object.keys(request.questions).map(key => [key, { noul: 0.9 }])), usage: { input_tokens: 1000 } };
  } };
  const clef = await (await s.ask()).json();
  assert.equal(clef.cached, false);
  assert.equal(clef.model, '@cf/cloudflare/clef');
  assert.equal((await (await s.ask()).json()).cached, true);
  s.env.MODEL_PROVIDER = 'jev';
  assert.equal((await (await s.ask()).json()).cached, true);
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
  assert.equal(s.db.prepare('SELECT nano_usd FROM spend').get().nano_usd, cases.length * 2752512);
});
