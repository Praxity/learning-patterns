import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

test('public configuration supplies the selected provider and both authored notices', async () => {
  for (const [provider, name] of [['perplexity', 'Perplexity (US)'], ['clef', 'Cloudflare Workers AI'], ['jev', 'TypeSafe (US)']]) {
    const response = await worker.fetch(new Request('https://course.example/api/patterns/config'), { MODEL_PROVIDER: provider, TURNSTILE_SITE_KEY: 'public-key' });
    const config = await response.json();
    assert.equal(response.status, 200);
    assert.equal(config.providerName, name);
    assert.equal(config.siteKey, 'public-key');
    assert.equal(config.dataNotice.en, 'Your answer is sent to a decision model; it is not stored and not used for training.');
    assert.equal(config.dataNotice.fr, "Votre réponse est envoyée à un modèle décisionnel. Elle n'est ni conservée ni utilisée pour l'entraînement.");
  }
});
