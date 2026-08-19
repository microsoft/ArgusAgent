import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const components = join(here, '..', 'components');

/** User-visible attributes that must not carry a hard-coded English string. */
const ATTR = /\b(placeholder|title|aria-label)="([A-Z][^"{}]{2,})"/g;

/** Brand names are not translated. */
const ALLOWED = new Set(['Argus']);

describe('Chinese localization coverage', () => {
  it('no user-visible attribute is hard-coded English', () => {
    const offenders: string[] = [];

    for (const file of readdirSync(components).filter((f) => f.endsWith('.tsx'))) {
      const text = readFileSync(join(components, file), 'utf8');
      for (const match of text.matchAll(ATTR)) {
        if (ALLOWED.has(match[2])) continue;
        const line = text.slice(0, match.index).split('\n').length;
        offenders.push(`${file}:${line} ${match[1]}="${match[2]}"`);
      }
    }

    // Users reported not being able to read the UI. A string that never goes
    // through t() stays English regardless of the selected locale.
    expect(offenders).toEqual([]);
  });

  it('every English key has a Chinese translation', async () => {
    const source = readFileSync(join(here, '..', 'i18n.tsx'), 'utf8');
    const block = (name: string) => {
      const start = source.indexOf(`const ${name}`);
      const end = source.indexOf('\n};', start);
      return new Set(
        [...source.slice(start, end).matchAll(/^ {2}'([^']+)':/gm)].map((m) => m[1]),
      );
    };

    const en = block('en');
    const zh = block('zhCN');
    const missing = [...en].filter((key) => !zh.has(key));

    expect(missing).toEqual([]);
  });

  it('does not remount the application when locale changes', () => {
    const source = readFileSync(join(here, '..', 'main.tsx'), 'utf8');

    expect(source).not.toMatch(/<App\s+key=\{locale\}/);
  });
});
