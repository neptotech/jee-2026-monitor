const { Redis } = require("@upstash/redis");
const fetch = require("node-fetch");

let redis;
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

const CALLMEBOT_BASE = "http://api.callmebot.com/start.php";
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Notify a single user via CallMeBot
 */
async function callUser(username, message) {
  const encodedMsg = encodeURIComponent(message);
  const url = `${CALLMEBOT_BASE}?source=auth&user=@${username}&text=${encodedMsg}&lang=en-US-Standard-B`;
  try {
    const resp = await fetch(url, { timeout: 10000 });
    return { username, status: resp.status, ok: resp.ok };
  } catch (err) {
    return { username, status: 0, ok: false, error: err.message };
  }
}

/**
 * Notify all subscribers in batched parallel.
 * Called from check.js when a change is detected, or directly via POST for testing.
 */
async function notifyAll(message) {
  const kv = getRedis();
  const users = await kv.smembers("callmebot_users");

  if (!users || users.length === 0) {
    return { notified: 0, total: 0, results: [] };
  }

  const allResults = [];

  // Process in batches to avoid overwhelming CallMeBot
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((u) => callUser(u, message))
    );
    results.forEach((r) => {
      allResults.push(r.status === "fulfilled" ? r.value : { error: r.reason });
    });

    // Small delay between batches
    if (i + BATCH_SIZE < users.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const succeeded = allResults.filter((r) => r.ok).length;
  return { notified: succeeded, total: users.length, results: allResults };
}

// Export notifyAll for use from check.js
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const message = body.message || "A new change occurred on JEE official site! This is from JEE Monitor via CallMeBot reaching you.";

    const result = await notifyAll(message);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Notify error:", err);
    res.status(500).json({ error: "Failed to send notifications" });
  }
};

// Also export notifyAll for internal use
module.exports.notifyAll = notifyAll;
