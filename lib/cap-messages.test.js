import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAP_MESSAGES, renderCapNotice } from './data-notice.js';
import { escapeHtml } from './html.js';

const expected = {
  ip_daily: {
    en: "You've used today's live checks. They reset at midnight UTC.",
    fr: "Vous avez utilisé les vérifications en direct d'aujourd'hui. Elles reprennent à minuit UTC."
  },
  budget: {
    en: "Live checks are paused until midnight UTC because today's budget is used up.",
    fr: "Le budget d'aujourd'hui est épuisé. Les vérifications en direct reprennent à minuit UTC."
  }
};

test('one owner supplies both daily reasons in English and Québec French', () => {
  assert.deepEqual(CAP_MESSAGES, expected);
  assert.ok(Object.isFrozen(CAP_MESSAGES));
  for (const reason of ['ip_daily', 'budget']) {
    for (const lang of ['en', 'fr']) {
      assert.equal(renderCapNotice(reason, lang), `<p class="lp-small" data-lp-cap>${escapeHtml(expected[reason][lang])}</p>`);
    }
    assert.equal(renderCapNotice(reason, 'other'), renderCapNotice(reason, 'en'));
  }
});
