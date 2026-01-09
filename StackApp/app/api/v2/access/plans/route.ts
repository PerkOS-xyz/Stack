import { NextRequest, NextResponse } from "next/server";
import { getActivePlans, ACCESS_PLANS, STACK_API_ENDPOINTS } from "@/lib/config/access-plans";

export const dynamic = "force-dynamic";

/**
 * GET /api/v2/access/plans
 *
 * List all available access plans
 */
export async function GET(request: NextRequest) {
  const plans = getActivePlans();

  return NextResponse.json({
    success: true,
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.priceUsd === "custom" ? "Contact Us" : plan.priceUsd === "0" ? "Free" : `$${plan.priceUsd}/mo`,
      priceUsd: plan.priceUsd,
      priceAtomicUnits: plan.priceAtomicUnits,
      limits: {
        monthlyApiCalls: plan.monthlyApiCalls === -1 ? "Unlimited" : plan.monthlyApiCalls.toLocaleString(),
        networks: plan.networkLimit === -1 ? "All networks" : `${plan.networkLimit} network${plan.networkLimit > 1 ? "s" : ""}`,
        priorityRouting: plan.priorityRouting,
        dedicatedInfra: plan.dedicatedInfra,
        sla: plan.slaGuarantee,
      },
      features: plan.features,
      supportLevel: plan.supportLevel,
    })),
    endpoints: STACK_API_ENDPOINTS,
    notes: [
      "L2 transaction fees paid by users",
      "All plans include access to all API endpoints",
      "Enterprise plans include custom SLA and dedicated support",
    ],
  });
}
