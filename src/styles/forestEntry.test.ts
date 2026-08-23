import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BACKGROUNDS, FOREST_ENTRY_VIDEO } from '../config/constants';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
const desktopCss = css.slice(0, css.indexOf('@media (max-width: 720px)'));
const mobileCss = css.slice(css.indexOf('@media (max-width: 720px)'));
const reducedCss = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

describe('forest entry video styles', () => {
  it('uses the forest-entry.mp4 asset and keeps background3 as the Forest still', () => {
    expect(FOREST_ENTRY_VIDEO).toBe('/backgrounds/forest-entry.mp4');
    expect(fs.existsSync(path.resolve(process.cwd(), 'public/backgrounds/forest-entry.mp4'))).toBe(true);
    expect(BACKGROUNDS.forest).toBe('/backgrounds/background3.jpg');
    expect(BACKGROUNDS.burnSuccess).toBe('/backgrounds/background4.jpg');
    expect(css).toMatch(/\.forest-entry__video/);
    expect(css).toMatch(/\.scene-bg--forest/);
    expect(css).toMatch(/\.scene-bg--burn-success/);
  });

  it('fits the video without stretching on desktop and scales it slightly on mobile', () => {
    expect(desktopCss).toMatch(/\.forest-entry__video\s*\{[^}]*object-fit:\s*contain/s);
    expect(desktopCss).not.toMatch(/\.forest-entry__video\s*\{[^}]*object-fit:\s*cover/s);
    expect(mobileCss).toMatch(/\.forest-entry__video\s*\{[^}]*--fit-scale:\s*1\.08/s);
    expect(mobileCss).toMatch(/\.forest-entry__video[\s\S]*object-fit:\s*contain/);
    expect(mobileCss).toMatch(/\.forest-entry[\s\S]*overflow:\s*hidden/);
    expect(css).toMatch(/\.forest-entry\s*\{[^}]*pointer-events:\s*none/s);
  });

  it('skips the entry video animation when reduced motion is preferred', () => {
    expect(reducedCss).toMatch(/\.forest-entry\s*\{[^}]*display:\s*none/s);
  });
});
