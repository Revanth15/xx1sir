"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { AssetStatusBadge } from "@/components/assets/asset-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { SITE_LOCATION_CONFIG } from "@/lib/defaults";
import type { AssetTypeConfig, AssetWithStatus } from "@/lib/types/assets";
import { cn } from "@/lib/utils";
import { printAssetLabels } from "@/utils/asset-print";
import { useAuth } from "@/utils/AuthProvider";
import { formatDueDate } from "@/utils/assets";
import { notify } from "@/utils/toast";
import { Checkbox } from "../ui/checkbox";

const ALL = "ALL";

type AssetFilters = {
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
        params.set("limit", "200");

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
    assets.length > 0 &&
    assets.every((asset) => selectedAssetIds.includes(asset.id));

  const setFilter = <K extends keyof AssetFilters>(
    key: K,
    value: AssetFilters[K],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
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
        ? current.filter((id) => !assets.some((asset) => asset.id === id))
        : assets.map((asset) => asset.id),
    );
  };

  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    const search = filters.search.trim();

    if (search) {
      chips.push({ key: "search", label: "Search", value: search });
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

  return (
    <div className="container mx-auto space-y-4 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-sm text-muted-foreground">
            Track current inspection freshness and serviceability by QR-coded
            asset.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/assets/scan">Scan Asset</Link>
          </Button>
          {profile?.role === "admin" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={selectedAssets.length === 0}
                onClick={handlePrintSelected}
              >
                {selectedAssets.length > 0
                  ? `Print Selected (${selectedAssets.length})`
                  : "Print Selected"}
              </Button>
              <Button asChild>
                <Link href="/assets/new">Create Asset</Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Card className="border-border/80">
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Filters</p>
              <p className="text-xs text-muted-foreground">
                {loading
                  ? "Refreshing assets..."
                  : `${assets.length} matching asset${assets.length === 1 ? "" : "s"}`}
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
                  className="shrink-0"
                >
                  <X className="size-3.5" />
                  Clear all
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 size-4 ml-2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="asset-search"
                placeholder="Asset code, serial, name, location"
                value={filters.search}
                onChange={(event) => setFilter("search", event.target.value)}
                className="h-9 pl-9 text-sm"
              />
            </div>
          </div>

          {filtersOpen ? (
            <div
              id="asset-filters-panel"
              className="rounded-xl"
            >
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
                  className="h-auto gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-foreground"
                >
                  <span className="text-muted-foreground">{chip.label}:</span>
                  <span>{chip.value}</span>
                  <button
                    type="button"
                    onClick={() => clearFilter(chip.key)}
                    aria-label={`Clear ${chip.label.toLowerCase()} filter`}
                    className="rounded-full p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading assets...
            </div>
          ) : assets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No matching assets.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    {profile?.role === "admin" ? (
                      <TableCell>
                        <Checkbox
                          checked={selectedAssetIds.includes(asset.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              toggleAssetSelection(asset.id)
                            } else {
                              toggleAssetSelection(asset.id)
                            }
                          }}
                          aria-label={`Select ${asset.asset_code}`}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className="font-mono">
                      <Link
                        href={`/assets/${encodeURIComponent(asset.asset_code)}`}
                        className="font-semibold hover:underline"
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
                        <p>{`Unit ${asset.unit_code} · Blk ${asset.block_code} · Level ${asset.level_code}`}</p>
                        {asset.display_name ? (
                          <p className="text-xs text-muted-foreground">
                            {asset.display_name}
                          </p>
                        ) : null}
                        {asset.location_note ? (
                          <p className="text-xs text-muted-foreground">
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
        </CardContent>
      </Card>

      {profile?.role === "admin" && assets.length > 0 ? (
        <div className="flex flex-col gap-3 px-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            {selectedAssets.length} of {assets.length} visible assets selected
            for bulk print.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={toggleSelectAllVisible}
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
            >
              Print Selected Labels
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
