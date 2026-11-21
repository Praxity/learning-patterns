export const MET = 0.65;
export const MISSED = 0.35;
/** @param {number} noul @returns {'met' | 'missed' | 'unsure'} */
export const band = (noul) => (noul >= MET ? "met" : noul <= MISSED ? "missed" : "unsure");

export const CLEF_CHOICE_CONFIDENT = 0.25;
