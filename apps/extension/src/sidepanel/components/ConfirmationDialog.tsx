import { useApp } from '../state/AppContext';

/** Replace / Append / Cancel dialog shown when the editor already has text. */
export function ConfirmationDialog() {
  const { state, confirmResolve, confirmCancel } = useApp();
  const request = state.confirm;
  if (!request) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-40 flex items-end justify-center bg-navy-950/70 p-4 backdrop-blur-[2px]"
      onClick={confirmCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-navy-600 bg-navy-800 p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-sm font-semibold text-white">
          Replace or append?
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">{request.text}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => confirmResolve('replace')}
            className="rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-navy-950 hover:bg-gold-light"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => confirmResolve('append')}
            className="rounded-xl border border-navy-600 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-navy-700"
          >
            Append
          </button>
          <button
            type="button"
            onClick={confirmCancel}
            className="rounded-xl px-3 py-2 text-xs font-medium text-slate-400 hover:bg-navy-700 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}