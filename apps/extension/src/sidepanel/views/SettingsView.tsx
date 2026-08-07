import type { Settings } from '@insightreply/shared';
import { TONES, EMOJI_PREFERENCES, DEFAULT_SETTINGS } from '@insightreply/shared';
import { useApp } from '../state/AppContext';
import { Button } from '../components/Button.js';
import { SectionLabel } from '../components/SectionLabel.js';
import { ToneChip } from '../components/ToneChip.js';

const PROFILE_EXAMPLE = `I am a business analyst, product manager, and AI product builder.
I prefer thoughtful, practical comments that connect ideas to product strategy,
business growth, digital transformation, and African markets.`;

export function SettingsView() {
  const { state, patchSettings, resetSettings, setView, showToast, clearSelectedPost } = useApp();
  const settings = state.settings;
  const dirty =
    settings.defaultTone !== DEFAULT_SETTINGS.defaultTone ||
    settings.defaultLength !== DEFAULT_SETTINGS.defaultLength ||
    settings.suggestionCount !== DEFAULT_SETTINGS.suggestionCount ||
    settings.emojiPreference !== DEFAULT_SETTINGS.emojiPreference ||
    settings.writingProfile !== DEFAULT_SETTINGS.writingProfile ||
    settings.language !== DEFAULT_SETTINGS.language ||
    settings.backendUrl !== DEFAULT_SETTINGS.backendUrl;

  const update = async (patch: Parameters<typeof patchSettings>[0]) => {
    try {
      await patchSettings(patch);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Settings could not be saved.', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => setView('generate')}
        className="self-start text-xs font-medium text-slate-300 hover:text-white"
      >
        ← Back to suggestions
      </button>

      <section>
        <SectionLabel>Defaults</SectionLabel>
        <div className="flex flex-col gap-4 rounded-2xl border border-navy-600/70 bg-navy-800/60 p-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-200">Default tone</p>
            <div role="radiogroup" aria-label="Default tone" className="flex flex-wrap gap-1.5">
              {TONES.map((tone) => (
                <ToneChip
                  key={tone}
                  tone={tone}
                  selected={settings.defaultTone === tone}
                  onSelect={(next) => void update({ defaultTone: next })}
                />
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="default-length" className="mb-1.5 block text-xs font-medium text-slate-200">
              Default length
            </label>
            <select
              id="default-length"
              value={settings.defaultLength}
              onChange={(event) =>
                void update({ defaultLength: event.target.value as Settings['defaultLength'] })
              }
              className="w-full rounded-xl border border-navy-600 bg-navy-800 px-3 py-2 text-sm text-slate-100 focus:border-gold focus:outline-none"
            >
              <option value="short">Short (15–30 words)</option>
              <option value="medium">Medium (30–60 words)</option>
              <option value="detailed">Detailed (60–100 words)</option>
            </select>
          </div>

          <div>
            <label htmlFor="suggestion-count" className="mb-1.5 block text-xs font-medium text-slate-200">
              Number of suggestions
            </label>
            <select
              id="suggestion-count"
              value={settings.suggestionCount}
              onChange={(event) =>
                void update({ suggestionCount: Number(event.target.value) })
              }
              className="w-full rounded-xl border border-navy-600 bg-navy-800 px-3 py-2 text-sm text-slate-100 focus:border-gold focus:outline-none"
            >
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-200">Emoji preference</p>
            <div role="radiogroup" aria-label="Emoji preference" className="flex gap-1.5">
              {EMOJI_PREFERENCES.map((pref) => (
                <button
                  key={pref}
                  type="button"
                  role="radio"
                  aria-checked={settings.emojiPreference === pref}
                  onClick={() => void update({ emojiPreference: pref })}
                  className={`rounded-full border px-3 py-1.5 text-xs capitalize transition-colors ${
                    settings.emojiPreference === pref
                      ? 'border-gold bg-gold/15 text-gold-light'
                      : 'border-navy-600 text-slate-300 hover:text-white'
                  }`}
                >
                  {pref === 'none' ? 'None' : 'Occasional'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="language" className="mb-1.5 block text-xs font-medium text-slate-200">
              Preferred language
            </label>
            <input
              id="language"
              type="text"
              value={settings.language}
              maxLength={30}
              onChange={(event) => void update({ language: event.target.value })}
              placeholder="English"
              className="w-full rounded-xl border border-navy-600 bg-navy-800 px-3 py-2 text-sm text-slate-100 focus:border-gold focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Writing profile</SectionLabel>
        <div className="rounded-2xl border border-navy-600/70 bg-navy-800/60 p-4">
          <label htmlFor="profile" className="sr-only">
            Writing profile
          </label>
          <textarea
            id="profile"
            value={settings.writingProfile}
            onChange={(event) => void update({ writingProfile: event.target.value })}
            placeholder={PROFILE_EXAMPLE}
            maxLength={1500}
            rows={5}
            className="w-full resize-y rounded-xl border border-navy-600 bg-navy-900/60 p-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            {settings.writingProfile.length}/1500 — only sent to the generation backend when you
            generate.
          </p>
        </div>
      </section>

      <section>
        <SectionLabel>Backend</SectionLabel>
        <div className="rounded-2xl border border-navy-600/70 bg-navy-800/60 p-4">
          <label htmlFor="backend-url" className="mb-1.5 block text-xs font-medium text-slate-200">
            Backend API URL
          </label>
          <input
            id="backend-url"
            type="url"
            value={settings.backendUrl}
            onChange={(event) => void update({ backendUrl: event.target.value })}
            className="w-full rounded-xl border border-navy-600 bg-navy-800 px-3 py-2 text-sm text-slate-100 focus:border-gold focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Your own instance of the InsightReply backend (default: http://localhost:8787).
          </p>
        </div>
      </section>

      <section>
        <SectionLabel>Privacy</SectionLabel>
        <div className="rounded-2xl border border-navy-600/70 bg-navy-800/60 p-4 text-xs leading-relaxed text-slate-300">
          <p>
            Post content is processed only when you press Generate. The extension never posts
            comments automatically, does not sell data, and does not collect LinkedIn credentials.
            Avoid sending confidential information in posts you analyse.
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <Button variant="secondary" onClick={() => void clearSelectedPost()} disabled={!state.selectedPost}>
          Clear selected post
        </Button>
        <Button variant="danger" onClick={() => void resetSettings()} disabled={!dirty}>
          Clear settings
        </Button>
      </div>
    </div>
  );
}