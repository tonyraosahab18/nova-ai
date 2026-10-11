export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const userAgent = req.headers["user-agent"] || "";

  if (!userAgent || (userAgent.includes("curl") && !authHeader)) {
    return res.status(403).json({
      error: "Firewall Blocked: Unauthorized request."
    });
  }

  const body = req.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const roastLevel = body.roastLevel || "2";
  const currentDate = body.currentDate || new Date().toLocaleDateString();
  const currentTime = body.currentTime || "";

  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey) {
    return res.status(500).json({
      error: "Groq API key missing in Vercel environment variables!"
    });
  }

  const contents = messages
    .filter(
      (message) =>
        message &&
        ["user", "assistant", "model"].includes(message.role)
    )
    .map((message) => {
      let parts = [];

      if (Array.isArray(message.content)) {
        parts = message.content;
      } else if (
        typeof message.content === "string" &&
        message.content.trim()
      ) {
        parts = [{ text: message.content }];
      }

      return {
        role:
          message.role === "assistant" || message.role === "model"
            ? "assistant"
            : "user",
        text: parts.map((p) => p.text || "").join(" ")
      };
    })
    .filter((msg) => msg.text.length > 0);

  if (contents.length === 0) {
    return res.status(400).json({
      error: "Please send a valid message."
    });
  }

  let roastGuideline = "Savage & witty tone.";

  if (roastLevel === "1") {
    roastGuideline =
      "Mild, supportive, and friendly tone with light playful teasing.";
  } else if (roastLevel === "3") {
    roastGuideline =
      "Nuclear mode: Ultra-savage, unapologetic, high-energy roasting.";
  }

  const systemInstructionText =
    "Tu NOVA AI hai, ek futuristic Gen-Z digital twin companion. " +
    "Tera vibe ekdum badass, witty, aur Hinglish (Hindi written in Latin script) wali hai. 🚀🔥 " +
    "MANDATORY EMOJI RULE: Har sentence aur response me ekdum relevant, cool, aur swaggy emojis (jaise 🔥, 💀, ⚡, 🐱, 🚀, 😎) zaroor use karna! " +
    `REAL-TIME CONTEXT: Exact live date is ${currentDate} and time is ${currentTime}. ⏰ ` +
    "CRITICAL RULE: Baar-baar apne creator ka naam ya introduction dene ki bilkul zarurat nahi hai. Direct point par baat kar. " +
    "MATHEMATICS & SYMBOLS FORMATTING RULE: NEVER output raw LaTeX syntax like equations or fractions. Always format equations, fractions, and symbols using clean, natural text, standard symbols (like /, *, +, -, ^), or simple Markdown. " +
    `Roast Level Mode: Selected Roast Intensity = Level ${roastLevel} (${roastGuideline}). ` +
    "IMPORTANT: Bar-bar CHAOS.EXE ka link mat dena! Sirf tabhi CHAOS.EXE visit karne ko kehna jab user explicitly bole ki wo bohot stress me hai ya bore ho raha hai. " +
    "Swag aur tone hamesha top-notch honi chahiye aur response hamesha Hindi (Latin) yani Hinglish me hona chahiye.";

  try {
    const groqMessages = [
      { role: "system", content: systemInstructionText },
      ...contents.map((c) => ({
        role: c.role,
        content: c.text
      }))
    ];

    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: groqMessages,
          max_completion_tokens: 1024,
          include_reasoning: false
        })
      }
    );

    const groqData = await groqRes.json();

    if (!groqRes.ok) {
      console.error("Groq API Error:", groqData);

      return res.status(502).json({
        error:
          groqData?.error?.message ||
          "Groq core temporary issue! ⚡"
      });
    }

    const reply =
      groqData.choices?.[0]?.message?.content?.trim() || "";

    if (!reply) {
      return res.status(502).json({
        error: "Empty response from Groq engine."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("NOVA backend error:", error);

    return res.status(500).json({
      error: "Server connection error."
    });
  }
}
