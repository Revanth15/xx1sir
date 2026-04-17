import { AssetDetailPage } from "@/components/assets/asset-detail-page";

export default async function AssetPage({
  params,
}: {
  params: Promise<{ assetCode: string }>;
}) {
  const { assetCode } = await params;
  return <AssetDetailPage assetCode={decodeURIComponent(assetCode)} />;
}
