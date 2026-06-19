"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Clock3,
  Factory,
  MapPinned,
  PackageCheck,
  Printer,
  QrCode,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { AssetStatusBadge } from "@/components/assets/asset-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BD_COMPANY_OPTIONS, SITE_LOCATION_CONFIG } from "@/lib/defaults";
import type { AssetTypeConfig, AssetWithStatus } from "@/lib/types/assets";
import { cn } from "@/lib/utils";
import { printAssetLabels } from "@/utils/asset-print";
import { useAuth } from "@/utils/AuthProvider";
import { formatDueDate } from "@/utils/assets";
import { notify } from "@/utils/toast";
import { Checkbox } from "../ui/checkbox";

const ALL = "ALL";

type AssetFilters = {
  company: string;
  assetType: string;
  unit: string;
  block: string;
  level: string;
  freshness: string;
  serviceability: string;
  search: string;
};

type FilterOption = {
  value: string;
  label: string;
};

type ActiveFilterChip = {
  key: keyof AssetFilters;
  label: string;
  value: string;
};

const DEFAULT_FILTERS: AssetFilters = {
  company: ALL,
  assetType: ALL,
  unit: ALL,
  block: ALL,
  level: ALL,
  freshness: ALL,
  serviceability: ALL,
  search: "",
};

const FRESHNESS_OPTIONS: FilterOption[] = [
  { value: ALL, label: "All freshness" },
  { value: "CURRENT", label: "Current" },
  { value: "OUTDATED", label: "Outdated" },
];

const SERVICEABILITY_OPTIONS: FilterOption[] = [
  { value: ALL, label: "All serviceability" },
  { value: "SERVICEABLE", label: "Serviceable" },
  { value: "UNSERVICEABLE", label: "Unserviceable" },
];

const COMPANY_BLOCKS: Record<string, string[]> = {
  ALPHA: ["265", "263"],
  BRAVO: ["262", "263"],
  CHARLIE: ["264", "263"],
  SUPPORT: ["261", "260"],
  MSC: [],
  HQ: ["235"],
};

function getCompanyBlocks(company: string) {
  return COMPANY_BLOCKS[company] ?? [];
}

function assetMatchesCompany(asset: AssetWithStatus, company: string) {
  return company === ALL || getCompanyBlocks(company).includes(asset.block_code);
}

function getDaysUntilDue(dueDate: string | null) {
  if (!dueDate) return null;
  const today = new Date();
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function DashboardMetric({
  label,
  value,
  caption,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  caption: string;
  icon: typeof PackageCheck;
  tone?: "default" | "green" | "yellow" | "red" | "blue";
}) {
  const toneClass = {
    default: "text-white/55",
    green: "text-emerald-300",
    yellow: "text-yellow-300",
    red: "text-red-300",
    blue: "text-blue-300",
  }[tone];

  return (
    <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-white/45">
          {label}
        </div>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", toneClass)} />
      </div>
      <div className="text-3xl font-bold leading-none tracking-tight text-white">
        {value}
      </div>
      <p className="mt-1 truncate text-xs text-white/50">{caption}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full min-w-0 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AssetsListPage() {
  const { profile } = useAuth();
  const [assets, setAssets] = useState<AssetWithStatus[]>([]);
  const [assetTypeConfigs, setAssetTypeConfigs] = useState<AssetTypeConfig[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<AssetFilters>(() => ({
    ...DEFAULT_FILTERS,
  }));

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.assetType !== ALL)
          params.set("assetType", filters.assetType);
        if (filters.unit !== ALL) params.set("unit", filters.unit);
        if (filters.block !== ALL) params.set("block", filters.block);
        if (filters.level !== ALL) params.set("level", filters.level);
        if (filters.freshness !== ALL)
          params.set("freshness", filters.freshness);
        if (filters.serviceability !== ALL) {
          params.set("serviceability", filters.serviceability);
        }
        if (filters.search.trim()) params.set("search", filters.search.trim());
        params.set("limit", "1000");

        const response = await fetch(`/api/assets?${params.toString()}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load assets");
        }

        if (!cancelled) {
          setAssets(result.data.assets ?? []);
          setAssetTypeConfigs(result.data.assetTypeConfigs ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          notify.error(
            error instanceof Error ? error.message : "Failed to load assets",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAssets();

    return () => {
      cancelled = true;
    };
  }, [filters]);

  const assetTypeLabelMap = useMemo(
    () =>
      new Map<string, string>(
        assetTypeConfigs.map((config) => [config.code, config.label]),
      ),
    [assetTypeConfigs],
  );

  const unitLabelMap = useMemo(
    () =>
      new Map<string, string>(
        SITE_LOCATION_CONFIG.units.map((unit) => [unit.code, unit.label]),
      ),
    [],
  );

  const blockLabelMap = useMemo(
    () =>
      new Map<string, string>(
        SITE_LOCATION_CONFIG.blocks.map((block) => [
          block.code,
          `Blk ${block.code}`,
        ]),
      ),
    [],
  );

  const levelLabelMap = useMemo(
    () =>
      new Map<string, string>(
        SITE_LOCATION_CONFIG.levels.map((level) => [level.code, level.label]),
      ),
    [],
  );

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedAssetIds.includes(asset.id)),
    [assets, selectedAssetIds],
  );

  const visibleAssets = useMemo(
    () => assets.filter((asset) => assetMatchesCompany(asset, filters.company)),
    [assets, filters.company],
  );

  const assetTypeOptions = useMemo<FilterOption[]>(
    () => [
      { value: ALL, label: "All types" },
      ...assetTypeConfigs.map((config) => ({
        value: config.code,
        label: config.label,
      })),
    ],
    [assetTypeConfigs],
  );

  const unitOptions = useMemo<FilterOption[]>(
    () => [
      { value: ALL, label: "All units" },
      ...SITE_LOCATION_CONFIG.units.map((unit) => ({
        value: unit.code,
        label: unit.label,
      })),
    ],
    [],
  );

  const blockOptions = useMemo<FilterOption[]>(
    () => [
      { value: ALL, label: "All blocks" },
      ...SITE_LOCATION_CONFIG.blocks.map((block) => ({
        value: block.code,
        label: `Blk ${block.code}`,
      })),
    ],
    [],
  );

  const levelOptions = useMemo<FilterOption[]>(
    () => [
      { value: ALL, label: "All levels" },
      ...SITE_LOCATION_CONFIG.levels.map((level) => ({
        value: level.code,
        label: level.label,
      })),
    ],
    [],
  );

  const filterControls = useMemo(
    () => [
      {
        key: "assetType" as const,
        label: "Type",
        value: filters.assetType,
        options: assetTypeOptions,
      },
      {
        key: "freshness" as const,
        label: "Freshness",
        value: filters.freshness,
        options: FRESHNESS_OPTIONS,
      },
      {
        key: "unit" as const,
        label: "Unit",
        value: filters.unit,
        options: unitOptions,
      },
      {
        key: "block" as const,
        label: "Block",
        value: filters.block,
        options: blockOptions,
      },
      {
        key: "level" as const,
        label: "Level",
        value: filters.level,
        options: levelOptions,
      },
      {
        key: "serviceability" as const,
        label: "Status",
        value: filters.serviceability,
        options: SERVICEABILITY_OPTIONS,
      },
    ],
    [
      assetTypeOptions,
      blockOptions,
      filters.assetType,
      filters.block,
      filters.freshness,
      filters.level,
      filters.serviceability,
      filters.unit,
      levelOptions,
      unitOptions,
    ],
  );

  const allVisibleSelected =
    visibleAssets.length > 0 &&
    visibleAssets.every((asset) => selectedAssetIds.includes(asset.id));

  const setFilter = <K extends keyof AssetFilters>(
    key: K,
    value: AssetFilters[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "company" ? { block: ALL } : {}),
    }));
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedAssetIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleAssets.some((asset) => asset.id === id))
        : visibleAssets.map((asset) => asset.id),
    );
  };

  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    const search = filters.search.trim();

    if (search) {
      chips.push({ key: "search", label: "Search", value: search });
    }
    if (filters.company !== ALL) {
      chips.push({
        key: "company",
        label: "Company",
        value: filters.company,
      });
    }
    if (filters.assetType !== ALL) {
      chips.push({
        key: "assetType",
        label: "Type",
        value: assetTypeLabelMap.get(filters.assetType) ?? filters.assetType,
      });
    }
    if (filters.freshness !== ALL) {
      chips.push({
        key: "freshness",
        label: "Freshness",
        value:
          FRESHNESS_OPTIONS.find((option) => option.value === filters.freshness)
            ?.label ?? filters.freshness,
      });
    }
    if (filters.unit !== ALL) {
      chips.push({
        key: "unit",
        label: "Unit",
        value: unitLabelMap.get(filters.unit) ?? filters.unit,
      });
    }
    if (filters.block !== ALL) {
      chips.push({
        key: "block",
        label: "Block",
        value: blockLabelMap.get(filters.block) ?? filters.block,
      });
    }
    if (filters.level !== ALL) {
      chips.push({
        key: "level",
        label: "Level",
        value: levelLabelMap.get(filters.level) ?? filters.level,
      });
    }
    if (filters.serviceability !== ALL) {
      chips.push({
        key: "serviceability",
        label: "Status",
        value:
          SERVICEABILITY_OPTIONS.find(
            (option) => option.value === filters.serviceability,
          )?.label ?? filters.serviceability,
      });
    }

    return chips;
  }, [
    assetTypeLabelMap,
    blockLabelMap,
    filters.assetType,
    filters.block,
    filters.company,
    filters.freshness,
    filters.level,
    filters.search,
    filters.serviceability,
    filters.unit,
    levelLabelMap,
    unitLabelMap,
  ]);

  const hasActiveFilters = activeFilterChips.length > 0;

  const resetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

  const clearFilter = (key: keyof AssetFilters) => {
    if (key === "search") {
      setFilter("search", "");
      return;
    }

    setFilter(key, ALL);
  };

  const handlePrintSelected = async () => {
    try {
      await printAssetLabels(
        selectedAssets.map((asset) => ({
          assetCode: asset.asset_code,
          subtitle:
            asset.display_name ||
            assetTypeLabelMap.get(asset.asset_type_code) ||
            null,
        })),
      );
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : "Failed to print selected labels",
      );
    }
  };

  const totalVisible = visibleAssets.length;
  const unserviceableCount = visibleAssets.filter(
    (asset) => asset.displayed_status === "UNSERVICEABLE",
  ).length;
  const outdatedCount = visibleAssets.filter(
    (asset) => asset.freshness === "OUTDATED",
  ).length;
  const neverInspectedCount = visibleAssets.filter(
    (asset) => !asset.last_inspected_at,
  ).length;
  const dueSoonCount = visibleAssets.filter((asset) => {
    const daysUntilDue = getDaysUntilDue(asset.due_date);
    return daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7;
  }).length;
  const currentCount = visibleAssets.filter(
    (asset) => asset.freshness === "CURRENT",
  ).length;
  const currentRate =
    totalVisible > 0 ? Math.round((currentCount / totalVisible) * 100) : 0;

  const companySummaries = BD_COMPANY_OPTIONS.map((company) => {
    const companyAssets = assets.filter((asset) =>
      assetMatchesCompany(asset, company),
    );
    const companyOutdated = companyAssets.filter(
      (asset) => asset.freshness === "OUTDATED",
    ).length;
    const companyUnserviceable = companyAssets.filter(
      (asset) => asset.displayed_status === "UNSERVICEABLE",
    ).length;
    const companyCurrentRate =
      companyAssets.length > 0
        ? Math.round(
            ((companyAssets.length - companyOutdated) / companyAssets.length) *
              100,
          )
        : 0;

    return {
      company,
      total: companyAssets.length,
      outdated: companyOutdated,
      unserviceable: companyUnserviceable,
      currentRate: companyCurrentRate,
    };
  });

  const laggingCompany = companySummaries
    .filter((company) => company.total > 0)
    .sort((a, b) => b.outdated - a.outdated)[0];

  const scopedBlocks =
    filters.company === ALL
      ? SITE_LOCATION_CONFIG.blocks
      : SITE_LOCATION_CONFIG.blocks.filter((block) =>
          getCompanyBlocks(filters.company).includes(block.code),
        );

  const selectedScopeLabel =
    filters.company === ALL ? "All companies" : filters.company;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] w-full bg-[#050607] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)] bg-[length:22px_22px] text-white">
      <div className="container mx-auto space-y-4 px-4 py-4 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Asset Inventory</h1>
            <p className="mt-1 text-sm text-white/55">
              {loading
                ? "Refreshing assets..."
                : `${visibleAssets.length} visible of ${assets.length} loaded assets`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white">
              <Link href="/assets/scan">
                <QrCode className="size-4" />
                Scan
              </Link>
            </Button>
            {profile?.role === "admin" ? (
              <>
                <Button asChild>
                  <Link href="/assets/new">Create Asset</Link>
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-white/10 bg-black/35 shadow-2xl shadow-black/20 backdrop-blur-sm">
          <div className="px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                  <span>Asset health</span>
                  <span className="h-1 w-1 rounded-full bg-white/30" />
                  <span>{filters.block === ALL ? "All blocks" : `Blk ${filters.block}`}</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {selectedScopeLabel}
                </h2>
              </div>
              <div className="text-sm text-white/50">
                {currentRate}% checks current
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setFilter("company", ALL)}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition",
                  filters.company === ALL
                    ? "border-white/30 bg-white/15 text-white"
                    : "border-white/10 bg-white/[0.035] text-white/60 hover:text-white",
                )}
              >
                <Building2 className="h-4 w-4" />
                All
              </button>
              {companySummaries.map((summary) => (
                <button
                  key={summary.company}
                  type="button"
                  onClick={() => setFilter("company", summary.company)}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition",
                    filters.company === summary.company
                      ? "border-white/30 bg-white/15 text-white"
                      : "border-white/10 bg-white/[0.035] text-white/60 hover:text-white",
                  )}
                >
                  <Factory className="h-4 w-4" />
                  {summary.company}
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                    {summary.outdated}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setFilter("block", ALL)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium transition",
                  filters.block === ALL
                    ? "border-white/20 bg-white/[0.12] text-white"
                    : "border-white/10 bg-white/[0.025] text-white/55 hover:text-white",
                )}
              >
                <MapPinned className="h-3.5 w-3.5" />
                All blocks
              </button>
              {scopedBlocks.map((block) => {
                const blockCount = assets.filter(
                  (asset) =>
                    asset.block_code === block.code &&
                    assetMatchesCompany(asset, filters.company),
                ).length;

                return (
                  <button
                    key={block.code}
                    type="button"
                    onClick={() => setFilter("block", block.code)}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium transition",
                      filters.block === block.code
                        ? "border-amber-300/40 bg-amber-400/15 text-amber-100"
                        : "border-white/10 bg-white/[0.025] text-white/55 hover:text-white",
                    )}
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Blk {block.code}
                    <span className="text-white/45">{blockCount}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <DashboardMetric
                label="Assets tracked"
                value={totalVisible}
                caption="In the selected scope"
                icon={PackageCheck}
                tone="blue"
              />
              <DashboardMetric
                label="Unserviceable"
                value={unserviceableCount}
                caption="Needs repair or follow-up"
                icon={ShieldAlert}
                tone="red"
              />
              <DashboardMetric
                label="Checks overdue"
                value={outdatedCount}
                caption={`${neverInspectedCount} never inspected`}
                icon={AlertTriangle}
                tone="yellow"
              />
              <DashboardMetric
                label="Due this week"
                value={dueSoonCount}
                caption="Scheduled checks approaching"
                icon={Clock3}
                tone="green"
              />
            </div>

            <div className="mt-3 rounded-xl bg-black/35">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                    Company check discipline
                  </div>
                  <div className="mt-1 text-sm text-white/55">
                    Sorted by scheduled checks that are no longer current
                  </div>
                </div>
                {laggingCompany ? (
                  <div className="text-sm text-yellow-200">
                    Highest backlog: {laggingCompany.company} ({laggingCompany.outdated})
                  </div>
                ) : null}
              </div>
              <div className="grid gap-2 lg:grid-cols-3">
                {companySummaries.map((summary) => (
                  <button
                    key={summary.company}
                    type="button"
                    onClick={() => setFilter("company", summary.company)}
                    className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-left transition hover:bg-white/[0.07]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{summary.company}</span>
                      <span className="text-sm text-white/50">
                        {summary.currentRate}% current
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${summary.currentRate}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-white/50">
                      <span>{summary.total} assets</span>
                      <span>{summary.outdated} overdue</span>
                      <span>{summary.unserviceable} unserviceable</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/35 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold">Asset list</p>
              <p className="text-xs text-white/45">
                {visibleAssets.length} matching asset{visibleAssets.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={filtersOpen ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFiltersOpen((current) => !current)}
                aria-expanded={filtersOpen}
                aria-controls="asset-filters-panel"
                className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
              >
                <SlidersHorizontal className="size-3.5" />
                {hasActiveFilters
                  ? `Filters (${activeFilterChips.length})`
                  : "Filters"}
              </Button>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="shrink-0 text-white/70 hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="size-3.5" />
                  Clear all
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 ml-2 size-4 -translate-y-1/2 text-white/40" />
              <Input
                id="asset-search"
                placeholder="Asset code, serial, name, location"
                value={filters.search}
                onChange={(event) => setFilter("search", event.target.value)}
                className="h-9 border-white/10 bg-white/[0.04] pl-9 text-sm text-white placeholder:text-white/35"
              />
            </div>

            {filtersOpen ? (
              <div id="asset-filters-panel">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {filterControls.map((filterControl) => (
                    <FilterSelect
                      key={filterControl.key}
                      label={filterControl.label}
                      value={filterControl.value}
                      onChange={(value) => setFilter(filterControl.key, value)}
                      options={filterControl.options}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {hasActiveFilters ? (
              <div className="flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <Badge
                    key={`${chip.key}-${chip.value}`}
                    variant="outline"
                    className="h-auto gap-1.5 rounded-full border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white"
                  >
                    <span className="text-white/45">{chip.label}:</span>
                    <span>{chip.value}</span>
                    <button
                      type="button"
                      onClick={() => clearFilter(chip.key)}
                      aria-label={`Clear ${chip.label.toLowerCase()} filter`}
                      className="rounded-full p-0.5 text-white/50 transition hover:bg-white/10 hover:text-white"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-4 overflow-x-auto rounded-md border border-white/10">
            {loading ? (
              <div className="p-8 text-center text-white/50">Loading assets...</div>
            ) : visibleAssets.length === 0 ? (
              <div className="p-8 text-center text-white/50">No matching assets.</div>
            ) : (
              <Table className="min-w-[920px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {profile?.role === "admin" ? (
                      <TableHead className="w-8">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleSelectAllVisible}
                          aria-label="Select all visible assets"
                        />
                      </TableHead>
                    ) : null}
                    <TableHead>Asset Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Last Inspection</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleAssets.map((asset) => (
                    <TableRow key={asset.id} className="hover:bg-white/[0.04]">
                      {profile?.role === "admin" ? (
                        <TableCell>
                          <Checkbox
                            checked={selectedAssetIds.includes(asset.id)}
                            onCheckedChange={() => toggleAssetSelection(asset.id)}
                            aria-label={`Select ${asset.asset_code}`}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell className="font-mono">
                        <Link
                          href={`/assets/${encodeURIComponent(asset.asset_code)}`}
                          className="font-semibold text-white hover:underline"
                        >
                          {asset.asset_code}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {assetTypeLabelMap.get(asset.asset_type_code) ??
                          asset.asset_type_code}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="space-y-1">
                          <p>
                            {`Unit ${asset.unit_code} · Blk ${asset.block_code} · Level ${asset.level_code}${
                              asset.unit_number ? ` · ${asset.unit_number}` : ""
                            }`}
                          </p>
                          {asset.display_name ? (
                            <p className="text-xs text-white/45">
                              {asset.display_name}
                            </p>
                          ) : null}
                          {asset.location_note ? (
                            <p className="text-xs text-white/45">
                              {asset.location_note}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {asset.last_inspected_at
                          ? new Date(asset.last_inspected_at).toLocaleDateString(
                              "en-SG",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                timeZone: "Asia/Singapore",
                              },
                            )
                          : "Never"}
                      </TableCell>
                      <TableCell>{formatDueDate(asset.due_date)}</TableCell>
                      <TableCell>
                        <AssetStatusBadge status={asset.displayed_status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        {profile?.role === "admin" && visibleAssets.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-white/55">
              {selectedAssets.length} of {visibleAssets.length} visible assets selected for bulk print.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={toggleSelectAllVisible}
                className="text-white/70 hover:bg-white/[0.08] hover:text-white"
              >
                {allVisibleSelected
                  ? "Clear Visible Selection"
                  : "Select All Visible"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={selectedAssets.length === 0}
                onClick={handlePrintSelected}
                className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
              >
                <Printer className="size-4" />
                Print Selected Labels
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
