import { annotate, feedback, validateContent, validateState } from 'learning-patterns/patterns/self-check/logic.js';
import { strings } from 'learning-patterns/patterns/self-check/strings.js';
import schema from 'learning-patterns/patterns/self-check/content.schema.json' with { type: 'json' };

export function check(content: unknown, state: unknown) {
  validateContent(content);
  const result = feedback(content, []);
  const segments = annotate(content.model, content.parts, []);
  const saved = validateState(content, state);

  result.count satisfies number;
  segments[0].text satisfies string;
  saved?.answer satisfies string | undefined;
  strings.fr.answer satisfies string;
  schema.properties.task.type satisfies string;

  // @ts-expect-error Criterion IDs must be strings.
  feedback(content, [123]);
  // @ts-expect-error Translated labels are strings.
  strings.en.answer satisfies number;
  // @ts-expect-error The schema's field type is a string.
  schema.properties.task.type satisfies number;

  return { result, segments, saved, label: strings.en.answer, schema };
}
