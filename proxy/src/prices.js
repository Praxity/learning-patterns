// Input-only list prices. Jev: docs.typesafe.ai/models; Clef: Cloudflare model pages.
export const DEFAULT_MODEL = "@cf/cloudflare/clef";
export const JEV_MODEL = "jev-1.13.0";
export const PRICES = Object.freeze({
	"jev-1.13.0": 0.042,
	"@cf/cloudflare/clef-flash": 0.09,
	"@cf/cloudflare/clef": 0.24,
});

// All three pinned models have at most 64K total input tokens. Reserving 65,536
// covers both interpretations of 64K. Recheck this bound when adding a model.
export const MAX_INPUT_TOKENS = 65_536;

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
