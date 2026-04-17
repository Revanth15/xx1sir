import { NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/server-auth";
import type {
  AssetInspectionRecord,
  AssetRecord,
  AssetTypeConfig,
} from "@/lib/types/assets";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  buildAssetWithStatus,
  buildInspectionFailureDescription,
  isServiceabilityStatus,
  normalizeAssetLookupCode,
  summarizeCheckResults,
  validateChecklistSchema,
} from "@/utils/assets";
import { ApiError, successResponse, withApiHandler } from "@/utils/api";

const inspectionSchema = z.object({
  serviceability_status: z.string().trim().min(1),
  notes: z.string().trim().optional(),
  check_results_json: z.record(z.string(), z.unknown()).default({}),
});

export const POST = withApiHandler(
  async (
    req: NextRequest,
    context: { params: Promise<{ assetCode: string }> }
  ) => {
    const { user, profile } = await requireApiUser();
    const payload = await req.json();
    const parsed = inspectionSchema.safeParse(payload);

    if (!parsed.success) {
      throw new ApiError(
        400,
        "Invalid inspection payload.",
        parsed.error.flatten()
      );
    }

    if (!isServiceabilityStatus(parsed.data.serviceability_status)) {
      throw new ApiError(400, "Invalid serviceability status.");
    }

    const { assetCode: rawAssetCode } = await context.params;
    const assetCode = normalizeAssetLookupCode(rawAssetCode);
    const supabaseAdmin = createAdminClient();

    const { data: asset, error: assetError } = await supabaseAdmin
      .from("assets")
      .select("*")
      .eq("asset_code", assetCode)
      .eq("is_active", true)
      .single<AssetRecord>();

    if (assetError || !asset) {
      throw new ApiError(404, "Asset not found.");
    }

    const { data: assetTypeConfig, error: typeError } = await supabaseAdmin
      .from("asset_type_configs")
      .select("*")
      .eq("code", asset.asset_type_code)
      .single<AssetTypeConfig>();

    if (typeError || !assetTypeConfig) {
      throw new ApiError(400, "Asset type config not found.");
    }

    const checklistErrors = validateChecklistSchema(
      assetTypeConfig.checklist_schema_json,
      parsed.data.check_results_json
    );

    if (checklistErrors.length > 0) {
      throw new ApiError(400, "Checklist validation failed.", checklistErrors);
    }

    const inspectedAt = new Date().toISOString();
    const inspectorName = profile?.username || user.email || user.id;

    const { data: inspection, error: inspectionError } = await supabaseAdmin
      .from("asset_inspections")
      .insert([
        {
          asset_id: asset.id,
          inspected_at: inspectedAt,
          inspected_by_user_id: user.id,
          inspected_by_name: inspectorName,
          serviceability_status: parsed.data.serviceability_status,
          core_notes: parsed.data.notes || null,
          check_results_json: parsed.data.check_results_json,
        },
      ])
      .select("*")
      .single<AssetInspectionRecord>();

    if (inspectionError) {
      throw new ApiError(500, "Failed to create inspection.", inspectionError);
    }

    const { data: updatedAsset, error: updateError } = await supabaseAdmin
      .from("assets")
      .update({
        last_inspected_at: inspectedAt,
        last_inspected_by: inspectorName,
        last_serviceability_status: parsed.data.serviceability_status,
        last_check_summary_json: summarizeCheckResults(
          parsed.data.check_results_json
        ),
        latest_inspection_id: inspection.id,
        updated_at: inspectedAt,
        updated_by: inspectorName,
      })
      .eq("id", asset.id)
      .select("*")
      .single<AssetRecord>();

    if (updateError || !updatedAsset) {
      throw new ApiError(500, "Failed to update asset status.", updateError);
    }

    const enrichedAsset = buildAssetWithStatus(updatedAsset, assetTypeConfig);
    const promptLinkedReport =
      parsed.data.serviceability_status === "UNSERVICEABLE";

    return successResponse(
      {
        inspection,
        asset: enrichedAsset,
        prompt_linked_report: promptLinkedReport,
        damage_report_prefill: promptLinkedReport
          ? {
              block: asset.block_code,
              unit_number: asset.unit_code,
              location: `Level ${asset.level_code}${
                asset.location_note ? ` · ${asset.location_note}` : ""
              }`,
              description: buildInspectionFailureDescription(asset, inspection),
              asset_id: asset.id,
              source_inspection_id: inspection.id,
            }
          : null,
      },
      201
    );
  }
);

export const GET = withApiHandler(
  async (
    _req: NextRequest,
    context: { params: Promise<{ assetCode: string }> }
  ) => {
    await requireApiUser();
    const { assetCode: rawAssetCode } = await context.params;
    const assetCode = normalizeAssetLookupCode(rawAssetCode);
    const supabaseAdmin = createAdminClient();

    const { data: asset, error: assetError } = await supabaseAdmin
      .from("assets")
      .select("id")
      .eq("asset_code", assetCode)
      .single<{ id: string }>();

    if (assetError || !asset) {
      throw new ApiError(404, "Asset not found.");
    }

    const { data: inspections, error } = await supabaseAdmin
      .from("asset_inspections")
      .select("*")
      .eq("asset_id", asset.id)
      .order("inspected_at", { ascending: false })
      .returns<AssetInspectionRecord[]>();

    if (error) {
      throw new ApiError(500, "Failed to fetch inspections.", error);
    }

    return successResponse({ inspections: inspections ?? [] });
  }
);
