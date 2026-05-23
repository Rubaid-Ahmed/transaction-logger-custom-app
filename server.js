const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { createDefaultState, createDemoState } = require("./backend/default-state");
const { loadState, saveState, getDataPath } = require("./backend/store");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8500);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, infos] of Object.entries(interfaces)) {
    for (const info of infos || []) {
      if (info.family === "IPv4" && !info.internal && !info.address.startsWith("169.254.")) {
        candidates.push({ name, address: info.address });
      }
    }
  }

  const physical = candidates.find((candidate) => {
    const looksVirtual = /virtual|vbox|vmware|hyper-v|vethernet|docker|wsl|loopback|bluetooth|npcap/i.test(
      candidate.name
    );
    const commonHostOnlyRange = candidate.address.startsWith("192.168.56.");
    return !looksVirtual && !commonHostOnlyRange;
  });

  return physical?.address || candidates[0]?.address || "127.0.0.1";
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=120"
    });
    res.end(data);
  });
}

function readRequestJson(req, callback) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 5 * 1024 * 1024) {
      req.destroy();
    }
  });
  req.on("end", () => {
    try {
      callback(null, body ? JSON.parse(body) : {});
    } catch (error) {
      callback(error);
    }
  });
}

function handleApi(req, res, pathname) {
  if (pathname === "/api/health") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      app: "Custom Transaction Logger",
      dataPath: getDataPath(),
      localUrl: `http://127.0.0.1:${PORT}`,
      networkUrl: `http://${getLocalIp()}:${PORT}`
    });
    return true;
  }

  if (pathname === "/api/state") {
    if (req.method === "GET") {
      sendJson(res, 200, loadState());
      return true;
    }

    if (req.method === "PUT") {
      readRequestJson(req, (error, payload) => {
        if (error) {
          sendJson(res, 400, { error: "Invalid JSON payload" });
          return;
        }
        saveState(payload);
        sendJson(res, 200, { ok: true, savedAt: new Date().toISOString() });
      });
      return true;
    }

    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  }

  if (pathname === "/api/default-state") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return true;
    }
    sendJson(res, 200, createDefaultState());
    return true;
  }

  if (pathname === "/api/demo-state") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return true;
    }
    sendJson(res, 200, createDemoState());
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (handleApi(req, res, requestUrl.pathname)) {
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  sendFile(res, filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`Custom Transaction Logger running at http://127.0.0.1:${PORT}`);
  console.log(`Network testing URL: http://${getLocalIp()}:${PORT}`);
  console.log(`Data file: ${getDataPath()}`);
});
