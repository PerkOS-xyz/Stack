import { NextRequest, NextResponse } from "next/server";
import { getAgenticCommerceService, isAcpEnabled } from "@/lib/services/AgenticCommerceService";
import { acpJobActionSchema, validateBody } from "@/lib/validation/schemas";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

/**
 * GET /api/v2/acp/jobs?network=base&jobId=1
 * Read an ERC-8183 job's on-chain state.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const network = searchParams.get("network");
    const jobId = searchParams.get("jobId");

    if (!network || jobId === null) {
      return NextResponse.json({ error: "network and jobId are required" }, { status: 400, headers: corsHeaders });
    }
    if (!isAcpEnabled(network)) {
      return NextResponse.json(
        { error: `ACP (ERC-8183) not configured for network "${network}"` },
        { status: 501, headers: corsHeaders }
      );
    }

    const job = await getAgenticCommerceService().getJob(network, BigInt(jobId));
    return NextResponse.json({ job }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read job" },
      { status: 400, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/v2/acp/jobs
 * Build the UNSIGNED transaction for an ERC-8183 action (create/fund/submit/
 * complete/reject/...). The caller signs + broadcasts; the contract enforces
 * roles (client funds, provider submits, evaluator completes/rejects).
 */
export async function POST(req: NextRequest) {
  try {
    const validation = validateBody(acpJobActionSchema, await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: corsHeaders });
    }
    const { network, action, ...params } = validation.data;

    if (!isAcpEnabled(network)) {
      return NextResponse.json(
        {
          error: `ACP (ERC-8183) not configured for network "${network}". Deploy AgenticCommerce and set NEXT_PUBLIC_<NETWORK>_ACP_CONTRACT.`,
        },
        { status: 501, headers: corsHeaders }
      );
    }

    const unsignedTx = getAgenticCommerceService().buildActionTx(network, action, params);
    return NextResponse.json({ action, unsignedTx }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build action" },
      { status: 400, headers: corsHeaders }
    );
  }
}
