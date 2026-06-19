export const CLOSED_REPORT_STATUSES = new Set(["COMPLETED", "REJECTED", "MERGED"]);

export function normalizeRoomBlock(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^blk\s*/i, "").trim();
}

export function normalizeRoomUnitNumber(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  const withoutPrefix = trimmed.replace(/^#+/, "");
  return withoutPrefix ? `#${withoutPrefix}` : "";
}

export function getLevelUnitNumberPrefix(levelCode: string | null | undefined) {
  const numericLevel = Number.parseInt((levelCode ?? "").trim(), 10);
  if (!Number.isFinite(numericLevel) || numericLevel < 1) return "";

  return String(numericLevel).padStart(2, "0");
}

export function normalizeAssetUnitNumberForLevel(
  levelCode: string | null | undefined,
  value: string | null | undefined
) {
  const levelPrefix = getLevelUnitNumberPrefix(levelCode);
  const rawValue = (value ?? "").trim().replace(/^#+/, "").replace(/\s+/g, "");

  if (!rawValue) return "";
  if (!levelPrefix) return rawValue;

  const suffix = rawValue.includes("-")
    ? rawValue.split("-").slice(1).join("-")
    : rawValue.startsWith(levelPrefix)
      ? rawValue.slice(levelPrefix.length).replace(/^-+/, "")
      : rawValue;

  return suffix ? `${levelPrefix}-${suffix}` : `${levelPrefix}-`;
}

export function getAssetUnitNumberSuffix(
  levelCode: string | null | undefined,
  value: string | null | undefined
) {
  const rawValue = (value ?? "").trim().replace(/^#+/, "").replace(/\s+/g, "");
  if (!rawValue) return "";

  const levelPrefix = getLevelUnitNumberPrefix(levelCode);
  if (levelPrefix && rawValue.startsWith(`${levelPrefix}-`)) {
    return rawValue.slice(levelPrefix.length + 1);
  }

  if (rawValue.includes("-")) {
    return rawValue.split("-").slice(1).join("-");
  }

  return rawValue.startsWith(levelPrefix)
    ? rawValue.slice(levelPrefix.length).replace(/^-+/, "")
    : rawValue;
}

export function normalizeRoomUnitNumberForLevel(
  levelCode: string | null | undefined,
  value: string | null | undefined
) {
  const normalized = normalizeAssetUnitNumberForLevel(levelCode, value);
  return normalized ? normalizeRoomUnitNumber(normalized) : "";
}

export function isRoomUnitNumberValidForLevel(
  levelCode: string | null | undefined,
  value: string | null | undefined
) {
  const normalized = normalizeRoomUnitNumber(value);
  if (!normalized) return true;

  const levelPrefix = getLevelUnitNumberPrefix(levelCode);
  return !levelPrefix || normalized.replace(/^#/, "").startsWith(`${levelPrefix}-`);
}

export function deriveLevelFromUnitNumber(unitNumber: string | null | undefined) {
  const normalized = normalizeRoomUnitNumber(unitNumber);
  const numericPrefix = normalized.replace(/^#/, "").match(/^(\d+)/)?.[1];
  if (!numericPrefix) return "";

  const level = Number.parseInt(numericPrefix, 10);
  return level >= 1 && level <= 6 ? String(level) : "";
}

export function isActiveReportStatus(status: string | null | undefined) {
  return Boolean(status) && !CLOSED_REPORT_STATUSES.has(status as string);
}
