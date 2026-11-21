import d02 from './demos/02-live.js';
import d03 from './demos/03-branch.js';
import d06 from './demos/06-misconceptions.js';
import d07 from './demos/07-explain-back.js';
import d13 from './demos/13-journal.js';
import d16 from './demos/16-fixtures.js';
import d20 from './demos/20-faq.js';
import d21 from './demos/21-sections.js';
import { faqLookup } from '../logic/20-faq.js';
import { sectionLookup } from '../logic/21-sections.js';
import { liveFeedback } from '../logic/02-live.js';
import { readBranch } from '../logic/03-branch.js';
import { misconceptionFeedback } from '../logic/06-misconceptions.js';
import { explainFeedback } from '../logic/07-explain-back.js';
import { journalDecision } from '../logic/13-journal.js';
import { labelAnswers } from '../logic/16-fixture-data.js';

export const blocks = Object.fromEntries([
  { ...d02, perplexityMaxInputTokens: 40960, outcome: liveFeedback },
  { ...d03, perplexityMaxInputTokens: 16384, outcome: (answers, model) => ({ branch: readBranch(answers.branch, undefined, model) }) },
  { ...d06, perplexityMaxInputTokens: 16384, outcome: (answers, model) => misconceptionFeedback(answers.misconception, model) },
  { ...d07, perplexityMaxInputTokens: 40960, outcome: explainFeedback },
  { ...d13, perplexityMaxInputTokens: 57344, outcome: journalDecision, cache: false },
  { ...d16, perplexityMaxInputTokens: 49152, outcome: labelAnswers },
  { ...d20, perplexityMaxInputTokens: 8192, outcome: faqLookup },
  { ...d21, perplexityMaxInputTokens: 8192, outcome: sectionLookup },
].map(block => [block.id, { ...block, maxInputTokens: 8192 }]));
