import { NextRequest } from "next/server";

import { requireApiUser } from "@/lib/server-auth";
import type { AssetRecord, AssetTypeConfig } from "@/lib/types/assets";
import { createAdminClient } from "@/utils/supabase/admin";
import { buildAssetWithStatus, normalizeAssetLookupCode } from "@/utils/assets";
import { ApiError, successResponse, withApiHandler } from "@/utils/api";

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

    const { data: assetTypeConfig, error: typeError } = await supabaseAdmin
      .from("asset_type_configs")
      .select("*")
      .eq("code", asset.asset_type_code)
      .maybeSingle<AssetTypeConfig>();

    if (typeError) {
      throw new ApiError(500, "Failed to fetch asset type config.", typeError);
    }

    return successResponse({
      asset: buildAssetWithStatus(
        {
          ...asset,
          asset_type_config: assetTypeConfig ?? null,
        },
        assetTypeConfig ?? null
      ),
    });
  }
);
