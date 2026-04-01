import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const root = path.join(process.cwd(), "dist");
const port = Number(process.env.PORT ?? 4173);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

function sendNotFound(response) {
  response.statusCode = 404;
  response.setHeader("content-type", "text/plain; charset=utf-8");
  response.end("Not found");
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(root, `.${pathname}`);

  if (!filePath.startsWith(root)) {
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
  console.log(`Preview server running at http://localhost:${port}`);
});
