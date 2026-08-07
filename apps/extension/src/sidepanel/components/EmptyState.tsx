interface EmptyStateProps {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-navy-600 bg-navy-800/40 px-4 py-10 text-center">
      <div className="text-2xl" aria-hidden="true">
        ✦
      </div>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="max-w-[240px] text-xs leading-relaxed text-slate-400">{body}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-navy-950 hover:bg-gold-light"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}