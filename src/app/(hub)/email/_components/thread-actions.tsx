"use client";

/**
 * Thread-view actions: Draft reply with AI (streams the email-reply run),
 * Draft quote (WO-05, quote routings), Re-run triage, Archive. Live agent
 * calls stream NDJSON step events — no dead spinners.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, RefreshCcw, Sparkles, Table2 } from "lucide-react";
import { Button } from "@/components/ui";
import { archiveThread, rerunTriage } from "../actions";

type StreamState = { phase: "idle" | "running" | "done" | "error"; steps: string[]; approvalId?: string; message?: string };

export function useAgentStream() {
  const [state, setState] = useState<StreamState>({ phase: "idle", steps: [] });
  const run = async (agent: string, input: unknown) => {
    setState({ phase: "running", steps: [] });
    try {
      const res = await fetch(`/api/agents/${agent}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let final: { status?: string; approvalIds?: string[]; message?: string } | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line) as { type: string; name?: string; kind?: string; status?: string; approvalIds?: string[]; message?: string };
          if (evt.type === "step") {
            setState((s) => ({ ...s, steps: [...s.steps, `${evt.kind}: ${evt.name}`] }));
          } else if (evt.type === "result") {
            final = evt;
          } else if (evt.type === "error") {
            throw new Error(evt.message ?? "agent error");
          }
        }
      }
      setState((s) => ({
        ...s,
        phase: "done",
        approvalId: final?.approvalIds?.[0],
        message: final?.status === "escalated" ? "Escalated — needs human input (see Approvals)" : undefined,
      }));
      return final;
    } catch (e) {
      setState((s) => ({ ...s, phase: "error", message: e instanceof Error ? e.message : "failed" }));
      return null;
    }
  };
  return { state, run };
}

export function StreamProgress({ state }: { state: StreamState }) {
  if (state.phase === "idle") return null;
  return (
    <div className="mt-2 rounded-md border border-line bg-bg p-2.5">
      {state.steps.map((s, i) => (
        <p key={i} className="font-mono text-[10px] text-ink-muted">
          ▸ {s}
        </p>
      ))}
      {state.phase === "running" ? (
        <p className="font-mono text-[10px] text-accent status-running">▸ agent thinking…</p>
      ) : state.phase === "error" ? (
        <p className="font-mono text-[10px] text-danger">✗ {state.message}</p>
      ) : (
        <p className="font-mono text-[10px] text-ok">
          ✓ done{" "}
          {state.approvalId ? (
            <Link href={`/approvals?id=${state.approvalId}`} className="text-accent underline">
              review the draft →
            </Link>
          ) : (
            state.message
          )}
        </p>
      )}
    </div>
  );
}

export function ThreadActions({
  threadId,
  archived,
  replyRoutingId,
  quoteRoutingId,
}: {
  threadId: string;
  archived: boolean;
  replyRoutingId: string | null;
  quoteRoutingId: string | null;
}) {
  const router = useRouter();
  const { state, run } = useAgentStream();
  const [busy, setBusy] = useState(false);

  const draftReply = async () => {
    if (replyRoutingId) {
      await run("email-reply", { mode: "reply", routingId: replyRoutingId });
    }
    router.refresh();
  };

  const draftQuote = async () => {
    if (quoteRoutingId) {
      await run("quote", { routingId: quoteRoutingId });
    }
    router.refresh();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {replyRoutingId ? (
          <Button variant="primary" onClick={draftReply} disabled={state.phase === "running"}>
            <Sparkles className="h-3.5 w-3.5" /> Draft reply with AI
          </Button>
        ) : null}
        {quoteRoutingId ? (
          <Button variant="primary" onClick={draftQuote} disabled={state.phase === "running"}>
            <Table2 className="h-3.5 w-3.5" /> Draft quote
          </Button>
        ) : null}
        <Button
          onClick={async () => {
            setBusy(true);
            await rerunTriage(threadId);
            setBusy(false);
            router.refresh();
          }}
          disabled={busy}
        >
          <RefreshCcw className="h-3.5 w-3.5" /> Re-run triage
        </Button>
        <Button
          onClick={async () => {
            await archiveThread(threadId, !archived);
            router.refresh();
          }}
        >
          {archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          {archived ? "Unarchive" : "Archive"}
        </Button>
      </div>
      <StreamProgress state={state} />
    </div>
  );
}
