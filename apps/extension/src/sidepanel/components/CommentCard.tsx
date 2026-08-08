import type { ReactNode } from 'react';
import { TONE_LABELS, type Tone } from '@insightreply/shared';
import { useApp, type CommentDraft } from '../state/AppContext';

/** Renders the human label for a tone, falling back to the raw value. */
function toneLabel(tone: string): string {
  return TONE_LABELS[tone as Tone] ?? tone;
}

interface CommentCardProps {
  draft: CommentDraft;
  index: number;
}

export function CommentCard({ draft, index }: CommentCardProps) {
  const { setDraftText, copyDraft, insertDraft, regenerateDraft } = useApp();
  const charCount = draft.text.length;

  return (
    <article className="rounded-2xl border border-navy-600/70 bg-white p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-dark">
          {toneLabel(draft.tone)} · suggestion {index + 1}
        </p>
        <button
          type="button"
          onClick={() => void regenerateDraft(draft.id)}
          title="Regenerate this suggestion"
          aria-label="Regenerate this suggestion"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-900"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <label htmlFor={`draft-${draft.id}`} className="sr-only">
        Edit suggestion
      </label>
      <textarea
        id={`draft-${draft.id}`}
        value={draft.text}
        onChange={(event) => setDraftText(draft.id, event.target.value)}
        rows={4}
        className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm leading-relaxed text-navy-900 focus:border-gold focus:outline-none"
      />

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{charCount} characters</span>
        <div className="flex gap-2">
          <CardAction onClick={() => void copyDraft(draft.id)} label="Copy">
            <CopyIcon />
          </CardAction>
          <CardAction onClick={() => void insertDraft(draft.id)} label="Insert into LinkedIn">
            <InsertIcon />
          </CardAction>
        </div>
      </div>
    </article>
  );
}

function CardAction({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600/60 px-2.5 py-1.5 text-[11px] font-medium text-navy-800 hover:border-gold hover:text-gold-dark"
    >
      {children}
      {label}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function InsertIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
