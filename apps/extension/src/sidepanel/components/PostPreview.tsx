import { useState } from 'react';
import { MAX_POST_LENGTH } from '@insightreply/shared';
import { useApp } from '../state/AppContext';
import { sanitizeText } from '../lib/sanitize.js';

const PREVIEW_LIMIT = 500;

/** Shows the author and first 500 characters of the selected post. */
export function PostPreview() {
  const { state, clearSelectedPost } = useApp();
  const [expanded, setExpanded] = useState(false);
  const post = state.selectedPost;

  if (!post) {
    return (
      <div className="rounded-2xl border border-dashed border-navy-600 bg-navy-800/60 p-4 text-center">
        <p className="text-sm font-medium text-slate-200">No conversation selected</p>
        <p className="mt-1 text-xs text-slate-400">
          Open LinkedIn, click <span className="font-semibold text-gold-light">✨ AI Comment</span>{' '}
          on a post, or <span className="font-semibold text-gold-light">✨ AI Reply</span> beside a reply.
        </p>
      </div>
    );
  }

  // sanitizeText caps at 500 characters by default, which silently truncated
  // every preview to exactly the preview limit and made `truncated` (and the
  // Expand control) permanently false.
  const fullText = sanitizeText(post.postText, MAX_POST_LENGTH);
  const previewText = expanded ? fullText : truncate(fullText, PREVIEW_LIMIT);
  const truncated = fullText.length > PREVIEW_LIMIT;
  const reply = post.replyContext;

  return (
    <div className="rounded-2xl border border-navy-600/70 bg-navy-800/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-slate-400">{reply ? 'Reply conversation' : 'Selected post'}</p>
          <p className="truncate text-sm font-semibold text-white">
            {reply ? 'Post by ' : ''}
            {post.authorName ? sanitizeText(post.authorName, 200) : 'Unknown author'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void clearSelectedPost()}
          className="shrink-0 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-navy-700 hover:text-white"
        >
          Clear
        </button>
      </div>
      <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-slate-300">
        {previewText}
      </p>
      {reply && (
        <div className="mt-3 rounded-xl border border-gold/25 bg-gold/5 p-3">
          {reply.parentCommentText && (
            <div className="mb-2 border-l-2 border-slate-600 pl-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Your comment
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                {sanitizeText(reply.parentCommentText, 700)}
              </p>
            </div>
          )}
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gold-light">
            Reply from {reply.authorName ? sanitizeText(reply.authorName, 200) : 'LinkedIn member'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-200">
            {sanitizeText(reply.text, 1_000)}
          </p>
        </div>
      )}
      {truncated && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-gold-light hover:underline"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      )}
      {post.truncated && (
        <p className="mt-2 rounded-lg bg-gold/10 px-2 py-1.5 text-[11px] text-gold-light">
          This post appears truncated. Expand it on LinkedIn first so InsightReply can analyse the
          complete text.
        </p>
      )}
    </div>
  );
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}
