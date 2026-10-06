import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("dist");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 4000);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function resolveFile(urlPath) {
  const cleanPath = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const target = resolve(root, cleanPath === "/" ? "index.html" : cleanPath.slice(1));
  if (!target.startsWith(root)) return join(root, "index.html");
  if (existsSync(target) && statSync(target).isFile()) return target;
  return join(root, "index.html");
}

createServer((request, response) => {
  const file = resolveFile(request.url || "/");
  response.setHeader("content-type", types[extname(file)] || "application/octet-stream");
  createReadStream(file)
    .on("error", () => {
      response.statusCode = 404;
      response.end("Not found");
    })
    .pipe(response);
}).listen(port, host, () => {
  console.log(`Diamond Student Hub preview running at http://${host}:${port}`);
});
