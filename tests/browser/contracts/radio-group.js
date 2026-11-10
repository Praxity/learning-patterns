// Contract data is independent of Playwright and shared by every binding.
const apg = 'https://www.w3.org/WAI/ARIA/apg/patterns/radio/';
const wcag = 'https://www.w3.org/TR/WCAG22/';

// WebKit walks NodeTraversal::next/previous and returns at the document boundary.
// It has no wrap path in RadioInputType::handleKeydownEvent (lines 116-158).
export const webkitRadioArrows = {
  wraps: false,
  source: 'https://github.com/WebKit/WebKit/blob/67d931686f9e8cd74deeadd0da510cafd8686ba5/Source/WebCore/html/RadioInputType.cpp#L116-L158'
};

export const radioGroupContract = [
  { id: 'group-name', outcome: 'The native group is named by its visible legend.', static: true,
    sources: [wcag + '#info-and-relationships', wcag + '#name-role-value', 'https://www.w3.org/TR/html-aam-1.0/#el-fieldset'] },
  { id: 'radio-names', outcome: 'Every option exposes the radio role and its authored name.', static: true,
    sources: [apg + '#wai-ariaroles,states,andproperties', wcag + '#name-role-value'] },
  { id: 'checked', outcome: 'Exposed selection agrees with native rendered checked state and the binding.', static: true,
    sources: [apg + '#wai-ariaroles,states,andproperties', wcag + '#name-role-value'] },
  { id: 'tab', outcome: 'Tab enters once at the selected radio or first radio, then leaves; Shift+Tab returns to the selected radio.', static: false,
    sources: [apg + '#keyboardinteraction', wcag + '#no-keyboard-trap'] },
  { id: 'arrows', outcome: 'All four arrows move focus and selection; Chromium/Firefox wrap and native WebKit stops at endpoints.', static: false,
    sources: [apg + '#keyboardinteraction', wcag + '#keyboard', webkitRadioArrows.source] },
  { id: 'space', outcome: 'Space selects an unchecked focused radio and does not clear a checked radio.', static: false,
    sources: [apg + '#keyboardinteraction', wcag + '#keyboard'] },
  { id: 'stable-names', outcome: 'Selecting and deselecting every option preserves its authored accessible name.', static: false,
    sources: [apg + '#wai-ariaroles,states,andproperties', wcag + '#name-role-value'] },
  { id: 'focus', outcome: 'Every radio has the repository-required visible 3px keyboard focus outline.', static: false,
    sources: [wcag + '#focus-visible'] }
];

/** Full authored legend name, allowing layout whitespace beside its comma.
 * AccName 4.3.2 (Name From Content) discusses CSS-dependent joining:
 * https://www.w3.org/TR/accname-1.2/#computation-steps
 * @param {string} caption
 * @param {string} question
 */
export function numberedLegendName(caption, question) {
  const words = text => text.trim().split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  return new RegExp(`^${words(caption)}\\s*,\\s*${words(question)}$`);
}
