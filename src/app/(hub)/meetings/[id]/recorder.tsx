"use client";

/**
 * Meeting recorder (WO-07 task 1) — phone-width first. MediaRecorder (opus),
 * elapsed timer, live level meter (animated waveform when motion is allowed,
 * static bar under prefers-reduced-motion), and a "Process meeting" CTA that
 * runs the pipeline. Mic-denied shows designed guidance, not a broken state.
 * In DEMO_MODE the transcript is the pre-baked fixture regardless of audio.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Square, Wand2 } from "lucide-react";
import { Button } from "@/components/ui";
import { processMeetingAction } from "./actions";

export function Recorder({ meetingId }: { meetingId: string }) {
  const [state, setState] = useState<"idle" | "recording" | "stopped" | "denied">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => cleanup(), []);
  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      mediaRef.current = rec;
      rec.start();
      setState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      // level meter
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setLevel(data.reduce((a, b) => a + b, 0) / data.length / 255);
        if (!reduce) rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setState("denied");
    }
  }

  function stop() {
    mediaRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setState("stopped");
  }

  const process = () =>
    startTransition(async () => {
      await processMeetingAction(meetingId);
      router.refresh();
    });

  const mmss = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, "0")}`;

  if (state === "denied") {
    return (
      <div className="rounded-lg border border-line bg-surface2/40 p-4 text-center">
        <p className="text-[13px] font-medium">Microphone access needed</p>
        <p className="mt-1 text-[11px] text-ink-muted">Allow mic access to record, or process the meeting from the seeded audio below.</p>
        <div className="mt-3">
          <Button variant="primary" disabled={pending} onClick={process}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Process meeting
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface2/40 p-4">
      <div className="flex items-center gap-3">
        {state === "recording" ? (
          <button type="button" onClick={stop} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-danger text-white" aria-label="Stop recording">
            <Square className="h-5 w-5" />
          </button>
        ) : (
          <button type="button" onClick={start} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink" aria-label="Start recording">
            <Mic className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[13px] tabular-nums">{mmss}</div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-accent transition-[width] duration-100" style={{ width: `${Math.min(100, level * 140)}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="primary" disabled={pending || state === "recording"} onClick={process}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Process meeting
        </Button>
        <span className="font-mono text-[10px] text-ink-faint">demo: transcript is the seeded site-walk fixture</span>
      </div>
    </div>
  );
}
