import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGateIICinematic } from './useGateIICinematic';

describe('useGateIICinematic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts ambient immediately and advances on a single schedule', () => {
    const { result } = renderHook(() => useGateIICinematic(true));
    expect(result.current).toBe('ambient');

    act(() => {
      vi.advanceTimersByTime(4_999);
    });
    expect(result.current).toBe('ambient');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('disturbance');

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current).toBe('fade');
  });

  it('clears timers on unmount so Strict Mode cannot double-run the sequence', () => {
    const spy = vi.spyOn(window, 'clearTimeout');
    const { unmount, result } = renderHook(() => useGateIICinematic(true));
    expect(result.current).toBe('ambient');
    unmount();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('resets when the cinematic is no longer active', () => {
    const { result, rerender } = renderHook(({ active }) => useGateIICinematic(active), {
      initialProps: { active: true },
    });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBe('disturbance');
    rerender({ active: false });
    expect(result.current).toBe('idle');
  });
});
