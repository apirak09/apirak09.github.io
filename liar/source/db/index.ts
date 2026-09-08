import { env } from "cloudflare:workers";
export function getDatabase() { return env.DB; }
