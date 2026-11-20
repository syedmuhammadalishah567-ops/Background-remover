import { pipeline, RawImage, env, type BackgroundRemovalPipeline } from "@huggingface/transformers";

env.allowLocalModels = false;

const MODEL = "onnx-community/ormbg-ONNX";

type ProgressInfo = { status: string; file?: string; loaded?: number; total?: number };

let loading: Promise<BackgroundRemovalPipeline> | null = null;

async function pickDevice(): Promise<{ device: "webgpu" | "wasm"; dtype: "fp16" | "q8" }> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
    const adapter = await gpu?.requestAdapter();
    if (adapter?.features.has("shader-f16")) return { device: "webgpu", dtype: "fp16" };
  } catch {}
  return { device: "wasm", dtype: "q8" };
}

function load() {
  if (loading) return loading;
  loading = (async () => {
    const files = new Map<string, { loaded: number; total: number }>();
    const progress_callback = (p: ProgressInfo) => {
      if (p.status !== "progress" || !p.file || !p.total) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
      let loaded = 0;
      let total = 0;
      files.forEach((f) => {
        loaded += f.loaded;
        total += f.total;
      });
      self.postMessage({ type: "progress", loaded, total });
    };
    const { device, dtype } = await pickDevice();
    try {
      return (await pipeline("background-removal", MODEL, { device, dtype, progress_callback })) as BackgroundRemovalPipeline;
    } catch (err) {
      if (device === "wasm") throw err;
      return (await pipeline("background-removal", MODEL, { device: "wasm", dtype: "q8", progress_callback })) as BackgroundRemovalPipeline;
    }
  })();
  loading.catch(() => (loading = null));
  return loading;
}

self.onmessage = async (e: MessageEvent<{ id: number; blob: Blob } | { preload: true }>) => {
  if ("preload" in e.data) {
    load().catch(() => {});
    return;
  }
  const { id, blob } = e.data;
  try {
    const segmenter = await load();
    self.postMessage({ type: "ready" });
    const image = await RawImage.fromBlob(blob);
    const t0 = performance.now();
    const out = (await segmenter(image)) as RawImage;
    const n = out.width * out.height;
    const data = new Uint8Array(n);
    for (let i = 0; i < n; i++) data[i] = out.data[i * out.channels + out.channels - 1];
    self.postMessage({ type: "mask", id, width: out.width, height: out.height, data, ms: Math.round(performance.now() - t0) }, { transfer: [data.buffer] });
  } catch (err) {
    self.postMessage({ type: "error", id, message: err instanceof Error ? err.message : String(err) });
  }
};
