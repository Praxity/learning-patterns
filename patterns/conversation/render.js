import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { BRANCHES, REPLY_LIMIT, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content @param {string} line @param {string} id */
export function renderMichel(content, line, id) {
  return `<li class="lp-conversation-turn"><span class="lp-conversation-avatar" aria-hidden="true">${html(content.person.initial)}</span><p class="lp-conversation-bubble" data-lp-michel id="${html(id)}" tabindex="-1">${html(line)}</p></li>`;
}

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings @param {import('./logic.js').ConversationState} state */
export function renderDebrief(content, strings, state) {
  return `<h3 class="lp-run-in">${html(strings.debrief)}</h3><ol class="lp-conversation-debrief">${[...new Set(state.history.map(({ branch }) => branch))].map(branch => `<li><p class="lp-run-in">${html(content.branches[branch].move)}</p><p>${html(content.branches[branch].debrief)}</p></li>`).join('')}</ol>`;
}

/** @param {import('./logic.js').Content} content @param {'opening' | import('./logic.js').Branch} node */
export function renderChoices(content, node) {
  return BRANCHES.map((branch, index) => `<button class="lp-choice lp-conversation-choice" type="button" data-lp-branch="${html(branch)}"><span class="lp-choice-key" aria-hidden="true">${index + 1}</span><span>${html(content.examples[node][/** @type {import('./logic.js').Branch} */ (branch)])}</span></button>`).join('');
}

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings @param {{ id: string, lang: string }} options */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  return `<section class="lp lp-conversation" data-lp-pattern="conversation" lang="${html(lang)}">
    <header class="lp-scene"><span class="lp-conversation-avatar" aria-hidden="true">${html(content.person.initial)}</span><div><p class="lp-scene-title">${html(content.person.name)}</p><p class="lp-scene-sub">${html(content.person.role)}</p></div></header>
    <p>${html(content.setup)}</p>
    <ol class="lp-conversation-chat" data-lp-chat>${renderMichel(content, content.opening, `${id}-line-0`)}</ol>
    <div data-lp-flow hidden>
      <div data-lp-composer hidden>
        <div class="lp-conversation-composer">
          <label class="lp-visually-hidden" for="${html(`${id}-reply`)}">${html(strings.reply.replace('{name}', content.person.name))}</label>
          <textarea class="lp-input lp-conversation-input" id="${html(`${id}-reply`)}" rows="3" maxlength="${REPLY_LIMIT}" placeholder="${html(strings.placeholder)}"></textarea>
          <div class="lp-conversation-foot"><p class="lp-error-text" id="${html(`${id}-error`)}" data-lp-error hidden>${icons['alert-circle']}<span>${html(strings.empty)}</span></p><button class="lp-button" type="button" data-lp-send>${html(strings.send)}</button></div>
        </div>
        <div data-lp-notice id="${html(`${id}-notice`)}" hidden></div>
        <div data-lp-challenge hidden></div>
      </div>
      <p class="lp-small" data-lp-hint hidden></p>
      <p class="lp-small" data-lp-offline hidden>${html(strings.fallback)}</p>
      <details class="lp-details" data-lp-choices><summary>${html(strings.choose)}</summary><div class="lp-choices" data-lp-replies>${renderChoices(content, 'opening')}</div></details>
    </div>
    <div class="lp-section" data-lp-debrief hidden></div>
    <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${html(strings.restart)}</button></div>
    <div class="lp-section lp-stack" data-lp-script>
      <p class="lp-run-in">${html(strings.script)}</p>
      ${BRANCHES.map(key => {
        const first = /** @type {import('./logic.js').Branch} */ (key);
        return `<details class="lp-details"><summary>${html(content.examples.opening[first])}</summary><p class="lp-conversation-bubble">${html(content.branches[first].line)}</p>${first === 'pause' ? `<p><em>${html(content.pauseNote)}</em></p>` : ''}<p class="lp-run-in">${html(strings.next)}</p>${BRANCHES.map(key => {
          const second = /** @type {import('./logic.js').Branch} */ (key);
          const note = content.stageNotes[`${first}:${second}`];
          return `<details class="lp-details lp-section" data-lp-static-end><summary>${html(content.examples[first][second])}</summary><p class="lp-conversation-bubble">${html(content.branches[first].endings[second])}</p>${note ? `<p><em>${html(note)}</em></p>` : ''}${renderDebrief(content, strings, { node: second, round: 2, end: true, history: [{ branch: first, reply: content.examples.opening[first] }, { branch: second, reply: content.examples[first][second] }] })}</details>`;
        }).join('')}</details>`;
      }).join('')}
    </div>
    <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
  </section>`;
}
