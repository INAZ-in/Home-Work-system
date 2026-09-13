import cron from "node-cron";
import { createApp } from "./app.js";
import { runScheduleSync } from "./services/bmstuSync.js";

const PORT = Number(process.env.PORT ?? 4000);

const app = createApp();

app.listen(PORT, () => {
  console.log(`HomeWorke backend listening on :${PORT}`);
});

if (process.env.DISABLE_SYNC_CRON !== "true") {
  // Daily at 03:00 Europe/Moscow — schedules rarely change intraday, and the
  // group's day hasn't started yet at that hour.
  cron.schedule(
    "0 3 * * *",
    () => {
      console.log("[cron] Running scheduled bmstu schedule sync...");
      runScheduleSync()
        .then((result) => console.log("[cron] Sync finished:", result.status, result))
        .catch((err) => console.error("[cron] Sync threw unexpectedly:", err));
    },
    { timezone: "Europe/Moscow" },
  );
  console.log("Daily schedule sync cron armed (03:00 Europe/Moscow).");
} else {
  console.log("Schedule sync cron disabled via DISABLE_SYNC_CRON.");
}
