import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <div className="font-mono text-xs tracking-[0.3em] text-ink-muted">CLEA SOLUTIONS</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sales Hub</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Mission Control for the field. Agents draft overnight; you review in the morning.
            <span className="text-ink"> Drafts only — humans send.</span>
          </p>
        </div>
        <LoginForm next={next ?? "/dashboard"} />
        <p className="mt-8 font-mono text-[11px] leading-relaxed text-ink-faint">
          01 · Private by default — demo instance, fictional data
          <br />
          02 · Single rep persona: Cole Mercer, Meridian Surfaces Co.
        </p>
      </div>
    </main>
  );
}
