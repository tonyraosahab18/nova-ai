export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const userAgent = req.headers['user-agent'] || '';
  if (!userAgent || (userAgent.includes('curl') && !authHeader)) {
    return res.status(403).json({ error: "Firewall Blocked: Unauthorized request." });
  }

  const body = req.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const roastLevel = body.roastLevel || "2";
  const currentDate = body.currentDate || new Date().toLocaleDateString();
  const currentTime = body.currentTime || "";

  const geminiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY
  ].filter(Boolean);

  if (geminiKeys.length === 0) {
    return res.status(500).json({ error: "No Gemini API keys found in Environment Variables." });
  }

  const contents = messages
    .filter((message) => message && ["user", "assistant", "model"].includes(message.role))
    .map((message) => {
      let parts = [];
      if (Array.isArray(message.content)) {
        parts = message.content;
      } else if (typeof message.content === "string" && message.content.trim()) {
        parts = [{ text: message.content }];
      }
      return {
        role: message.role === "assistant" || message.role === "model" ? "model" : "user",
        parts: parts
      };
    })
    .filter((msg) => msg.parts.length > 0);

  if (contents.length === 0 || !contents.some((message) => message.role === "user")) {
    return res.status(400).json({ error: "Please send a valid user message or image." });
  }

  let roastGuideline = "Savage & witty tone.";
  if (roastLevel === "1") {
    roastGuideline = "Mild, supportive, and friendly tone with light playful teasing.";
  } else if (roastLevel === "3") {
    roastGuideline = "Nuclear mode: Ultra-savage, unapologetic, high-energy roasting.";
  }

  const systemInstructionText = 
    "Tu NOVA AI hai, ek futuristic Gen-Z digital twin companion. " +
    "Tera vibe ekdum badass, witty, aur Hinglish (Hindi written in Latin script) wali hai. 🚀🔥 " +
    "MANDATORY EMOJI RULE: Har sentence aur response me ekdum relevant, cool, aur swaggy emojis (jaise 🔥, 💀, ⚡, 🐱, 🚀, 😎) zaroor use karna! " +
    `REAL-TIME CONTEXT: Exact live date is ${currentDate} and time is ${currentTime}. ⏰ ` +
    "CRITICAL RULE: Baar-baar apne creator ka naam ya introduction dene ki bilkul zarurat nahi hai. Direct point par baat kar. " +
    "MATHEMATICS & SYMBOLS FORMATTING RULE: NEVER output raw LaTeX syntax like fractions or complex backslash math commands. Always format equations, fractions, and symbols using clean, natural text, standard symbols (like /, *, +, -, ^), or simple Markdown. " +
    `Roast Level Mode: Selected Roast Intensity = Level ${roastLevel} (${roastGuideline}). ` +
    "IMPORTANT: Bar-bar CHAOS.EXE ka link mat dena! Sirf tabhi CHAOS.EXE visit karne ko kehna jab user explicitly bole ki wo bohot stress me hai ya bore ho raha hai. " +
    "Swag aur tone hamesha top-notch honi chahiye aur response hamesha Hindi (Latin) yani Hinglish me hona chahiye.";

  // Random key rotation for lightning fast load distribution
  const selectedKey = geminiKeys[Math.floor(Math.random() * geminiKeys.length)];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${selectedKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstructionText }] },
          contents,
          generationConfig: { temperature: 0.85, maxOutputTokens: 1024 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      return res.status(502).json({ error: data?.error?.message || "AI core temporary glitch! ⚡" });
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({ error: "Empty response from AI core." });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("NOVA backend error:", error);
    return res.status(500).json({ error: "Server connection error." });
  }
}
