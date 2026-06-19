import { NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAdmin, requireApiUser } from "@/lib/server-auth";
import type { AssetRecord, AssetTypeConfig } from "@/lib/types/assets";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  buildAssetWithStatus,
  generateAssetCode,
  normalizeAssetCodePart,
} from "@/utils/assets";
import { ApiError, successResponse, withApiHandler } from "@/utils/api";
import {
  getLevelUnitNumberPrefix,
  isRoomUnitNumberValidForLevel,
  normalizeRoomUnitNumber,
} from "@/utils/rooms";

const createAssetSchema = z.object({
  unit_code: z.string().trim().min(1),
  block_code: z.string().trim().min(1),
  level_code: z.string().trim().min(1),
  unit_number: z.string().trim().optional(),
  asset_type_code: z.string().trim().min(1),
  serial_number: z.string().trim().min(1),
  display_name: z.string().trim().optional(),
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
    const payload = await req.json();
    const parsed = createAssetSchema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid asset payload.", parsed.error.flatten());
  }

  const supabaseAdmin = createAdminClient();
  const body = parsed.data;
  const actorName = getActorName(profile?.username, user.email, user.id);

  const normalizedAsset = {
    unit_code: normalizeAssetCodePart(body.unit_code),
    block_code: normalizeAssetCodePart(body.block_code),
    level_code: normalizeAssetCodePart(body.level_code),
    unit_number: normalizeRoomUnitNumber(body.unit_number) || null,
    asset_type_code: normalizeAssetCodePart(body.asset_type_code),
    serial_number: normalizeAssetCodePart(body.serial_number),
    display_name: body.display_name?.trim() || null,
    location_note: body.location_note?.trim() || null,
    is_active: body.is_active ?? true,
  };

  if (
    normalizedAsset.unit_number &&
    (!isRoomUnitNumberValidForLevel(normalizedAsset.level_code, normalizedAsset.unit_number) ||
      normalizedAsset.unit_number === `#${getLevelUnitNumberPrefix(normalizedAsset.level_code)}-`)
  ) {
    throw new ApiError(
      400,
      `Unit number must start with ${getLevelUnitNumberPrefix(normalizedAsset.level_code)}-.`
    );
  }

  const assetCode = generateAssetCode(
    normalizedAsset.unit_code,
    normalizedAsset.block_code,
    normalizedAsset.level_code,
    normalizedAsset.asset_type_code,
    normalizedAsset.serial_number
  );

  const { data: assetTypeConfig, error: assetTypeError } = await supabaseAdmin
    .from("asset_type_configs")
    .select("*")
    .eq("code", normalizedAsset.asset_type_code)
    .single<AssetTypeConfig>();

  if (assetTypeError || !assetTypeConfig) {
    throw new ApiError(400, "Unknown asset type.");
  }

  const { data, error } = await supabaseAdmin
    .from("assets")
    .insert([
      {
        ...normalizedAsset,
        asset_code: assetCode,
        created_by: actorName,
        updated_by: actorName,
      },
    ])
    .select("*")
    .single<AssetRecord>();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(409, `Asset code ${assetCode} already exists.`);
    }

    throw new ApiError(500, "Failed to create asset.", error);
  }

    return successResponse(
      { asset: buildAssetWithStatus(data, assetTypeConfig) },
      201
    );
  }
);

export const GET = withApiHandler(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> }
  ) => {
    const { profile } = await requireApiUser();
    const { searchParams } = new URL(req.url);
    const assetType = searchParams.get("assetType");
    const unit = searchParams.get("unit");
    const block = searchParams.get("block");
    const level = searchParams.get("level");
    const freshness = searchParams.get("freshness");
    const serviceability = searchParams.get("serviceability");
    const search = searchParams.get("search");
    const includeInactive =
      searchParams.get("includeInactive") === "true" && profile?.role === "admin";
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.max(1, Number(searchParams.get("limit") || "50"));

  const supabaseAdmin = createAdminClient();
  let query = supabaseAdmin.from("assets").select("*").order("asset_code");

  if (!includeInactive) query = query.eq("is_active", true);
  if (assetType) query = query.eq("asset_type_code", normalizeAssetCodePart(assetType));
  if (unit) query = query.eq("unit_code", normalizeAssetCodePart(unit));
  if (block) query = query.eq("block_code", normalizeAssetCodePart(block));
  if (level) query = query.eq("level_code", normalizeAssetCodePart(level));
  if (serviceability) {
    query = query.eq("last_serviceability_status", serviceability);
  }
  if (search) {
    const safeSearch = search.trim();
    query = query.or(
      `asset_code.ilike.%${safeSearch}%,display_name.ilike.%${safeSearch}%,serial_number.ilike.%${safeSearch}%,unit_number.ilike.%${safeSearch}%,location_note.ilike.%${safeSearch}%`
    );
  }

  const [{ data: assets, error: assetsError }, { data: assetTypeConfigs, error: configsError }] =
    await Promise.all([
      query.returns<AssetRecord[]>(),
      supabaseAdmin
        .from("asset_type_configs")
        .select("*")
        .order("label")
        .returns<AssetTypeConfig[]>(),
    ]);

  if (assetsError) {
    throw new ApiError(500, "Failed to fetch assets.", assetsError);
  }

  if (configsError) {
    throw new ApiError(500, "Failed to fetch asset type configs.", configsError);
  }

  const configMap = new Map(
    (assetTypeConfigs ?? []).map((config) => [config.code, config])
  );

  let enrichedAssets = (assets ?? []).map((asset) =>
    buildAssetWithStatus(asset, configMap.get(asset.asset_type_code) ?? null)
  );

  if (freshness === "CURRENT" || freshness === "OUTDATED") {
    enrichedAssets = enrichedAssets.filter(
      (asset) => asset.freshness === freshness
    );
  }

  const total = enrichedAssets.length;
  const from = (page - 1) * limit;
  const pagedAssets = enrichedAssets.slice(from, from + limit);

    return successResponse({
      assets: pagedAssets,
      assetTypeConfigs: assetTypeConfigs ?? [],
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  }
);
