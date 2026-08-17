import { personaServiceStatus } from "../_server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(personaServiceStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
