import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

const MOBILE_VIEWPORTS = [
  [390, 844],
  [393, 852],
  [412, 915],
  [430, 932],
  [360, 800],
] as const;

describe('mobile background sizing', () => {
  it('keeps a blurred cover fill under a contained sharp image', () => {
    expect(css).toMatch(/\.scene-bg__fill\s*\{[^}]*background-size:\s*cover/s);
    expect(css).toMatch(/\.scene-bg__fit\s*\{[^}]*background-size:\s*contain/s);
  });

  it('scales the mobile foreground slightly without switching to cover', () => {
    const mobileCss = css.slice(css.indexOf('@media (max-width: 720px)'));
    expect(mobileCss).toMatch(/scene-bg--fitted \.scene-bg__fit[\s\S]*background-size:\s*contain/);
    expect(mobileCss).toMatch(/\.scene-bg--gate-i \.scene-bg__fit\s*\{[^}]*--fit-scale:\s*1\.08/);
    expect(mobileCss).toMatch(/\.scene-bg--gate-ii \.scene-bg__fit\s*\{[^}]*--fit-scale:\s*1\.1/);
    expect(mobileCss).toMatch(/\.scene-bg--forest \.scene-bg__fit\s*\{[^}]*--fit-scale:\s*1\.08/);
    expect(mobileCss).toMatch(/\.scene-bg--burn-success \.scene-bg__fit\s*\{[^}]*--fit-scale:\s*1\.08/);
    expect(mobileCss).toMatch(/\.forest-entry__video\s*\{[^}]*--fit-scale:\s*1\.08/);
    expect(mobileCss).not.toMatch(/\.scene-bg--gate-i \.scene-bg__fit\s*\{[^}]*background-size:\s*cover/);
  });

  it('uses dynamic viewport height and safe-area insets for overlays', () => {
    expect(css).toMatch(/100dvh/);
    expect(css).toMatch(/safe-area-inset-top/);
    expect(css).toMatch(/safe-area-inset-bottom/);
    expect(css).toMatch(/overflow-x:\s*hidden/);
  });

  it('documents the phone sizes used to check artwork text stays in view', () => {
    expect(MOBILE_VIEWPORTS).toEqual([
      [390, 844],
      [393, 852],
      [412, 915],
      [430, 932],
      [360, 800],
    ]);
  });
});
