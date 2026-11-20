"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preloadModel, removeBackground, type Stage } from "@/lib/segment";
import {
  exportImage,
  loadImage,
  prepare,
  previewSize,
  renderOriginal,
  renderResult,
  type Background,
  type Edge,
  type Format,
  type Options,
  type Prepared,
} from "@/lib/compose";
import styles from "./Remover.module.css";

type Item = {
  id: number;
  name: string;
  file: File;
  url: string;
  status: "queued" | "working" | "done" | "error";
  prepared?: Prepared;
};

const SWATCHES = ["#ffffff", "#f1f1ef", "#111111", "#ffd84d", "#ff8fb1", "#7fd6c2", "#2f5bff"];
const PREVIEW_SIDE = 1600;

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

let nextId = 1;

export default function Remover() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bgKind, setBgKind] = useState<Background["kind"]>("transparent");
  const [color, setColor] = useState("#ffffff");
  const [blur, setBlur] = useState<"light" | "strong">("strong");
  const [edge, setEdge] = useState<Edge>("normal");
  const [shadow, setShadow] = useState(false);
  const [trim, setTrim] = useState(false);
  const [format, setFormat] = useState<Format>("png");
  const [pos, setPos] = useState(50);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const origRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef<HTMLCanvasElement>(null);
  const queue = useRef<Item[]>([]);
  const pumping = useRef(false);
  const activeRef = useRef<number | null>(null);

  const active = items.find((i) => i.id === activeId) ?? null;
  const background: Background =
    bgKind === "color" ? { kind: "color", color } : bgKind === "blur" ? { kind: "blur", strength: blur } : { kind: "transparent" };
  const opts: Options = { background, edge, shadow, trim };
  const optsKey = JSON.stringify(opts);

  const update = (id: number, patch: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const reveal = useCallback(() => {
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 1100);
      const e = 1 - Math.pow(1 - p, 3);
      setPos(100 - 50 * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  const pump = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    while (queue.current.length) {
      const item = queue.current.shift()!;
      update(item.id, { status: "working" });
      try {
        const { image, modelInput } = await loadImage(item.file);
        const mask = await removeBackground(modelInput, setStage);
        update(item.id, { status: "done", prepared: prepare(image, mask) });
        if (activeRef.current === item.id) reveal();
      } catch (err) {
        console.error("[cutline]", err);
        update(item.id, { status: "error" });
        setError(
          err instanceof Error && /decode|InvalidState|source image/i.test(err.message)
            ? `${item.name} couldn't be opened. Use a JPG, PNG or WebP photo.`
            : "The AI model couldn't run. Check your connection, then try again in Chrome or Edge.",
        );
      }
    }
    setStage(null);
    pumping.current = false;
  }, [reveal]);

  const addFiles = useCallback(
    (files: FileList | File[] | null | undefined) => {
      const images = [...(files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (!images.length) {
        if (files && [...files].length) setError("Those files aren't images. Use JPG, PNG or WebP photos.");
        return;
      }
      setError(null);
      const added: Item[] = images.map((file) => ({
        id: nextId++,
        name: file.name || "pasted-image.png",
        file,
        url: URL.createObjectURL(file),
        status: "queued",
      }));
      setItems((list) => [...list, ...added]);
      activeRef.current = added[0].id;
      setActiveId(added[0].id);
      setPos(100);
      queue.current.push(...added);
      pump();
      requestAnimationFrame(() =>
        document.querySelector('[aria-label="Background remover"]')?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    },
    [pump],
  );

  useEffect(() => {
    const t = setTimeout(preloadModel, 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items ?? [])]
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length) addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  useEffect(() => {
    const p = active?.prepared;
    if (!p || !origRef.current || !resultRef.current) return;
    const parsed = JSON.parse(optsKey) as Options;
    renderOriginal(p, parsed, PREVIEW_SIDE, origRef.current);
    renderResult(p, parsed, PREVIEW_SIDE, resultRef.current);
  }, [active?.prepared, optsKey]);

  const frameSize = active?.prepared ? previewSize(active.prepared, opts, PREVIEW_SIDE) : { w: 0, h: 0 };

  const fit = (() => {
    if (!frameSize.w || !box.w) return { w: 0, h: 0 };
    const s = Math.min(box.w / frameSize.w, box.h / frameSize.h);
    return { w: Math.floor(frameSize.w * s), h: Math.floor(frameSize.h * s) };
  })();

  function moveTo(clientX: number) {
    const r = frameRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }

  async function download(item: Item) {
    if (!item.prepared) return;
    setSaving(true);
    try {
      const blob = await exportImage(item.prepared, opts, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${item.name.replace(/\.[^.]+$/, "")}-no-bg.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setSaving(false);
    }
  }

  async function downloadAll() {
    for (const item of items) {
      if (item.status === "done") {
        await download(item);
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  function removeItem(id: number) {
    queue.current = queue.current.filter((i) => i.id !== id);
    setItems((list) => {
      const gone = list.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      const rest = list.filter((i) => i.id !== id);
      if (activeId === id) {
        const next = rest[rest.length - 1]?.id ?? null;
        activeRef.current = next;
        setActiveId(next);
      }
      return rest;
    });
  }

  const doneCount = items.filter((i) => i.status === "done").length;
  const pct = stage?.kind === "download" && stage.total ? stage.loaded / stage.total : 0;
  const progress =
    active?.status === "queued"
      ? { label: "Waiting for the photo before it", note: "Photos are cut out one at a time", pct: null }
      : stage?.kind === "download" && pct < 1
        ? { label: `Downloading AI model · ${Math.round(pct * 100)}%`, note: "One-time download, then saved by your browser", pct }
        : stage?.kind === "download"
          ? { label: "Starting the AI model", note: "Only the first photo takes this long", pct: null }
          : { label: "Cutting out the background", note: "Usually a few seconds", pct: null };

  return (
    <section
      className={`${styles.tool} ${dragging ? styles.dragging : ""}`}
      aria-label="Background remover"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {items.length === 0 ? (
        <button className={styles.drop} onClick={() => fileRef.current?.click()}>
          <span className={styles.dropTitle}>Drop photos here</span>
          <span className={styles.dropSub}>or click to choose. You can also paste an image. Several at once is fine.</span>
          <span className={styles.dropMeta}>JPG · PNG · WebP · up to 4096 px</span>
        </button>
      ) : (
        <div className={styles.workspace}>
          <div className={styles.left}>
            <div className={styles.stage} ref={stageRef}>
              {active?.status === "done" ? (
                <div
                  ref={frameRef}
                  className={`${styles.frame} ${bgKind === "transparent" && format === "png" ? styles.checker : ""}`}
                  style={{ width: fit.w, height: fit.h }}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    moveTo(e.clientX);
                  }}
                  onPointerMove={(e) => e.buttons === 1 && moveTo(e.clientX)}
                >
                  <canvas ref={origRef} className={styles.layer} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
                  <canvas ref={resultRef} className={styles.layer} style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
                  <div className={styles.cut} style={{ left: `${pos}%` }}>
                    <span className={styles.knob} aria-hidden>
                      <svg viewBox="0 0 20 12">
                        <path d="M6 1 1 6l5 5M14 1l5 5-5 5" />
                      </svg>
                    </span>
                  </div>
                  <span className={`${styles.tag} ${styles.tagL}`} style={{ opacity: pos > 12 ? 1 : 0 }}>
                    Original
                  </span>
                  <span className={`${styles.tag} ${styles.tagR}`} style={{ opacity: pos < 88 ? 1 : 0 }}>
                    Cutout
                  </span>
                  <input
                    className={styles.range}
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(pos)}
                    aria-label="Compare original and cutout"
                    onChange={(e) => setPos(Number(e.target.value))}
                  />
                </div>
              ) : active ? (
                <div className={styles.pending}>
                  <div className={`${styles.pendingFrame} ${active.status === "error" ? "" : "ants"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={active.url} alt="" className={styles.pendingImg} />
                  </div>
                  {active.status === "error" ? (
                    <div className={styles.progress}>
                      <span className={styles.progressLabel}>This photo couldn&rsquo;t be processed</span>
                      <span className={styles.progressNote}>Remove it and try another JPG, PNG or WebP.</span>
                    </div>
                  ) : (
                    <div className={styles.progress} role="status">
                      <span className={styles.progressLabel}>{progress.label}</span>
                      <span className={styles.bar}>
                        <span
                          className={`${styles.barFill} ${progress.pct === null ? styles.barIndeterminate : ""}`}
                          style={progress.pct === null ? undefined : { width: `${progress.pct * 100}%` }}
                        />
                      </span>
                      <span className={styles.progressNote}>{progress.note}</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className={styles.strip}>
              {items.map((i) => (
                <div key={i.id} className={`${styles.thumb} ${i.id === activeId ? styles.thumbOn : ""}`}>
                  <button
                    className={styles.thumbBtn}
                    onClick={() => {
                      activeRef.current = i.id;
                      setActiveId(i.id);
                      setPos(50);
                    }}
                    aria-label={`Show ${i.name}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i.url} alt="" />
                    {i.status !== "done" && <span className={styles.thumbState}>{i.status === "error" ? "!" : "…"}</span>}
                  </button>
                  <button className={styles.thumbX} onClick={() => removeItem(i.id)} aria-label={`Remove ${i.name}`}>
                    ×
                  </button>
                </div>
              ))}
              <button className={styles.add} onClick={() => fileRef.current?.click()}>
                + Add
              </button>
            </div>
          </div>

          <div className={styles.panel}>
            <fieldset className={styles.group}>
              <legend className={styles.legend}>Background</legend>
              <Segmented
                label="Background"
                value={bgKind}
                onChange={setBgKind}
                options={[
                  { id: "transparent", label: "Transparent" },
                  { id: "color", label: "Color" },
                  { id: "blur", label: "Blur" },
                ]}
              />
              {bgKind === "color" && (
                <div className={styles.swatches}>
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      className={styles.swatch}
                      style={{ background: c }}
                      aria-label={`Background ${c}`}
                      aria-pressed={color === c}
                      onClick={() => setColor(c)}
                    />
                  ))}
                  <label className={`${styles.swatch} ${styles.custom}`} title="Pick any color">
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Custom color" />
                  </label>
                </div>
              )}
              {bgKind === "blur" && (
                <Segmented
                  label="Blur strength"
                  value={blur}
                  onChange={setBlur}
                  options={[
                    { id: "light", label: "Light blur" },
                    { id: "strong", label: "Strong blur" },
                  ]}
                />
              )}
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.legend}>Edges</legend>
              <Segmented
                label="Edge sharpness"
                value={edge}
                onChange={setEdge}
                options={[
                  { id: "soft", label: "Soft" },
                  { id: "normal", label: "Normal" },
                  { id: "sharp", label: "Sharp" },
                ]}
              />
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.legend}>Extras</legend>
              <label className={styles.toggle}>
                <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} />
                <span>
                  <strong>Drop shadow</strong>
                  <small>Grounds products on a plain background</small>
                </span>
              </label>
              <label className={styles.toggle}>
                <input type="checkbox" checked={trim} onChange={(e) => setTrim(e.target.checked)} />
                <span>
                  <strong>Trim to subject</strong>
                  <small>Crops away empty space around it</small>
                </span>
              </label>
            </fieldset>

            <div className={styles.save}>
              <Segmented
                label="File format"
                value={format}
                onChange={setFormat}
                options={[
                  { id: "png", label: "PNG" },
                  { id: "jpg", label: "JPG" },
                ]}
              />
              {format === "jpg" && bgKind === "transparent" && (
                <p className={styles.note}>JPG can&rsquo;t be transparent, so the background will be white.</p>
              )}
              <button
                className={styles.primary}
                disabled={active?.status !== "done" || saving}
                onClick={() => active && download(active)}
              >
                {saving ? "Saving…" : `Download ${format.toUpperCase()}`}
              </button>
              {doneCount > 1 && (
                <button className={styles.secondary} onClick={downloadAll} disabled={saving}>
                  Download all {doneCount}
                </button>
              )}
              <p className={styles.note}>Full resolution. Free, no watermark, no sign-up.</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
