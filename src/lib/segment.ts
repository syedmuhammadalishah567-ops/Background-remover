export type Mask = { data: Uint8Array; width: number; height: number };

export type Stage = { kind: "download"; loaded: number; total: number } | { kind: "working" };

type WorkerMsg =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready" }
  | { type: "mask"; id: number; width: number; height: number; data: Uint8Array }
  | { type: "error"; id: number; message: string };

let worker: Worker | null = null;
let nextId = 1;

function getWorker() {
  if (!worker) worker = new Worker(new URL("./segment.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

export function preloadModel() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /(^|-)2g|3g/.test(conn?.effectiveType ?? "")) return;
  getWorker().postMessage({ preload: true });
}

export function removeBackground(input: Blob, onStage: (s: Stage) => void): Promise<Mask> {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<WorkerMsg>) => {
      const m = e.data;
      if (m.type === "progress") onStage({ kind: "download", loaded: m.loaded, total: m.total });
      else if (m.type === "ready") onStage({ kind: "working" });
      else if (m.id === id) {
        w.removeEventListener("message", onMessage);
        if (m.type === "error") reject(new Error(m.message));
        else resolve({ data: m.data, width: m.width, height: m.height });
      }
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, blob: input });
  });
}
