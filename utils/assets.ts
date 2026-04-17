import type {
  AssetChecklistField,
  AssetChecklistSchema,
  AssetDisplayedStatus,
  AssetInspectionRecord,
  AssetRecord,
  AssetServiceabilityStatus,
  AssetTypeConfig,
  AssetWithRelations,
  AssetWithStatus,
} from "@/lib/types/assets";

export const SINGAPORE_TIME_ZONE = "Asia/Singapore";
const ASSET_TYPE_QR_TOKEN_MAP: Record<string, string> = {
  WATERCOOLER: "WC",
};

const SINGAPORE_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: SINGAPORE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function normalizeAssetCodePart(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function generateAssetCode(
  unitCode: string,
  blockCode: string,
  levelCode: string,
  assetTypeCode: string,
  serialNumber: string
) {
  return [
    unitCode,
    blockCode,
    levelCode,
    ASSET_TYPE_QR_TOKEN_MAP[normalizeAssetCodePart(assetTypeCode)] ?? assetTypeCode,
    serialNumber,
  ]
    .map(normalizeAssetCodePart)
    .join("-");
}

export function normalizeAssetLookupCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function parseAssetCode(assetCode: string) {
  const parts = normalizeAssetLookupCode(assetCode).split("-");
  if (parts.length !== 5) {
    return null;
  }

  const [unit, block, level, object, serial] = parts;
  return { unit, block, level, object, serial };
}

export function getSingaporeDayKey(value: string | number | Date) {
  return SINGAPORE_DAY_FORMATTER.format(new Date(value));
}

export function getSingaporeDayStamp(value: string | number | Date) {
  const [year, month, day] = getSingaporeDayKey(value).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function toDayKeyFromStamp(stamp: number) {
  return new Date(stamp).toISOString().slice(0, 10);
}

export function calculateDueDate(
  inspectedAt: Date | string | null | undefined,
  frequencyDays: number | null | undefined
) {
  if (!inspectedAt || !frequencyDays || frequencyDays < 1) {
    return null;
  }

  const inspectedDayStamp = getSingaporeDayStamp(inspectedAt);
  const dueStamp =
    inspectedDayStamp + (frequencyDays - 1) * 24 * 60 * 60 * 1000;

  return toDayKeyFromStamp(dueStamp);
}

export function isInspectionCurrent(
  inspectedAt: Date | string | null | undefined,
  frequencyDays: number | null | undefined,
  now: Date | string | number = new Date()
) {
  const dueDate = calculateDueDate(inspectedAt, frequencyDays);
  if (!dueDate) {
    return false;
  }

  return getSingaporeDayStamp(now) <= getSingaporeDayStamp(dueDate);
}

export function isAssetOverdue(
  lastInspectionAt: Date | string | null | undefined,
  frequencyDays: number | null | undefined,
  now: Date | string | number = new Date()
) {
  return !isInspectionCurrent(lastInspectionAt, frequencyDays, now);
}

export function calculateDisplayedStatus(
  asset: Pick<AssetRecord, "last_inspected_at" | "last_serviceability_status">,
  frequencyDays: number | null | undefined,
  now: Date | string | number = new Date()
): AssetDisplayedStatus {
  if (isAssetOverdue(asset.last_inspected_at, frequencyDays, now)) {
    return "OUTDATED";
  }

  return asset.last_serviceability_status ?? "OUTDATED";
}

export function formatDueDate(dueDate: Date | string | null | undefined) {
  if (!dueDate) {
    return "—";
  }

  return new Date(dueDate).toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: SINGAPORE_TIME_ZONE,
  });
}

export function summarizeCheckResults(checkResults: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(checkResults).map(([key, value]) => {
      if (typeof value === "boolean") {
        return [key, value ? "PASS" : "FAIL"];
      }

      return [key, value];
    })
  );
}

export function validateChecklistFieldValue(
  fieldKey: string,
  fieldSchema: AssetChecklistField,
  value: unknown
) {
  if (fieldSchema.required && (value === undefined || value === null || value === "")) {
    return `${fieldKey} is required.`;
  }

  if (value === undefined || value === null) {
    return null;
  }

  if (fieldSchema.type === "boolean" && typeof value !== "boolean") {
    return `${fieldKey} must be a boolean.`;
  }

  if (fieldSchema.type === "text" && typeof value !== "string") {
    return `${fieldKey} must be text.`;
  }

  if (fieldSchema.type === "number" && typeof value !== "number") {
    return `${fieldKey} must be a number.`;
  }

  return null;
}

export function validateChecklistSchema(
  schema: AssetChecklistSchema | null | undefined,
  checkResults: Record<string, unknown>
) {
  if (!schema) {
    return [];
  }

  return Object.entries(schema)
    .map(([fieldKey, fieldSchema]) =>
      validateChecklistFieldValue(fieldKey, fieldSchema, checkResults[fieldKey])
    )
    .filter((issue): issue is string => Boolean(issue));
}

export function buildAssetWithStatus(
  asset: AssetWithRelations,
  typeConfig?: AssetTypeConfig | null
): AssetWithStatus {
  const effectiveTypeConfig =
    typeConfig ?? asset.asset_type_config ?? asset.asset_type_configs ?? null;
  const inspectionFrequencyDays =
    effectiveTypeConfig?.inspection_frequency_days ?? null;

  return {
    ...asset,
    asset_type_config: effectiveTypeConfig,
    due_date: calculateDueDate(asset.last_inspected_at, inspectionFrequencyDays),
    freshness: isAssetOverdue(asset.last_inspected_at, inspectionFrequencyDays)
      ? "OUTDATED"
      : "CURRENT",
    displayed_status: calculateDisplayedStatus(asset, inspectionFrequencyDays),
  };
}

export function getFailedChecksSummary(checkResults: Record<string, unknown>) {
  return Object.entries(checkResults)
    .filter(([, value]) => value === false || value === "FAIL")
    .map(([key]) => key.replace(/_/g, " "));
}

export function buildInspectionFailureDescription(
  asset: Pick<AssetRecord, "asset_code" | "asset_type_code">,
  inspection: Pick<
    AssetInspectionRecord,
    "serviceability_status" | "check_results_json" | "core_notes"
  >
) {
  const failedChecks = getFailedChecksSummary(inspection.check_results_json ?? {});

  const parts = [
    `Asset ${asset.asset_code}`,
    `type ${asset.asset_type_code}`,
    `status ${inspection.serviceability_status}.`,
  ];

  if (failedChecks.length > 0) {
    parts.push(`Failed checks: ${failedChecks.join(", ")}.`);
  }

  if (inspection.core_notes) {
    parts.push(`Notes: ${inspection.core_notes}`);
  }

  return parts.join(" ");
}

export function isServiceabilityStatus(
  value: string
): value is AssetServiceabilityStatus {
  return value === "SERVICEABLE" || value === "UNSERVICEABLE";
}

export function generateBulkSerials(serialStart: string, quantity: number) {
  const normalizedStart = normalizeAssetCodePart(serialStart);

  if (!/^\d+$/.test(normalizedStart)) {
    throw new Error("Bulk create currently supports numeric serial starts only.");
  }

  const width = normalizedStart.length;
  const startNumber = Number(normalizedStart);

  return Array.from({ length: quantity }, (_, index) =>
    String(startNumber + index).padStart(width, "0")
  );
}
