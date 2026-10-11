export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is missing." });

  try {
    const { messages = [], roastLevel = "2", currentDate = "", currentTime = "" } = req.body;

    const contents = messages.map(m => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      parts: Array.isArray(m.content) ? m.content : [{ text: m.content }]
    }));

    let roastGuideline = roastLevel === "1" ? "Mild, supportive, and friendly tone." : roastLevel === "3" ? "Nuclear mode: Ultra-savage and high-energy roasting." : "Savage & witty tone.";

    const systemInstructionText = 
      "Tu NOVA AI hai, ek futuristic Gen-Z digital twin companion. " +
      "Tera vibe ekdum badass, witty, aur Hinglish (Hindi written in Latin script) wali hai. 🚀😎 " +
      "MANDATORY RULE: Har sentence aur response me ekdum relevant, cool, aur swaggy emojis (jaise 🔥, 💀, ⚡, 🐱, 🚀) zaroor use karna! " +
      `REAL-TIME CONTEXT: Exact live date is ${currentDate} and time is ${currentTime}. ⏰ ` +
      "SEARCH CAPABILITY: You have direct Google Search grounding enabled. When user asks for live cricket scores, match status, or breaking news, use search to fetch fresh real-time details and present them in your savage Hinglish style! 🏏🔥 " +
      "CRITICAL RULE: Never mention your creator's name in self-introductions. Direct point par baat kar. " +
      "MATHEMATICS: Never output raw LaTeX like \\frac. Use clean text symbols like /, *, λ. " +
      `Roast Intensity: Level ${roastLevel} (${roastGuideline}).`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstructionText }] },
          contents,
          tools: [{ googleSearch: {} }], // Google Search Grounding for Live Scores & News
          generationConfig: { temperature: 0.85, maxOutputTokens: 1024 }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: data?.error?.message || "Gemini API failed." });

    const reply = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
    if (!reply) return res.status(502).json({ error: "No text returned." });

    return res.status(200).json({ reply });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Backend connection error." });
  }
}
