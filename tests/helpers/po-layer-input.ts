/** Test helper: assemble a LayerInput for determinism assertions. */
import type { PoExtraction } from "@/agents/po-intake";
import { loadLayerInput } from "@/app/api/workflows/po-intake/workflow";
import type { LayerInput } from "@/lib/po-intake/layers";

export async function loadInputForTest(extraction: PoExtraction): Promise<LayerInput> {
  return loadLayerInput("00000000-0000-4000-8000-0000000000po".replace("po", "01"), extraction);
}
