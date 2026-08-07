import { useState } from 'react';
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
        <p className="text-sm font-medium text-slate-200">No post selected</p>
        <p className="mt-1 text-xs text-slate-400">
          Open LinkedIn, click <span className="font-semibold text-gold-light">✨ AI Comment</span>{' '}
          on a post to begin.
        </p>
      </div>
    );
  }

  const fullText = sanitizeText(post.postText);
  const previewText = expanded ? fullText : truncate(fullText, PREVIEW_LIMIT);
  const truncated = fullText.length > PREVIEW_LIMIT;

  return (
    <div className="rounded-2xl border border-navy-600/70 bg-navy-800/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-slate-400">Selected post</p>
          <p className="truncate text-sm font-semibold text-white">
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