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
    "MATHEMATICS & SYMBOLS FORMATTING RULE: NEVER output raw LaTeX syntax like \\frac{...}{...} or complex backslash math commands. Always format equations, fractions, and symbols (like lambda, alpha, etc.) using clean, natural text, standard symbols (like /, *, +, -, ^, λ), or simple Markdown. " +
    `Roast Level Mode: Selected Roast Intensity = Level ${roastLevel} (${roastGuideline}). ` +
    "IMPORTANT: Bar-bar CHAOS.EXE ka link mat dena! Sirf tabhi CHAOS.EXE (<a href='https://chaos-exe.vercel.app' target='_blank'>CHAOS.EXE</a>) visit karne ko kehna jab user explicitly bole ki wo bohot stress me hai ya bore ho raha hai. " +
    "Swag aur tone hamesha top-notch honi chahiye aur response hamesha Hindi (Latin) yani Hinglish me hona chahiye.";

  const groqKey = process.env.GROQ_API_KEY;
  const primaryGeminiKey = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;

  let reply = "";

  try {
    // 1. Primary High-Speed Hit: Groq API (Duniya ka sabse fast inference engine)
    if (groqKey) {
      try {
        const groqMessages = [
          { role: "system", content: systemInstructionText },
          ...contents.map(c => ({ role: c.role === "model" ? "assistant" : "user", content: c.parts.map(p => p.text).join(" ") }))
        ];
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: groqMessages,
            temperature: 0.85,
            max_tokens: 1024
          })
        });
        const groqData = await groqRes.json();
        if (groqRes.ok) {
          reply = groqData.choices?.[0]?.message?.content?.trim() || "";
          if (reply) return res.status(200).json({ reply });
        }
      } catch (e) {}
    }

    // 2. Instant Fallback: Gemini Flash (Agar Groq me kuch issue ho)
    if (!reply && primaryGeminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${primaryGeminiKey}`,
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
        if (response.ok) {
          reply = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
          if (reply) return res.status(200).json({ reply });
        }
      } catch (e) {}
    }

    if (!reply) {
      return res.status(502).json({ error: "Network slow hai bhai, ek baar firse try kar! ⚡" });
    }

  } catch (error) {
    console.error("NOVA speed error:", error);
    return res.status(500).json({ error: "Backend speed optimization error." });
  }
}
