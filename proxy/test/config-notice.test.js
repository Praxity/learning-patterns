import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

test('public configuration supplies the selected provider and both authored notices', async () => {
  for (const [provider, name] of [['perplexity', 'Perplexity (US)'], ['clef', 'Cloudflare Workers AI'], ['jev', 'TypeSafe (US)']]) {
    const recipient = provider === 'perplexity' ? 'Perplexity' : provider === 'clef' ? 'Cloudflare Workers AI' : 'TypeSafe';
    const response = await worker.fetch(new Request('https://course.example/api/patterns/config'), { MODEL_PROVIDER: provider, TURNSTILE_SITE_KEY: 'public-key' });
    const config = await response.json();
    assert.equal(response.status, 200);
    assert.equal(config.providerName, name);
    assert.equal(config.siteKey, 'public-key');
    assert.equal(config.dataNotice.en, `Your answer is sent to ${recipient} to choose which feedback to show. Praxity doesn't keep it. ${recipient}'s terms apply.`);
    assert.equal(config.dataNotice.fr, `Votre réponse est envoyée à ${recipient} pour choisir la rétroaction à vous afficher. Praxity ne la conserve pas. Les conditions de ${recipient} s'appliquent.`);
    assert.equal(config.questionNotice.en, `Your question is sent to ${recipient} to choose which information to show. Praxity doesn't keep it. ${recipient}'s terms apply.`);
    assert.equal(config.questionNotice.fr, `Votre question est envoyée à ${recipient} pour choisir les informations à vous afficher. Praxity ne la conserve pas. Les conditions de ${recipient} s'appliquent.`);
  }
});
