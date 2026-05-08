"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AssetQrLabel } from "@/components/assets/asset-qr-label";
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
import type { AssetRecord, AssetTypeConfig, AssetWithStatus } from "@/lib/types/assets";
import { notify } from "@/utils/toast";
import { generateAssetCode } from "@/utils/assets";

type AssetFormMode = "create" | "edit";

type AssetFormProps = {
  mode: AssetFormMode;
  assetCode?: string;
  initialAsset?: AssetRecord | AssetWithStatus | null;
  onSaved?: (asset: AssetWithStatus, requiresQrReprint: boolean) => void;
  onCancel?: () => void;
};

type AssetFormState = {
  unit_code: string;
  block_code: string;
  level_code: string;
  asset_type_code: string;
  serial_number: string;
  display_name: string;
  location_note: string;
  is_active: boolean;
};

const EMPTY_ERRORS: Record<string, string> = {};
const DEFAULT_UNIT_CODE = SITE_LOCATION_CONFIG.units[0]?.code ?? "";

function buildInitialState(initialAsset?: AssetRecord | AssetWithStatus | null): AssetFormState {
  return {
    unit_code: initialAsset?.unit_code ?? DEFAULT_UNIT_CODE,
    block_code: initialAsset?.block_code ?? "",
    level_code: initialAsset?.level_code ?? "",
    asset_type_code: initialAsset?.asset_type_code ?? "",
    serial_number: initialAsset?.serial_number ?? "",
    display_name: initialAsset?.display_name ?? "",
    location_note: initialAsset?.location_note ?? "",
    is_active: initialAsset?.is_active ?? true,
  };
}

export function AssetForm({
  mode,
  assetCode,
  initialAsset,
  onSaved,
  onCancel,
}: AssetFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<AssetFormState>(() => buildInitialState(initialAsset));
  const [assetTypeConfigs, setAssetTypeConfigs] = useState<AssetTypeConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>(EMPTY_ERRORS);

  useEffect(() => {
    setForm(buildInitialState(initialAsset));
  }, [initialAsset]);

  useEffect(() => {
    let cancelled = false;
    async function loadConfigs() {
      try {
        setLoadingConfigs(true);
        const response = await fetch("/api/assets?limit=1&includeInactive=true");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to load asset types");
        if (!cancelled) setAssetTypeConfigs(result.data.assetTypeConfigs ?? []);
      } catch (error) {
        if (!cancelled) notify.error(error instanceof Error ? error.message : "Failed to load asset types");
      } finally {
        if (!cancelled) setLoadingConfigs(false);
      }
    }
    loadConfigs();
    return () => { cancelled = true; };
  }, []);

  const previewCode = useMemo(() => {
    if (!form.unit_code || !form.block_code || !form.level_code || !form.asset_type_code || !form.serial_number) return null;
    return generateAssetCode(form.unit_code, form.block_code, form.level_code, form.asset_type_code, form.serial_number);
  }, [form]);

  const selectedTypeConfig = assetTypeConfigs.find((config) => config.code === form.asset_type_code) ?? null;
  const selectableAssetTypeConfigs = assetTypeConfigs.filter(
    (config) =>
      config.is_active ||
      (mode === "edit" && config.code === initialAsset?.asset_type_code)
  );

  const setField = <K extends keyof AssetFormState>(key: K, value: AssetFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.unit_code) nextErrors.unit_code = "Unit is required.";
    if (!form.block_code) nextErrors.block_code = "Block is required.";
    if (!form.level_code) nextErrors.level_code = "Level is required.";
    if (!form.asset_type_code) nextErrors.asset_type_code = "Asset type is required.";
    if (!form.serial_number.trim()) nextErrors.serial_number = "Serial number is required.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;
    try {
      setSubmitting(true);
      const response = await fetch(
        mode === "create" ? "/api/assets" : `/api/assets/${encodeURIComponent(assetCode ?? initialAsset?.asset_code ?? "")}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save asset");
      const savedAsset = result.data.asset as AssetWithStatus;
      const requiresQrReprint = Boolean(result.data.requires_qr_reprint);
      notify.success(
        mode === "create" ? "Asset created." : "Asset updated.",
        requiresQrReprint ? "Code components changed. Reprint the QR label." : undefined
      );
      onSaved?.(savedAsset, requiresQrReprint);
      if (mode === "create") {
        router.push(`/assets/${encodeURIComponent(savedAsset.asset_code)}`);
        return;
      }
      router.refresh();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to save asset");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unit_code">Unit</Label>
          <Select
            value={form.unit_code || undefined}
            onValueChange={(value) => setField("unit_code", value)}
            disabled={SITE_LOCATION_CONFIG.units.length === 1}
          >
            <SelectTrigger id="unit_code" className="w-full">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {SITE_LOCATION_CONFIG.units.map((unit) => (
                <SelectItem key={unit.code} value={unit.code}>{unit.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.unit_code && <p className="text-xs text-destructive">{errors.unit_code}</p>}
          {SITE_LOCATION_CONFIG.units.length === 1 && (
            <p className="text-xs text-muted-foreground">Unit is fixed to 1SIR for now.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="block_code">Block</Label>
          <Select
            value={form.block_code || undefined}
            onValueChange={(value) => setField("block_code", value)}
          >
            <SelectTrigger id="block_code" className="w-full">
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
          {errors.block_code && <p className="text-xs text-destructive">{errors.block_code}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="level_code">Level</Label>
          <Select
            value={form.level_code || undefined}
            onValueChange={(value) => setField("level_code", value)}
          >
            <SelectTrigger id="level_code" className="w-full">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {SITE_LOCATION_CONFIG.levels.map((level) => (
                <SelectItem key={level.code} value={level.code}>{level.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.level_code && <p className="text-xs text-destructive">{errors.level_code}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="asset_type_code">Asset Type</Label>
          <Select
            value={form.asset_type_code || undefined}
            onValueChange={(value) => setField("asset_type_code", value)}
            disabled={loadingConfigs}
          >
            <SelectTrigger id="asset_type_code" className="w-full">
              <SelectValue placeholder={loadingConfigs ? "Loading..." : "Select type"} />
            </SelectTrigger>
            <SelectContent>
              {selectableAssetTypeConfigs.map((typeConfig) => (
                <SelectItem key={typeConfig.code} value={typeConfig.code}>{typeConfig.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTypeConfig && (
            <p className="text-xs text-muted-foreground">
              Inspection cadence: every {selectedTypeConfig.inspection_frequency_days} day(s)
            </p>
          )}
          {errors.asset_type_code && <p className="text-xs text-destructive">{errors.asset_type_code}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="serial_number">Serial Number</Label>
          <Input
            id="serial_number"
            value={form.serial_number}
            onChange={(event) => setField("serial_number", event.target.value.toUpperCase())}
            placeholder="e.g. WC-017"
          />
          <p className="text-xs text-muted-foreground">Stored in uppercase.</p>
          {errors.serial_number && <p className="text-xs text-destructive">{errors.serial_number}</p>}
        </div>

        <div className="hidden space-y-2 sm:block">
          <Label htmlFor="display_name">Display Name</Label>
          <Input
            id="display_name"
            value={form.display_name}
            onChange={(event) => setField("display_name", event.target.value)}
            placeholder="Optional friendly name"
          />
        </div>
      </div>

      <div className="space-y-2 sm:hidden">
        <Label htmlFor="display_name_mobile">Display Name</Label>
        <Input
          id="display_name_mobile"
          value={form.display_name}
          onChange={(event) => setField("display_name", event.target.value)}
          placeholder="Optional friendly name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location_note">Location Note</Label>
        <Textarea
          id="location_note"
          value={form.location_note}
          onChange={(event) => setField("location_note", event.target.value)}
          placeholder="Optional note for exact placement or landmarks"
          rows={3}
        />
      </div>

        {mode === "edit" && (
          <div className="space-y-2">
            <Label htmlFor="is_active">Asset State</Label>
            <Select
              value={form.is_active ? "ACTIVE" : "INACTIVE"}
              onValueChange={(value) => setField("is_active", value === "ACTIVE")}
            >
              <SelectTrigger id="is_active" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={submitting || loadingConfigs}>
            {submitting
              ? mode === "create" ? "Creating..." : "Saving..."
              : mode === "create" ? "Create Asset" : "Save Asset"}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <AssetQrLabel
        assetCode={previewCode}
        title={mode === "create" ? "QR Preview" : "Reprint QR"}
        subtitle={selectedTypeConfig?.label ?? form.display_name ?? null}
      />
    </form>
  );
}
