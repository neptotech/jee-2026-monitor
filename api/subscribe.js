const { Redis } = require("@upstash/redis");

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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Parse body (Vercel provides parsed body for JSON content-type)
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    let username = (body.username || "").trim().replace(/^@/, "");

    if (!username) return res.status(400).json({ error: "Username is required" });
    if (!/^[a-zA-Z0-9_]{3,}$/.test(username)) {
      return res.status(400).json({ error: "Invalid Telegram username format" });
    }

    const kv = getRedis();
    await kv.sadd("callmebot_users", username);
    const count = await kv.scard("callmebot_users");

    res.json({ success: true, message: `@${username} subscribed`, totalSubscribers: count });
  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ error: "Failed to subscribe. Is Upstash Redis configured?" });
  }
};
