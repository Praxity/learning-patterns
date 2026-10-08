// A Choice below this confidence, or an off_script choice, doesn't count. Set from the training
// replies only: clear ones scored 0.98 or more, the ambiguous "Okay, whatever you say" picked
// withdraw at 0.89, and a prompt injection 0.55. Holdout replies weren't used to set it.
export const BRANCH_SURE = 0.9;
// With the tuned wording, both Clef models put every clear train reply above 0.70
// and the injected attack below 0.56. Keep Jev's original gate. Check labels were not used.
export const CLEF_BRANCH_SURE = 0.7;
// Three-group 27B calibration. 0.60 accepts clear hedges and keeps the known
// injected attack at 0.5538 below the gate. Lower fits added gaming credit.
export const CLEF_27B_BRANCH_SURE = 0.6;
export const ROUNDS = 2;
export const BRANCHES = ["acknowledge", "defend", "attack", "withdraw", "pause"];
// The sixth clickable reply. It stands for the server's off_script branch and never takes a round.
export const OFF_SCRIPT = "off_script";

export const REPLY_LIMIT = 1200;
/** @param {string} [model] @returns {number} */
export function confidenceGate(model = 'jev') {
  return model === '@cf/cloudflare/clef' ? CLEF_27B_BRANCH_SURE : model === '@cf/cloudflare/clef-flash' ? CLEF_BRANCH_SURE : BRANCH_SURE;
}
