import { AssetTypeCadencePage } from "@/components/admin/asset-type-cadence-page";
import { requirePageAdmin } from "@/lib/server-auth";
import type { AssetTypeConfig } from "@/lib/types/assets";
import { createAdminClient } from "@/utils/supabase/admin";

export default async function AdminAssetTypesPage() {
  await requirePageAdmin();

  const supabaseAdmin = createAdminClient();
  const { data: assetTypeConfigs, error } = await supabaseAdmin
    .from("asset_type_configs")
    .select("*")
    .order("label")
    .returns<AssetTypeConfig[]>();

  if (error) {
    throw new Error("Failed to load asset type settings.");
  }

  return (
    <AssetTypeCadencePage initialAssetTypeConfigs={assetTypeConfigs ?? []} />
  );
}
