declare module "cloudflare:workers" {
  export const env: { DB?: import("../lib/service").Database };
}
