import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outdir = path.join(root, "dist");

async function copyStaticFiles() {
  await mkdir(path.join(outdir, "vendor/hash-wasm"), { recursive: true });

  await Promise.all([
    copyFile(path.join(root, "index.html"), path.join(outdir, "index.html")),
    copyFile(path.join(root, "src/style.css"), path.join(outdir, "style.css")),
    copyFile(
      path.join(root, "node_modules/hash-wasm/dist/index.esm.js"),
      path.join(outdir, "vendor/hash-wasm/index.esm.js"),
    ),
  ]);
}

await mkdir(outdir, { recursive: true });
await copyStaticFiles();
