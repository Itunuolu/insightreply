import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function Card({ children, className = '', padded = true }: CardProps) {
  return (
    <section
      className={`rounded-2xl border border-navy-600/70 bg-white text-navy-900 shadow-sm ${padded ? 'p-4' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
      {children}
    </h2>
  );
}