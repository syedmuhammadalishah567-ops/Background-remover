# Cutline: background remover

Removes image backgrounds in the browser with open-source AI. There are no servers or API costs.

- **Model:** ORMBG (Open Remove Background, Apache 2.0) through transformers.js in a Web Worker. It uses WebGPU fp16 (88 MB) when available and WASM q8 (44 MB) otherwise.
- **Preload:** the model starts downloading 2 seconds after the page opens, except when Data Saver is on or the connection is 2G/3G, so it's usually ready before the first photo.
- **Output:** full resolution (up to 4096 px) as PNG or JPG, with a transparent, color or blurred background, edge sharpness, drop shadow and trim to subject.

## Run locally

```bash
npm install
npm run dev
```

## Where things live

- `src/lib/segment.worker.ts` and `src/lib/segment.ts`: the AI model and preloading.
- `src/lib/compose.ts`: mask edges, backgrounds, shadow, trim and export.
- `src/components/Remover.tsx`: the tool UI.

## Turning on ads

Set `NEXT_PUBLIC_SITE_URL`, apply for AdSense, then add `NEXT_PUBLIC_ADSENSE_CLIENT` and the slot IDs from `.env.example`.

Before launch, replace `hello@example.com` in the About and Privacy pages.
