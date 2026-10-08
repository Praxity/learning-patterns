---
title: Talk it through
title_fr: Parlons-en
summary: Reply to an upset colleague, see how the conversation changes, then reflect on your two moves.
section: conversation
ai: yes
offline: yes
learners: not tried
---
# Talk it through

You changed an agreed work plan without asking Michel. Practise answering his concern in a two-round conversation.

## When to use it

Use it to practise a difficult conversation with a colleague. The five replies let you acknowledge the impact, defend the change, attack, withdraw or ask for a pause. Each path shows a different response from Michel. The debrief describes how your two moves tend to land; it gives no score.

## How it works

1. Read Michel’s opening line, write your reply and select "Say it", or open "Or choose a reply".
2. Michel answers with an authored line for your move. Reply once more to finish the conversation.
3. Read the debrief for both moves. Select "Start over" to try another path.

If a typed reply is unclear or unrelated, Michel does not answer. A quiet line explains how to continue and opens the five replies. Neither result takes a round. A pause includes an italic note that you return ten minutes later. Some endings include a stage note.

## Evidence

In a randomized study of 120 healthcare professionals, practising branching conversations with feedback improved three of four motivational interviewing measures more than further study of the material ([Reger et al., 2020](https://doi.org/10.1001/jamanetworkopen.2020.17348)). This is adjacent evidence for rehearsing a difficult conversation, seeing a consequence and reading an authored debrief. The content adapts the Gottman Institute's examples of repair attempts and the four horsemen from couple relationships to a workplace exchange ([Wilde, 2012](https://www.gottman.com/blog/manage-conflict-repair-and-de-escalate/); [Gottman Institute, 2013](https://www.gottman.com/blog/the-four-horsemen-the-antidotes/)). The model's choices were checked against agent-written answers, not learners. This two-round conversation and its effects on real workplace conversations have not been tested with learners.

## Accessibility

Meets the shared baseline in the root README.

- Focus moves to Michel’s new line after each completed turn, including the final line. That focus reads the line once; the status region stays empty to avoid a duplicate announcement. Tab reaches the composer, or "Start over" at the end.
- Unsure and off-script lines use the single status region without moving focus. Disclosures open immediately.
- Buttons use the shared choice rows and visible focus. Bubbles have different positions and speaker labels, with borders in forced colours.
- Without the model, the composer is replaced by five reply buttons and the whole tree works. Without JavaScript, native nested disclosures form a static script of all 25 paths, stage notes and debriefs.
- English and Québec French use identical fields. The French conversation uses vous.

## Content fields

All content is authored plain text, escaped before rendering.

| Field | Meaning |
| --- | --- |
| `setup` | Two sentences setting the meeting scene. |
| `person` | Michel’s `name`, `role` and avatar `initial`. |
| `subject`, `opening` | Composer subject and Michel’s opening line. |
| `branches` | The five fixed branch identities. |
| `branches[branch].line`, `.endings` | Michel’s first reply, then his final reply for each second move. |
| `branches[branch].move`, `.debrief` | Plain name of the learner’s move and one sentence about how it lands. |
| `examples[node][branch]` | Five example replies for `opening` and each branch node, at most 1,200 characters each. |
| `stageNotes` | Optional italic ending notes keyed `first:second`. |
| `pauseNote` | Return to the conversation after a pause. |
| `unsure`, `offScript` | Helpful guidance that does not advance the conversation. |

The schema and validator reject unknown fields, missing branch identities and blank text. Model questions describe the fixed work-plan scenario. Keep the English opening and first replies in step with the proxy’s `MICHEL_REPLIES`; the unit test checks every line. French translates that same context. Changing the scenario requires changing and evaluating the proxy’s questions too.

## Logic

`logic.js` imports branch identities, the two-round limit, reply limit and model-specific confidence gate from the browser-safe `proxy/logic/03-contract.js`. It never repeats a gate.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming the bad field. |
| `start()` | `{ node: 'opening', round: 0, history: [], end: false }`. Also resets the conversation. |
| `feedback(answers, model?)` | A branch, `'unsure'` or `'off_script'`, from `{ branch: { choice, confidence } }`. Invalid answers throw. |
| `turn(content, state, branch, reply)` | `{ state, line, note }`. History stores `{ branch, reply }`; `end` becomes true after two moves. Unsure/off-script keep the state and return guidance as `note`. Further turns after the end throw. |
| `validateState(value)` | Clean `{ conversation, draft }`, or `null` if the history, node, round, end flag or draft is invalid. |
| `BRANCHES`, `REPLY_LIMIT` | The proxy-owned branch identities and maximum reply length. |

The optional `state: { read, write }` adapter retains the draft and conversation only when the host provides it. Invalid saved state is ignored. Edited pending drafts discard their result; restart cancels pending work. Repeated enhancement returns the same instance. `destroy()` removes listeners, cancels requests and restores the server’s static script.

## Use it

Copy this folder, `lib/` and `proxy/logic/03-contract.js`, preserving relative paths. Include `lib/base.css`, then `pattern.css`. Give each instance a unique id prefix.

```js
import { render } from './patterns/conversation/render.js';
import { enhance } from './patterns/conversation/enhance.js';
import { strings } from './patterns/conversation/strings.js';
import { createAsk } from './lib/ask.js';

const markup = render(content, strings.en, { id: 'meeting', lang: 'en' });
const ask = createAsk({ endpoint: '/api/patterns', fetch: window.fetch.bind(window) });
enhance(document.querySelector('[data-lp-pattern="conversation"]'), { content, strings: strings.en, ask });
```

The shared client calls `ask('03-branch', { node, reply }, { challengeSlot, signal })`. Its `config()` provides the model and bilingual data notice. The notice sits under the composer. Turnstile loads only after the first refusal that requires clearance and appears inline. Missing ask, failed configuration, invalid answers or a thrown request select the reply-button fallback. The demo uses a fixed classification and sends no text.

## Adapt it with your agent

> Rewrite the example replies and debrief for my audience: [audience]. Preserve the work-plan scenario, five branch identities, two rounds, Michel’s opening and first lines, and all 25 endings. Keep each debrief to one plain sentence and each example reply under 1,200 characters. Translate both languages together, using Québec French and vous. Do not add scores or model-written dialogue.

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
