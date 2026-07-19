import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { presentations } from "@/db/schema";
import { SlideshowClient } from "./slideshow-client";

export const dynamic = "force-dynamic";

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pres = await db.query.presentations.findFirst({ where: eq(presentations.id, id) });
  if (!pres) notFound();
  return <SlideshowClient presentationId={pres.id} title={pres.title} slides={pres.slides} exportedAssetId={pres.exportedAssetId} />;
}
