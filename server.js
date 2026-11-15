const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get(["/style.css", "/script.js"], (req, res) => {
  res.sendFile(path.join(__dirname, req.path));
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Safe Walk Buddy",
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash"
  });
});

// GEMINI AI CHECK-IN
app.post("/api/ai-checkin", async (req, res) => {
  try {
    const text =
      typeof req.body.text === "string"
        ? req.body.text.trim()
        : "";

    if (!text || text.length > 500) {
      return res.status(400).json({
        error: "Enter a check-in of up to 500 characters."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: "Gemini API key is not configured."
      });
    }

    const model =
      process.env.GEMINI_MODEL || "gemini-3.8-flash";

    const prompt = `
You are a cautious check-in assistant
inside a student safety prototype.

Classify the user's check-in as exactly one:
OK, NEEDS_SUPPORT, or URGENT.

Do not claim to know the user's actual safety
or location.

If wording is ambiguous, choose NEEDS_SUPPORT.

Return only JSON with:
category
reply

Keep reply under 45 words.
Reply in the same language the user wrote in (Tamil, Tanglish or English).

If the user says they are in immediate danger,
advise contacting local emergency services
and a trusted person now.

User check-in: ${JSON.stringify(text)}
`;

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],

        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error:
          payload?.error?.message ||
          "Gemini request failed."
      });
    }

    const raw =
      payload?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("") || "";

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        category: "NEEDS_SUPPORT",
        reply:
          "I could not interpret that check-in reliably. Please contact someone you trust if you need support."
      };
    }

    const allowed = [
      "OK",
      "NEEDS_SUPPORT",
      "URGENT"
    ];

    const category = allowed.includes(parsed.category)
      ? parsed.category
      : "NEEDS_SUPPORT";

    const reply =
      typeof parsed.reply === "string"
        ? parsed.reply.slice(0, 300)
        : "Please check in with someone you trust.";

    res.json({
      category,
      reply
    });

  } catch (error) {
    console.error("AI check-in error:", error);

    res.status(500).json({
      error: "Server error while processing check-in."
    });
  }
});
app.get("/api/models", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "No API key set." });
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
  );
  const d = await r.json();
  res.json(
    (d.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => m.name)
  );
});
app.listen(PORT, () => {
  console.log(
    `Safe Walk Buddy running at http://localhost:${PORT}`
  );
});
