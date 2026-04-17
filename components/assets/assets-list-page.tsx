"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AssetStatusBadge } from "@/components/assets/asset-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { printAssetLabels } from "@/utils/asset-print";
import { useAuth } from "@/utils/AuthProvider";
import { notify } from "@/utils/toast";
import { formatDueDate } from "@/utils/assets";

const ALL = "ALL";

export function AssetsListPage() {
  const { profile } = useAuth();
  const [assets, setAssets] = useState<AssetWithStatus[]>([]);
  const [assetTypeConfigs, setAssetTypeConfigs] = useState<AssetTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    assetType: ALL,
    unit: ALL,
    block: ALL,
    level: ALL,
    freshness: ALL,
    serviceability: ALL,
    search: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.assetType !== ALL) params.set("assetType", filters.assetType);
        if (filters.unit !== ALL) params.set("unit", filters.unit);
        if (filters.block !== ALL) params.set("block", filters.block);
        if (filters.level !== ALL) params.set("level", filters.level);
        if (filters.freshness !== ALL) params.set("freshness", filters.freshness);
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
          notify.error(error instanceof Error ? error.message : "Failed to load assets");
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
    () => new Map(assetTypeConfigs.map((config) => [config.code, config.label])),
    [assetTypeConfigs]
  );

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedAssetIds.includes(asset.id)),
    [assets, selectedAssetIds]
  );

  const allVisibleSelected =
    assets.length > 0 && assets.every((asset) => selectedAssetIds.includes(asset.id));

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId]
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedAssetIds((current) =>
      allVisibleSelected ? current.filter((id) => !assets.some((asset) => asset.id === id)) : assets.map((asset) => asset.id)
    );
  };

  const handlePrintSelected = async () => {
    try {
      await printAssetLabels(
        selectedAssets.map((asset) => ({
          assetCode: asset.asset_code,
          subtitle: asset.display_name || assetTypeLabelMap.get(asset.asset_type_code) || null,
        }))
      );
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to print selected labels");
    }
  };

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-sm text-muted-foreground">
            Track current inspection freshness and serviceability by QR-coded asset.
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

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="asset-search">Search</Label>
            <Input
              id="asset-search"
              placeholder="Asset code, serial, name, location"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Asset Type</Label>
            <Select
              value={filters.assetType}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, assetType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {assetTypeConfigs.map((config) => (
                  <SelectItem key={config.code} value={config.code}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Freshness</Label>
            <Select
              value={filters.freshness}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, freshness: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All freshness</SelectItem>
                <SelectItem value="CURRENT">Current</SelectItem>
                <SelectItem value="OUTDATED">Outdated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Unit</Label>
            <Select
              value={filters.unit}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, unit: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All units</SelectItem>
                {SITE_LOCATION_CONFIG.units.map((unit) => (
                  <SelectItem key={unit.code} value={unit.code}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Block</Label>
            <Select
              value={filters.block}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, block: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All blocks</SelectItem>
                {SITE_LOCATION_CONFIG.blocks.map((block) => (
                  <SelectItem key={block.code} value={block.code}>
                    {`Blk ${block.code}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Level</Label>
            <Select
              value={filters.level}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, level: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All levels</SelectItem>
                {SITE_LOCATION_CONFIG.levels.map((level) => (
                  <SelectItem key={level.code} value={level.code}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Serviceability</Label>
            <Select
              value={filters.serviceability}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, serviceability: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All serviceability</SelectItem>
                <SelectItem value="SERVICEABLE">Serviceable</SelectItem>
                <SelectItem value="UNSERVICEABLE">Unserviceable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No matching assets.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {profile?.role === "admin" ? (
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
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
                      <TableCell className="w-12 align-top">
                        <input
                          type="checkbox"
                          checked={selectedAssetIds.includes(asset.id)}
                          onChange={() => toggleAssetSelection(asset.id)}
                          aria-label={`Select ${asset.asset_code}`}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className="font-mono">
                      <Link href={`/assets/${encodeURIComponent(asset.asset_code)}`} className="font-semibold hover:underline">
                        {asset.asset_code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {assetTypeLabelMap.get(asset.asset_type_code) ?? asset.asset_type_code}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="space-y-1">
                        <p>{`Unit ${asset.unit_code} · Blk ${asset.block_code} · Level ${asset.level_code}`}</p>
                        {asset.display_name ? (
                          <p className="text-xs text-muted-foreground">{asset.display_name}</p>
                        ) : null}
                        {asset.location_note ? (
                          <p className="text-xs text-muted-foreground">{asset.location_note}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {asset.last_inspected_at
                        ? new Date(asset.last_inspected_at).toLocaleDateString("en-SG", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            timeZone: "Asia/Singapore",
                          })
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
        <div className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            {selectedAssets.length} of {assets.length} visible assets selected for bulk print.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={toggleSelectAllVisible}>
              {allVisibleSelected ? "Clear Visible Selection" : "Select All Visible"}
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
