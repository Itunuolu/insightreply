import { useApp, type ToastMessage } from '../state/AppContext';

const kindStyles: Record<ToastMessage['kind'], string> = {
  success: 'border-gold/60 bg-navy-800 text-gold-light',
  error: 'border-red-900 bg-navy-800 text-red-300',
  info: 'border-navy-600 bg-navy-800 text-slate-200',
};

export function Toasts() {
  const { state, dismissToast } = useApp();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col gap-2"
    >
      {state.toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs shadow-lg ${kindStyles[toast.kind]}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
        >
          <p className="leading-relaxed">{toast.text}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}