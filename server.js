#!/usr/bin/env node
// Lokalny serwer dev – zastępuje `netlify dev` na czas testów.
// Uruchom: node server.js
// Aplikacja dostępna na: http://localhost:8888

const http = require("http");
const fs   = require("fs");
const path = require("path");
const url  = require("url");

// Załaduj .env
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
  });
}

const PORT = 3000;
const MIME = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ── API routes ──────────────────────────────────────────────
  if (pathname === "/api/config" || pathname === "/.netlify/functions/config") {
    const { handler } = require("./netlify/functions/config.js");
    const result = await handler({});
    res.writeHead(result.statusCode, { "Content-Type": "application/json" });
    res.end(result.body);
    return;
  }

  if (pathname === "/api/movies" || pathname === "/.netlify/functions/movies") {
    const { handler } = require("./netlify/functions/movies.js");
    const result = await handler({ queryStringParameters: parsed.query });
    res.writeHead(result.statusCode, result.headers || { "Content-Type": "application/json" });
    res.end(result.body);
    return;
  }

  // ── Static files ────────────────────────────────────────────
  let filePath = path.join(__dirname, pathname === "/" ? "index.html" : pathname);

  // SPA fallback – dla tras z ?session= serwuj index.html
  if (!fs.existsSync(filePath)) filePath = path.join(__dirname, "index.html");

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  CineMatch dev server running at http://localhost:${PORT}\n`);
});
