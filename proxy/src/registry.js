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
// Clef/Jev reserve 8,192 tokens. Perplexity bills shared state per question.
// Its bounds cover the UTF-8 bytes of each separate question request at field
// caps, including six-byte JSON escapes, plus 1,024 framing tokens per question.
// Uncertain billing retains this charge; re-evaluate each bound when its wording or fields grow.
export const blocks = Object.fromEntries([
  { ...d03, perplexityMaxInputTokens: 16384, outcome: (answers, model) => ({ branch: readBranch(answers.branch, undefined, model) }) },
  { ...d06, perplexityMaxInputTokens: 16384, outcome: (answers, model) => misconceptionFeedback(answers.misconception, model) },
  { ...d07, perplexityMaxInputTokens: 40960, outcome: explainFeedback },
  // Journal text is personal. Cache hits or shared calls would reveal another learner's submission through cost and timing.
  { ...d13, perplexityMaxInputTokens: 57344, outcome: journalFeedback, cache: false },
  { ...d16, perplexityMaxInputTokens: 49152, outcome: labelAnswers },
].map(block => [block.id, { ...block, maxInputTokens: 8192 }]));
