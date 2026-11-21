export const BRANCH_SURE = 0.9;
export const CLEF_BRANCH_SURE = 0.7;
export const CLEF_27B_BRANCH_SURE = 0.6;
export const ROUNDS = 2;
export const BRANCHES = ["acknowledge", "defend", "attack", "withdraw", "pause"];
export const OFF_SCRIPT = "off_script";

export const REPLY_LIMIT = 1200;
/** @param {string} [model] @returns {number} */
export function confidenceGate(model = 'jev') {
  return model === '@cf/cloudflare/clef' ? CLEF_27B_BRANCH_SURE : model === '@cf/cloudflare/clef-flash' ? CLEF_BRANCH_SURE : BRANCH_SURE;
}
