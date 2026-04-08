import { homedir } from "node:os";
import { join } from "node:path";

export function configPath(): string {
  if (process.env.KAVRITH_CONFIG_PATH) return process.env.KAVRITH_CONFIG_PATH;
  return join(
    homedir(),
    "Library",
    "Application Support",
    "Kavrith",
    "config.json",
  );
}
