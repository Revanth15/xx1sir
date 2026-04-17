"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
import { Textarea } from "@/components/ui/textarea";
import { SITE_LOCATION_CONFIG } from "@/lib/defaults";
import type { AssetTypeConfig, AssetWithStatus } from "@/lib/types/assets";
import { printAssetLabels } from "@/utils/asset-print";
import { notify } from "@/utils/toast";
import { generateAssetCode, generateBulkSerials } from "@/utils/assets";

const DEFAULT_UNIT_CODE = SITE_LOCATION_CONFIG.units[0]?.code ?? "";

type BulkFormState = {
  unit_code: string;
  block_code: string;
  level_code: string;
  asset_type_code: string;
  serial_start: string;
  quantity: string;
  display_name_prefix: string;
  location_note: string;
};

const INITIAL_FORM: BulkFormState = {
  unit_code: DEFAULT_UNIT_CODE,
  block_code: "",
  level_code: "",
  asset_type_code: "",
  serial_start: "01",
  quantity: "4",
  display_name_prefix: "",
  location_note: "",
};

export function BulkAssetForm() {
  const [form, setForm] = useState<BulkFormState>(INITIAL_FORM);
  const [assetTypeConfigs, setAssetTypeConfigs] = useState<AssetTypeConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdAssets, setCreatedAssets] = useState<AssetWithStatus[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadConfigs() {
      try {
        setLoadingConfigs(true);
        const response = await fetch("/api/assets?limit=1&includeInactive=true");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load asset types");
        }

        if (!cancelled) {
          setAssetTypeConfigs(result.data.assetTypeConfigs ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          notify.error(
            error instanceof Error ? error.message : "Failed to load asset types"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingConfigs(false);
        }
      }
    }

    loadConfigs();

    return () => {
      cancelled = true;
    };
  }, []);

  const quantityNumber = Number(form.quantity);
  const serialPreview = useMemo(() => {
    if (
      !form.unit_code ||
      !form.block_code ||
      !form.level_code ||
      !form.asset_type_code ||
      !form.serial_start ||
      !Number.isInteger(quantityNumber) ||
      quantityNumber < 1
    ) {
      return [];
    }

    try {
      return generateBulkSerials(form.serial_start, Math.min(quantityNumber, 100)).map(
        (serial) => ({
          serial,
          assetCode: generateAssetCode(
            form.unit_code,
            form.block_code,
            form.level_code,
            form.asset_type_code,
            serial
          ),
        })
      );
    } catch {
      return [];
    }
  }, [
    form.asset_type_code,
    form.block_code,
    form.level_code,
    form.quantity,
    form.serial_start,
    form.unit_code,
    quantityNumber,
  ]);

  const handleFieldChange = <K extends keyof BulkFormState>(
    key: K,
    value: BulkFormState[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.block_code || !form.level_code || !form.asset_type_code) {
      notify.error("Block, level, and asset type are required.");
      return;
    }

    if (!/^\d+$/.test(form.serial_start.trim())) {
      notify.error("Starting serial must be numeric, for example 017.");
      return;
    }

    if (!Number.isInteger(quantityNumber) || quantityNumber < 1 || quantityNumber > 100) {
      notify.error("Quantity must be between 1 and 100.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch("/api/assets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_code: form.unit_code,
          block_code: form.block_code,
          level_code: form.level_code,
          asset_type_code: form.asset_type_code,
          serial_start: form.serial_start,
          quantity: quantityNumber,
          display_name_prefix: form.display_name_prefix || undefined,
          location_note: form.location_note || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        if (Array.isArray(result.details)) {
          throw new Error(
            `${result.error} ${result.details.join(", ")}`
          );
        }
        throw new Error(result.error || "Failed to bulk create assets");
      }

      setCreatedAssets(result.data.assets ?? []);
      notify.success(
        `${result.data.assets?.length ?? 0} assets created.`,
        "You can print the generated labels below."
      );
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : "Failed to bulk create assets"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintCreated = async () => {
    try {
      await printAssetLabels(
        createdAssets.map((asset) => ({
          assetCode: asset.asset_code,
          subtitle: asset.display_name || asset.asset_type_config?.label || null,
        }))
      );
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to print labels");
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">

<div className="grid grid-cols-3 gap-4">
  <div className="space-y-2">
    <Label htmlFor="bulk-unit-code">Unit</Label>
    <Select value={form.unit_code} disabled>
      <SelectTrigger id="bulk-unit-code" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SITE_LOCATION_CONFIG.units.map((unit) => (
          <SelectItem key={unit.code} value={unit.code}>{unit.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground">Fixed to 1SIR for now.</p>
  </div>

  <div className="space-y-2">
    <Label htmlFor="bulk-block-code">Block</Label>
    <Select
      value={form.block_code || undefined}
      onValueChange={(value) => handleFieldChange("block_code", value)}
    >
      <SelectTrigger id="bulk-block-code" className="w-full">
        <SelectValue placeholder="Select block" />
      </SelectTrigger>
      <SelectContent>
        {SITE_LOCATION_CONFIG.blocks.map((block) => (
          <SelectItem key={block.code} value={block.code}>
            {`Blk ${block.code} · ${block.label}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  <div className="space-y-2">
    <Label htmlFor="bulk-level-code">Level</Label>
    <Select
      value={form.level_code || undefined}
      onValueChange={(value) => handleFieldChange("level_code", value)}
    >
      <SelectTrigger id="bulk-level-code" className="w-full">
        <SelectValue placeholder="Select level" />
      </SelectTrigger>
      <SelectContent>
        {SITE_LOCATION_CONFIG.levels.map((level) => (
          <SelectItem key={level.code} value={level.code}>{level.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
</div>

<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
  <div className="space-y-2">
    <Label htmlFor="bulk-asset-type">Asset Type</Label>
    <Select
      value={form.asset_type_code || undefined}
      onValueChange={(value) => handleFieldChange("asset_type_code", value)}
      disabled={loadingConfigs}
    >
      <SelectTrigger id="bulk-asset-type" className="w-full">
        <SelectValue placeholder={loadingConfigs ? "Loading..." : "Select type"} />
      </SelectTrigger>
      <SelectContent>
        {assetTypeConfigs.map((config) => (
          <SelectItem key={config.code} value={config.code}>{config.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  <div className="space-y-2">
    <Label htmlFor="bulk-serial-start">Starting Serial</Label>
    <Input
      id="bulk-serial-start"
      value={form.serial_start}
      onChange={(event) => handleFieldChange("serial_start", event.target.value.toUpperCase())}
      placeholder="02"
    />
    <p className="text-xs text-muted-foreground">
      `02` becomes `02, 03,...`
    </p>
  </div>

  <div className="hidden space-y-2 sm:block">
    <Label htmlFor="bulk-quantity">Quantity</Label>
    <Input
      id="bulk-quantity"
      type="number"
      min={1}
      max={100}
      value={form.quantity}
      onChange={(event) => handleFieldChange("quantity", event.target.value)}
    />
  </div>
</div>

<div className="space-y-2 sm:hidden">
  <Label htmlFor="bulk-quantity-mobile">Quantity</Label>
  <Input
    id="bulk-quantity-mobile"
    type="number"
    min={1}
    max={100}
    value={form.quantity}
    onChange={(event) => handleFieldChange("quantity", event.target.value)}
  />
</div>

<div className="space-y-2">
  <Label htmlFor="bulk-display-name-prefix">Display Name Prefix</Label>
  <Input
    id="bulk-display-name-prefix"
    value={form.display_name_prefix}
    onChange={(event) => handleFieldChange("display_name_prefix", event.target.value)}
    placeholder="Optional. Example: Water Cooler"
  />
  <p className="text-xs text-muted-foreground">
    If set, each asset becomes `{`<prefix> <serial>`}`.
  </p>
</div>

{/* Row 4: Location Note */}
<div className="space-y-2">
  <Label htmlFor="bulk-location-note">Location Note</Label>
  <Textarea
    id="bulk-location-note"
    rows={3}
    value={form.location_note}
    onChange={(event) => handleFieldChange("location_note", event.target.value)}
    placeholder="Optional note shared across this batch"
  />
</div>

<div className="flex flex-wrap gap-2">
  <Button type="submit" disabled={submitting || loadingConfigs}>
    {submitting ? "Creating Batch..." : "Create Batch"}
  </Button>
  {createdAssets.length > 0 && (
    <Button type="button" variant="outline" onClick={handlePrintCreated}>
      Print Created Labels
    </Button>
  )}
  {createdAssets.length > 0 && (
    <Button asChild type="button" variant="ghost">
      <Link href="/assets">Go To Inventory</Link>
    </Button>
  )}
</div>
</form>

      <div className="space-y-3">
        <div>
          <h3 className="font-medium">Batch Preview</h3>
          <p className="text-sm text-muted-foreground">
            Previewing the generated canonical asset codes for this batch.
          </p>
        </div>
        <div className="rounded-xl border">
          {serialPreview.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Fill in the location, type, starting serial, and quantity to preview the batch.
            </div>
          ) : (
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Serial</th>
                    <th className="px-4 py-2 text-left font-medium">Asset Code</th>
                  </tr>
                </thead>
                <tbody>
                  {serialPreview.map((entry) => (
                    <tr key={entry.assetCode} className="border-b last:border-b-0">
                      <td className="px-4 py-2 font-mono">{entry.serial}</td>
                      <td className="px-4 py-2 font-mono">{entry.assetCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createdAssets.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h3 className="font-medium">Created Assets</h3>
            <p className="text-sm text-muted-foreground">
              {createdAssets.length} assets were created in this batch.
            </p>
          </div>
          <div className="rounded-xl border">
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Asset Code</th>
                    <th className="px-4 py-2 text-left font-medium">Display Name</th>
                  </tr>
                </thead>
                <tbody>
                  {createdAssets.map((asset) => (
                    <tr key={asset.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2 font-mono">{asset.asset_code}</td>
                      <td className="px-4 py-2">{asset.display_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
