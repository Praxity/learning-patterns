---
title: Test out of sections
title_fr: Passez les sections que vous maîtrisez
summary: Answer a short placement check, then see which refresher sections you can skip and which receive prerequisite credit.
section: course
ai: no
offline: yes
learners: not tried
---
# Test out of sections

A placement check that starts with a four-section course outline, then shows one meeting-refresher question at a time. Check your answers to see which sections you can skip. Correct advanced answers also credit their prerequisites.

## When to use it

Use it for a small refresher where authors can justify skipping a section after one or two questions. Each advanced question must actually test the prerequisite knowledge it credits. An authored prerequisite link alone does not establish that coverage.

Some clients require evidence that learners saw every section. Set `allowTestOut` to `false` for those courses. The outline explains that every section is required and offers no Start button. Without JavaScript, the questions and native Answers remain available. The learner cannot change this setting. This pattern recommends sections to skip; the host course owns navigation and completion records.

## How it works

1. Read "What you'll cover", a numbered outline with no status words. "Start the check" opens the first question.
2. Each panel shows "Question {n} of {total}", a decorative progress bar, the section title, a stem and keyed native radios. Back preserves answers. Next needs an answer and shows a field error if one is missing. The last action is "Check my answers".
3. Complete submissions lock the answers. The outline returns with a one-line skip summary and compact "Skip", "Credited" or "Take it" statuses. Credit sources appear below their section titles.
4. A direct pass requires every question in the section to be correct. Credit follows prerequisite links transitively. If several passes credit a section, the lowest numeric passed section id supplies the credit. A direct pass takes precedence over credit.
5. "Review answers" opens the original questions in a native details element. The chosen row shows "Correct" or "Not quite" with an icon. A wrong answer also reveals the correct row and the author's explanation.
6. Each panel change focuses its heading and announces its progress once. Results announce the summary once. Panels enter horizontally over 240 ms and switch instantly under reduced motion. "Start over" clears answers, marks and statuses and returns focus to the outline heading.

Without JavaScript, the outline and native questions remain usable. Open "Answers" for the correct options and explanations. There is no computed placement result in this baseline.

## Content fields

All authored text is plain text and escaped when rendered. Keep the English and Québec French examples together.

| Field | Meaning |
| --- | --- |
| `title` | Course title in the scene header. |
| `allowTestOut` | Required author boolean. False keeps every section required. |
| `sections` | Nonempty outline in display order. The example has four sections. |
| `sections[].id` | Unique positive safe integer. Lowest numeric id decides credit ties. |
| `sections[].title` | Section title used in headings and credit messages. |
| `sections[].requires` | Unique existing section ids. Cycles, including self-links, are rejected. |
| `questions` | One or two questions per section. The renderer groups them in outline order. |
| `questions[].id` | Unique string identity using letters, digits, underscores or hyphens. |
| `questions[].section` | Existing numeric section id. |
| `questions[].text` | Fieldset legend. |
| `questions[].options` | Nonempty list of authored choices. |
| `questions[].options[].id` | Unique identity within the question, using letters, digits, underscores or hyphens. |
| `questions[].options[].text` | Choice label. |
| `questions[].correct` | Identity of an option in that question. |
| `questions[].explanation` | Explanation shown after a wrong answer and in native Answers. |

`validateContent` rejects unknown fields, blank text, duplicate ids, invalid references and cyclic prerequisites. JSON Schema describes local fields. Its `x-uniqueBy`, `x-acyclicReferences`, `x-sectionReference`, `x-sectionQuestions` and `x-optionReference` annotations document checks requiring `validateContent`; ordinary schema validators do not enforce these annotations.

## Logic

`logic.js` and `strings.js` have no DOM code or runtime dependencies.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the bad field. |
| `plan(sections, passed, allowTestOut = true)` | `{ rows, skip }`. Rows keep outline order and contain `{ id, title, action: 'take' \| 'passed' \| 'credited', by? }`. `by` is the source section id for credit. Rejects invalid sections, passed ids and settings. |
| `score(content, picks)` | `{ right, wrong, unanswered, passed, rows, skip }`. Question groups contain ids in content order. `passed` contains section ids in outline order. Partial answers can pass fully answered sections; the enhancer waits for complete picks. Invalid picks throw. |
| `validateState(content, value)` | Copied `{ picks, shown, step }` or `null` for invalid saved state. Step 0 is the outline, 1 through question count are question panels, and question count + 1 is results. Shown state requires every answer and the result step. Test-out disabled accepts only step 0. |
| `format(template, values)` | Known `{key}` placeholders replaced once. Inserted values stay literal. |

## Use it

Copy `patterns/test-out/` and `lib/`, keeping their relative paths. Link `lib/base.css` before `patterns/test-out/pattern.css`. Give each instance a unique id prefix.

```js
import { render } from './patterns/test-out/render.js';
import { enhance } from './patterns/test-out/enhance.js';
import { strings } from './patterns/test-out/strings.js';
import content from './patterns/test-out/examples/en.json' with { type: 'json' };

document.querySelector('main').innerHTML = render(content, strings.en, { id: 'placement', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

Optional `state: { read, write }` stores `{ picks: { [questionId]: optionId }, shown, step }`. Invalid saved values are ignored. Partial picks restore to their saved panel; complete shown results rebuild silently without moving focus. Each pick, panel change, submission and reset writes state. If a restored last panel lacks earlier answers, Check returns to the first unanswered question. Repeated enhancement returns the same instance. `destroy()` removes listeners, clears feedback, unlocks radios and restores native Answers. Host state errors propagate to the host.

## Accessibility

Native fieldsets, legends and labelled radios work before enhancement. Results use text and decorative Tabler icons. Missing messages describe their fieldsets and radios. One initially empty status region announces each panel change and the result summary once. Panel headings receive focus, while validation errors leave focus on the action button. Restoration is silent. Reset focuses the outline heading. One panel at a time keeps the activity usable in narrow containers.

Browser checks cover axe WCAG 2.0, 2.1 and 2.2 AA rules, keyboard use, both languages, native Answers, independent instances, state, enhancement guards, 320 CSS pixels with text spacing and Chromium forced colours. Motion follows shared reduced-motion styles. Screen reader passes: not yet.

## Evidence

The research reviewed for this pattern describes prerequisite credit in PhysicsGraph and Math Academy diagnostics. That supports the design's provenance, not its effectiveness. [PhysicsGraph's diagnostic description](https://physicsgraph.com/how-it-works/diagnostic) treats correct advanced answers as evidence about prerequisites and requires two agreeing pieces of evidence per topic. The research files report no published diagnostic accuracy data or independent validation of those systems. Research on retrieval practice, spacing and mastery learning does not validate skipping workplace refresher sections after one or two multiple-choice answers.

This four-question meeting check and its prerequisite links have not been tested with learners. A correct answer may be a guess. It does not establish mastery of an entire section. Authors must review item coverage and the consequences of mistaken credit before enabling test-out.

Logic unit tested. Not tried with learners.

## Adapt it with your agent

> Adapt the test-out examples for my refresher topic and audience. Keep `{ title, allowTestOut, sections: [{ id, title, requires }], questions: [{ id, section, text, options: [{ id, text }], correct, explanation }] }`. Use three or four sections and one or two questions per section. Every advanced question must test the prerequisites it credits. Keep prerequisite links acyclic and all ids and references valid. Write the choices and explanations in English and Québec French with vous. Preserve the native baseline, state contract, in-place marks, single summary announcement and container reflow. Do not claim that one or two answers prove mastery. Ask the course author to decide whether skipping is allowed.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
