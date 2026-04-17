import type { AssetWithStatus } from "@/lib/types/assets";

const ASSET_INSPECTION_CACHE_PREFIX = "asset-inspection-context:";
const ASSET_INSPECTION_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedInspectionAsset = {
  cachedAt: number;
  asset: AssetWithStatus;
};

function getCacheKey(assetCode: string) {
  return `${ASSET_INSPECTION_CACHE_PREFIX}${assetCode}`;
}

export function readCachedInspectionAsset(assetCode: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(getCacheKey(assetCode));
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as CachedInspectionAsset;
    if (
      !parsed?.asset ||
      parsed.asset.asset_code !== assetCode ||
      Date.now() - parsed.cachedAt > ASSET_INSPECTION_CACHE_TTL_MS
    ) {
      window.sessionStorage.removeItem(getCacheKey(assetCode));
      return null;
    }

    return parsed.asset;
  } catch {
    window.sessionStorage.removeItem(getCacheKey(assetCode));
    return null;
  }
}

export function writeCachedInspectionAsset(asset: AssetWithStatus) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: CachedInspectionAsset = {
    cachedAt: Date.now(),
    asset,
  };

  window.sessionStorage.setItem(getCacheKey(asset.asset_code), JSON.stringify(payload));
}
