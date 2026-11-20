import type { Mask } from "./segment";

export type Edge = "soft" | "normal" | "sharp";
export type Background = { kind: "transparent" } | { kind: "color"; color: string } | { kind: "blur"; strength: "light" | "strong" };
export type Options = { background: Background; edge: Edge; shadow: boolean; trim: boolean };
export type Format = "png" | "jpg";

export type Prepared = {
  original: ImageBitmap;
  mask: Mask;
  bbox: { x: number; y: number; w: number; h: number };
  cutouts: Map<Edge, HTMLCanvasElement>;
};

const MAX_SIDE = 4096;
const MODEL_SIDE = 1024;

export async function loadImage(file: Blob) {
  let image = await createImageBitmap(file, { imageOrientation: "from-image" });
  if (Math.max(image.width, image.height) > MAX_SIDE) {
    const s = MAX_SIDE / Math.max(image.width, image.height);
    const resized = await createImageBitmap(image, {
      resizeWidth: Math.round(image.width * s),
      resizeHeight: Math.round(image.height * s),
      resizeQuality: "high",
    });
    image.close();
    image = resized;
  }
  const s = Math.min(1, MODEL_SIDE / Math.max(image.width, image.height));
  const c = document.createElement("canvas");
  c.width = Math.round(image.width * s);
  c.height = Math.round(image.height * s);
  c.getContext("2d")!.drawImage(image, 0, 0, c.width, c.height);
  const modelInput = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
  return { image, modelInput };
}

function findBox(mask: Mask, W: number, H: number) {
  let x0 = mask.width;
  let y0 = mask.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[y * mask.width + x] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: W, h: H };
  const sx = W / mask.width;
  const sy = H / mask.height;
  const pad = Math.round(Math.max((x1 - x0) * sx, (y1 - y0) * sy) * 0.05);
  const x = Math.max(0, Math.floor(x0 * sx) - pad);
  const y = Math.max(0, Math.floor(y0 * sy) - pad);
  return { x, y, w: Math.min(W, Math.ceil((x1 + 1) * sx) + pad) - x, h: Math.min(H, Math.ceil((y1 + 1) * sy) + pad) - y };
}

export function prepare(original: ImageBitmap, mask: Mask): Prepared {
  return { original, mask, bbox: findBox(mask, original.width, original.height), cutouts: new Map() };
}

const CURVES: Record<Edge, [number, number]> = { soft: [0, 1], normal: [0.08, 0.92], sharp: [0.35, 0.65] };

function cutout(p: Prepared, edge: Edge) {
  const cached = p.cutouts.get(edge);
  if (cached) return cached;
  const { mask, original } = p;
  const [lo, hi] = CURVES[edge];
  const small = document.createElement("canvas");
  small.width = mask.width;
  small.height = mask.height;
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) {
    const a = Math.min(1, Math.max(0, (mask.data[i] / 255 - lo) / (hi - lo)));
    img.data[i * 4 + 3] = Math.round(a * 255);
  }
  sctx.putImageData(img, 0, 0);

  const out = document.createElement("canvas");
  out.width = original.width;
  out.height = original.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(original, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, out.width, out.height);
  p.cutouts.set(edge, out);
  return out;
}

function frame(p: Prepared, opts: Options, maxSide: number) {
  const box = opts.trim ? p.bbox : { x: 0, y: 0, w: p.original.width, h: p.original.height };
  const s = Math.min(1, maxSide / Math.max(box.w, box.h));
  return { box, w: Math.max(1, Math.round(box.w * s)), h: Math.max(1, Math.round(box.h * s)) };
}

export function previewSize(p: Prepared, opts: Options, maxSide: number) {
  const { w, h } = frame(p, opts, maxSide);
  return { w, h };
}

export function renderOriginal(p: Prepared, opts: Options, maxSide: number, target?: HTMLCanvasElement) {
  const { box, w, h } = frame(p, opts, maxSide);
  const c = target ?? document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(p.original, box.x, box.y, box.w, box.h, 0, 0, w, h);
  return c;
}

export function renderResult(p: Prepared, opts: Options, maxSide: number, target?: HTMLCanvasElement, format: Format = "png") {
  const { box, w, h } = frame(p, opts, maxSide);
  const c = target ?? document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";

  const bg = opts.background;
  if (bg.kind === "color") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.kind === "blur") {
    const radius = Math.max(w, h) * (bg.strength === "light" ? 0.012 : 0.03);
    ctx.save();
    ctx.filter = `blur(${radius}px)`;
    const grow = radius * 3;
    ctx.drawImage(p.original, box.x, box.y, box.w, box.h, -grow, -grow, w + grow * 2, h + grow * 2);
    ctx.restore();
  } else if (format === "jpg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }

  const cut = cutout(p, opts.edge);
  if (opts.shadow) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = Math.max(w, h) * 0.035;
    ctx.shadowOffsetY = Math.max(w, h) * 0.018;
    ctx.drawImage(cut, box.x, box.y, box.w, box.h, 0, 0, w, h);
    ctx.restore();
  }
  ctx.drawImage(cut, box.x, box.y, box.w, box.h, 0, 0, w, h);
  return c;
}

export async function exportImage(p: Prepared, opts: Options, format: Format) {
  const c = renderResult(p, opts, Infinity, undefined, format);
  const type = format === "png" ? "image/png" : "image/jpeg";
  return new Promise<Blob>((r) => c.toBlob((b) => r(b!), type, 0.92));
}
