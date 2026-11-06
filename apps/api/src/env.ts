import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";

const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "apps", "api", ".env"),
  path.resolve(__dirname, "..", ".env"),
  path.resolve(__dirname, "..", "..", ".env"),
];

for (const file of candidates) {
  if (!existsSync(file)) continue;
  loadEnvFile(file);
  break;
}
