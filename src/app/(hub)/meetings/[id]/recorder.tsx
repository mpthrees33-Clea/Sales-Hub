"use client";

/**
 * In-browser recorder (WO-07 task 1) — MediaRecorder, big phone-first
 * controls, elapsed timer, live level meter via AnalyserNode (static under
 * prefers-reduced-motion), pause/resume, designed mic-denied state, plus a
 * file-upload fallback.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui";

type RecState = "idle" | "denied" | "recording" | "paused" | "stopped";

export function Recorder({
  onComplete,
  disabled,
}: {
  onComplete: (blob: Blob, filename: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [finished, setFinished] = useState<Blob | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        setFinished(new Blob(chunksRef.current, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start(1000);
      setState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

      if (!reducedMotion) {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += Math.abs(v - 128);
          setLevel(Math.min(1, sum / data.length / 40));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }
    } catch {
      setState("denied");
    }
  };

  const stop = () => {
    mediaRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    setState("stopped");
  };

  const togglePause = () => {
    const rec = mediaRef.current;
    if (!rec) return;
    if (rec.state === "recording") {
      rec.pause();
      setState("paused");
    } else if (rec.state === "paused") {
      rec.resume();
      setState("recording");
    }
  };

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  if (state === "denied") {
    return (
      <div className="rounded-md border border-warn/40 bg-warn-dim p-3.5">
        <p className="text-[13px] font-medium text-warn">Microphone unavailable</p>
        <p className="mt-1 text-[12px] text-ink-muted">
          Allow microphone access in your browser settings, or upload a recording instead — webm, m4a, or mp3 up to
          100&nbsp;MB.
        </p>
        <UploadButton fileRef={fileRef} onComplete={onComplete} disabled={disabled} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {state === "idle" ? (
          <>
            <button
              type="button"
              onClick={start}
              disabled={disabled}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white transition-transform hover:scale-105 disabled:opacity-50"
              aria-label="Start recording"
            >
              <Mic className="h-6 w-6" />
            </button>
            <span className="text-[12px] text-ink-muted">Tap to record the meeting</span>
            <UploadButton fileRef={fileRef} onComplete={onComplete} disabled={disabled} />
          </>
        ) : state === "stopped" && finished ? (
          <>
            <span className="font-mono text-[13px]">{mmss} recorded</span>
            <Button
              variant="primary"
              disabled={disabled}
              onClick={() => void onComplete(finished, `meeting-${Date.now()}.webm`)}
              className="min-h-[44px]"
            >
              Process meeting
            </Button>
            <Button onClick={() => { setFinished(null); setState("idle"); setElapsed(0); }} className="min-h-[44px]">
              Discard
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={stop}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white"
              aria-label="Stop recording"
            >
              <Square className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={togglePause}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface2"
              aria-label={state === "paused" ? "Resume" : "Pause"}
            >
              {state === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <span className="font-mono text-lg tabular-nums">{mmss}</span>
            <LevelMeter level={state === "paused" ? 0 : level} reduced={reducedMotion} />
          </>
        )}
      </div>
    </div>
  );
}

function LevelMeter({ level, reduced }: { level: number; reduced: boolean }) {
  if (reduced) {
    return (
      <div className="h-2 w-28 overflow-hidden rounded-full bg-surface2">
        <div className="h-full bg-ok" style={{ width: `${Math.round(level * 100)}%` }} />
      </div>
    );
  }
  return (
    <div className="flex h-8 items-end gap-0.5" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-ok transition-all duration-75"
          style={{ height: `${Math.max(8, Math.min(100, level * 100 * (0.5 + Math.sin(i * 1.7) ** 2)))}%` }}
        />
      ))}
    </div>
  );
}

function UploadButton({
  fileRef,
  onComplete,
  disabled,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  onComplete: (blob: Blob, filename: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="audio/webm,audio/mp4,audio/mpeg,audio/wav,.m4a,.mp3,.webm,.wav"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onComplete(f, f.name);
        }}
      />
      <Button onClick={() => fileRef.current?.click()} disabled={disabled} className="min-h-[44px]">
        <Upload className="h-3.5 w-3.5" /> Upload audio
      </Button>
    </>
  );
}
