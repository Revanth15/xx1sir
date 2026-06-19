import { NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAdmin } from "@/lib/server-auth";
import type {
  AssetRecord,
  AssetTypeConfig,
  BulkCreateAssetsRequest,
} from "@/lib/types/assets";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  buildAssetWithStatus,
  generateAssetCode,
  generateBulkSerials,
  normalizeAssetCodePart,
} from "@/utils/assets";
import { ApiError, successResponse, withApiHandler } from "@/utils/api";
import {
  getLevelUnitNumberPrefix,
  isRoomUnitNumberValidForLevel,
  normalizeRoomUnitNumber,
} from "@/utils/rooms";

const bulkCreateSchema = z.object({
  unit_code: z.string().trim().min(1),
  block_code: z.string().trim().min(1),
  level_code: z.string().trim().min(1),
  unit_number: z.string().trim().optional(),
  asset_type_code: z.string().trim().min(1),
  serial_start: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(100),
  display_name_prefix: z.string().trim().optional(),
  location_note: z.string().trim().optional(),
  is_active: z.boolean().optional(),
});

function getActorName(profileName: string | undefined, email: string | undefined, userId: string) {
  return profileName || email || userId;
}

export const POST = withApiHandler(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> }
  ) => {
    const { user, profile } = await requireApiAdmin();
    const payload = (await req.json()) as BulkCreateAssetsRequest;
    const parsed = bulkCreateSchema.safeParse(payload);

    if (!parsed.success) {
      throw new ApiError(
        400,
        "Invalid bulk asset payload.",
        parsed.error.flatten()
      );
    }

    const body = parsed.data;
    const actorName = getActorName(profile?.username, user.email, user.id);
    const supabaseAdmin = createAdminClient();

    const normalizedBase = {
      unit_code: normalizeAssetCodePart(body.unit_code),
      block_code: normalizeAssetCodePart(body.block_code),
      level_code: normalizeAssetCodePart(body.level_code),
      unit_number: normalizeRoomUnitNumber(body.unit_number) || null,
      asset_type_code: normalizeAssetCodePart(body.asset_type_code),
      location_note: body.location_note?.trim() || null,
      is_active: body.is_active ?? true,
    };

    if (
      normalizedBase.unit_number &&
      (!isRoomUnitNumberValidForLevel(normalizedBase.level_code, normalizedBase.unit_number) ||
        normalizedBase.unit_number === `#${getLevelUnitNumberPrefix(normalizedBase.level_code)}-`)
    ) {
      throw new ApiError(
        400,
        `Unit number must start with ${getLevelUnitNumberPrefix(normalizedBase.level_code)}-.`
      );
    }

    const { data: assetTypeConfig, error: assetTypeError } = await supabaseAdmin
      .from("asset_type_configs")
      .select("*")
      .eq("code", normalizedBase.asset_type_code)
      .single<AssetTypeConfig>();

    if (assetTypeError || !assetTypeConfig) {
      throw new ApiError(400, "Unknown asset type.");
    }

    const serials = generateBulkSerials(body.serial_start, body.quantity);
    const recordsToInsert = serials.map((serial) => {
      const assetCode = generateAssetCode(
        normalizedBase.unit_code,
        normalizedBase.block_code,
        normalizedBase.level_code,
        normalizedBase.asset_type_code,
        serial
      );

      return {
        asset_code: assetCode,
        unit_code: normalizedBase.unit_code,
        block_code: normalizedBase.block_code,
        level_code: normalizedBase.level_code,
        unit_number: normalizedBase.unit_number,
        asset_type_code: normalizedBase.asset_type_code,
        serial_number: serial,
        display_name: body.display_name_prefix?.trim()
          ? `${body.display_name_prefix.trim()} ${serial}`
          : null,
        location_note: normalizedBase.location_note,
        is_active: normalizedBase.is_active,
        created_by: actorName,
        updated_by: actorName,
      };
    });

    const assetCodes = recordsToInsert.map((record) => record.asset_code);
    const { data: existingAssets, error: existingAssetsError } = await supabaseAdmin
      .from("assets")
      .select("asset_code")
      .in("asset_code", assetCodes);

    if (existingAssetsError) {
      throw new ApiError(500, "Failed to validate bulk asset codes.", existingAssetsError);
    }

    if ((existingAssets ?? []).length > 0) {
      throw new ApiError(
        409,
        "Some asset codes already exist.",
        (existingAssets ?? []).map((asset) => asset.asset_code)
      );
    }

    const { data, error } = await supabaseAdmin
      .from("assets")
      .insert(recordsToInsert)
      .select("*")
      .returns<AssetRecord[]>();

    if (error) {
      throw new ApiError(500, "Failed to create assets.", error);
    }

    return successResponse(
      {
        assets: (data ?? []).map((asset) =>
          buildAssetWithStatus(asset, assetTypeConfig)
        ),
      },
      201
    );
  }
);
