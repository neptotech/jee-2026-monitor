const fetch = require("node-fetch");
const crypto = require("crypto");

module.exports = async (req, res) => {
  // CORS headers so any frontend can call this
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const url = req.query.url || "https://jeemain.nta.nic.in/";

  // Basic safety: only allow checking specific domains
  const allowed = ["jeemain.nta.nic.in", "nta.ac.in", "ntaresults.nic.in", "nta.nic.in"];
  try {
    const hostname = new URL(url).hostname;
    if (!allowed.some((d) => hostname === d || hostname.endsWith("." + d))) {
      return res.status(403).json({ success: false, error: "Domain not allowed" });
    }
  } catch {
    return res.status(400).json({ success: false, error: "Invalid URL" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    const content = await response.text();
    const hash = crypto.createHash("md5").update(content).digest("hex");

    res.json({
      success: true,
      hash,
      status: response.status,
      contentLength: content.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
};
