import type { CommentLength } from '@insightreply/shared';
import { LENGTH_LABELS } from '@insightreply/shared';

interface LengthSelectorProps {
  value: CommentLength;
  onChange: (length: CommentLength) => void;
}

export function LengthSelector({ value, onChange }: LengthSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Comment length" className="grid grid-cols-3 gap-2">
      {(Object.keys(LENGTH_LABELS) as CommentLength[]).map((length) => {
        const meta = LENGTH_LABELS[length];
        const selected = value === length;
        return (
          <button
            key={length}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(length)}
            className={`rounded-xl border p-2.5 text-left transition-colors ${
              selected
                ? 'border-gold bg-gold/15'
                : 'border-navy-600 hover:border-navy-500'
            }`}
          >
            <span className={`block text-xs font-semibold ${selected ? 'text-gold-light' : 'text-slate-200'}`}>
              {meta.label}
            </span>
            <span className="mt-0.5 block text-[10px] leading-tight text-slate-400">
              {meta.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}