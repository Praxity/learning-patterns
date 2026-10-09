---
title: Talk it through
title_fr: Parlons-en
summary: Practise two replies to an upset colleague and review what happened.
section: conversation
ai: yes
offline: yes
learners: not tried
---
# Talk it through

You changed a work plan without asking Michel. Practise answering him in two rounds.

## When to use it

Use it to practise a difficult workplace conversation. You can acknowledge the impact, defend the change, attack, withdraw or ask for a pause. Michel responds to each choice. The review explains the effects of your two replies. It gives no score.

## How it works

1. Read Michel’s opening line, write your reply and select "Say it", or open "Or choose a reply".
2. Read Michel’s response. Reply once more to finish the conversation.
3. Read the review of both replies. Select "Start over" to try another path.

Unclear or unrelated replies get guidance and open the five reply choices. Michel does not answer, and the round stays available. A pause shows a note that you return ten minutes later. Some endings include stage notes.

## Evidence

In a randomized study of 120 healthcare professionals, practising branching conversations with feedback improved three of four motivational interviewing measures more than further study of the material ([Reger et al., 2020](https://doi.org/10.1001/jamanetworkopen.2020.17348)). This supports conversation practice with consequences and feedback, but did not test this pattern. The content adapts the Gottman Institute's examples of repair attempts and the four horsemen from couple relationships to a workplace exchange ([Wilde, 2012](https://www.gottman.com/blog/manage-conflict-repair-and-de-escalate/); [Gottman Institute, 2013](https://www.gottman.com/blog/the-four-horsemen-the-antidotes/)). The decision model was tested only on agent-written answers. This two-round conversation and its effects on workplace conversations have not been tested with learners.

## Accessibility

Daily proxy caps show and announce the reason and midnight UTC reset once, keep focus in place and leave the fallback usable.

Meets the shared baseline in the root README.

- Each completed turn moves focus to Michel’s new line, including the final line. Focus announces it once; the status region stays empty. Tab reaches the reply box, or "Start over" at the end.
- Unsure and off-script lines use the single status region without moving focus. Disclosures open immediately.
- Reply buttons have visible focus. Speech bubbles differ in position and speaker label, with borders in forced colours.
- Without the decision model, five reply buttons replace the reply box and support every path. Without JavaScript, nested disclosures show all 25 paths, stage notes and reviews.
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
| `branches[branch].move`, `.debrief` | Name of the learner’s response and one sentence about its effect. |
| `examples[node][branch]` | Five example replies for `opening` and each branch node, at most 1,200 characters each. |
| `stageNotes` | Optional italic ending notes keyed `first:second`. |
| `pauseNote` | Return to the conversation after a pause. |
| `unsure`, `offScript` | Helpful guidance that does not advance the conversation. |

The schema and validator reject unknown fields, missing branch IDs and blank text. Keep the English opening and first replies identical to the proxy’s `MICHEL_REPLIES`; tests check every line. French must convey the same context. To change the work-plan scenario, change and evaluate the proxy questions too.

## Logic

`logic.js` imports branch identities, the two-round limit, reply limit and decision model's confidence gate from the browser-safe `proxy/logic/03-contract.js`. That module owns the gate.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming the bad field. |
| `start()` | `{ node: 'opening', round: 0, history: [], end: false }`. Also resets the conversation. |
| `feedback(answers, model?)` | A branch, `'unsure'` or `'off_script'`, from `{ branch: { choice, confidence } }`. Without a decision model, uses Jev's confidence gate, also used by the default Perplexity provider. Invalid answers throw. |
| `turn(content, state, branch, reply)` | `{ state, line, note }`. History stores `{ branch, reply }`; `end` becomes true after two moves. Unsure/off-script keep the state and return guidance as `note`. Further turns after the end throw. |
| `validateState(value)` | Clean `{ conversation, draft }`, or `null` if the history, node, round, end flag or draft is invalid. |
| `BRANCHES`, `REPLY_LIMIT` | The proxy-owned branch identities and maximum reply length. |

Pass `state: { read, write }` to save the draft and conversation. Invalid saved state is ignored. Editing during a check discards its result; restarting cancels requests. Repeated enhancement returns the same instance. `destroy()` removes listeners, cancels requests and restores the static script.

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

The shared client calls `ask('03-branch', { node, reply }, { challengeSlot, signal })`. Its `config()` supplies the decision model and bilingual data notice below the reply box. Turnstile appears inline after a clearance refusal. Missing `ask`, failed configuration, invalid answers or a failed request opens the reply choices. The demo uses a fixed classification and sends no text.

## Adapt it with your agent

> Adapt the example replies and reviews for [audience]. Keep the work-plan scenario, five branch IDs, two rounds, Michel’s opening and first lines, and all 25 endings. Write one plain review sentence per response and keep example replies under 1,200 characters. Write English and Québec French together, using vous. Keep authored dialogue and no scores.

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
