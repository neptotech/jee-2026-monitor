const { Redis } = require("@upstash/redis");

let redis;
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  // Cache subscriber count for 30s to avoid hammering Redis
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=15");

  try {
    const kv = getRedis();
    const count = await kv.scard("callmebot_users");
    res.json({ success: true, count });
  } catch (err) {
    console.error("Subscribers count error:", err);
    res.status(500).json({ error: "Failed to get subscriber count" });
  }
};
