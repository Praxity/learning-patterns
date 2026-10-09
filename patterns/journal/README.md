---
title: Journal entry with a nudge
title_fr: Entrée de journal avec un petit rappel
summary: Reflect on your week, save your entry and ask for a question or support message.
section: question
ai: yes
offline: yes
learners: not tried
---
# Journal entry with a nudge

Reflect on practising assertiveness this week. Save your entry in your browser or ask for one optional question.

## When to use it

Use it for weekly course reflections. Each suggestion asks about the first missing detail: a situation, your response, a next step or when to try it. There is no score or checklist.

The distress check was tested only on agent-written answers. It shows an authored support message instead of a question. It does not diagnose, contact anyone or send alerts. Replace the message with your real support details. Test the decision model with your own examples before use with learners.

## How it works

1. Write about your week under today’s date.
2. Select "Save" to keep the entry in this browser. Saving never asks for a suggestion.
3. Select "Get a suggestion" for one optional question, a completion message or a support message.

Editing during a request discards the suggestion. Select "Get a suggestion" again for the revised entry.

Without the decision model, all four questions open with support text below. Without JavaScript, you can write and read the questions and support text, but cannot save.

## Evidence

A review of 29 studies in health professions identified guidance and a supportive setting as conditions for reflection ([Mann et al., 2009](https://doi.org/10.1007/s10459-007-9090-2)). Asking what to try and when draws on research about linking a future situation to an action ([Gollwitzer and Sheeran, 2025](https://doi.org/10.1146/annurev-psych-021524-110536)). Optional questions follow guidance on teaching that supports learner choice ([Reeve and Halusic, 2009](https://doi.org/10.1177/1477878509104319)). Detecting distress in text is unreliable: a review of 75 studies of mental-health prediction from social media found problems with how labels were defined and validated ([Chancellor and De Choudhury, 2020](https://doi.org/10.1038/s41746-020-0233-7)). The support message is a precaution. Offer help whether or not the decision model flags distress. The decision model was tested only on agent-written answers. Workplace reflection benefits, the one-question limit and distress detection have not been tested with learners.

## Accessibility

Daily proxy caps show and announce the reason and midnight UTC reset once, keep focus in place and leave the fallback usable.

Meets the shared baseline in the root README.

- The prompt labels the large writing area. Today’s date uses the page language.
- Each submitted result or save message uses one status region. Suggestions keep focus on the action; typing does not announce or request feedback.
- Native questions open immediately. Support text and questions remain available without the decision model or JavaScript.
- A failed suggestion opens the questions. If the suggestion button has focus, focus moves to the questions' disclosure before the button hides.
- Blocked storage reports that the entry was not saved and keeps the text available to copy.
- English and Québec French share the same fields. French uses vous.

## Content fields

All fields are escaped plain text.

| Field | Meaning |
| --- | --- |
| `prompt` | Page title and accessible name of the writing area. |
| `questions` | Four `{ id, text }` optional questions, ordered `situation`, `action`, `next_step`, `when`. |
| `complete` | Completion message with a decorative check icon when all four details are found. |
| `support` | Support message. Replace it with your real support details. |
| `supportNote` | Support text always available below the questions. |
| `saved` | Confirmation that Save kept the entry in this browser. |
| `changed` | Message when the entry changed during a pending suggestion. |

The proxy checks an assertiveness reflection. To change the task, change and evaluate its criteria too. Unknown fields, blank text and incorrect question order are rejected.

## Logic

`logic.js` imports `journalDecision`, the criterion order and input limit from `proxy/logic/13-journal.js`. That module owns the confidence gates and returns decisions without text. Replace `complete` in the bilingual examples to change the completion message. An uncertain criterion counts as missing. The lower distress gate favours showing support over missing a need for help.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming the bad field. |
| `feedback(content, answers)` | `{ kind: 'support' \| 'complete', text }` or `{ kind: 'nudge', key, text }`. Invalid probabilities throw. |
| `validateAnswer(text)` | `{ ok: true, text }` or `{ ok: false, error: 'empty' \| 'tooLong' }`. Preserves whitespace. |
| `savedEntry(text, savedAt)` | `{ text, savedAt }`, or throws for invalid text or timestamp. |
| `validateState(value)` | A copied saved entry, or `null`. Accepts canonical UTC ISO timestamps and rejects extra fields. |
| `ANSWER_LIMIT` | The proxy-owned maximum entry length. |

Pass `state: { read, write }` to store an entry and its save date. Only Save writes to storage. Invalid saved entries are ignored. A failed read blocks overwriting unreadable storage. A failed write reports failure. Without an adapter, Save reports that saving is unavailable.

Repeated enhancement returns the same instance. `destroy()` cancels pending work, removes listeners and restores native questions and support text. The renderer accepts an optional `date: Date`; enhancement updates it to the learner’s local today.

## Use it

Copy this folder, `lib/`, `proxy/logic/13-journal.js` and `proxy/logic/shared.js`, preserving relative paths. Include `lib/base.css`, then `pattern.css`. Give each instance a unique id prefix.

```js
import { render } from './patterns/journal/render.js';
import { enhance } from './patterns/journal/enhance.js';
import { strings } from './patterns/journal/strings.js';
import { createAsk } from './lib/ask.js';
import { browserState } from './lib/browser-state.js';

const markup = render(content, strings.en, { id: 'weekly', lang: 'en' });
// Keeps the entry in this browser across reloads; denied storage makes Save say it couldn't keep it.
const state = browserState({ pattern: 'journal', lang: 'en', id: 'weekly' });
const ask = createAsk({ endpoint: '/api/patterns', fetch: window.fetch.bind(window) });
enhance(document.querySelector('[data-lp-pattern="journal"]'), { content, strings: strings.en, state, ask });
```

The shared client calls `ask('13-journal', { answer }, { challengeSlot, signal })`. Its data notice appears under "Get a suggestion". Turnstile appears inline when a request needs clearance. The proxy never caches entries. Missing `ask`, failed configuration, invalid answers or failed requests open the authored questions. The demo sends no entry text and uses fixed answers. Its adapter saves locally only on Save.

## Adapt it with your agent

> Adapt the optional questions for [audience]. Keep the assertiveness reflection, four criterion IDs and their order. Keep authored questions and no scores. Use these real support details: [details]. Write English and Québec French together, using vous.

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
