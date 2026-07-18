/**
 * Provider resolver (docs/01 §6): DEMO_MODE resolves Demo implementations;
 * live classes exist behind the same interfaces. ErpProvider is always the
 * seeded Postgres. ImageGen intentionally allows live generation inside demo
 * mode when explicitly configured (the one live wow — WO-11 task 7).
 */
import { env } from "@/lib/env";
import { DemoCalendarProvider } from "./calendar/demo";
import type { CalendarProvider } from "./calendar/types";
import { DemoEmailProvider } from "./email/demo";
import { GraphEmailProvider } from "./email/live";
import type { EmailProvider } from "./email/types";
import { DemoErpProvider } from "./erp/demo";
import type { ErpProvider } from "./erp/types";
import { DemoImageGenProvider } from "./imagegen/demo";
import { GeminiImageGenProvider } from "./imagegen/live";
import type { ImageGenProvider } from "./imagegen/types";
import { DemoMapsProvider } from "./maps/demo";
import { GoogleRoutesMapsProvider } from "./maps/live";
import type { MapsProvider } from "./maps/types";
import { DemoTranscriptionProvider } from "./transcription/demo";
import { AssemblyAiTranscriptionProvider } from "./transcription/live";
import type { TranscriptionProvider } from "./transcription/types";

export function getEmailProvider(): EmailProvider {
  return env.DEMO_MODE ? new DemoEmailProvider() : new GraphEmailProvider();
}

export function getCalendarProvider(): CalendarProvider {
  return new DemoCalendarProvider(); // Graph calendar is a later swap; demo reads meetings
}

export function getTranscriptionProvider(): TranscriptionProvider {
  if (!env.DEMO_MODE && env.ASSEMBLYAI_API_KEY) return new AssemblyAiTranscriptionProvider();
  return new DemoTranscriptionProvider();
}

export function getMapsProvider(): MapsProvider {
  if (!env.DEMO_MODE && env.GOOGLE_MAPS_API_KEY) return new GoogleRoutesMapsProvider();
  if (env.DEMO_MODE && env.GOOGLE_MAPS_API_KEY) return new GoogleRoutesMapsProvider();
  return new DemoMapsProvider();
}

export function getImageGenProvider(): ImageGenProvider {
  const liveAllowed = env.GEMINI_API_KEY && (env.SCENES_LIVE_IN_DEMO || !env.DEMO_MODE);
  return liveAllowed ? new GeminiImageGenProvider() : new DemoImageGenProvider();
}

export function getErpProvider(): ErpProvider {
  return new DemoErpProvider(); // always seeded Postgres — there is no live ERP
}
