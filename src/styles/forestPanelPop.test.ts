import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
const desktopCss = css.slice(0, css.indexOf('@media (max-width: 720px)'));

describe('Forest panel pop', () => {
  it('uses the same hover pop on desktop panels', () => {
    expect(desktopCss).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    expect(desktopCss).toMatch(/\.forest-panel:hover[\s\S]*scale\(1\.02\)/);
    expect(desktopCss).toMatch(/\.forest-pop:hover[\s\S]*scale\(1\.02\)/);
    expect(desktopCss).toMatch(/translateY\(-5px\)/);
  });

  it('uses a lighter active pop for tap feedback', () => {
    expect(css).toMatch(/\.forest-panel:active[\s\S]*scale\(1\.012\)/);
    expect(css).toMatch(/\.forest-pop:active[\s\S]*scale\(1\.012\)/);
    expect(css).toMatch(/\.forest-panel:focus-visible/);
  });
});
