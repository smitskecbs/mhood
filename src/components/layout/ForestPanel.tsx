import type { ReactNode } from 'react';

type ForestPanelProps = {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
};

export function ForestPanel({ title, eyebrow, children, className = '' }: ForestPanelProps) {
  return (
    <section className={`forest-panel forest-pop ${className}`.trim()}>
      {eyebrow ? <p className="forest-panel__eyebrow">{eyebrow}</p> : null}
      {title ? <h2 className="forest-panel__title">{title}</h2> : null}
      {children}
    </section>
  );
}
