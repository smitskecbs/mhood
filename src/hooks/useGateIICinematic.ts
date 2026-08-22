import { useEffect, useRef, useState } from 'react';
import {
  GATE_II_PHASE_SCHEDULE,
  type GateIICinematicPhase,
} from '../config/gateIICinematic';

/**
 * Advances Gate II atmosphere through a fixed schedule.
 * Cleanup always invalidates pending timeouts so Strict Mode cannot run two sequences.
 */
export function useGateIICinematic(active: boolean): GateIICinematicPhase {
  const [phase, setPhase] = useState<GateIICinematicPhase>(active ? 'ambient' : 'idle');
  const generation = useRef(0);

  useEffect(() => {
    if (!active) {
      setPhase('idle');
      return;
    }

    const gen = ++generation.current;
    setPhase('ambient');

    const timers = GATE_II_PHASE_SCHEDULE.filter((step) => step.atMs > 0).map((step) =>
      window.setTimeout(() => {
        if (generation.current !== gen) return;
        setPhase(step.phase);
      }, step.atMs),
    );

    return () => {
      generation.current += 1;
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [active]);

  if (!active) return 'idle';
  return phase === 'idle' ? 'ambient' : phase;
}
