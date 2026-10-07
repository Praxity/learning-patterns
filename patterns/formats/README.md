---
title: Switch formats
title_fr: Changez de format
summary: The same section as text, slides, an audio script or a quiz. Switching keeps your place.
section: course
ai: no
offline: yes
learners: not tried
---
# Switch formats

The same section as text, slides, an audio script or a quiz. Switching keeps your place.

## When to use it

Use it when a short lesson benefits from different ways to read, review or practise the same material. Offer choice and access. Do not label learners by a supposed learning style or claim that choosing a format improves learning.

## How it works

1. You choose text, slides, the sample audio script or a quiz.
2. You use Previous and Next to move through the sections. The section counter sits above the content heading. You can switch formats and keep your place.
3. In the quiz, you choose an option and select "Check answer" to read feedback beside it. You can change your answer and check again.
4. If a section has no quiz question, you read its outline and continue.
5. In the last section, you read the lesson summary. In the quiz, you also see how many questions you have checked.

## Evidence

The supplied research notes name Google's Learn Your Way as the design source for switching lesson formats. Google's report describes a randomized study with 60 students aged 15 to 18. Users scored 78%, compared with 67% for a digital PDF reader, on a retention test 3 to 5 days later. The tool combined generated formats, personalization and quizzes. The comparison does not isolate format switching, keeping your place or this authored workplace lesson. It supports investigating the combined approach but establishes no outcome for this pattern. [Google Research, Learn Your Way](https://research.google/blog/learn-your-way-reimagining-textbooks-with-generative-ai/).

The supplied feedback research argues for task-specific, informative feedback. This pattern follows that design advice with option-specific authored explanations. Those notes contain no evaluation of these questions, the sample narration script or section-preserving switches.

Learning-styles matching is not supported by evidence. Pashler and colleagues' review found insufficient evidence to justify matching instruction to assessed learning styles. This pattern offers choice and access, with no style assessment or matching claim. [Pashler et al., Learning styles: concepts and evidence](https://www.psychologicalscience.org/journals/pspi/j.1539-6053.2009.01038.x/).

The lesson examples are demo content. Check subject-matter claims before publishing a course.

Logic unit tested. Not tried with learners.

## Accessibility

Meets the shared baseline in the root README.

- All four format buttons stay in the tab order and expose the chosen format as pressed. Unavailable navigation buttons leave the tab order.
- The disabled Play button explains that no recording is available. It does not start audio.
- Quiz feedback appears beside the chosen option on submit. An empty submission shows a question error and keeps focus on Check answer.
- Format changes keep focus on the chosen control and announce the format and section. During a cross-fade, the outgoing view is inert and hidden from assistive technology.

## Content fields

All content is authored plain text. HTML characters are escaped.

| Field | Meaning |
| --- | --- |
| `title` | Lesson title in the scene header. |
| `points` | At least one lesson section, in display order. |
| `points[].id` | Unique stable id using letters, digits, underscores or hyphens. |
| `points[].title` | Section heading. |
| `points[].sentences` | Nonempty array of sentences for text and narration. |
| `points[].outline` | Nonempty array of concise points for slides and quiz sections without a question. |
| `points[].example` | Optional nonempty array of example sentences for text and narration. |
| `points[].exampleOutline` | Optional concise example for slides and quiz sections without a question. |
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
| `FORMATS` | Frozen `['text', 'slides', 'audio', 'quiz']`. `audio` selects the sample script. |
| `clampPoint(index, count)` | Section index truncated and clamped to `0..count-1`. Nonfinite indices return zero. Invalid counts throw. |
| `movePlace(place, action, count)` | Clamped index after `next`, `previous` or `{ set: index }`. Unknown actions throw. |
| `switchFormat(state, format)` | New `{ format, section }`, keeping the section. Unknown formats throw. |
| `spokenLines(point)` | New array of title, sentences and optional example sentences in narration order. |
| `checkQuizAnswer(questionIndex, optionIndex, quiz)` | `{ correct, feedback }` for the chosen option. Invalid indices throw. |
| `validateState(content, value)` | Copied `{ format, section }` or `null` for invalid saved state. |

The section index is zero-based. Host restoration requires an integer in range and a recognized format, with no extra keys. Invalid state is ignored as a whole, without clamping or announcing. If you reorder or replace sections, the host should invalidate old state.

Format changes cross-fade for 160 ms and switch instantly under reduced motion. The four format buttons stay in one row at narrow widths and with increased text spacing. Icons sit above labels on narrow screens, and labels wrap only between words. Selection uses a 2px accent border and tint. Focus on the selected format extends that border into one thicker edge; other formats keep the shared outer focus ring. Slides use a 16:9 frame that grows for narrow widths and enlarged text. Text uses article paragraphs.

The narration view is labelled "Sample, no audio". It has a disabled Play button, an empty progress track and "0:00 / 1:20". Evenly spaced timestamps illustrate an 80-second sample. The script includes the title, sentences and example in order. It provides no recording, playback, synthesized speech or timed progression.

Without JavaScript, the entire text lesson and final summary are visible. Format controls, alternate views and navigation stay hidden. Enhancement keeps the server elements and changes their visibility. Quiz choices and feedback survive switching during the current enhancement. Saved host state records only the format and section, so quiz answers do not survive a reload.

The first demo question belongs to the first section and the second to the last. The middle section has no question. These associations make the short quiz follow the same section index as the reading.

State is optional. Each navigation or format change writes an independent copy. Repeated enhancement returns the same instance. `destroy()` removes listeners, clears quiz feedback and returns the complete text baseline. Repeated destruction and destruction of an older instance are safe. Host read and write errors propagate.

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

## Adapt it with your agent

> Adapt this short lesson to [topic] for [audience]. Keep `{ title, points: [{ id, title, sentences, outline, example?, exampleOutline? }], quiz: [{ section, prompt, options: [{ text, feedback, correct? }] }], summary }`. Write every learner-facing message. Preserve section ids, give each question exactly one correct option, and check that each format covers the same objectives. Keep English and Québec French together, with vous in French. Keep the complete text fallback, sample narration label, state, escaping, keyboard and accessibility contracts. Make no learning-styles claim. Update the examples, schema, README and interface tests.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
