import { test, expect } from '@playwright/test';
import { startSession } from './session.js';

test('positive control captures heading, button name and role, and one live message', async ({ page }, info) => {
  await page.goto('/index.html');
  await page.setContent('<!doctype html><html lang="en"><title>VoiceOver positive control</title><h1>Control heading</h1><button onclick="document.getElementById(\'status\').textContent=\'Control live message\'">Control action</button><div id="status" role="status" aria-live="polite"></div></html>');
  const session = await startSession(page, info);
  try {
    await session.observe(); await session.enter();
    await session.next('Control button name and role', true);
    const arrival = session.rows.flatMap(row => row.speech).join('\n');
    expect(arrival).toContain('Control heading');
    expect(arrival).toMatch(/Control action.*button|button.*Control action/i);
    await session.activate('button', 'Activate control button', 'Control+Alt+Space');
    await session.snapshot('control-result');
    const activated = session.rows.filter(row => row.step === 'Activate control button').flatMap(row => row.speech).join('\n');
    expect(activated.split('Control live message').length - 1).toBe(1);
    expect(await page.locator('#status').textContent()).toBe('Control live message');
  } finally { await session.stop(); }
});
