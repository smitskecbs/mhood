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

describe('mobile wallet card layout', () => {
  it('centers the wallet card in the mobile viewport', () => {
    expect(mobileCss).toMatch(/\.gate-shell\s*\{[^}]*place-items:\s*center/s);
    expect(mobileCss).not.toMatch(/place-items:\s*end\s+center/);
    expect(mobileCss).toMatch(/100dvh/);
    expect(mobileCss).toMatch(/safe-area-inset-top/);
    expect(mobileCss).toMatch(/safe-area-inset-bottom/);
  });

  it('sizes the mobile card for thumb-friendly buttons', () => {
    expect(mobileCss).toMatch(/\.gate-card\s*\{[^}]*width:\s*min\(92vw,\s*430px\)/s);
    expect(mobileCss).toMatch(/\.wallet-picker__button[\s\S]*min-height:\s*48px/);
    expect(mobileCss).toMatch(/\.gate-shell \.forest-button[\s\S]*min-height:\s*48px/);
    expect(mobileCss).toMatch(/\.forest-ui \.forest-button[\s\S]*min-height:\s*44px/);
    expect(mobileCss).toMatch(/font-size:\s*clamp\(/);
  });

  it('keeps the desktop wallet card centered and unshrunk', () => {
    expect(desktopCss).toMatch(/\.gate-shell,\s*\r?\n\.granted-overlay\s*\{[^}]*place-items:\s*center/s);
    expect(desktopCss).toMatch(/\.gate-card\s*\{[^}]*width:\s*min\(560px,\s*100%\)/s);
    expect(desktopCss).not.toMatch(/place-items:\s*end\s+center/);
    expect(desktopCss).not.toMatch(/\.gate-card\s*\{[^}]*width:\s*min\(92vw,\s*430px\)/s);
  });

  it('documents the phone sizes used for the wallet and denied scenes', () => {
    expect(MOBILE_VIEWPORTS).toEqual([
      [360, 800],
      [390, 844],
      [393, 852],
      [412, 915],
      [430, 932],
    ]);
  });
});
