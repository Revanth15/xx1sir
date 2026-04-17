"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type QrScanner from "qr-scanner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/utils/toast";

type DetailedQrScanResult = {
  data: string;
};

export function AssetScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const resolvingScanRef = useRef(false);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [startingScanner, setStartingScanner] = useState(false);
  const [lookingUpAsset, setLookingUpAsset] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const buildCameraErrorMessage = (error: unknown) => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      return "Camera scanning requires HTTPS or localhost access. Use manual entry below if needed.";
    }

    if (error instanceof Error) {
      switch (error.name) {
        case "NotAllowedError":
          return "Camera access was blocked. Allow camera permission in Safari and try again.";
        case "NotFoundError":
          return "No camera was detected on this device. Use manual entry below.";
        case "NotReadableError":
          return "The camera is already in use by another app or browser tab.";
        case "OverconstrainedError":
          return "The requested camera is unavailable on this device.";
        default:
          return error.message || "Unable to access the camera. Use manual entry below.";
      }
    }

    return "Unable to access the camera. Use manual entry below.";
  };

  const destroyScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }

    setScanning(false);
    setStartingScanner(false);
  };

  const stopScanner = () => {
    scannerRef.current?.stop();
    setScanning(false);
    setStartingScanner(false);
  };

  const lookupAsset = async (rawCode: string, source: "scanner" | "manual") => {
    const toastId = notify.loading(
      source === "scanner" ? "QR code detected" : "Looking up asset",
      source === "scanner"
        ? "Resolving the scanned asset and opening inspection."
        : "Resolving the entered asset code."
    );

    setLookingUpAsset(true);

    try {
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

      const assetCode = result.data.asset.asset_code as string;
      notify.dismiss(toastId);
      notify.success(
        source === "scanner" ? "Scan successful" : "Asset found",
        `Opening inspection for ${assetCode}.`
      );
      router.push(`/assets/${encodeURIComponent(assetCode)}/inspect`);
    } catch (error) {
      notify.dismiss(toastId);
      throw error;
    } finally {
      setLookingUpAsset(false);
    }
  };

  const getScanner = async () => {
    if (scannerRef.current) {
      return scannerRef.current;
    }

    if (!videoRef.current) {
      throw new Error("Camera preview is not ready yet.");
    }

    const { default: QrScannerClass } = await import("qr-scanner");
    const scanner = new QrScannerClass(
      videoRef.current,
      (result: DetailedQrScanResult) => {
        const rawCode = result.data?.trim();
        if (!rawCode || resolvingScanRef.current) {
          return;
        }

        resolvingScanRef.current = true;
        scanner.stop();
        setScanning(false);

        void lookupAsset(rawCode, "scanner").catch(async (error) => {
          const message =
            error instanceof Error ? error.message : "Failed to resolve QR code.";
          setCameraError(message);
          notify.error("Scan unsuccessful", message);
          resolvingScanRef.current = false;

          try {
            await scanner.start();
            setCameraError(null);
            setScanning(true);
            notify.info("Scanner resumed", "Point the camera at the QR code and try again.");
          } catch (restartError) {
            const restartMessage = buildCameraErrorMessage(restartError);
            setCameraError(restartMessage);
            notify.error("Unable to resume scanner", restartMessage);
          }
        });
      },
      {
        preferredCamera: "environment",
        maxScansPerSecond: 8,
        returnDetailedScanResult: true,
      }
    );

    scannerRef.current = scanner;
    return scanner;
  };

  const startScanner = async () => {
    setCameraError(null);
    setStartingScanner(true);

    try {
      const { default: QrScannerClass } = await import("qr-scanner");

      if (!(await QrScannerClass.hasCamera())) {
        throw new Error("No camera detected on this device. Use manual entry below.");
      }

      const scanner = await getScanner();
      await scanner.start();
      resolvingScanRef.current = false;
      setScanning(true);
      notify.info("Scanner ready", "Point the camera at the asset QR code.");
    } catch (error) {
      const message = buildCameraErrorMessage(error);
      setCameraError(message);
      stopScanner();
      notify.error("Unable to start scanner", message);
    } finally {
      setStartingScanner(false);
    }
  };

  useEffect(() => {
    return () => {
      destroyScanner();
    };
  }, []);

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await lookupAsset(manualCode, "manual");
    } catch (error) {
      notify.error(
        "Lookup unsuccessful",
        error instanceof Error ? error.message : "Lookup failed."
      );
    }
  };

  const helperText = (() => {
    if (lookingUpAsset) {
      return {
        text: "QR code detected. Resolving asset and opening the inspection form.",
        destructive: false,
      };
    }

    if (cameraError) {
      return {
        text: cameraError,
        destructive: true,
      };
    }

    if (startingScanner) {
      return {
        text: "Starting the camera. Accept the browser permission prompt if shown.",
        destructive: false,
      };
    }

    if (scanning) {
      return {
        text: "Position the QR code within the camera frame.",
        destructive: false,
      };
    }

    return {
      text: "Start the camera scanner or use manual lookup if camera access is unavailable.",
      destructive: false,
    };
  })();

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
            <video
              ref={videoRef}
              className="aspect-video w-full object-cover"
              playsInline
              muted
            />
          </div>
          <p
            className={
              helperText.destructive ? "text-sm text-destructive" : "text-sm text-muted-foreground"
            }
          >
            {helperText.text}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={startScanner}
              disabled={scanning || startingScanner || lookingUpAsset}
            >
              {lookingUpAsset
                ? "Opening Inspection..."
                : startingScanner
                  ? "Starting Camera..."
                  : scanning
                    ? "Scanning..."
                    : "Start Camera Scanner"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={stopScanner}
              disabled={!scanning && !startingScanner}
            >
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
                placeholder="1SIR-265-1-WC-017"
              />
            </div>
            <Button type="submit" disabled={lookingUpAsset}>
              {lookingUpAsset ? "Opening Inspection..." : "Find Asset"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
