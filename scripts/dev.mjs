import { watch } from "node:fs";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";

const root = process.cwd();
const outdir = path.join(root, "dist");
const port = Number(process.env.PORT ?? 5173);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

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

function sendNotFound(response) {
  response.statusCode = 404;
  response.setHeader("content-type", "text/plain; charset=utf-8");
  response.end("Not found");
}

await rm(outdir, { force: true, recursive: true });
await mkdir(outdir, { recursive: true });
await copyStaticFiles();

const compiler = spawn("node", ["node_modules/typescript/lib/tsc.js", "--project", "tsconfig.build.json", "--watch"], {
  cwd: root,
  stdio: "inherit",
});

watch(path.join(root, "index.html"), async () => {
  await copyFile(path.join(root, "index.html"), path.join(outdir, "index.html"));
  console.log("updated dist/index.html");
});

watch(path.join(root, "src/style.css"), async () => {
  await copyFile(path.join(root, "src/style.css"), path.join(outdir, "style.css"));
  console.log("updated dist/style.css");
});

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(outdir, `.${pathname}`);

  if (!filePath.startsWith(outdir)) {
    sendNotFound(response);
    return;
  }

  try {
    const body = await readFile(filePath);
    response.statusCode = 200;
    response.setHeader("content-type", contentTypes.get(path.extname(filePath)) ?? "application/octet-stream");
    response.end(body);
  } catch {
    sendNotFound(response);
  }
});

server.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
});

async function shutdown() {
  compiler.kill("SIGINT");
  server.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
