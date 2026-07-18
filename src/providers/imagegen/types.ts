/** ImageGenProvider — reference-conditioned room scenes (docs/01 §6, WO-11). */
export type GenerateSceneInput = {
  productSwatchUrl: string;
  roomPhotoUrl: string;
  targetSurfaces: string[];
  styleNotes?: string;
  promptText: string;
};

export type GenerateSceneResult = {
  imageBlobUrl: string;
  model: string;
  durationMs: number;
};

export interface ImageGenProvider {
  generateScene(input: GenerateSceneInput): Promise<GenerateSceneResult>;
}
