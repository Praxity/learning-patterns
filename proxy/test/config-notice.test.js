import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

test('public configuration supplies the selected provider and every learner notice', async () => {
  for (const [provider, name] of [['perplexity', 'Perplexity (US)'], ['clef', 'Cloudflare Workers AI'], ['jev', 'TypeSafe (US)']]) {
    const response = await worker.fetch(new Request('https://course.example/api/patterns/config'), { MODEL_PROVIDER: provider, TURNSTILE_SITE_KEY: 'public-key' });
    const config = await response.json();
    assert.equal(response.status, 200);
    assert.equal(config.providerName, name);
    assert.equal(config.siteKey, 'public-key');
    assert.equal(config.dataNotice.en, 'Your answer is sent to a decision model to give instant feedback.');
    assert.equal(config.dataNotice.fr, 'Votre réponse est envoyée à un modèle de décision pour vous donner une rétroaction immédiate.');
    assert.equal(config.questionNotice.en, 'Your question is sent to a decision model to find where the course answers it.');
    assert.equal(config.questionNotice.fr, 'Votre question est envoyée à un modèle de décision pour trouver où le cours y répond.');
    assert.equal(config.replyNotice.en, 'Your reply is sent to a decision model to choose how the conversation goes on.');
    assert.equal(config.entryNotice.en, 'When you ask for a suggestion, your entry is sent to a decision model to choose a question or a support message.');
  }
});
