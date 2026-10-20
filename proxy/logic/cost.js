import { costOf, DEFAULT_MODEL } from "../src/prices.js";
export { costOf };
const money = (usd) => (usd >= 0.01 ? `$${usd.toFixed(2)}` : `$${usd.toPrecision(2)}`);

// "$0.000041 for 980 tokens. About $0.04 per 1,000 runs."
export function costText({ calls, tokens, model = DEFAULT_MODEL, usd = costOf(tokens, model) }) {
	const what = calls === 1 ? `${tokens.toLocaleString("en")} tokens` : `${calls} checks, ${tokens.toLocaleString("en")} tokens`;
	return `${money(usd)} for ${what}. About ${money(usd * 1000)} per 1,000 runs.`;
}
