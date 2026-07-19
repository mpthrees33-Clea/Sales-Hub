/** Scene studio (WO-11 task 4) — pick finish, room, surfaces → generate. */
import { blobExists } from "@/lib/blob";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { sceneQuota, SCENE_COST_USD } from "@/lib/scene-limits";
import { Studio } from "./studio";

export const dynamic = "force-dynamic";

const ROOM_FIXTURES = [
  { key: "rooms/lobby.svg", label: "Lobby" },
  { key: "rooms/conference.svg", label: "Conference room" },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ sku?: string }> }) {
  const { sku } = await searchParams;
  const catalog = await db
    .select({ id: products.id, sku: products.sku, name: products.name, family: products.family, finish: products.finish, swatchBlobUrl: products.swatchBlobUrl })
    .from(products)
    .orderBy(products.name);
  const rooms = (await Promise.all(ROOM_FIXTURES.map(async (r) => ({ ...r, blobUrl: `/api/blob/${r.key}`, ok: await blobExists(r.key) })))).filter((r) => r.ok);
  const quota = await sceneQuota();
  const preselect = sku ? (catalog.find((c) => c.sku === sku)?.id ?? null) : null;

  return (
    <Studio
      catalog={catalog}
      rooms={rooms.map(({ label, blobUrl }) => ({ label, blobUrl }))}
      preselectProductId={preselect}
      quota={{ used: quota.used, cap: quota.cap, capReached: quota.capReached }}
      costUsd={SCENE_COST_USD}
    />
  );
}
