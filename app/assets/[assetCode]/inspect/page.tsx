import { AssetInspectionPage } from "@/components/assets/asset-inspection-page";

export default async function InspectAssetPage({
  params,
}: {
  params: Promise<{ assetCode: string }>;
}) {
  const { assetCode } = await params;
  return <AssetInspectionPage assetCode={decodeURIComponent(assetCode)} />;
}
