/**
 * Tiny local server mirroring Vercel's static + /api layout for ONE app:
 *   node scripts/dev-server.mjs run 4181
 * Serves apps/<name>/ statically and routes /api/<fn> to the default export
 * of apps/<name>/api/<fn>.mjs (Node (req,res) handlers, same as Vercel).
 */
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const app = process.argv[2] ?? "ink";
const port = Number(process.argv[3] ?? 4180);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", app);
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const path = url.pathname;
  if (path.startsWith("/api/")) {
    const fn = path.slice(5).split("/").map((s) => s.replace(/[^a-z0-9_-]/gi, "")).filter(Boolean).join("/");
    const file = join(root, "api", fn + ".mjs");
    if (!existsSync(file)) { res.writeHead(404).end("no such function"); return; }
    const mod = await import(pathToFileURL(file));
    // minimal res.status().json() shim
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); return res; };
    return mod.default(req, res);
  }
  const file = join(root, path === "/" ? "index.html" : path.slice(1));
  if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.setHeader("content-type", MIME[extname(file)] ?? "application/octet-stream");
  res.end(readFileSync(file));
}).listen(port, () => console.log(`serving apps/${app} on http://localhost:${port}`));
