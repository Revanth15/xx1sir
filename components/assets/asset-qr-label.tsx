"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AssetQrLabelProps = {
  assetCode: string | null;
  title?: string;
  subtitle?: string | null;
  showActions?: boolean;
};

export function AssetQrLabel({
  assetCode,
  title = "QR Label",
  subtitle,
  showActions = true,
}: AssetQrLabelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function generateQr() {
      if (!assetCode) {
        setQrDataUrl(null);
        return;
      }

      const dataUrl = await QRCode.toDataURL(assetCode, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320,
      });

      if (!cancelled) {
        setQrDataUrl(dataUrl);
      }
    }

    generateQr().catch(() => setQrDataUrl(null));

    return () => {
      cancelled = true;
    };
  }, [assetCode]);

  const downloadQr = () => {
    if (!qrDataUrl || !assetCode) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${assetCode}.png`;
    link.click();
  };

  const printQr = () => {
    if (!qrDataUrl || !assetCode) return;

    const printWindow = window.open("", "_blank", "width=640,height=720");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${assetCode}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: grid;
              place-items: center;
              margin: 0;
              min-height: 100vh;
            }
            .label {
              border: 1px solid #ddd;
              padding: 24px;
              width: 320px;
              text-align: center;
            }
            img {
              width: 100%;
              height: auto;
            }
            h1 {
              margin: 16px 0 8px;
              font-size: 20px;
              line-height: 1.2;
            }
            p {
              margin: 0;
              color: #555;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <img src="${qrDataUrl}" alt="${assetCode}" />
            <h1>${assetCode}</h1>
            ${subtitle ? `<p>${subtitle}</p>` : ""}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {assetCode ? (
          <>
            <div className="rounded-xl border bg-white p-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={assetCode}
                  className="mx-auto h-auto w-full max-w-64"
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  Generating QR preview...
                </div>
              )}
            </div>
            <div className="space-y-1 text-center">
              <p className="font-mono text-sm font-semibold">{assetCode}</p>
              {subtitle ? (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {showActions ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={printQr}>
                  Print Label
                </Button>
                <Button type="button" className="flex-1" onClick={downloadQr}>
                  Download PNG
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex h-80 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            Complete the code fields to preview the QR label.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
