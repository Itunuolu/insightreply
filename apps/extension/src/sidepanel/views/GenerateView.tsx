import { TONES } from '@insightreply/shared';
import { useApp } from '../state/AppContext';
import { Button } from '../components/Button.js';
import { SectionLabel } from '../components/SectionLabel.js';
import { CommentCard } from '../components/CommentCard.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { LengthSelector } from '../components/LengthSelector.js';
import { LoadingState } from '../components/LoadingState.js';
import { PostPreview } from '../components/PostPreview.js';
import { ToneChip } from '../components/ToneChip.js';

export function GenerateView() {
  const { state, patchCompose, runGeneration, setView } = useApp();
  const { selectedPost, compose, generationStatus, generationError, result, drafts, settings } =
    state;

  const hasPost = Boolean(selectedPost);
  const isReply = Boolean(selectedPost?.replyContext);

  return (
    <div className="flex flex-col gap-4">
      <PostPreview />

      <div>
        <SectionLabel>Tone</SectionLabel>
        <div role="radiogroup" aria-label="Suggestion tone" className="flex flex-wrap gap-1.5">
          {TONES.map((tone) => (
            <ToneChip
              key={tone}
              tone={tone}
              selected={compose.tone === tone}
              onSelect={(next) => patchCompose({ tone: next })}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Length</SectionLabel>
        <LengthSelector value={compose.length} onChange={(length) => patchCompose({ length })} />
      </div>

      <div>
        <SectionLabel>Perspective</SectionLabel>
        <label htmlFor="perspective" className="sr-only">
          What perspective should the suggestion include?
        </label>
        <textarea
          id="perspective"
          value={compose.perspective}
          onChange={(event) => patchCompose({ perspective: event.target.value })}
          placeholder="e.g. Relate this to product management, add a Nigerian business perspective, ask a thoughtful question…"
          maxLength={500}
          rows={3}
          className="w-full resize-y rounded-xl border border-navy-600 bg-navy-800/60 p-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
        />
        <p className="mt-1 flex justify-end text-[11px] text-slate-500">
          {compose.perspective.length}/500
        </p>
      </div>

      <Button
        variant="primary"
        disabled={generationStatus === 'generating'}
        onClick={() => void runGeneration()}
        className="w-full"
      >
        {hasPost ? (
          <>Generate {settings.suggestionCount} {isReply ? 'Replies' : 'Comments'}</>
        ) : (
          <>Generate Suggestions</>
        )}
      </Button>

      {!hasPost && (
        <p className="text-center text-xs font-medium text-slate-400">
          Select a post or reply on LinkedIn first — click{' '}
          <span className="font-semibold text-gold-light">✨ AI Comment</span> on any post. The
          button appears near a post's engagement bar, or use{' '}
          <span className="font-semibold text-gold-light">✨ AI Reply</span> beside a reply.
        </p>
      )}

      <p className="text-center text-[11px] leading-relaxed text-slate-400">
        InsightReply generates writing suggestions. Review every {isReply ? 'reply' : 'comment'} before posting.
      </p>

      {generationStatus === 'generating' && <LoadingState label="Generating suggestions…" />}

      {generationStatus === 'error' && generationError && (
        <ErrorAlert error={generationError} onRetry={() => void runGeneration()} />
      )}

      {generationStatus === 'idle' && result === null && (
        <EmptyState
          title={hasPost ? 'Ready when you are' : 'Start with a LinkedIn conversation'}
          body={
            hasPost
              ? `Choose a tone and length, then generate ${isReply ? 'reply' : 'comment'} suggestions for the selected conversation.`
              : 'Open LinkedIn, click ✨ AI Comment on a post or ✨ AI Reply beside a reply, and the panel will fill in automatically.'
          }
        />
      )}

      {result !== null && (
        <div className="flex flex-col gap-3">
          {drafts.map((draft, index) => (
            <CommentCard key={draft.id} draft={draft} index={index} />
          ))}
          <Button variant="secondary" onClick={() => setView('settings')}>
            Adjust default preferences in Settings
          </Button>
        </div>
      )}
    </div>
  );
}
