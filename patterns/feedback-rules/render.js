import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { summarize, validateContent } from './logic.js';

/** @param {string} template @param {Record<string, unknown>} values */
export function format(template, values) { return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key])); }
/** @param {ReturnType<typeof summarize>} summary @param {import('./strings.js').Strings} strings */
export function summaryText(summary, strings) {
  return format(strings.summary, { ...summary,
    disagreementWord: summary.disagree === 1 ? strings.disagreement : strings.disagreements,
    unsureWord: summary.unsure === 1 ? strings.uncertainty : strings.uncertainties
  }) + (summary.notRun ? ` ${format(strings.unrun, summary)}` : '');
}

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content, strings, { id, lang }) {
  validateContent(content); const language = lang === 'fr' ? 'fr' : 'en';
  const summary = summarize(content, content.savedRun.answers[language], content.savedRun.model);
  return `<section class="lp lp-feedback-rules" data-lp-pattern="feedback-rules" lang="${html(lang)}">
    <p class="lp-stem">${html(content.task)}</p>
    <p class="lp-small">${html(content.note)}</p>
    <div class="lp-actions" data-lp-controls hidden>
      <label class="lp-label" for="${html(`${id}-language`)}">${html(strings.language)}
        <select class="lp-input" id="${html(`${id}-language`)}" data-lp-language><option value="en"${language === 'en' ? ' selected' : ''}>${html(strings.english)}</option><option value="fr"${language === 'fr' ? ' selected' : ''}>${html(strings.french)}</option></select>
      </label>
      <button class="lp-button" type="button" data-lp-run>${html(strings.run)}</button>
    </div>
    <div id="${html(`${id}-notice`)}" data-lp-notice hidden></div>
    <div data-lp-challenge hidden></div>
    <p class="lp-small" data-lp-offline>${html(strings.unavailable)}</p>
    <p class="lp-small" data-lp-run-info>${html(format(strings.saved, { date: content.savedRun.date, model: content.savedRun.modelName }))}</p>
    <p class="lp-label" data-lp-summary>${html(summaryText(summary, strings))}</p>
    <p class="lp-small" data-lp-progress hidden></p>
    <p class="lp-small" data-lp-polarity>${html(content.polarityNote)}</p>
    <div class="lp-feedback-rules-scroll" role="region" aria-labelledby="${html(`${id}-caption`)}" tabindex="0">
      <table><caption class="lp-visually-hidden" id="${html(`${id}-caption`)}">${html(strings.samples)}</caption>
        <thead><tr><th scope="col">${html(strings.samples)}</th>${content.criteria.map(c => `<th scope="col">${html(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${summary.rows.map(row => renderRow(content, strings, row, language)).join('')}</tbody>
      </table>
    </div>
    <p class="lp-small" data-lp-errors hidden>${html(strings.partial)}</p>
    <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
  </section>`;
}

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings
 * @param {ReturnType<typeof summarize>['rows'][number]} row @param {'en' | 'fr'} language
 */
export function renderRow(content, strings, row, language) {
  const fixture = /** @type {import('./logic.js').Fixture} */ (content.fixtures.find(f => f.id === row.id));
  return `<tr data-lp-row="${html(row.id)}"><th scope="row"><details class="lp-details"${row.review ? ' data-lp-review' : ''}>
    <summary>${html(fixture.name[language])}${row.review ? `<span class="lp-feedback-rules-review">${icons['alert-circle']}${html(strings.review)}</span>` : ''}</summary>
    <p class="lp-quote" lang="${language}">${html(fixture.answer[language])}</p>
    <dl>${row.cells.map(cell => `<dt>${html(/** @type {{ label: string }} */ (content.criteria.find(c => c.id === cell.id)).label)}</dt><dd>${html(strings.author)}: ${html(strings[cell.author])}. ${html(strings.model)}: ${html(cell.model ? strings[cell.model] : strings.notRun)}.</dd>`).join('')}</dl>
  </details>${row.failed ? `<p class="lp-small">${html(strings.failed)}</p>` : ''}</th>
  ${row.cells.map(cell => {
    const style = cell.outcome === 'agree' ? 'lp-met' : cell.outcome === 'disagree' ? 'lp-missed' : 'lp-neutral';
    const icon = cell.outcome === 'agree' ? icons.check : cell.outcome === 'disagree' ? icons.x : cell.outcome === 'unsure' ? icons['question-mark'] : icons['circle-dashed'];
    return `<td><span class="lp-small">${html(strings.author)}: ${html(strings[cell.author])}</span><span class="lp-feedback-rules-outcome ${style}" data-lp-outcome="${cell.outcome}">${icon}${html(strings[cell.outcome])}</span></td>`;
  }).join('')}</tr>`;
}
