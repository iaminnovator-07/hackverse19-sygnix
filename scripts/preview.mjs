import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const port = Number(process.env.PORT || 4173);

if (!existsSync(dist)) {
  console.error("dist folder not found. Run `npm run build` first.");
  process.exit(1);
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

http
  .createServer((req, res) => {
    const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const filePath = path.join(dist, urlPath);
    const safePath = filePath.startsWith(dist) ? filePath : path.join(dist, "index.html");
    const target = existsSync(safePath) ? safePath : path.join(dist, "index.html");
    const ext = path.extname(target).toLowerCase();

    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain; charset=utf-8" });
    createReadStream(target).pipe(res);
  })
  .listen(port, () => {
    console.log(`Preview available at http://localhost:${port}`);
  });
