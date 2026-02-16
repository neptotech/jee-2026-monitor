const express = require("express");
const fetch = require("node-fetch");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// API endpoint to fetch target website content
app.get("/api/check", async (req, res) => {
  const url = req.query.url || "https://jeemain.nta.nic.in/";
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
      snippet: content.substring(0, 500),
    });
  } catch (err) {
    res.json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n  🚀 JEE 2026 Live Monitor running at:`);
  console.log(`  ➜  http://localhost:${PORT}\n`);
});
