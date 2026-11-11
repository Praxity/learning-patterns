---
title: Which is better, and why
title_fr: Quelle version est la meilleure, et pourquoi
summary: Read two versions of the same email, highlight the sentence that shows each quality or say neither does, then see the better version annotated.
section: question
ai: no
offline: yes
learners: not tried
---
# Which is better, and why

Read two versions of the same email. For each quality, highlight the sentence that shows it, or say neither version does, then see the better version annotated.

## Use it when

- Good and weak emails look alike at first, and the difference is in one or two sentences, as in a reply to a customer or a request to a colleague.
- Learners can tell which version is better but can't yet point to what makes it better.
- A course on giving feedback needs learners to see what good looks like before they comment on a colleague's draft.

## Avoid it when

- When learners should judge a single draft and write feedback on it, use [Give feedback on a colleague's work](../mark-colleague/README.md).
- When one passage holds the answer and nothing is compared, use [Highlight the key passage](../highlight/README.md).
- When one detail of a case decides which rule applies, use [Change one detail](../change-one-detail/README.md).

## Before you use it

Write two complete versions of the same email: a subject, a greeting, a body of one to three short paragraphs with two to six sentences in all, and a sign-off. Make both versions attempt the same things, so a learner has to read both to answer, not only the better one. Write a phone number with a word joiner (U+2060) after each hyphen, so it never breaks across lines.

Write two to four questions, each about one quality both versions attempt, such as "Which sentence tells a customer with an urgent order exactly who to call?" Put the deciding word in the question ("exactly", "plainly"), so only one sentence can be defended from the card alone. Make at least one answer "Neither version does this", so learners can't score by always picking the better version.

Every answer sentence is in the body of the better version. A pair where the weaker version does one thing better isn't supported yet. The subject, greeting and sign-off are context, not answers.

For each question, write a reason that says why the right sentence works and why the weaker one falls short, and a note of two to six words that names the quality ("Who to call for an urgent order"). The summary puts each note under its sentence, or under "Missing from both versions", so write every note in a form that fits both.

## How it works

1. The learner reads the situation and both versions as emails: a subject line, then the body. On a wide screen the emails sit side by side; on a phone, one under the other.
2. One question at a time, they highlight a sentence in the body of either email, as in [Highlight the key passage](../highlight/README.md), or choose "Neither version does this" under the emails. Then they select "Check my answer". Selecting another sentence moves the highlight; selecting the highlighted sentence again clears it.
3. A "Correct" or "Incorrect" mark follows their choice, a "Correct answer" mark follows the right sentence if they didn't choose it, and the reason appears under the emails. The highlighter moves to the sentence that shows the quality, as the summary will show it.
4. "Next question" opens the next quality. After the last one, "Show the summary" gives the number they got right in one sentence and shows the better email with each answer sentence highlighted and its note under it. Qualities neither version has are listed under "Missing from both versions".
5. "Start over", on the summary, clears every answer.

Without JavaScript, the learner reads both emails, then each question with a "Show the answer" disclosure that quotes the right sentence and gives the reason.

## Evidence

Comparing two examples side by side teaches more than studying them one at a time. In a randomised study, 70 seventh-grade students learned to solve equations either by comparing two solution methods or by studying the same methods one at a time. The students who compared gained more procedural knowledge and flexibility, and about the same conceptual knowledge ([Rittle-Johnson and Star, 2007](https://doi.org/10.1037/0022-0663.99.3.561)). A meta-analysis of 57 experiments found that comparing cases led to more learning than studying single or sequential cases or traditional instruction (d = 0.50). Comparison helped more when learners looked for what the cases share, when a principle followed the comparison and when testing came soon after ([Alfieri, Nokes-Malach and Schunn, 2013](https://doi.org/10.1080/00461520.2013.775712)). In three studies with novices learning to negotiate, comparing two examples helped them take a strategy from the examples and use it on later problems ([Gentner, Loewenstein and Thompson, 2003](https://doi.org/10.1037/0022-0663.95.2.393)).

None of these studies asked learners to point to the sentence that shows a quality, offered a "neither" answer or used workplace writing. Here learners look for differences, while the meta-analysis found larger gains when learners looked for what cases share. The reason after each question does the job of the principle that follows a comparison. This combination has not been tested, and the pattern has not been tried with learners.

## Accessibility

Follows the shared baseline in the root README.

Each body sentence is an inline toggle button named by its own words, inside a group named by its version, so a screen reader says "Version B" as focus moves into that email. A chosen sentence takes a highlighter colour and a 2px accent underline; in forced colours it uses the system mark colours and a highlight-coloured underline. Without JavaScript, learners read both emails and open each answer, but nothing is chosen or saved.

## Content fields

All text is plain text and escaped on render. Keep English and Canadian French examples together.

| Field | Meaning |
| --- | --- |
| `title` | Card heading, the name of the task, at most 120 characters. |
| `context` | The situation, at most 400 characters. |
| `versions.a`, `versions.b` | The two versions of the email. |
| `versions.*.subject` | The subject line, at most 120 characters. |
| `versions.*.greeting` | The greeting, such as "Hello,", at most 120 characters. |
| `versions.*.body` | One to three paragraphs, each a list of sentences, two to six sentences in all, at most 300 characters each. Only these sentences can be chosen. |
| `versions.*.signoff` | The sign-off, at most 200 characters. A line break (`\n`) starts a new line, as in `"Thanks,\nSam Rivera"`. |
| `better` | `"a"` or `"b"`: the better version, which the summary shows. |
| `qualities` | Two to four questions, in display order. |
| `qualities[].question` | One question about one quality, at most 400 characters. |
| `qualities[].sentence` | The number of the body sentence in the better version that shows the quality, counted from 1 across its paragraphs, or `null` when neither version does. |
| `qualities[].reason` | Why that sentence works and the other falls short, at most 600 characters. |
| `qualities[].note` | Two to six words naming the quality, shown in the summary, at most 120 characters. |

`validateContent` rejects unknown fields, empty text, counts outside the limits, a sentence number the better version doesn't have, two questions on the same sentence, and content where every answer is `null`. Standard schema validators enforce the shapes and text limits; the `x-sentences`, `x-uniqueBy` and `x-oneNamesSentence` annotations need `validateContent`.

## Logic

`logic.js`, `strings.js` and the schema contain no DOM code.

A pick is a body sentence written as its version and number, counted across paragraphs, such as `"b2"`, or `"neither"`.

| Export | Returns |
| --- | --- |
| `NEITHER` | The pick `"neither"`. |
| `validateContent(content)` | Nothing; throws an Error naming the invalid field. |
| `answer(content, index)` | The right pick for that question. |
| `sentenceOf(content, pick)` | `{ version, sentence }` for a sentence pick, or `null` for `"neither"` or an unknown pick. |
| `isPick(content, value)` | Whether the value is a pick for this content. |
| `pickName(content, strings, pick)` | The version a sentence pick is in, such as "Version B", or the Neither label. |
| `answerText(content, strings, index)` | The right answer as one line with its closing punctuation, such as "Correct answer, in Version B: For an urgent order, call …", or "Correct answer: Neither version does this." |
| `score(content, picks)` | `{ results, right, total, done }` for checked picks in question order. Throws for an unknown pick or too many picks. |
| `summary(content)` | `{ version, paragraphs: [[{ text, note }]], missing }`: the better version's body with each answer sentence's note (`null` for the others), then the notes of the qualities neither version has. |
| `validateState(content, value)` | An independent `{ at, picks }` copy, or `null`. |
| `format(template, values)` | Placeholder substitution preserving inserted text literally. |

Optional host `state: { read, write }` stores `{ at, picks }`: `at` is the open question, or the number of questions once the summary shows, and `picks` holds the checked picks. Every question before `at` is checked, and `at` itself may be. Each check, "Next question", "Show the summary" and "Start over" write it. A choice the learner hasn't checked stays in the page and is not saved. Restoring shows the saved question with its marks, or the summary, and moves no focus. Invalid saved values are ignored. Without an adapter the answers last for the mounted instance. Repeated enhancement returns the same instance; `destroy()` removes listeners, clears the answers and restores the no-JavaScript view.

## Use it

Copy `patterns/which-is-better/` and `lib/`, keeping relative paths. Link `lib/base.css` before `patterns/which-is-better/pattern.css`. Use a unique id prefix per instance.

```js
import { render } from './patterns/which-is-better/render.js';
import { enhance } from './patterns/which-is-better/enhance.js';
import { strings } from './patterns/which-is-better/strings.js';
import content from './patterns/which-is-better/examples/en.json' with { type: 'json' };

document.querySelector('main').innerHTML = render(content, strings.en, { id: 'replies', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

### Accessibility details

- The question line holds the progress, "Question 1 of 3", and the question. It labels the group of choices, and the line under it, "Select one sentence in either version.", describes the group.
- Each version has a level 3 heading, one level below the card title, and its email is a group named by that heading. Tab moves through Version A's body sentences, Version B's, then "Neither version does this". Space or Enter presses a sentence or the Neither row, and each reports its pressed state. Arrow keys move between sentences through both emails and wrap; Home and End go to the first and last sentence. They work when the screen reader passes them to the page.
- "Check my answer" with nothing chosen shows an error under the question, linked to every choice, brings the question into view and moves focus to the first sentence, which reads the error once.
- Choices show the focus ring for keyboard focus only; a tapped or clicked sentence shows its highlight and a tapped Neither row its border.
- After a check, focus moves to the feedback under the emails. For screen readers it starts with "Correct." or "Incorrect. Correct answer, in Version B:" and the right sentence, then the reason, so the result is read once and the status region stays empty. Each mark follows its sentence in the text, kept on the line of the sentence's last word. The choices lock: sentences stay in the tab order so their marks can be read, and Tab goes on to "Next question".
- "Next question" brings the new question line into view and moves focus to it. "Show the summary" moves focus to the result sentence; the annotated version follows in reading order, each note under its sentence and introduced by a hidden "This sentence shows:".
- "Start over" announces "Answers cleared." and moves focus to the first question.
- Marks use words, icons and borders as well as colour.

## Adapt it with your agent

> Adapt the which-is-better examples to [topic] for [audience]. Keep `{ title, context, versions: { a, b }, better, qualities: [{ question, sentence, reason, note }] }`, where each version is an email `{ subject, greeting, body: [[sentence]], signoff }`. Write two complete versions of the same email, each with one to three paragraphs and two to six body sentences in all, where both versions attempt the same things. Write two to four questions, each about one quality both versions attempt, with the deciding word in the question so one body sentence, or neither, is the only defensible answer from the card alone. Number answer sentences from 1 across the better version's paragraphs, and make at least one answer `null` (neither version). Write each reason as why the right sentence works and the other falls short, and each note in two to six words that fit both "This sentence shows:" and "Missing from both versions". Write English and Québec French together, using vous. Preserve the email layout, the highlightable body sentences, the Neither row, one question at a time, the marks, the annotated summary, the no-JavaScript disclosures, one status region and saved state. Show both languages for review.

## Related patterns

- [Give feedback on a colleague's work](../mark-colleague/README.md)
- [Highlight the key passage](../highlight/README.md)
- [Change one detail](../change-one-detail/README.md)
- [Check your own answer](../self-check/README.md)

## Help improve this pattern

Tried it with learners? [Tell us what happened](https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml&pattern=Which%20is%20better%2C%20and%20why). You can also [suggest a change to this page](https://github.com/Praxity/learning-patterns/edit/main/patterns/which-is-better/README.md).

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
