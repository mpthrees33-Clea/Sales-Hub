/**
 * Deterministic WAV fixture for the meeting-recording demo — a clean,
 * speech-cadenced tone pattern (16 kHz mono, ~24 s) standing in for the
 * Harborview site-walk recording. Demo transcription ignores audio content
 * and returns the pre-baked transcript fixture.
 */
export function makeMeetingWav(): Buffer {
  const sampleRate = 16_000;
  const seconds = 24;
  const n = sampleRate * seconds;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    // Alternate two "speakers": different base pitches, syllable envelopes.
    const speakerB = Math.floor(t / 4) % 2 === 1;
    const base = speakerB ? 130 : 185;
    const syllable = Math.max(0, Math.sin(2 * Math.PI * 3.1 * t)) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.23 * t));
    const sample =
      (Math.sin(2 * Math.PI * base * t) * 0.5 + Math.sin(2 * Math.PI * base * 2.01 * t) * 0.25) * syllable * 0.4;
    data.writeInt16LE(Math.round(sample * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
