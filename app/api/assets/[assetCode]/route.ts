import { NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAdmin, requireApiUser } from "@/lib/server-auth";
import type {
  AssetInspectionRecord,
  AssetLinkedReportRecord,
  AssetRecord,
  AssetTypeConfig,
} from "@/lib/types/assets";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  buildAssetWithStatus,
  generateAssetCode,
  normalizeAssetCodePart,
  normalizeAssetLookupCode,
} from "@/utils/assets";
import { ApiError, successResponse, withApiHandler } from "@/utils/api";
import {
  getLevelUnitNumberPrefix,
  isRoomUnitNumberValidForLevel,
  normalizeRoomUnitNumber,
} from "@/utils/rooms";

const updateAssetSchema = z.object({
  unit_code: z.string().trim().min(1).optional(),
  block_code: z.string().trim().min(1).optional(),
  level_code: z.string().trim().min(1).optional(),
  unit_number: z.string().trim().nullable().optional(),
  asset_type_code: z.string().trim().min(1).optional(),
  serial_number: z.string().trim().min(1).optional(),
  display_name: z.string().trim().nullable().optional(),
  location_note: z.string().trim().nullable().optional(),
  is_active: z.boolean().optional(),
});

function getActorName(profileName: string | undefined, email: string | undefined, userId: string) {
  return profileName || email || userId;
}

export const GET = withApiHandler(
  async (
    _req: NextRequest,
    context: { params: Promise<{ assetCode: string }> }
  ) => {
    const { profile } = await requireApiUser();
    const { assetCode: rawAssetCode } = await context.params;
    const assetCode = normalizeAssetLookupCode(rawAssetCode);
    const supabaseAdmin = createAdminClient();

    const { data: asset, error: assetError } = await supabaseAdmin
      .from("assets")
      .select("*")
      .eq("asset_code", assetCode)
      .maybeSingle<AssetRecord>();

    if (assetError) {
      throw new ApiError(500, "Failed to fetch asset.", assetError);
    }

    if (!asset || (!asset.is_active && profile?.role !== "admin")) {
      throw new ApiError(404, "Asset not found.");
    }

    const [
      { data: assetTypeConfig, error: typeError },
      { data: inspections, error: inspectionsError },
      { data: linkedReports, error: linkedReportsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("asset_type_configs")
        .select("*")
        .eq("code", asset.asset_type_code)
        .maybeSingle<AssetTypeConfig>(),
      supabaseAdmin
        .from("asset_inspections")
        .select("*")
        .eq("asset_id", asset.id)
        .order("inspected_at", { ascending: false })
        .returns<AssetInspectionRecord[]>(),
      supabaseAdmin
        .from("barrack_damage")
        .select(
          "id, case_reference, block, unit_number, location, type, description, status, date_reported, asset_id, source_inspection_id"
        )
        .eq("asset_id", asset.id)
        .order("date_reported", { ascending: false })
        .returns<AssetLinkedReportRecord[]>(),
    ]);

    if (typeError) {
      throw new ApiError(500, "Failed to fetch asset type config.", typeError);
    }

    if (inspectionsError) {
      throw new ApiError(500, "Failed to fetch inspections.", inspectionsError);
    }

    if (linkedReportsError) {
      throw new ApiError(500, "Failed to fetch linked reports.", linkedReportsError);
    }

    return successResponse({
      asset: buildAssetWithStatus(
        {
          ...asset,
          asset_type_config: assetTypeConfig ?? null,
          asset_inspections: inspections ?? [],
          linked_reports: linkedReports ?? [],
        },
        assetTypeConfig ?? null
      ),
    });
  }
);

export const PATCH = withApiHandler(
  async (
    req: NextRequest,
    context: { params: Promise<{ assetCode: string }> }
  ) => {
    const { user, profile } = await requireApiAdmin();
    const payload = await req.json();
    const parsed = updateAssetSchema.safeParse(payload);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid asset update payload.", parsed.error.flatten());
    }

    const { assetCode: rawAssetCode } = await context.params;
    const assetCode = normalizeAssetLookupCode(rawAssetCode);
    const supabaseAdmin = createAdminClient();

    const { data: existingAsset, error: existingError } = await supabaseAdmin
      .from("assets")
      .select("*")
      .eq("asset_code", assetCode)
      .single<AssetRecord>();

    if (existingError || !existingAsset) {
      throw new ApiError(404, "Asset not found.");
    }

    const nextValues = {
      unit_code: normalizeAssetCodePart(
        parsed.data.unit_code ?? existingAsset.unit_code
      ),
      block_code: normalizeAssetCodePart(
        parsed.data.block_code ?? existingAsset.block_code
      ),
      level_code: normalizeAssetCodePart(
        parsed.data.level_code ?? existingAsset.level_code
      ),
      unit_number:
        parsed.data.unit_number === undefined
          ? existingAsset.unit_number
          : normalizeRoomUnitNumber(parsed.data.unit_number) || null,
      asset_type_code: normalizeAssetCodePart(
        parsed.data.asset_type_code ?? existingAsset.asset_type_code
      ),
      serial_number: normalizeAssetCodePart(
        parsed.data.serial_number ?? existingAsset.serial_number
      ),
      display_name:
        parsed.data.display_name === undefined
          ? existingAsset.display_name
          : parsed.data.display_name || null,
      location_note:
        parsed.data.location_note === undefined
          ? existingAsset.location_note
          : parsed.data.location_note || null,
      is_active: parsed.data.is_active ?? existingAsset.is_active,
    };

    if (
      nextValues.unit_number &&
      (!isRoomUnitNumberValidForLevel(nextValues.level_code, nextValues.unit_number) ||
        nextValues.unit_number === `#${getLevelUnitNumberPrefix(nextValues.level_code)}-`)
    ) {
      throw new ApiError(
        400,
        `Unit number must start with ${getLevelUnitNumberPrefix(nextValues.level_code)}-.`
      );
    }

    const nextAssetCode = generateAssetCode(
      nextValues.unit_code,
      nextValues.block_code,
      nextValues.level_code,
      nextValues.asset_type_code,
      nextValues.serial_number
    );

    const { data: assetTypeConfig, error: assetTypeError } = await supabaseAdmin
      .from("asset_type_configs")
      .select("*")
      .eq("code", nextValues.asset_type_code)
      .single<AssetTypeConfig>();

    if (assetTypeError || !assetTypeConfig) {
      throw new ApiError(400, "Unknown asset type.");
    }

    const actorName = getActorName(profile?.username, user.email, user.id);
    const { data: updatedAsset, error: updateError } = await supabaseAdmin
      .from("assets")
      .update({
        ...nextValues,
        asset_code: nextAssetCode,
        updated_by: actorName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingAsset.id)
      .select("*")
      .single<AssetRecord>();

    if (updateError) {
      if (updateError.code === "23505") {
        throw new ApiError(409, `Asset code ${nextAssetCode} already exists.`);
      }

      throw new ApiError(500, "Failed to update asset.", updateError);
    }

    return successResponse({
      asset: buildAssetWithStatus(updatedAsset, assetTypeConfig),
      requires_qr_reprint: nextAssetCode !== existingAsset.asset_code,
    });
  }
);
