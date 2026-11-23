import { test, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';

for (const name of await readdir(new URL('../../patterns/', import.meta.url))) {
  const source = await readFile(new URL(`../../patterns/${name}/render.js`, import.meta.url), 'utf8');
  if (!/<fieldset class="lp-choices/.test(source)) continue;
  for (const lang of ['en', 'fr']) {
    const content = JSON.parse(await readFile(new URL(`../../patterns/${name}/examples/${lang}.json`, import.meta.url), 'utf8'));
    test(`${name} enhances its rendered choice markup (${lang})`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`/${name}/${lang}.html`);
      await page.waitForFunction(() => window.lpReady);
      const result = await page.evaluate(async ({ name, lang, content }) => {
        window.lpInstances.forEach(instance => instance.destroy());
        const { render } = await import(`/patterns/${name}/render.js`);
        const { enhance } = await import(`/patterns/${name}/enhance.js`);
        const { strings } = await import(`/patterns/${name}/strings.js`);
        document.querySelector('main').innerHTML = render(content, strings[lang], { id: 'choice-contract', lang });
        const root = document.querySelector('[data-lp-pattern]');
        const instance = enhance(root, { content, strings: strings[lang] });
        const result = { destroy: typeof instance.destroy, repeated: enhance(root, { content, strings: strings[lang] }) === instance };
        instance.destroy();
        return result;
      }, { name, lang, content });
      expect(result).toEqual({ destroy: 'function', repeated: true });
      expect(errors).toEqual([]);
    });
  }
}

for (const name of ['dont-know', 'test-out']) for (const wrapper of ['div', 'fieldset']) {
  test(`${name} rejects a choice nested in an unexpected ${wrapper}`, async ({ page }) => {
    await page.goto(`/${name}/en.html`);
    await page.waitForFunction(() => window.lpReady);
    const error = await page.evaluate(({ wrapper }) => {
      window.lpInstances.forEach(instance => instance.destroy());
      const row = document.querySelector('fieldset.lp-choices .lp-choice');
      const nested = document.createElement(wrapper);
      row.replaceWith(nested);
      nested.append(row);
      try {
        window.lpEnhance();
        return null;
      } catch (error) {
        return error.message;
      }
    }, { wrapper });
    expect(error).toBe(`Invalid ${name} ${wrapper === 'fieldset' ? 'questions' : 'choice'} markup`);
  });
}
