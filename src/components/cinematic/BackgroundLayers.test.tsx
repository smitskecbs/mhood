import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GATE_II_METEORS, GATE_II_PARTICLES } from '../../config/gateIICinematic';
import { BackgroundLayers } from './BackgroundLayers';

describe('BackgroundLayers', () => {
  it('fits Gate I/II and Forest with a blurred fill and a contained sharp image', () => {
    const { container } = render(
      <BackgroundLayers introActive gateIIVisible forestVisible />,
    );
    expect(container.querySelectorAll('.scene-bg--gate-i .scene-bg__fill')).toHaveLength(1);
    expect(container.querySelectorAll('.scene-bg--gate-i .scene-bg__fit')).toHaveLength(1);
    expect(container.querySelectorAll('.scene-bg--gate-ii .scene-bg__fit')).toHaveLength(1);
    expect(container.querySelector('.scene-bg--forest')?.classList.contains('scene-bg--fitted')).toBe(true);
    expect(container.querySelectorAll('.scene-bg--forest .scene-bg__fit')).toHaveLength(1);
  });

  it('starts Gate II ambient life immediately and keeps the wallet UI off-screen', () => {
    const living = render(
      <BackgroundLayers introActive={false} gateIIVisible forestVisible={false} />,
    );
    expect(living.container.querySelector('.scene-bg--gate-ii')?.classList.contains('is-living')).toBe(true);
    expect(living.container.querySelector('.scene-stack')?.getAttribute('data-gate2-phase')).toBe('ambient');
    expect(living.container.querySelectorAll('.gate2-particle')).toHaveLength(GATE_II_PARTICLES.length);
    expect(living.container.querySelectorAll('.gate2-meteor')).toHaveLength(GATE_II_METEORS.length);
    expect(living.container.querySelector('.scene-bg--gate-i-ghost')?.classList.contains('is-visible')).toBe(false);
    expect(living.container.querySelector('.scene-dimmer')?.classList.contains('is-visible')).toBe(false);
  });

  it('dims busy effects when the wallet UI appears', () => {
    const wallet = render(
      <BackgroundLayers
        introActive={false}
        gateIIVisible
        walletUiVisible
        forestVisible={false}
      />,
    );
    expect(wallet.container.querySelector('.scene-stack')?.getAttribute('data-pointer-events')).toBe('none');
    expect(wallet.container.querySelector('.scene-stack')?.getAttribute('data-gate2-phase')).toBe('rest');
    expect(wallet.container.querySelector('.scene-bg--gate-ii')?.classList.contains('is-living')).toBe(true);
    expect(wallet.container.querySelector('.scene-bg--gate-i-ghost')?.classList.contains('is-visible')).toBe(true);
    expect(wallet.container.querySelector('.scene-dimmer')?.classList.contains('is-visible')).toBe(true);
    expect(wallet.container.querySelector('.gate2-meteor')).toBeNull();
    expect(wallet.container.querySelector('.gate2-fx')?.classList.contains('is-quiet')).toBe(true);
  });

  it('hides every photographic layer during ACCESS GRANTED blackout', () => {
    const { container } = render(
      <BackgroundLayers introActive={false} gateIIVisible walletUiVisible forestVisible={false} blackout />,
    );
    expect(container.querySelector('.scene-stack')?.classList.contains('is-blackout')).toBe(true);
    expect(container.querySelector('.scene-bg--gate-i')?.classList.contains('is-visible')).toBe(false);
    expect(container.querySelector('.scene-bg--gate-ii')?.classList.contains('is-visible')).toBe(false);
    expect(container.querySelector('.scene-bg--forest')?.classList.contains('is-visible')).toBe(false);
    expect(container.querySelector('.scene-bg--gate-i-ghost')?.classList.contains('is-visible')).toBe(false);
    expect(container.querySelector('[data-testid="gate2-atmosphere"]')).toBeNull();
  });

  it('shows background1 for the denied scene without blackout or Gate II', () => {
    const { container } = render(
      <BackgroundLayers
        introActive={false}
        gateIIVisible={false}
        walletUiVisible={false}
        denied
        forestVisible={false}
      />,
    );
    expect(container.querySelector('.scene-stack')?.classList.contains('is-denied')).toBe(true);
    expect(container.querySelector('.scene-stack')?.classList.contains('is-blackout')).toBe(false);
    expect(container.querySelector('.scene-bg--gate-i')?.classList.contains('is-visible')).toBe(true);
    expect(container.querySelector('.scene-bg--gate-ii')?.classList.contains('is-visible')).toBe(false);
    expect(container.querySelector('.scene-bg--gate-i-ghost')?.classList.contains('is-visible')).toBe(false);
    expect(container.querySelector('.scene-dimmer')?.classList.contains('is-denied')).toBe(true);
    expect(container.querySelector('.scene-dimmer')?.classList.contains('is-visible')).toBe(true);
  });

  it('disables glitch animation and Gate II particles when reduced motion is preferred', () => {
    const { container } = render(
      <BackgroundLayers introActive gateIIVisible forestVisible={false} reducedMotion />,
    );
    expect(container.querySelector('.scene-glitch')?.classList.contains('is-active')).toBe(false);
    expect(container.querySelector('.scene-bg--gate-i')?.classList.contains('is-flickering')).toBe(false);
    expect(container.querySelector('.scene-bg--gate-ii')?.classList.contains('is-living')).toBe(false);
    expect(container.querySelector('[data-testid="gate2-atmosphere"]')).toBeNull();
    expect(container.querySelector('.gate2-meteor')).toBeNull();
  });
});
