---
title: Switch formats
title_fr: Changez de format
summary: Choose text, slides, a narration script, an outline or a quiz and keep your current lesson section.
section: course
ai: no
offline: yes
learners: not tried
---
# Switch formats

A small course lesson with five formats and one shared section index. Choose text, slides, a sample narration script, an outline or a short quiz. Switching keeps your place. The examples preserve demo 27's three points about stonewalling and time-outs, Roxanne's example and two quiz questions, with a Québec French translation.

## When to use it

Use it when a short lesson benefits from different ways to read, review or practise the same material. Offer choice and access. Do not label learners by a supposed learning style or claim that choosing a format improves learning.

## How it works

1. The scene header names the lesson. Five buttons select the format, each with visible text and a decorative icon.
2. Previous and Next change the section. Switching format preserves that section and announces "Showing {format}, section {n}." once. Focus stays on the control.
3. Text shows the section's sentences and example. Slides show larger outline points and the example. The narration script lists the title, sentences and example in order. There is no audio file, playback control, synthesized speech or timed progression. Outline shows concise points, including any example outline.
4. Quiz shows the questions assigned to the section. Choose an option, then Check answer to see its authored feedback beside the selected row. You can change your answer and submit again. A section with no question shows its outline and a message explaining how to continue.
5. The last section ends with an authored summary. In Quiz it also reports how many questions currently have checked answers, without a score.

Without JavaScript, the entire text lesson and final summary are visible. Format controls, alternate views and navigation stay hidden. Enhancement keeps the server elements and changes their visibility. Quiz choices and feedback survive switching during the current enhancement. Saved host state records only the format and section, so quiz answers do not survive a reload.

The first demo question belongs to the first section and the second to the last. The middle section has no question. These associations make the short quiz follow the same section index as the reading.

## Content fields

All content is authored plain text. HTML characters are escaped.

| Field | Meaning |
| --- | --- |
| `title` | Lesson title in the scene header. |
| `points` | At least one lesson section, in display order. |
| `points[].id` | Unique stable id using letters, digits, underscores or hyphens. |
| `points[].title` | Section heading. |
| `points[].sentences` | Nonempty array of sentences for text and narration. |
| `points[].outline` | Nonempty array of concise points for slides and outline. |
| `points[].example` | Optional nonempty array of example sentences for text, slides and narration. |
| `points[].exampleOutline` | Optional concise example for outline and slides. |
| `quiz` | Nonempty array of authored questions. |
| `quiz[].section` | An existing `points[].id`, used to associate a question with a section. |
| `quiz[].prompt` | Question text. |
| `quiz[].options` | Nonempty array of `{ text, feedback, correct? }`. Exactly one option has `correct: true`. |
| `summary` | Short lesson summary displayed at the end. |

Unknown fields, empty strings, duplicate section ids, unknown question sections and missing or multiple correct answers throw an Error naming the field. Whitespace is permitted. JSON Schema annotations `x-uniqueBy`, `x-reference` and `x-exactlyOneTrue` describe cross-record rules; ordinary schema tools also need `validateContent` to enforce those rules. Authors check that sentences, outlines, examples and questions cover the same objectives. The pattern cannot verify their meaning.

## Logic

`logic.js` is pure and contains no DOM code or runtime dependencies.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an Error naming the first bad field. |
| `FORMATS` | Frozen `['text', 'slides', 'audio', 'outline', 'quiz']`. `audio` selects the sample script. |
| `clampPoint(index, count)` | Section index truncated and clamped to `0..count-1`. Nonfinite indices return zero. Invalid counts throw. |
| `movePlace(place, action, count)` | Clamped index after `next`, `previous` or `{ set: index }`. Unknown actions throw. |
| `switchFormat(state, format)` | New `{ format, section }`, keeping the section. Unknown formats throw. |
| `spokenLines(point)` | New array of title, sentences and optional example sentences in narration order. |
| `checkQuizAnswer(questionIndex, optionIndex, quiz)` | `{ correct, feedback }` for the chosen option. Invalid indices throw. |
| `validateState(content, value)` | Copied `{ format, section }` or `null` for invalid saved state. |

The section index is zero-based. Host restoration requires an integer in range and a recognized format, with no extra keys. Invalid state is ignored as a whole, without clamping or announcing. If you reorder or replace sections, the host should invalidate old state.

## Use it

Copy `patterns/formats/` and `lib/` with their relative paths. Link `lib/base.css` before `patterns/formats/pattern.css`. Each instance needs a unique id prefix.

```js
import { render } from './patterns/formats/render.js';
import { enhance } from './patterns/formats/enhance.js';
import { strings } from './patterns/formats/strings.js';

// content is your authored object or one of examples/en.json and examples/fr.json.
container.innerHTML = render(content, strings.en, { id: 'lesson', lang: 'en' });
const instance = enhance(container.querySelector('[data-lp-pattern]'), {
  content, strings: strings.en,
  state: { read: () => saved, write: value => { saved = value; } }
});
```

State is optional. Each navigation or format change writes an independent copy. Repeated enhancement returns the same instance. `destroy()` removes listeners, clears quiz feedback and returns the complete text baseline. Repeated destruction and destruction of an older instance are safe. Host read and write errors propagate.

## Accessibility

The scene uses text, an `h3` lesson title and `h4` section headings. Format buttons have visible names and `aria-pressed`. All five remain in the tab order. Previous and Next use `aria-disabled` at the boundaries so focus stays on the control; activating a boundary does nothing. Quiz choices use native radios with keyed rows. Feedback appears only on submit, with an icon, a word and authored text on the chosen row. Changing a choice clears its old feedback. An empty submission displays an error at the question, announces it once and keeps focus on Check answer.

One initially empty status region announces each action once. Restoring state and initial enhancement do not announce. No automatic playback, time limits or content animation. Local CSS keeps selections on plain paper with a 2px border and removes shared shadows. Shared theme tokens control colours, focus, fonts and spacing.

Browser tests cover keyboard use, axe WCAG 2.0, 2.1 and 2.2 AA checks in Chromium, WebKit and Firefox, French, no JavaScript, two instances, lifecycle, state restoration, guard violations, reduced motion, 320 CSS pixels with text spacing and Chromium forced colours. Screen reader passes are a separate human check.

Screen reader passes: not yet

## Evidence

The supplied emerging-tools research notes identify Google's Learn Your Way as the design source for switching representations of one lesson. Google's primary report describes a randomized study with 60 students aged 15 to 18. Learn Your Way users scored 78% versus 67% with a digital PDF reader on a retention test 3 to 5 days later. The tool combined generated representations, personalization and quizzes. The comparison does not isolate format switching, place keeping or this authored workplace lesson. It gives a reason to investigate the combined approach, not an outcome claim for this pattern. [Google Research, Learn Your Way](https://research.google/blog/learn-your-way-reimagining-textbooks-with-generative-ai/).

The supplied feedback research argues for task-specific, informative feedback. This pattern follows that design advice with option-specific authored explanations. Those notes contain no evaluation of these questions, the sample narration script or section-preserving switches.

Learning-styles matching is not supported by evidence. Pashler and colleagues' review found insufficient evidence to justify matching instruction to assessed learning styles. This pattern offers choice and access, with no style assessment or matching claim. [Pashler et al., Learning styles: concepts and evidence](https://www.psychologicalscience.org/journals/pspi/j.1539-6053.2009.01038.x/).

Logic unit tested. Not tried with learners. The lesson examples are demo content; check subject-matter claims before publishing a course.

## Adapt it with your agent

> Adapt this short lesson to [topic] for [audience]. Keep `{ title, points: [{ id, title, sentences, outline, example?, exampleOutline? }], quiz: [{ section, prompt, options: [{ text, feedback, correct? }] }], summary }`. Write every learner-facing message. Preserve section ids, give each question exactly one correct option, and check that each format covers the same objectives. Keep English and Québec French together, with vous in French. Keep the complete text fallback, sample narration label, state, escaping, keyboard and accessibility contracts. Make no learning-styles claim. Update the examples, schema, README and interface tests.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
