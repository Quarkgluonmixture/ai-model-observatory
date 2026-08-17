import {
  authorizePersonaRequest,
  compilePersona,
  errorResponse,
} from "../_server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const denied = await authorizePersonaRequest(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as {
      description?: unknown;
      candidate_count?: unknown;
    };
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const candidateCount = Number(body.candidate_count ?? 3);
    if (description.length < 20 || description.length > 20_000) {
      return Response.json(
        { error: "角色 prompt 长度必须在 20 到 20,000 个字符之间。" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!Number.isInteger(candidateCount) || candidateCount < 2 || candidateCount > 5) {
      return Response.json(
        { error: "候选数量必须是 2 到 5 之间的整数。" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await compilePersona(description, candidateCount);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
