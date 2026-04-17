import { NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/server-auth";
import type { AssetRecord, AssetTypeConfig } from "@/lib/types/assets";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  buildAssetWithStatus,
  normalizeAssetLookupCode,
} from "@/utils/assets";
import { ApiError, successResponse, withApiHandler } from "@/utils/api";

const lookupSchema = z.object({
  raw_qr_code: z.string().trim().min(1),
});

export const POST = withApiHandler(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> }
  ) => {
    await requireApiUser();
    const payload = await req.json();
    const parsed = lookupSchema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiError(400, "raw_qr_code is required.");
  }

  const assetCode = normalizeAssetLookupCode(parsed.data.raw_qr_code);
  const supabaseAdmin = createAdminClient();

  const { data: asset, error } = await supabaseAdmin
    .from("assets")
    .select("*")
    .eq("asset_code", assetCode)
    .eq("is_active", true)
    .maybeSingle<AssetRecord>();

  if (error) {
    throw new ApiError(500, "Failed to lookup asset.", error);
  }

  if (!asset) {
    return successResponse({ asset: null, error: "Asset not found." });
  }

  const { data: assetTypeConfig, error: typeError } = await supabaseAdmin
    .from("asset_type_configs")
    .select("*")
    .eq("code", asset.asset_type_code)
    .maybeSingle<AssetTypeConfig>();

  if (typeError) {
    throw new ApiError(500, "Failed to load asset type config.", typeError);
  }

    return successResponse({
      asset: buildAssetWithStatus(asset, assetTypeConfig ?? null),
    });
  }
);
