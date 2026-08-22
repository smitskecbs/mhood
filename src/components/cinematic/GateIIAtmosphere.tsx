import { GATE_II_METEORS, GATE_II_PARTICLES, type GateIICinematicPhase } from '../../config/gateIICinematic';

type GateIIAtmosphereProps = {
  phase: GateIICinematicPhase;
};

export function GateIIAtmosphere({ phase }: GateIIAtmosphereProps) {
  if (phase === 'idle') return null;

  const quiet = phase === 'dim' || phase === 'rest';
  const showMeteors = !quiet;

  return (
    <div
      className={`gate2-fx gate2-fx--${phase} ${quiet ? 'is-quiet' : 'is-playing'}`}
      data-testid="gate2-atmosphere"
      data-phase={phase}
    >
      <div className="gate2-energy" />
      <div className="gate2-ray gate2-ray--a" />
      <div className="gate2-ray gate2-ray--b" />
      {GATE_II_PARTICLES.map((particle) => (
        <span
          key={particle.id}
          className={`gate2-particle gate2-particle--${particle.kind}`}
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
      {showMeteors
        ? GATE_II_METEORS.map((meteor) => (
            <span
              key={meteor.id}
              className={`gate2-meteor gate2-meteor--${meteor.band}`}
              style={{
                top: meteor.top,
                left: meteor.left,
                ['--angle' as string]: `${meteor.angle}deg`,
                ['--len' as string]: `${meteor.length}px`,
                ['--dur' as string]: `${meteor.duration}s`,
                ['--delay' as string]: `${meteor.delay}s`,
                ['--op' as string]: String(meteor.opacity),
              }}
            />
          ))
        : null}
    </div>
  );
}
