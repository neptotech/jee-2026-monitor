const fetch = require("node-fetch");
const crypto = require("crypto");
const { notifyAll } = require("./notify.js");

// ── Shared cache – persists across warm Vercel invocations ──
// All users share this single cached result, so target gets hit only once per cycle
const TARGET_URL = "https://stackoverflow.com/questions";
const CACHE_TTL = 15_000; // Re-fetch at most once every 15 seconds

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
  notificationSent: false, // Prevent duplicate CallMeBot notifications
  notifiedCount: 0,
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
        "Accept-Language": "en-US,en;q=0.9",
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

    // Detect change (only after first baseline is set)
    if (cache.hash && newHash !== cache.hash) {
      cache.prevHash = cache.hash;
      cache.changed = true;
      cache.changeDetectedAt = cache.lastChecked;

      // ── Notify all CallMeBot subscribers (only once per change) ──
      if (!cache.notificationSent) {
        cache.notificationSent = true;
        try {
          const msg = "A new change occurred on StackOverflow! This is a test from the Monitor via CallMeBot reaching you.";
          const result = await notifyAll(msg);
          cache.notifiedCount = result.notified;
          console.log(`CallMeBot: notified ${result.notified}/${result.total} subscribers`);
        } catch (notifyErr) {
          console.error("CallMeBot notification error:", notifyErr.message);
        }
      }
    }

    cache.hash = newHash;
  } catch (err) {
    cache.error = err.message;
    cache.lastChecked = new Date().toISOString();
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  // ── KEY OPTIMIZATION: Vercel Edge CDN caching ──
  // s-maxage=15  → Vercel CDN caches this response for 15s at 300+ edge locations
  //                 ALL user requests in that window are served from CDN (zero function invocations)
  // stale-while-revalidate=10 → After 15s, CDN serves stale data instantly while refreshing in background
  // Result: even 100,000 users → only ~4 function invocations per minute
  res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=10");

  // Only re-fetch from NTA if cache is stale
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
    notifiedCount: cache.notifiedCount,
  });
};
