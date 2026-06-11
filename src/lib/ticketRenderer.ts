import * as QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { CATEGORIES } from "./categories";
import { buildQrPayload } from "./crypto";
import type { Ticket } from "./types";

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () =>
          reject(new Error(`Impossible de charger le modèle: ${src}`));
        img.src = src;
      }),
    );
  }
  return imageCache.get(src)!;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Compose le billet final : modèle PNG + QR code placé dans le cadre
 * "VERIFICATION ACCÈS". Retourne un canvas en pleine résolution (2480x877).
 */
export async function renderTicketCanvas(
  ticket: Ticket,
): Promise<HTMLCanvasElement> {
  const cfg = CATEGORIES[ticket.category];
  const template = await loadImage(cfg.template);

  const canvas = document.createElement("canvas");
  canvas.width = cfg.width;
  canvas.height = cfg.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(template, 0, 0, cfg.width, cfg.height);

  // QR haute correction d'erreur (robuste à l'impression / dégradations).
  const payload = buildQrPayload(ticket.id, ticket.secret);
  const qrSize = cfg.qr.size;
  const qrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "H",
    margin: 1,
    scale: 12,
    color: { dark: "#111111", light: "#ffffff" },
  });
  const qrImg = await loadImage(qrDataUrl);

  const pad = Math.round(qrSize * 0.12);
  const bgSize = qrSize + pad * 2;
  const bgX = cfg.qr.cx - bgSize / 2;
  const bgY = cfg.qr.cy - bgSize / 2;

  // Fond blanc arrondi (zone de silence pour garantir la lisibilité du QR).
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, bgX, bgY, bgSize, bgSize, Math.round(bgSize * 0.1));
  ctx.fill();
  ctx.restore();

  ctx.drawImage(
    qrImg,
    cfg.qr.cx - qrSize / 2,
    cfg.qr.cy - qrSize / 2,
    qrSize,
    qrSize,
  );

  return canvas;
}

export function fileNameFor(ticket: Ticket): string {
  const safe = (ticket.reference || ticket.id).replace(/[^\w-]+/g, "_");
  const name = ticket.holderName.replace(/[^\w-]+/g, "_").slice(0, 40);
  return `billet_${safe}_${name}`;
}

export async function ticketToPngBlob(ticket: Ticket): Promise<Blob> {
  const canvas = await renderTicketCanvas(ticket);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob a échoué"))),
      "image/png",
    ),
  );
}

export async function downloadTicketPng(ticket: Ticket): Promise<void> {
  const blob = await ticketToPngBlob(ticket);
  triggerDownload(blob, `${fileNameFor(ticket)}.png`);
}

export async function downloadTicketPdf(ticket: Ticket): Promise<void> {
  const canvas = await renderTicketCanvas(ticket);
  const pdf = ticketCanvasToPdf([canvas]);
  pdf.save(`${fileNameFor(ticket)}.pdf`);
}

/** Construit un PDF multi-pages (1 billet / page) à partir de canvases. */
export function ticketCanvasToPdf(canvases: HTMLCanvasElement[]): jsPDF {
  const first = canvases[0];
  const ratio = first.height / first.width;
  // Largeur fixe en mm, hauteur proportionnelle.
  const wMm = 220;
  const hMm = wMm * ratio;
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [wMm, hMm],
  });
  canvases.forEach((canvas, i) => {
    if (i > 0) pdf.addPage([wMm, hMm], "landscape");
    const data = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(data, "JPEG", 0, 0, wMm, hMm);
  });
  return pdf;
}

export async function downloadBatchPdf(
  tickets: Ticket[],
  name: string,
): Promise<void> {
  const canvases: HTMLCanvasElement[] = [];
  for (const t of tickets) canvases.push(await renderTicketCanvas(t));
  const pdf = ticketCanvasToPdf(canvases);
  pdf.save(`${name}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
