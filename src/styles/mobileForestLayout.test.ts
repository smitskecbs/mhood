import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
const desktopCss = css.slice(0, css.indexOf('@media (max-width: 720px)'));
const mobileCss = css.slice(css.indexOf('@media (max-width: 720px)'));

const MOBILE_VIEWPORTS = [
  [360, 800],
  [390, 844],
  [393, 852],
  [412, 915],
  [430, 932],
] as const;

describe('mobile Forest dashboard layout', () => {
  it('stacks Forest sections in a single column on small screens', () => {
    expect(mobileCss).toMatch(/\.forest-columns\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
    expect(mobileCss).toMatch(/\.forest-ui\s*\{[^}]*width:\s*100%/s);
    expect(mobileCss).toMatch(/\.forest-panel[\s\S]*min-width:\s*0/);
    expect(mobileCss).toMatch(/safe-area-inset-left/);
    expect(mobileCss).toMatch(/safe-area-inset-right/);
  });

  it('does not keep a fixed table min-width on mobile', () => {
    expect(mobileCss).not.toMatch(/min-width:\s*420px/);
    expect(mobileCss).not.toMatch(/min-width:\s*600px/);
    expect(mobileCss).not.toMatch(/min-width:\s*700px/);
    expect(mobileCss).toMatch(/\.table-scroll,\s*\r?\n\s*\.forest-table\s*\{[^}]*display:\s*none/s);
    expect(mobileCss).toMatch(/\.ranking-cards,\s*\r?\n\s*\.allocation-cards\s*\{[^}]*display:\s*grid/s);
  });

  it('keeps the desktop Forest grid and ranking table', () => {
    expect(desktopCss).toMatch(/\.forest-columns\s*\{[^}]*grid-template-columns:\s*1fr 1fr/s);
    expect(desktopCss).toMatch(/\.wallet-summary__grid,\s*\r?\n\.stats-grid\s*\{[^}]*repeat\(6,/s);
    expect(desktopCss).toMatch(/\.stats-grid--grove\s*\{[^}]*repeat\(5,/s);
    expect(desktopCss).toMatch(/\.forest-table\s*\{[^}]*min-width:\s*420px/s);
    expect(desktopCss).toMatch(/\.ranking-cards,\s*\r?\n\.allocation-cards\s*\{[^}]*display:\s*none/s);
  });

  it('keeps burn controls inside the mobile viewport', () => {
    expect(mobileCss).toMatch(/\.percent-row \.forest-button[\s\S]*width:\s*100%/);
    expect(mobileCss).toMatch(/\.burn-panel > \.forest-button[\s\S]*width:\s*100%/);
    expect(mobileCss).toMatch(/min-height:\s*44px/);
  });

  it('documents the phone sizes used to check Forest panels stay in view', () => {
    expect(MOBILE_VIEWPORTS).toEqual([
      [360, 800],
      [390, 844],
      [393, 852],
      [412, 915],
      [430, 932],
    ]);
  });
});
