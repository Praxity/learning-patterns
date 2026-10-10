import { icons } from '../../lib/conversation-icons.js';
import { escapeHtml as html } from '../../lib/html.js';
import { BRANCHES, REPLY_LIMIT, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content @param {string} line @param {string} id @param {string} [lang] */
export function renderMichel(content, line, id, lang = 'en') {
  return `<li class="lp-conversation-turn"><span class="lp-conversation-avatar" aria-hidden="true">${html(content.person.initial, lang)}</span><p class="lp-conversation-bubble" data-lp-michel id="${html(id)}" tabindex="-1">${html(line, lang)}</p></li>`;
}

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings @param {import('./logic.js').ConversationState} state @param {string} [lang] */
export function renderDebrief(content, strings, state, lang = 'en') {
  return `<h3 class="lp-run-in">${html(strings.debrief, lang)}</h3><ol class="lp-conversation-debrief">${[...new Set(state.history.map(({ branch }) => branch))].map(branch => `<li><p class="lp-run-in">${html(content.branches[branch].move, lang)}</p><p>${html(content.branches[branch].debrief, lang)}</p></li>`).join('')}</ol>`;
}

/** @param {import('./logic.js').Content} content @param {'opening' | import('./logic.js').Branch} node @param {string} [lang] */
export function renderChoices(content, node, lang = 'en') {
  return BRANCHES.map((branch, index) => `<button class="lp-choice lp-conversation-choice" type="button" data-lp-branch="${html(branch)}"><span class="lp-choice-key" aria-hidden="true">${index + 1}</span><span>${html(content.examples[node][/** @type {import('./logic.js').Branch} */ (branch)], lang)}</span></button>`).join('');
}

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings @param {{ id: string, lang: string }} options */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  return `<section class="lp lp-conversation" data-lp-pattern="conversation" lang="${html(lang)}">
    <header class="lp-scene"><span class="lp-conversation-avatar" aria-hidden="true">${html(content.person.initial, lang)}</span><div><p class="lp-scene-title">${html(content.person.name, lang)}</p><p class="lp-scene-sub">${html(content.person.role, lang)}</p></div></header>
    <p>${html(content.setup, lang)}</p>
    <ol class="lp-conversation-chat" data-lp-chat>${renderMichel(content, content.opening, `${id}-line-0`, lang)}</ol>
    <div data-lp-flow hidden>
      <div data-lp-composer hidden>
        <div class="lp-conversation-composer">
          <label class="lp-visually-hidden" for="${html(`${id}-reply`)}">${html(strings.reply.replace('{name}', content.person.name), lang)}</label>
          <textarea class="lp-input lp-conversation-input" id="${html(`${id}-reply`)}" rows="3" maxlength="${REPLY_LIMIT}" placeholder="${html(strings.placeholder, lang)}"></textarea>
          <div class="lp-conversation-foot"><p class="lp-error-text" id="${html(`${id}-error`)}" data-lp-error hidden>${icons['alert-circle']}<span>${html(strings.empty, lang)}</span></p><button class="lp-button" type="button" data-lp-send>${html(strings.send, lang)}</button></div>
        </div>
        <div data-lp-notice id="${html(`${id}-notice`)}" hidden></div>
        <div data-lp-challenge hidden></div>
      </div>
      <p class="lp-small" data-lp-hint hidden></p>
      <p class="lp-small" data-lp-offline hidden>${html(strings.fallback, lang)}</p>
      <details class="lp-details" data-lp-choices><summary>${html(strings.choose, lang)}</summary><div class="lp-choices" data-lp-replies>${renderChoices(content, 'opening', lang)}</div></details>
    </div>
    <div class="lp-section" data-lp-debrief hidden></div>
    <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${html(strings.restart, lang)}</button></div>
    <div class="lp-section lp-stack" data-lp-script>
      <p class="lp-run-in">${html(strings.script, lang)}</p>
      ${BRANCHES.map(key => {
        const first = /** @type {import('./logic.js').Branch} */ (key);
        return `<details class="lp-details"><summary>${html(content.examples.opening[first], lang)}</summary><p class="lp-conversation-bubble">${html(content.branches[first].line, lang)}</p>${first === 'pause' ? `<p><em>${html(content.pauseNote, lang)}</em></p>` : ''}<p class="lp-run-in">${html(strings.next, lang)}</p>${BRANCHES.map(key => {
          const second = /** @type {import('./logic.js').Branch} */ (key);
          const note = content.stageNotes[`${first}:${second}`];
          return `<details class="lp-details lp-section" data-lp-static-end><summary>${html(content.examples[first][second], lang)}</summary><p class="lp-conversation-bubble">${html(content.branches[first].endings[second], lang)}</p>${note ? `<p><em>${html(note, lang)}</em></p>` : ''}${renderDebrief(content, strings, { node: second, round: 2, end: true, history: [{ branch: first, reply: content.examples.opening[first] }, { branch: second, reply: content.examples[first][second] }] }, lang)}</details>`;
        }).join('')}</details>`;
      }).join('')}
    </div>
    <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
  </section>`;
}
