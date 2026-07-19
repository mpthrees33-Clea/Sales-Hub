import { db } from "@/db/client";
import { products } from "@/db/schema";
import { sceneBudget } from "@/lib/scene-limits";
import { SceneStudioClient } from "./studio-client";

export const dynamic = "force-dynamic";

const FIXTURE_ROOMS = [
  { key: "lobby", label: "Customer lobby (fixture)", url: "/api/blob/rooms/lobby.svg" },
  { key: "conference", label: "Conference room (fixture)", url: "/api/blob/rooms/conference.svg" },
];

export default async function NewScenePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;
  const [rows, budget] = await Promise.all([
    db
      .select({ id: products.id, sku: products.sku, name: products.name, swatch: products.swatchBlobUrl })
      .from(products)
      .orderBy(products.name),
    sceneBudget(),
  ]);
  // Hero SKU first (WO-11 task 4).
  const sorted = [...rows.sort((a, b) => (a.sku === "MS-WG-1147" ? -1 : b.sku === "MS-WG-1147" ? 1 : 0))];
  return (
    <SceneStudioClient
      products={sorted}
      fixtureRooms={FIXTURE_ROOMS}
      budget={budget}
      preselectedProductId={product}
    />
  );
}
