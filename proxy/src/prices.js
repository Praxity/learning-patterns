// Input-only list prices. Perplexity: docs.perplexity.ai/docs/decisions/quickstart
// (output free); Jev: docs.typesafe.ai/models; Clef: Cloudflare model pages.
export const DEFAULT_MODEL = "pplx-decider-v1.1-27b";
export const CLEF_MODEL = "@cf/cloudflare/clef";
export const JEV_MODEL = "jev-1.13.0";
export const PRICES = Object.freeze({
	"pplx-decider-v1.1-27b": 0.02,
	"jev-1.13.0": 0.042,
	"@cf/cloudflare/clef-flash": 0.09,
	"@cf/cloudflare/clef": 0.24,
});

// Keep the calculation inside a self-contained function so its browser exports
// survive bundler renaming and minification. Only table data crosses that boundary.
function pricing(prices, defaultModel) {
	const api = {
		costNanoUsd(tokens, model = defaultModel) {
			if (!Object.hasOwn(prices, model)) throw new Error(`Unknown model: ${model}`);
			if (!Number.isSafeInteger(tokens) || tokens < 0) throw new Error("Invalid billed input tokens");
			const cost = tokens * Math.round(prices[model] * 1000);
			if (!Number.isSafeInteger(cost)) throw new Error("Input token cost is too large");
			return cost;
		},
		costOf(tokens, model = defaultModel) {
			return api.costNanoUsd(tokens, model) / 1e9;
		},
	};
	return api;
}

export const { costNanoUsd, costOf } = pricing(PRICES, DEFAULT_MODEL);

// The Worker serves this same owner's exports to the browser. No copied price table.
export function browserPrices() {
	return `export const DEFAULT_MODEL = ${JSON.stringify(DEFAULT_MODEL)};\nexport const PRICES = Object.freeze(${JSON.stringify(PRICES)});\nconst pricing = ${pricing.toString()};\nexport const { costNanoUsd, costOf } = pricing(PRICES, DEFAULT_MODEL);\n`;
}
