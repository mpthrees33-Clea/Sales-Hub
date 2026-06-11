import { useState, type ReactNode } from 'react';

// Shared-password gate — the static, GitHub-Pages equivalent of the
// brochure generator's NextAuth CredentialsProvider. Same shared password,
// same "Reps only" login screen. Because this is a client-only SPA there is
// no server to verify against, so the check runs in the browser and a passing
// rep is remembered in localStorage (mirrors the brochure's persistent JWT
// session). Set VITE_SHARED_PASSWORD at build time to change it.
const EXPECTED = (import.meta.env.VITE_SHARED_PASSWORD as string | undefined) ?? 'trinity';
const STORAGE_KEY = 'saleshub.authed';

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true'
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (authed) return <>{children}</>;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === EXPECTED) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setAuthed(true);
    } else {
      setError('Wrong password.');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 bg-bg text-fg">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-divider bg-surface p-6 shadow-panel"
      >
        <h1 className="text-2xl font-extrabold tracking-tight">
          sales <span className="text-accent">hub</span>
        </h1>
        <p className="mt-1 text-sm text-fg-muted">Reps only.</p>

        <label className="mt-6 block text-sm font-medium">
          Password
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            className="mt-1 w-full rounded-md border border-divider bg-surface-1 px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </label>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          className="mt-5 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-light"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
