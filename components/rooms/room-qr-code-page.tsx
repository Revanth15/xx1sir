"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, Printer, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SITE_LOCATION_CONFIG } from "@/lib/defaults";
import { notify } from "@/utils/toast";
import {
  buildAssetUnitNumberFromSuffix,
  getAssetUnitNumberSuffix,
  getLevelUnitNumberPrefix,
  isRoomUnitNumberValidForLevel,
  normalizeAssetUnitNumberForLevel,
  normalizeRoomBlock,
  normalizeRoomUnitNumber,
} from "@/utils/rooms";

type RoomQrFormState = {
  unit_code: string;
  block_code: string;
  level_code: string;
  unit_number: string;
};

const DEFAULT_UNIT_CODE = SITE_LOCATION_CONFIG.units[0]?.code ?? "";
const INITIAL_FORM: RoomQrFormState = {
  unit_code: DEFAULT_UNIT_CODE,
  block_code: "",
  level_code: "",
  unit_number: "",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildRoomLabel(form: RoomQrFormState) {
  const roomNumber = normalizeRoomUnitNumber(form.unit_number);
  const unitNumberPrefix = getLevelUnitNumberPrefix(form.level_code);
  const hasValidRoomNumber = Boolean(
    roomNumber &&
      isRoomUnitNumberValidForLevel(form.level_code, roomNumber) &&
      roomNumber.replace(/^#/, "") !== `${unitNumberPrefix}-`
  );

  if (!form.unit_code || !form.block_code || !form.level_code || !hasValidRoomNumber) {
    return "";
  }

  return [
    form.unit_code,
    `Blk${normalizeRoomBlock(form.block_code)}`,
    `Level${form.level_code}`,
    roomNumber,
  ].join("-");
}

function buildRoomPath(blockCode: string, unitNumber: string) {
  const params = new URLSearchParams({
    block: normalizeRoomBlock(blockCode),
    unit_number: normalizeRoomUnitNumber(unitNumber),
  });

  return `/rooms?${params.toString()}`;
}

function printRoomLabel(label: string, qrDataUrl: string) {
  const printWindow = window.open("", "_blank", "width=1024,height=768");
  if (!printWindow) {
    notify.error("Unable to open print window.", "Allow pop-ups and try again.");
    return;
  }

  const safeLabel = escapeHtml(label);

  printWindow.document.write(`
    <html>
      <head>
        <title>Room QR Label</title>
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 16px;
          }
          .sheet {
            display: grid;
            grid-template-columns: repeat(auto-fill, 116px);
            gap: 12px;
            align-content: start;
          }
          .label {
            border: 1px solid #ddd;
            padding: 8px;
            width: 116px;
            text-align: center;
            break-inside: avoid;
          }
          img {
            width: 100px;
            height: 100px;
            display: block;
            margin: 0 auto;
          }
          h1 {
            margin: 6px 0 0;
            font-size: 8px;
            line-height: 1.2;
            word-break: break-all;
          }
          @page {
            margin: 10mm;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="label">
            <img src="${qrDataUrl}" alt="${safeLabel}" />
            <h1>${safeLabel}</h1>
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export function RoomQrCodePage() {
  const [form, setForm] = useState<RoomQrFormState>(INITIAL_FORM);
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const unitNumberPrefix = getLevelUnitNumberPrefix(form.level_code);
  const label = useMemo(() => buildRoomLabel(form), [form]);
  const roomPath = useMemo(
    () => (label ? buildRoomPath(form.block_code, form.unit_number) : ""),
    [form.block_code, form.unit_number, label]
  );
  const roomUrl = origin && roomPath ? `${origin}${roomPath}` : roomPath;
  const hasValidUnitNumber = Boolean(
    form.unit_number &&
      isRoomUnitNumberValidForLevel(form.level_code, form.unit_number) &&
      form.unit_number !== `${unitNumberPrefix}-`
  );
  const canGenerate = Boolean(
    form.unit_code && form.block_code && form.level_code && hasValidUnitNumber && roomUrl
  );

  useEffect(() => {
    let cancelled = false;

    async function generateQr() {
      if (!canGenerate) {
        setQrDataUrl(null);
        return;
      }

      const dataUrl = await QRCode.toDataURL(roomUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320,
      });

      if (!cancelled) {
        setQrDataUrl(dataUrl);
      }
    }

    generateQr().catch(() => {
      if (!cancelled) {
        setQrDataUrl(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canGenerate, roomUrl]);

  const setField = <K extends keyof RoomQrFormState>(
    key: K,
    value: RoomQrFormState[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setLevelCode = (levelCode: string) => {
    setForm((current) => ({
      ...current,
      level_code: levelCode,
      unit_number: normalizeAssetUnitNumberForLevel(levelCode, current.unit_number),
    }));
  };

  const setUnitNumber = (value: string) => {
    setForm((current) => ({
      ...current,
      unit_number: buildAssetUnitNumberFromSuffix(current.level_code, value),
    }));
  };

  const downloadQr = () => {
    if (!qrDataUrl || !label) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${label}.png`;
    link.click();
  };

  const copyRoomUrl = async () => {
    if (!roomUrl) return;

    try {
      await navigator.clipboard.writeText(roomUrl);
      notify.success("Room link copied.");
    } catch {
      notify.error("Failed to copy room link.");
    }
  };

  const printQr = () => {
    if (!qrDataUrl || !label || !roomUrl) return;
    printRoomLabel(label, qrDataUrl);
  };

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="text-2xl font-bold">Room QR Codes</h1>
        <p className="text-sm text-muted-foreground">
          Generate QR labels that open the room report page for active reports and new submissions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Room Details</CardTitle>
            <CardDescription>
              Select the location to build the room QR code and label.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="room-unit-code">Unit</Label>
                <Select
                  value={form.unit_code || undefined}
                  onValueChange={(value) => setField("unit_code", value)}
                  disabled={SITE_LOCATION_CONFIG.units.length === 1}
                >
                  <SelectTrigger id="room-unit-code" className="w-full">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_LOCATION_CONFIG.units.map((unit) => (
                      <SelectItem key={unit.code} value={unit.code}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="room-block-code">Block</Label>
                <Select
                  value={form.block_code || undefined}
                  onValueChange={(value) => setField("block_code", value)}
                >
                  <SelectTrigger id="room-block-code" className="w-full">
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
                <Label htmlFor="room-level-code">Level</Label>
                <Select
                  value={form.level_code || undefined}
                  onValueChange={setLevelCode}
                >
                  <SelectTrigger id="room-level-code" className="w-full">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_LOCATION_CONFIG.levels.map((level) => (
                      <SelectItem key={level.code} value={level.code}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="room-unit-number">Unit Number</Label>
                <div
                  className={`flex items-stretch rounded-md shadow-sm ${
                    !form.level_code ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  <span className="flex min-w-14 items-center justify-center rounded-l-md border border-r-0 border-input bg-muted px-3 font-mono text-sm text-muted-foreground select-none">
                    {unitNumberPrefix ? `#${unitNumberPrefix}-` : "#"}
                  </span>
                  <Input
                    id="room-unit-number"
                    value={getAssetUnitNumberSuffix(form.level_code, form.unit_number)}
                    onChange={(event) => setUnitNumber(event.target.value)}
                    onBlur={() =>
                      setField(
                        "unit_number",
                        form.unit_number === `${unitNumberPrefix}-`
                          ? ""
                          : normalizeAssetUnitNumberForLevel(
                              form.level_code,
                              form.unit_number
                            )
                      )
                    }
                    placeholder="05"
                    disabled={!form.level_code}
                    className="rounded-l-none font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {unitNumberPrefix
                    ? `The full room number will be #${unitNumberPrefix}-XX.`
                    : "Select a level first."}
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Label
                </p>
                <p className="break-all font-mono text-sm font-semibold">
                  {label || "Select all fields to generate a label"}
                </p>
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Room link
                </p>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {roomUrl || "Select all fields to generate a room link"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>QR Preview</CardTitle>
                <CardDescription>
                  QR content points to the public room report page.
                </CardDescription>
              </div>
              <div className="rounded-lg border bg-muted p-2 text-muted-foreground">
                <QrCode className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-white p-5">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={label}
                  className="mx-auto aspect-square h-[220px] w-[220px]"
                />
              ) : (
                <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
                  Select unit, block, level, and unit number to preview the QR code.
                </div>
              )}
            </div>

            <div className="space-y-1 text-center">
              <p className="break-all font-mono text-sm font-semibold">
                {label || "Room label"}
              </p>
              {roomPath ? (
                <p className="break-all text-xs text-muted-foreground">{roomPath}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={printQr}
                disabled={!qrDataUrl}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button type="button" onClick={downloadQr} disabled={!qrDataUrl}>
                <Download className="h-4 w-4" />
                PNG
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={copyRoomUrl}
                disabled={!roomUrl}
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button asChild variant="outline" aria-disabled={!roomPath}>
                {roomPath ? (
                  <Link href={roomPath} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </Link>
                ) : (
                  <span>
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
