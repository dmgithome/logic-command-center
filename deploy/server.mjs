import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const viewerRoot = process.env.VIEWER_ROOT ?? "/home/dm/apps/logic-command-center/viewer";
const manifestsRoot = process.env.MANIFESTS_ROOT ?? "/home/dm/apps/logic-command-center/manifests";
const port = Number.parseInt(process.env.PORT ?? "8088", 10);

const mimeByExt = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
]);

function safeJoin(root, unsafePath) {
  const normalized = path.posix.normalize(unsafePath).replace(/^\/+/g, "");
  if (normalized.startsWith("..")) return null;
  return path.join(root, ...normalized.split("/"));
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendFile(res, absPath, reqPath) {
  const ext = path.extname(absPath).toLowerCase();
  const type = mimeByExt.get(ext) ?? "application/octet-stream";

  const headers = { "Content-Type": type };
  if (reqPath.startsWith("/assets/")) {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  } else {
    headers["Cache-Control"] = "no-cache";
  }

  const stream = fs.createReadStream(absPath);
  stream.on("error", () => send(res, 500, "internal error"));
  res.writeHead(200, headers);
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  if (!req.url) return send(res, 400, "bad request");

  const u = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(u.pathname);

  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "method not allowed");

  if (pathname === "/manifests") {
    res.writeHead(301, { Location: "/manifests/" });
    return res.end();
  }

  if (pathname.startsWith("/manifests/")) {
    const rel = pathname.slice("/manifests/".length);
    const abs = safeJoin(manifestsRoot, rel);
    if (!abs) return send(res, 400, "bad path");
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return send(res, 404, "not found");
    return sendFile(res, abs, pathname);
  }

  // Viewer static
  let rel = pathname;
  if (rel === "/") rel = "/index.html";
  const abs = safeJoin(viewerRoot, rel);
  if (abs && fs.existsSync(abs) && !fs.statSync(abs).isDirectory()) return sendFile(res, abs, pathname);

  // SPA fallback
  const indexAbs = path.join(viewerRoot, "index.html");
  if (fs.existsSync(indexAbs)) return sendFile(res, indexAbs, "/index.html");

  return send(res, 404, "not found");
});

server.listen(port, "0.0.0.0", () => {
  console.log("logic-viewer listening on :" + port);
  console.log("viewerRoot=" + viewerRoot);
  console.log("manifestsRoot=" + manifestsRoot);
});

