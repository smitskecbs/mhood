import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BACKGROUNDS } from '../config/constants';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
const desktopCss = css.slice(0, css.indexOf('@media (max-width: 720px)'));
const mobileCss = css.slice(css.indexOf('@media (max-width: 720px)'));
const reducedCss = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

describe('verified burn success scene styles', () => {
  it('uses the background4 asset and fitted rendering', () => {
    expect(BACKGROUNDS.burnSuccess).toBe('/backgrounds/background4.jpg');
    expect(fs.existsSync(path.resolve(process.cwd(), 'public/backgrounds/background4.jpg'))).toBe(true);
    expect(css).toMatch(/\.scene-bg--burn-success/);
    expect(css).toMatch(/\.burn-success__card/);
  });

  it('keeps the desktop Forest grid and avoids horizontal mobile overflow', () => {
    expect(desktopCss).toMatch(/\.forest-columns\s*\{[^}]*grid-template-columns:\s*1fr 1fr/s);
    expect(desktopCss).toMatch(/\.forest-table\s*\{[^}]*min-width:\s*420px/s);
    expect(mobileCss).toMatch(/\.burn-success__card\s*\{[^}]*width:\s*min\(92vw,\s*430px\)/s);
    expect(mobileCss).toMatch(/\.burn-success__card[\s\S]*overflow-x:\s*hidden/);
    expect(mobileCss).toMatch(/min-height:\s*48px/);
  });

  it('disables pulse and embers when reduced motion is preferred', () => {
    expect(reducedCss).toMatch(/\.burn-success__pulse[\s\S]*animation:\s*none/);
    expect(reducedCss).toMatch(/\.burn-success__ember[\s\S]*animation:\s*none/);
  });
});
