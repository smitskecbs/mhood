import { GATE_II_PARTICLES, type GateIICinematicPhase } from '../../config/gateIICinematic';

type GateIIAtmosphereProps = {
  phase: GateIICinematicPhase;
};

export function GateIIAtmosphere({ phase }: GateIIAtmosphereProps) {
  if (phase === 'idle') return null;

  return (
    <div
      className={`gate2-fx gate2-fx--${phase}`}
      data-testid="gate2-atmosphere"
      data-phase={phase}
    >
      <div className="gate2-energy" />
      {GATE_II_PARTICLES.map((particle) => (
        <span
          key={particle.id}
          className="gate2-particle gate2-particle--dust"
          style={{
            top: particle.top,
            left: particle.left,
            width: particle.size,
            height: particle.size,
            ['--dur' as string]: `${particle.duration}s`,
            ['--delay' as string]: `${particle.delay}s`,
            ['--dx' as string]: particle.dx,
            ['--dy' as string]: particle.dy,
            ['--op' as string]: String(particle.opacity),
          }}
        />
      ))}
    </div>
  );
}
