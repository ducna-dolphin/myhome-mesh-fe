import type { PropsWithChildren, ReactNode } from 'react';
import './card.css';

interface CardProps extends PropsWithChildren {
  title?: string;
  action?: ReactNode;
  className?: string;
}

export function Card({ title, action, className = '', children }: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || action) && (
        <div className="card__header">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
