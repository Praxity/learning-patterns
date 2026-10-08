// Noul bands. Between the two thresholds the demo should say it isn't sure rather than guess.
export const MET = 0.65;
export const MISSED = 0.35;
export const band = (noul) => (noul >= MET ? "met" : noul <= MISSED ? "missed" : "unsure");

// Three-group calibration for 27B's horseman, study-belief and topic Choices.
// Fold optima were 0.15, 0.15 and 0.25; use their conservative upper boundary.
// Dialogue branches retain a higher gate to reject a known injected attack.
export const CLEF_CHOICE_CONFIDENT = 0.25;
