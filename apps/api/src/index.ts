import cron from "node-cron";
import { createApp } from "./app";
import { runElectionMaintenance } from "./lib/elections";

const port = Number(process.env.API_PORT || 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

cron.schedule("5 0 * * *", () => {
  runElectionMaintenance().catch((error) => console.error("Election job failed", error));
});

runElectionMaintenance().catch((error) => console.error("Election job failed", error));
