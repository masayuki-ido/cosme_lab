#!/usr/bin/env node
// 確認用の簡易サーバー。GitHub Pages と同じ /cosme_lab/ 配下で dist/ を配信する。
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { SITE } from "../src/lib/site.mjs";
import { ROOT } from "../src/lib/data.mjs";

const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT || 4321);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8" };

createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") { res.writeHead(302, { Location: SITE.base }); return res.end(); }
  if (!p.startsWith(SITE.base)) { res.writeHead(404); return res.end("outside base"); }
  p = p.slice(SITE.base.length - 1);
  let f = join(DIST, p);
  try {
    if ((await stat(f)).isDirectory()) f = join(f, "index.html");
  } catch { f = p.endsWith("/") ? join(DIST, p, "index.html") : f; }
  try {
    const buf = await readFile(f);
    res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" });
    res.end(buf);
  } catch {
    const buf = await readFile(join(DIST, "404.html")).catch(() => "404");
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(buf);
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}${SITE.base}`));
