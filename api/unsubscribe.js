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
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    let username = (body.username || "").trim().replace(/^@/, "");

    if (!username) return res.status(400).json({ error: "Username is required" });

    const kv = getRedis();
    const removed = await kv.srem("callmebot_users", username);
    const count = await kv.scard("callmebot_users");

    res.json({
      success: true,
      message: removed ? `@${username} unsubscribed` : `@${username} was not subscribed`,
      totalSubscribers: count,
    });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
};
