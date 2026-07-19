import { logout } from "@/app/(auth)/login/actions";

export function TopBar({
  clockLabel,
  showChip,
  repName,
}: {
  clockLabel: string;
  showChip: boolean;
  repName: string;
}) {
  const initials = repName
    .split(" ")
    .map((p) => p[0])
    .join("");
  return (
    <header className="flex h-12 items-center justify-between border-b border-line bg-surface px-4 pl-14 md:px-5">
      <div className="flex items-center gap-3">
        {showChip ? (
          <span className="rounded-full border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-ink-muted">
            DEMO • {clockLabel}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <form action={logout}>
          <button
            type="submit"
            className="text-[11px] text-ink-faint transition-colors hover:text-ink-muted"
            title="Sign out"
          >
            Sign out
          </button>
        </form>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface2 font-mono text-[11px] text-ink-muted"
          title={repName}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
