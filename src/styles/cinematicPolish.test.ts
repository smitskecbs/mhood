import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
const desktopCss = css.slice(0, css.indexOf('@media (max-width: 720px)'));
const reducedCss = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

const DESKTOP_VIEWPORTS = [
  [1280, 720],
  [1366, 768],
  [1440, 900],
] as const;

describe('cinematic polish', () => {
  it('removes meteors, tremor, rays, and Gate I ghost overlays', () => {
    expect(css).not.toMatch(/gate2-meteor/);
    expect(css).not.toMatch(/gate2-meteor-fly/);
    expect(css).not.toMatch(/gate2-tremor/);
    expect(css).not.toMatch(/gate2-ray/);
    expect(css).not.toMatch(/gate-i-ghost/);
    expect(css).not.toMatch(/gate-ii-breathe-climax/);
    expect(css).not.toMatch(/gate2-climax-glitch/);
  });

  it('fades Gate II to a black veil before the wallet card', () => {
    expect(css).toMatch(/\.scene-black-veil[\s\S]*background:\s*#000/);
    expect(css).toMatch(/\.scene-stack\.is-blackout[\s\S]*background:\s*#000/);
    expect(css).toMatch(/\.scene-stack\.gate2-fade/);
    expect(css).toMatch(/\.scene-stack\.gate2-disturbance/);
  });

  it('keeps the desktop Forest grid unchanged', () => {
    expect(desktopCss).toMatch(/\.forest-columns\s*\{[^}]*grid-template-columns:\s*1fr 1fr/s);
    expect(desktopCss).toMatch(/\.wallet-summary__grid,\s*\r?\n\.stats-grid\s*\{[^}]*repeat\(6,/s);
    expect(desktopCss).toMatch(/\.stats-grid--grove\s*\{[^}]*repeat\(5,/s);
    expect(desktopCss).toMatch(/\.forest-table\s*\{[^}]*min-width:\s*420px/s);
    expect(DESKTOP_VIEWPORTS).toEqual([
      [1280, 720],
      [1366, 768],
      [1440, 900],
    ]);
  });

  it('disables flicker, glitch, and panel scale when reduced motion is preferred', () => {
    expect(reducedCss).toMatch(/\.scene-bg--gate-i\.is-flickering[\s\S]*animation:\s*none/);
    expect(reducedCss).toMatch(/\.scene-glitch\.is-active[\s\S]*animation:\s*none/);
    expect(reducedCss).toMatch(/\.forest-panel:hover[\s\S]*transform:\s*none/);
    expect(reducedCss).toMatch(/\.forest-pop:active[\s\S]*transform:\s*none/);
  });
});
