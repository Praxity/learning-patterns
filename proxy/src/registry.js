import d03 from './demos/03-branch.js';
import d06 from './demos/06-misconceptions.js';
import d07 from './demos/07-explain-back.js';
import d13 from './demos/13-journal.js';
import d16 from './demos/16-fixtures.js';
import { readBranch } from '../logic/03-branch.js';
import { misconceptionFeedback } from '../logic/06-misconceptions.js';
import { explainFeedback } from '../logic/07-explain-back.js';
import { journalFeedback } from '../logic/13-journal.js';
import { labelAnswers } from '../logic/16-fixture-data.js';

// Only blocks accepted on the demo model can receive live checks.
// Evaluation and browser callers use the same decision owners and gates.
export const blocks = Object.fromEntries([
  { ...d03, outcome: (answers, model) => ({ branch: readBranch(answers.branch, undefined, model) }) },
  { ...d06, outcome: (answers, model) => misconceptionFeedback(answers.misconception, model) },
  { ...d07, outcome: explainFeedback },
  { ...d13, outcome: journalFeedback },
  { ...d16, outcome: labelAnswers },
].map(block => [block.id, block]));
