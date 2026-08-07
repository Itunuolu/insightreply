import type { Tone } from '@insightreply/shared';
import { TONE_LABELS } from '@insightreply/shared';

interface ToneChipProps {
  tone: Tone;
  selected: boolean;
  onSelect: (tone: Tone) => void;
}

export function ToneChip({ tone, selected, onSelect }: ToneChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Tone: ${TONE_LABELS[tone]}`}
      onClick={() => onSelect(tone)}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        selected
          ? 'border-gold bg-gold/15 text-gold-light'
          : 'border-navy-600 text-slate-300 hover:border-navy-500 hover:text-white'
      }`}
    >
      {TONE_LABELS[tone]}
    </button>
  );
}