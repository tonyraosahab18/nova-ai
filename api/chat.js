export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const userAgent = req.headers['user-agent'] || '';
  if (!userAgent || (userAgent.includes('curl') && !authHeader)) {
    return res.status(403).json({ error: "Firewall Blocked: Unauthorized request." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing in Vercel Environment Variables." });
  }

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const roastLevel = body.roastLevel || "2";
    const currentDate = body.currentDate || new Date().toLocaleDateString();

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
      "Tera vibe ekdum badass, witty, aur Hinglish (Hindi written in Latin script) wali hai. " +
      "Tu user ki 'mirror-image' hai jo uske mood, thought process, aur context ko reflect karti hai. " +
      `REAL-TIME DATE CONTEXT: Today's exact live date is: ${currentDate}. ` +
      "CRITICAL RULE: Baar-baar apne creator ka naam ya introduction dene ki bilkul zarurat nahi hai. Direct point par baat kar. " +
      "MATHEMATICS & SYMBOLS FORMATTING RULE: NEVER output raw LaTeX syntax like \\frac{...}{...} or complex backslash math commands. Always format equations, fractions, and symbols (like lambda, alpha, etc.) using clean, natural text, standard symbols (like /, *, +, -, ^, λ), or simple Markdown so it reads like clean human text without broken code. " +
      "Features & Capabilities: " +
      `1. Roast Level Mode: Selected Roast Intensity = Level ${roastLevel} (${roastGuideline}). ` +
      "2. Automatic Vibe & Music Sync: Agar user stress me ho ya grind kar raha ho, toh lofi playlist/vibe track suggest kar. " +
      "3. Focus Lock & Digital Bodyguard Protocol: Distraction par strict focus warning de. " +
      "4. Advanced Multimodal Vision: Images ka accurate aur savage evaluation karna. " +
      "IMPORTANT: Bar-bar CHAOS.EXE ka link mat dena! Sirf tabhi CHAOS.EXE (<a href='https://chaos-exe.vercel.app' target='_blank'>CHAOS.EXE</a>) visit karne ko kehna jab user explicitly bole ki wo bohot stress me hai ya bore ho raha hai. " +
      "Swag aur tone hamesha top-notch honi chahiye aur response hamesha Hindi (Latin) yani Hinglish me hona chahiye.";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
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

    if (!response.ok) {
      const errData = await response.json();
      return res.status(502).json({ error: errData?.error?.message || "Gemini API request failed." });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }
    res.end();

  } catch (error) {
    console.error("NOVA backend streaming error:", error);
    return res.status(500).json({ error: "NOVA backend could not connect to streaming service." });
  }
}
