import { Spinner } from './Button.js';

interface LoadingStateProps {
  label: string;
}

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-navy-600/70 bg-navy-800/60 px-4 py-10"
    >
      <Spinner className="h-7 w-7 text-gold" />
      <p className="text-sm text-slate-300">{label}</p>
      <p className="text-xs text-slate-500">Usually takes a few seconds.</p>
    </div>
  );
}