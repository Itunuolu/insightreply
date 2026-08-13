import { useApp } from './state/AppContext';
import { ConfirmationDialog } from './components/ConfirmationDialog.js';
import { GearIcon, IconButton } from './components/IconButton.js';
import { Toasts } from './components/Toasts.js';
import { GenerateView } from './views/GenerateView.js';
import { SettingsView } from './views/SettingsView.js';

function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-white ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="h-full w-full">
        <rect width="32" height="32" rx="8" fill="#0b1220" />
        <rect x="5.5" y="8" width="21" height="16" rx="5" fill="none" stroke="#d4af37" strokeWidth="2" />
        <circle cx="11" cy="16" r="1.8" fill="#d4af37" />
        <circle cx="16" cy="16" r="1.8" fill="#d4af37" />
        <circle cx="21" cy="16" r="1.8" fill="#d4af37" />
      </svg>
    </div>
  );
}

export function App() {
  const { state, setView } = useApp();
  const isSettings = state.view === 'settings';

  return (
    <div className="flex h-full flex-col bg-navy-900 text-slate-100">
      <header className="flex items-center justify-between gap-3 border-b border-navy-700/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <LogoMark />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold tracking-tight text-white">
              InsightReply
            </p>
            <p className="text-[11px] text-gold-light">by Hadesh.ai</p>
          </div>
        </div>
        <IconButton
          label={isSettings ? 'Back to suggestions' : 'Settings'}
          onClick={() => {
            if (isSettings) {
              setView('generate');
            } else {
              setView('settings');
            }
          }}
        >
          {isSettings ? <BackIcon /> : <GearIcon />}
        </IconButton>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {isSettings ? <SettingsView /> : <GenerateView />}
      </main>

      <footer className="border-t border-navy-700/60 px-4 py-2.5">
        <p className="text-center text-[10px] text-slate-500">
          AI writing assistant · You review and post every suggestion
        </p>
      </footer>

      <ConfirmationDialog />
      <Toasts />
    </div>
  );
}

function BackIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
