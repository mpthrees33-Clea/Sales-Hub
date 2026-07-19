import "@/lib/load-env";
import { closeDb } from "@/db/client";
import { nightlyRun } from "@/app/api/workflows/nightly";

async function main() {
  console.log("starting nightly…");
  const r1 = await nightlyRun({ trigger: "simulate" });
  console.log(JSON.stringify(r1, null, 2));
  const r2 = await nightlyRun({ trigger: "simulate" });
  console.log("second run:", JSON.stringify(r2));
  await closeDb();
}
main().catch(async (e) => { console.error(e); process.exitCode = 1; await closeDb(); });
