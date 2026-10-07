---
title: Test out of sections
title_fr: Passez les sections que vous maîtrisez
summary: Answer a short placement check, then see which refresher sections to skip or take.
section: course
ai: no
offline: yes
learners: not tried
---
# Test out of sections

You answer a placement check and see which course sections to skip or take.

## When to use it

Use it for a small refresher where authors can justify skipping a section after one or two questions. Each advanced question must test the prerequisite knowledge it credits. Do not enable skipping when a course requires evidence that learners saw every section. The host course owns navigation and completion records.

## How it works

1. You read the course outline and select "Start the check".
2. You answer one question at a time and select Next. You can use Back to revisit your answers.
3. You select "Check my answers" after the last question.
4. You read your course plan. Sections say "Skip" or "Take it".
5. You open "Review answers" to see your marks, the correct answers and explanations for questions you missed.
6. You select "Start over" to clear the check and return to the outline.

## Evidence

The reviewed research describes prerequisite credit in PhysicsGraph and Math Academy diagnostics. It explains the design's source but does not show that it works. [PhysicsGraph's diagnostic description](https://physicsgraph.com/how-it-works/diagnostic) treats correct advanced answers as evidence about prerequisites and requires two agreeing pieces of evidence per topic. The research files report no published accuracy data or independent validation of those systems. Research on recall practice, spacing and mastery learning does not validate skipping workplace refresher sections after one or two multiple-choice answers.

This four-question meeting check and its prerequisite links have not been tested with learners. A correct answer may be a guess. It does not establish mastery of an entire section. Authors must review item coverage and the consequences of mistaken credit before enabling test-out.

Logic unit tested. Not tried with learners.

## Accessibility

Meets the shared baseline in the root README.

- Each question has a fieldset, legend and labelled options. Missing-answer errors are linked to the question and options.
- Panel changes focus the heading and announce progress. Validation errors keep focus on the action button.
- Results announce the skip summary. Section statuses and answer marks use visible words beside their icons.
- Review answers opens through a native disclosure. Reset focuses the outline heading; restoration stays silent.

## Content fields

All authored text is plain text and escaped when rendered. Keep the English and Québec French examples together.

| Field | Meaning |
| --- | --- |
| `title` | Course title in the scene header. |
| `allowTestOut` | Required author boolean. False keeps every section required. |
| `sections` | Nonempty outline in display order. The example has four sections. |
| `sections[].id` | Unique positive safe integer. Lowest numeric id decides credit ties. |
| `sections[].title` | Section title in the course outline and result plan. |
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

Without JavaScript, the outline and native questions remain usable. Open "Answers" for the correct options and explanations. There is no computed placement result in this baseline.

Set `allowTestOut` to `false` when all sections are required. The outline then explains the requirement and has no Start button. The learner cannot change this setting.

A direct pass requires every question in the section to be correct. Credit follows prerequisite links transitively. If several passes credit a section, the lowest numeric passed section id supplies the credit. A direct pass takes precedence over credit. The result plan shows both passed and credited sections as "Skip", and every other section as "Take it".

Complete submissions lock the answers. Panels show question progress and switch horizontally over 240 ms, or instantly under reduced motion. Without JavaScript, the outline and native questions remain usable. Native Answers provide correct options and explanations, with no computed placement result.

Optional `state: { read, write }` stores `{ picks: { [questionId]: optionId }, shown, step }`. Invalid saved values are ignored. Partial picks restore to their saved panel; complete shown results rebuild silently without moving focus. Each pick, panel change, submission and reset writes state. If a restored last panel lacks earlier answers, Check returns to the first unanswered question. Repeated enhancement returns the same instance. `destroy()` removes listeners, clears feedback, unlocks radios and restores native Answers. Host state errors propagate to the host.

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

## Adapt it with your agent

> Adapt the test-out examples for my refresher topic and audience. Keep `{ title, allowTestOut, sections: [{ id, title, requires }], questions: [{ id, section, text, options: [{ id, text }], correct, explanation }] }`. Use three or four sections and one or two questions per section. Every advanced question must test the prerequisites it credits. Keep prerequisite links acyclic and all ids and references valid. Write the choices and explanations in English and Québec French with vous. Preserve the native baseline, state contract, in-place marks, single summary announcement and container reflow. Do not claim that one or two answers prove mastery. Ask the course author to decide whether skipping is allowed.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
