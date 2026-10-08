---
title: Test out of sections
title_fr: Passez les sections que vous maîtrisez
summary: Answer a short check to see which refresher sections you can skip and which to take.
section: course
ai: no
offline: yes
learners: not tried
---
# Test out of sections

Answer a short check to see which course sections you can skip and which to take.

## When to use it

Use it for a small refresher where one or two questions can justify skipping a section. Advanced questions must test any prerequisite knowledge they credit.

Keep all sections required when the course needs proof that learners saw each one. The host course handles navigation and completion records.

## How it works

1. Read the course outline and select "Start the check".
2. Answer each question. The counter shows the question number and section. Select "Next" to continue or "Back" to revisit an answer.
3. After the last question, select "Check my answers".
4. Read your course plan. Each section says "Skip" or "Take it".
5. Open "Review answers" to see your marks, correct answers and explanations for missed questions.
6. Select "Start over" to clear your answers and return to the outline.

## Evidence

Instruction that helps beginners can hinder learners who already know the material. This is the expertise reversal effect ([Kalyuga et al., 2003](https://doi.org/10.1207/S15326985EP3801_4)). Short tests can estimate what learners know. In experiments, a rapid test correlated up to 0.92 with longer tests and helped choose instruction ([Kalyuga and Sweller, 2004](https://doi.org/10.1037/0022-0663.96.3.558)).

A correct advanced answer can also credit the knowledge it builds on. This follows knowledge space theory, the basis of ALEKS ([Doignon and Falmagne, 1985](https://doi.org/10.1016/S0020-7373(85)80031-6)), and Math Academy's diagnostic ([Math Academy](https://mathacademy.com/how-our-ai-works)). Mastery learning programs require evidence of mastery before learners move on. They improved exam performance in a meta-analysis of 108 evaluations ([Kulik, Kulik and Bangert-Drowns, 1990](https://doi.org/10.3102/00346543060002265)).

One or two multiple-choice answers give little evidence; a guess can be right. Check that every question tests the knowledge it credits. This check and its prerequisite links have not been tested with learners.

## Accessibility

Follows the shared baseline in the root README.

- Each question has a fieldset, legend and labelled options. Missing-answer errors link to the question and options.
- Panel changes focus the heading to announce progress once. Validation errors keep focus on the action button.
- Results announce the skip summary. Section statuses and answer marks use words and icons.
- Review answers uses a native disclosure. Reset focuses the outline heading. Saved state restores silently.

## Content fields

Authors write plain text. Rendering escapes HTML characters. Keep English and Québec French examples together.

| Field | Meaning |
| --- | --- |
| `title` | Course title in the scene header. |
| `allowTestOut` | Required boolean. `false` keeps every section required. |
| `sections` | Nonempty outline in display order. |
| `sections[].id` | Unique positive safe integer. Lowest numeric id breaks credit ties. |
| `sections[].title` | Title in the outline, question counter and result plan. |
| `sections[].requires` | Unique existing section ids. Cycles and self-links are rejected. |
| `questions` | One or two questions per section. Rendering groups them in outline order. |
| `questions[].id` | Unique string id using letters, digits, underscores or hyphens. |
| `questions[].section` | Existing numeric section id. |
| `questions[].text` | Fieldset legend. |
| `questions[].options` | Nonempty list of choices. |
| `questions[].options[].id` | Unique within the question. Letters, digits, underscores or hyphens. |
| `questions[].options[].text` | Choice label. |
| `questions[].correct` | Id of the correct option. |
| `questions[].explanation` | Answer explanation after a wrong answer and in native Answers. Does not explain prerequisite credit. |

`validateContent` rejects unknown fields, blank text, duplicate ids, bad references and cyclic prerequisites. The schema describes local fields. Its `x-uniqueBy`, `x-acyclicReferences`, `x-sectionReference`, `x-sectionQuestions` and `x-optionReference` annotations need `validateContent`. Ordinary schema validators do not enforce them.

## Logic

`logic.js` and `strings.js` have no DOM code or runtime dependencies.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the bad field. |
| `plan(sections, passed, allowTestOut = true)` | `{ rows, skip }`. Rows follow outline order and contain `{ id, title, action: 'take' \| 'passed' \| 'credited', by? }`. `by` names the section granting credit. Invalid sections, passed ids and settings throw. |
| `score(content, picks)` | `{ right, wrong, unanswered, passed, rows, skip }`. Question ids follow content order; `passed` section ids follow outline order. Partial picks can pass fully answered sections. The enhancer requires complete picks. Invalid picks throw. |
| `validateState(content, value)` | Copied `{ picks, shown, step }` or `null`. Step 0 is the outline, 1 through question count are questions, and question count + 1 is results. Shown state requires every answer and the result step. Disabled test-out accepts only step 0. |
| `format(template, values)` | Replaces known `{key}` placeholders once. Inserted values stay literal. |

Without JavaScript, learners can read the outline, answer native questions and open "Answers" for correct options and explanations. There is no computed course plan.

Set `allowTestOut` to `false` when all sections are required. The outline explains this and hides Start. Learners cannot change the setting.

Passing a section requires every answer to be correct. A passed section also credits its prerequisites and theirs. When several passes credit one section, the lowest numeric passed id supplies credit. A direct pass takes precedence. Passed and credited sections both show "Skip"; others show "Take it".

Submission locks answers. Panels show the question number, total and section title. They slide horizontally over 240 ms, or change instantly under reduced motion.

Optional `state: { read, write }` stores `{ picks: { [questionId]: optionId }, shown, step }`. Invalid state is ignored. Partial picks restore to the saved panel; shown results restore silently without moving focus. Picks, panel changes, submission and reset write state. If a restored last panel has earlier unanswered questions, Check returns to the first one.

Repeated enhancement returns the same instance. `destroy()` removes listeners, clears feedback, unlocks radios and restores native Answers. Host state errors propagate.

## Use it

Copy `patterns/test-out/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/test-out/pattern.css`. Use a unique id prefix per instance.

```js
import { render } from './patterns/test-out/render.js';
import { enhance } from './patterns/test-out/enhance.js';
import { strings } from './patterns/test-out/strings.js';
import content from './patterns/test-out/examples/en.json' with { type: 'json' };

document.querySelector('main').innerHTML = render(content, strings.en, { id: 'placement', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

## Adapt it with your agent

> Adapt the test-out examples to [topic] for [audience]. Keep `{ title, allowTestOut, sections: [{ id, title, requires }], questions: [{ id, section, text, options: [{ id, text }], correct, explanation }] }`. Use three or four sections with one or two questions each. Advanced questions must test the prerequisites they credit. Keep ids and references valid, with no prerequisite cycles. Write English and Québec French together, using vous. Preserve native questions and answers, state, local marks, one summary announcement and reflow. Do not claim that one or two answers prove mastery. Ask the author whether skipping is allowed.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
