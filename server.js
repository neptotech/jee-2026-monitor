const express = require("express");
const fetch = require("node-fetch");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = 3000;

// ── Shared cache – one check serves ALL users ──
const TARGET_URL = "https://jeemain.nta.nic.in/";
const CACHE_TTL = 15_000; // Fetch from NTA at most once per 15s

let cache = {
  hash: null,
  prevHash: null,
  httpStatus: null,
  contentLength: 0,
  lastChecked: null,
  changed: false,
  changeDetectedAt: null,
  error: null,
  checkCount: 0,
};

async function fetchFromNTA() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(TARGET_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    clearTimeout(timeout);

    const content = await response.text();
    const newHash = crypto.createHash("md5").update(content).digest("hex");

    cache.checkCount++;
    cache.httpStatus = response.status;
    cache.contentLength = content.length;
    cache.lastChecked = new Date().toISOString();
    cache.error = null;

    if (cache.hash && newHash !== cache.hash) {
      cache.prevHash = cache.hash;
      cache.changed = true;
      cache.changeDetectedAt = cache.lastChecked;
    }
    cache.hash = newHash;
  } catch (err) {
    cache.error = err.message;
    cache.lastChecked = new Date().toISOString();
  }
}

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// API endpoint – returns shared cached data
app.get("/api/check", async (req, res) => {
  const now = Date.now();
  const lastTime = cache.lastChecked ? new Date(cache.lastChecked).getTime() : 0;
  if (now - lastTime >= CACHE_TTL) {
    await fetchFromNTA();
  }

  res.json({
    success: !cache.error,
    url: TARGET_URL,
    hash: cache.hash,
    prevHash: cache.prevHash,
    httpStatus: cache.httpStatus,
    contentLength: cache.contentLength,
    lastChecked: cache.lastChecked,
    changed: cache.changed,
    changeDetectedAt: cache.changeDetectedAt,
    serverChecks: cache.checkCount,
    error: cache.error,
    cacheTTL: CACHE_TTL,
  });
});

app.listen(PORT, () => {
  console.log(`\n  🚀 JEE 2026 Live Monitor running at:`);
  console.log(`  ➜  http://localhost:${PORT}\n`);
});
