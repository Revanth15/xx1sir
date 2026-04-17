"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/utils/toast";

type NativeBarcodeResult = {
  rawValue?: string;
};

type NativeBarcodeDetector = {
  detect(source: ImageBitmapSource): Promise<NativeBarcodeResult[]>;
};

type NativeBarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => NativeBarcodeDetector;

export function AssetScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const lookupAsset = async (rawCode: string) => {
    const response = await fetch("/api/assets/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_qr_code: rawCode }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to resolve QR code");
    }

    if (!result.data.asset) {
      throw new Error("Unknown asset code.");
    }

    router.push(`/assets/${encodeURIComponent(result.data.asset.asset_code)}`);
  };

  const stopScanner = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setScanning(false);
  };

  const startScanner = async () => {
    stopScanner();

    const BarcodeDetectorCtor = (
      window as Window & { BarcodeDetector?: NativeBarcodeDetectorConstructor }
    ).BarcodeDetector;

    if (!BarcodeDetectorCtor) {
      setCameraError(
        "This browser does not support in-app QR detection. Use manual entry below."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      setCameraError(null);
      setScanning(true);

      intervalRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;

        try {
          const detections = await detector.detect(videoRef.current);
          const rawValue = detections[0]?.rawValue;
          if (!rawValue) return;

          stopScanner();
          await lookupAsset(rawValue);
        } catch {
          // Ignore frame-level scan errors and keep polling.
        }
      }, 700);
    } catch (error) {
      stopScanner();
      setCameraError(
        error instanceof Error
          ? error.message
          : "Camera permission denied. Use manual entry below."
      );
    }
  };

  useEffect(() => stopScanner, []);

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await lookupAsset(manualCode);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Lookup failed");
    }
  };

  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="text-2xl font-bold">Scan Asset</h1>
        <p className="text-sm text-muted-foreground">
          Scan the raw QR code in-app or type the asset code manually if camera access is unavailable.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Camera Scanner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-black">
            <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted />
          </div>
          {cameraError ? (
            <p className="text-sm text-destructive">{cameraError}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Position the QR code within the camera frame.
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" onClick={startScanner} disabled={scanning}>
              {scanning ? "Scanning..." : "Start Camera Scanner"}
            </Button>
            <Button type="button" variant="outline" onClick={stopScanner} disabled={!scanning}>
              Stop
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual Lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-asset-code">Asset Code</Label>
              <Input
                id="manual-asset-code"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                placeholder="UNIT-BLOCK-LEVEL-OBJECT-SERIAL"
              />
            </div>
            <Button type="submit">Find Asset</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
