import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GATE_II_PARTICLES } from '../../config/gateIICinematic';
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

  it('starts Gate II ambient life immediately without meteors or a wallet overlay', () => {
    const living = render(
      <BackgroundLayers introActive={false} gateIIVisible forestVisible={false} />,
    );
    expect(living.container.querySelector('.scene-bg--gate-ii')?.classList.contains('is-living')).toBe(true);
    expect(living.container.querySelector('.scene-stack')?.getAttribute('data-gate2-phase')).toBe('ambient');
    expect(living.container.querySelectorAll('.gate2-particle')).toHaveLength(GATE_II_PARTICLES.length);
    expect(living.container.querySelector('.gate2-meteor')).toBeNull();
    expect(living.container.querySelector('.gate2-ray')).toBeNull();
    expect(living.container.querySelector('.scene-bg--gate-i-ghost')).toBeNull();
    expect(living.container.querySelector('.scene-dimmer')?.classList.contains('is-visible')).toBe(false);
    expect(living.container.querySelector('[data-testid="scene-black-veil"]')?.classList.contains('is-visible')).toBe(
      false,
    );
  });

  it('covers Gate II with a black veil from 8s so the wallet never sits on background2', () => {
    vi.useFakeTimers();
    const { container } = render(
      <BackgroundLayers introActive={false} gateIIVisible forestVisible={false} />,
    );
    act(() => {
      vi.advanceTimersByTime(7_999);
    });
    expect(container.querySelector('.scene-stack')?.getAttribute('data-gate2-phase')).toBe('disturbance');
    expect(container.querySelector('[data-testid="scene-black-veil"]')?.classList.contains('is-visible')).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelector('.scene-stack')?.getAttribute('data-gate2-phase')).toBe('fade');
    expect(container.querySelector('[data-testid="scene-black-veil"]')?.classList.contains('is-visible')).toBe(true);
    vi.useRealTimers();
  });

  it('keeps the wallet UI on a black screen with no Gate II or ghost behind it', () => {
    const wallet = render(
      <BackgroundLayers
        introActive={false}
        gateIIVisible={false}
        walletUiVisible
        forestVisible={false}
        blackout
      />,
    );
    expect(wallet.container.querySelector('.scene-stack')?.classList.contains('is-blackout')).toBe(true);
    expect(wallet.container.querySelector('.scene-stack')?.getAttribute('data-wallet-blackout')).toBe('true');
    expect(wallet.container.querySelector('.scene-bg--gate-ii')?.classList.contains('is-visible')).toBe(false);
    expect(wallet.container.querySelector('.scene-bg--gate-i')?.classList.contains('is-visible')).toBe(false);
    expect(wallet.container.querySelector('.scene-bg--gate-i-ghost')).toBeNull();
    expect(wallet.container.querySelector('[data-testid="gate2-atmosphere"]')).toBeNull();
    expect(wallet.container.querySelector('.gate2-meteor')).toBeNull();
  });

  it('hides every photographic layer during ACCESS GRANTED blackout', () => {
    const { container } = render(
      <BackgroundLayers introActive={false} gateIIVisible walletUiVisible forestVisible={false} blackout />,
    );
    expect(container.querySelector('.scene-stack')?.classList.contains('is-blackout')).toBe(true);
    expect(container.querySelector('.scene-bg--gate-i')?.classList.contains('is-visible')).toBe(false);
    expect(container.querySelector('.scene-bg--gate-ii')?.classList.contains('is-visible')).toBe(false);
    expect(container.querySelector('.scene-bg--forest')?.classList.contains('is-visible')).toBe(false);
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

  it('shows background4 only for the verified burn success scene', () => {
    const hidden = render(
      <BackgroundLayers introActive={false} gateIIVisible={false} forestVisible />,
    );
    expect(hidden.container.querySelector('.scene-bg--burn-success')?.classList.contains('is-visible')).toBe(false);
    expect(hidden.container.querySelector('.scene-bg--forest')?.classList.contains('is-visible')).toBe(true);

    const shown = render(
      <BackgroundLayers
        introActive={false}
        gateIIVisible={false}
        forestVisible={false}
        burnSuccessVisible
      />,
    );
    expect(shown.container.querySelector('.scene-stack')?.getAttribute('data-burn-success')).toBe('true');
    expect(shown.container.querySelector('.scene-bg--burn-success')?.classList.contains('is-visible')).toBe(true);
    expect(shown.container.querySelector('.scene-bg--burn-success .scene-bg__fit')).toBeTruthy();
    expect(shown.container.querySelector('.scene-bg--forest')?.classList.contains('is-visible')).toBe(false);
    expect(shown.container.querySelector('.scene-bg--burn-success .scene-bg__fit')?.getAttribute('style')).toMatch(
      /background4\.jpg/,
    );
    expect(shown.container.querySelector('[data-testid="gate2-atmosphere"]')).toBeNull();
  });

  it('keeps background3 as the normal Forest still image', () => {
    const { container } = render(
      <BackgroundLayers introActive={false} gateIIVisible={false} forestVisible />,
    );
    expect(container.querySelector('.scene-bg--forest .scene-bg__fit')?.getAttribute('style')).toMatch(
      /background3\.jpg/,
    );
    expect(container.querySelector('video')).toBeNull();
  });
});
