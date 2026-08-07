import type { PanelError } from '../lib/api.js';

interface ErrorAlertProps {
  error: PanelError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorAlert({ error, onRetry, onDismiss }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-900 bg-red-950/40 p-4"
    >
      <p className="text-sm font-semibold text-red-300">Something went wrong</p>
      <p className="mt-1 text-xs leading-relaxed text-red-200/90">{error.message}</p>
      <div className="mt-3 flex gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-red-800/70 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-3 py-1.5 text-xs text-red-200/80 hover:bg-red-950"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}