import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ForestPanel } from './ForestPanel';

describe('ForestPanel', () => {
  it('uses the shared pop class on every Forest dashboard card', () => {
    const { container } = render(
      <ForestPanel eyebrow="Your place in the trees" title="Wallet">
        body
      </ForestPanel>,
    );
    expect(container.querySelector('section')?.classList.contains('forest-panel')).toBe(true);
    expect(container.querySelector('section')?.classList.contains('forest-pop')).toBe(true);
  });
});
