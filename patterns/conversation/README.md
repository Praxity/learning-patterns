---
title: Scenario talk-through
title_fr: Mise en pratique dans un scénario
summary: Practise two replies to an upset colleague and review what happened.
section: conversation
ai: yes
offline: yes
learners: not tried
---
# Scenario talk-through

You changed a work plan without asking Michel. Practise answering him in two rounds.

## Use it when

- Learners need to practise a difficult conversation where each reply changes how the other person responds.
- Learners know what they should say but, under pressure, defend, attack or withdraw.

## Avoid it when

- When you need a score for conversation skills, use an assessed role-play. This pattern gives feedback without a score.

## Before you use it

It needs a server running a model. Without the decision model, five reply buttons replace the reply box and support every path. Review all replies and endings for your audience, and arrange to update and test the model checks when the scenario changes.

## How it works

1. Michel opens. The learner types a reply and selects "Say it", or picks one from "Or choose a reply".
2. Michel responds. The learner replies once more, which ends the conversation.
3. A review comments on both replies. "Start over" tries another path.

If the model can't place a reply, or the reply is off topic, Michel doesn't respond. The learner gets a line of guidance and the five reply choices, and tries the same turn again.

## Evidence

In a randomized study of 120 healthcare professionals, practising branching conversations with feedback improved three of four motivational interviewing measures more than further study of the material ([Reger et al., 2020](https://doi.org/10.1001/jamanetworkopen.2020.17348)). This supports conversation practice with consequences and feedback, but did not test this pattern. The content adapts the Gottman Institute's examples of repair attempts and the four horsemen from couple relationships to a workplace exchange ([Wilde, 2012](https://www.gottman.com/blog/manage-conflict-repair-and-de-escalate/); [Gottman Institute, 2013](https://www.gottman.com/blog/the-four-horsemen-the-antidotes/)). The decision model was tested only on agent-written answers. This two-round conversation and its effects on workplace conversations have not been tested with learners.

## Accessibility

Meets the shared baseline in the root README.

Review the reply choices, stage notes and endings for your audience. Without JavaScript, learners can open every conversation path and read its review.

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

If the first reply asks for a break, Michel agrees and a note reads "Ten minutes later, you're back with Michel." Some endings add a stage note, such as "Michel leaves the meeting."

Authored text is capped at 120 characters for titles and labels, 400 for questions and prompts, 300 for options, and 1,500 for answers, explanations and passage text. Avatar `person.initial` is at most two characters; example replies stay capped at 1,200. The schema gives each field's limit; `validateContent` enforces it.

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

Stored drafts restore intact even above the send limit, with valid conversation history. The host owns its total storage budget; sent replies and history entries still obey the reply limit.

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

### Accessibility details

Text fields keep the full draft, including text over the limit. Checking or saving shows a linked length error instead of cutting text. Limits come from the existing logic constants. The automatic action stays enabled while model configuration loads. An early press waits for configuration, then checks or uses the existing fallback.

Daily proxy caps show and announce the reason and midnight UTC reset once, keep focus in place and leave the fallback usable.

- Each completed turn moves focus to Michel’s new line, including the final line. The reply controls hide or change only after focus arrives, so focus never falls to the page body. Focus announces the line once; the status region stays empty. Tab reaches the reply box, or "Start over" at the end.
- While a reply is sending, "Say it" keeps its label and focus, and pressing it again sends nothing. "Sending…" appears beside it. If the reply takes more than a second, the status region says "Sending…" once.
- If automatic checking fails while the reply box or "Say it" has focus, focus moves to the message "Automatic checking is unavailable. Choose a reply to continue." before the reply box hides. Focus reads the message, so the status region stays empty, and the next Tab reaches the first reply. If focus is elsewhere, the status region announces the message once.
- Unsure and off-script lines use the single status region without moving focus. Disclosures open immediately.
- Reply buttons have visible focus. Speech bubbles differ in position and speaker label, with borders in forced colours.
- Without the decision model, five reply buttons replace the reply box and support every path. Without JavaScript, nested disclosures show all 25 paths, stage notes and reviews.
- English and Québec French use identical fields.

## Adapt it with your agent

> Adapt the example replies and reviews for [audience]. Keep the work-plan scenario, five branch IDs, two rounds, Michel’s opening and first lines, and all 25 endings. Write one plain review sentence per response and keep example replies under 1,200 characters. Write English and Québec French together, using vous. Keep authored dialogue and no scores.

## Related patterns

- [Journal entry with a nudge](../journal/README.md)
- [Check your own answer](../self-check/README.md)

## Help improve this pattern

Tried it with learners? [Tell us what happened](https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml&pattern=Scenario%20talk-through). You can also [suggest a change to this page](https://github.com/Praxity/learning-patterns/edit/main/patterns/conversation/README.md).

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
