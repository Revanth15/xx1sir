import QRCode from "qrcode";

export type PrintableAssetLabel = {
  assetCode: string;
  subtitle?: string | null;
};

const QR_SIZE = 100;
const LABEL_WIDTH = 116;

async function generateAssetQrDataUrl(assetCode: string) {
  return QRCode.toDataURL(assetCode, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
}

export async function printAssetLabels(labels: PrintableAssetLabel[]) {
  if (labels.length === 0) {
    return;
  }

  const labelsWithQr = await Promise.all(
    labels.map(async (label) => ({
      ...label,
      qrDataUrl: await generateAssetQrDataUrl(label.assetCode),
    }))
  );

  const printWindow = window.open("", "_blank", "width=1024,height=768");
  if (!printWindow) {
    return;
  }

  const labelHtml = labelsWithQr
    .map(
      (label) => `
        <div class="label">
          <img src="${label.qrDataUrl}" alt="${label.assetCode}" />
          <h1>${label.assetCode}</h1>
          ${label.subtitle ? `<p>${label.subtitle}</p>` : ""}
        </div>
      `
    )
    .join("");

  printWindow.document.write(`
    <html>
      <head>
        <title>Asset Labels</title>
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
            grid-template-columns: repeat(auto-fill, ${LABEL_WIDTH}px);
            gap: 12px;
            align-content: start;
          }
          .label {
            border: 1px solid #ddd;
            padding: 8px;
            width: ${LABEL_WIDTH}px;
            text-align: center;
            break-inside: avoid;
          }
          img {
            width: ${QR_SIZE}px;
            height: ${QR_SIZE}px;
            display: block;
            margin: 0 auto;
          }
          h1 {
            margin: 6px 0 0;
            font-size: 8px;
            line-height: 1.2;
            word-break: break-all;
          }
          p {
            margin: 2px 0 0;
            font-size: 7px;
            color: #555;
          }
          @page {
            margin: 10mm;
          }
        </style>
      </head>
      <body>
        <div class="sheet">${labelHtml}</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
