---
title: Journal with one nudge
title_fr: Journal avec une question
summary: Reflect on your week, save your entry and get one optional question or an authored support line.
section: course
ai: yes
offline: yes
learners: not tried
---
# Journal with one nudge

A dated journal page asks what you noticed while practising assertiveness. Write your reflection, save it in your browser or ask for one optional question.

## When to use it

Use it for a weekly reflection across a course. The question invites a specific moment, what you did, a next step and when you will try it. Each suggestion asks about the first missing part. There is no score or checklist.

The distress check is a decision model judgement tested only on agent-written answers. Its only effect is to show the authored support line instead of a question. It does not diagnose, contact anyone or send an alert. A host should place its real support details in that line. Check the decision model with your own examples before using it with learners.

## How it works

1. Write about your week under today’s date.
2. Select "Save" to keep the entry in this browser. Saving never asks for a suggestion.
3. Select "Get a suggestion" to read one optional question, the all-there line or the support line.

If you change the entry while a suggestion is pending, a quiet message says that no suggestion was shown. Select the action again for the revised entry.

Without the decision model, all four questions open at once. The authored support line stays visible below. Without JavaScript, you can write and read the questions and support line, but cannot save through this pattern.

## Evidence

A review of 29 studies in health professions identified guidance and a supportive setting as conditions for reflection ([Mann et al., 2009](https://doi.org/10.1007/s10459-007-9090-2)). A question about what to try and when draws on research about plans linking a future situation to an action ([Gollwitzer and Sheeran, 2025](https://doi.org/10.1146/annurev-psych-021524-110536)). Making the question optional follows guidance on autonomy-supportive teaching ([Reeve and Halusic, 2009](https://doi.org/10.1177/1477878509104319)). Detecting distress in text is unreliable: a review of 75 studies of mental-health prediction from social media found problems with how labels were defined and validated ([Chancellor and De Choudhury, 2020](https://doi.org/10.1038/s41746-020-0233-7)). The journal's support line is therefore a precaution, and hosts should offer help whether or not the decision model flags anything. The decision model's choices were checked against agent-written answers, not learners. Benefits for workplace reflection, the one-question limit and detection of distress have not been tested with learners.

## Accessibility

Meets the shared baseline in the root README.

- The prompt labels the large writing area. Today’s date uses the page language.
- Each submitted result or save message uses one status region. Suggestions keep focus on the action; typing does not announce or request feedback.
- Native questions open immediately. Support text and questions remain available without the decision model or JavaScript.
- Blocked storage reports that the entry was not saved and keeps the text available to copy.
- English and Québec French share the same fields. French uses vous.

## Content fields

All fields are authored plain text and are escaped before rendering.

| Field | Meaning |
| --- | --- |
| `prompt` | Page title and accessible name of the writing area. |
| `questions` | Four `{ id, text }` optional questions, ordered `situation`, `action`, `next_step`, `when`. |
| `complete` | The authored complete-feedback line, shown with a decorative check icon when all four elements are found. |
| `support` | Calm, practical support line. Replace it with your real support details. |
| `saved` | Confirmation that Save kept the entry in this browser. |
| `changed` | Message when the entry changed during a pending suggestion. |

The proxy’s questions evaluate an assertiveness reflection. Adapting that task requires adapting and evaluating the proxy’s criteria too. Unknown fields, blank text and reordered question identities are rejected.

## Logic

`logic.js` reuses `journalDecision`, the criterion order and input limit from `proxy/logic/13-journal.js`. That module owns the confidence gates and returns decisions without text. The bilingual example content owns the completion wording, and hosts can replace its `complete` field. An unsure nudge criterion counts as missing. The lower distress gate deliberately favours showing support over missing a support need.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming the bad field. |
| `feedback(content, answers)` | `{ kind: 'support' \| 'complete', text }` or `{ kind: 'nudge', key, text }`. Invalid probabilities throw. |
| `validateAnswer(text)` | `{ ok: true, text }` or `{ ok: false, error: 'empty' \| 'tooLong' }`. Preserves whitespace. |
| `savedEntry(text, savedAt)` | `{ text, savedAt }`, or throws for invalid text or timestamp. |
| `validateState(value)` | A copied saved entry, or `null`. Accepts canonical UTC ISO timestamps and rejects extra fields. |
| `ANSWER_LIMIT` | The proxy-owned maximum entry length. |

The optional `state: { read, write }` adapter stores a submitted entry with its save date. Only Save writes; suggestion requests and typing do not. Invalid saved entries are ignored. A failed read prevents overwriting unreadable storage; a failed write never shows a success message. Without an adapter, Save explains that saving is unavailable.

Repeated enhancement returns the same instance. `destroy()` cancels pending work, removes listeners and restores native questions and support text. The renderer accepts an optional `date: Date`; enhancement updates it to the learner’s local today.

## Use it

Copy this folder, `lib/`, `proxy/logic/13-journal.js` and `proxy/logic/shared.js`, preserving relative paths. Include `lib/base.css`, then `pattern.css`. Give each instance a unique id prefix.

```js
import { render } from './patterns/journal/render.js';
import { enhance } from './patterns/journal/enhance.js';
import { strings } from './patterns/journal/strings.js';
import { createAsk } from './lib/ask.js';

const markup = render(content, strings.en, { id: 'weekly', lang: 'en' });
const state = {
  read: () => JSON.parse(localStorage.getItem('weekly-journal') ?? 'null'),
  write: value => localStorage.setItem('weekly-journal', JSON.stringify(value))
};
const ask = createAsk({ endpoint: '/api/patterns', fetch: window.fetch.bind(window) });
enhance(document.querySelector('[data-lp-pattern="journal"]'), { content, strings: strings.en, state, ask });
```

The shared client calls `ask('13-journal', { answer }, { challengeSlot, signal })`. Its configured data notice sits under "Get a suggestion" only. Turnstile appears inline only when a submitted request needs clearance. The proxy never caches journal text. Missing ask, failed configuration, invalid answers or a thrown request select the authored questions. The demo uses fixed answers and sends no entry text; its host adapter saves locally only when you select Save.

## Adapt it with your agent

> Rewrite the optional questions for my audience: [audience]. Keep the assertiveness reflection, the four criterion identities and their order. Use calm, optional questions, no scores and no text written by a decision model. Replace the support line with these real support details: [details]. Translate both languages together, using Québec French and vous.

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
