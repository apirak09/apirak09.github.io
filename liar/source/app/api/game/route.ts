import { getDatabase } from "@/db";
import { handle } from "@/lib/service";
import type { Database } from "@/lib/service";

async function route(request:Request) {
  const db=getDatabase();
  if(!db) return Response.json({error:"Multiplayer is temporarily unavailable. Please try again shortly."},{status:503,headers:{"Cache-Control":"no-store"}});
  return handle(request,db as Database);
}
export const GET=route;
export const POST=route;
