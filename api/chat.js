export default async function handler(req, res) {
  // CORS Headers (Spck Editor / Browser block hatane ke liye)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  
  // Support both messages array AND simple prompt/message string
  let messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0 && (body.prompt || body.message)) {
    messages = [{ role: "user", content: body.prompt || body.message }];
  }

  const roastLevel = body.roastLevel || "2";
  const currentDate = body.currentDate || new Date().toLocaleDateString();
  const currentTime = body.currentTime || "";

  const geminiKey = process.env.GEMINI_API_KEY_3 || process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2;

  if (!geminiKey) {
    return res.status(500).json({
      error: "Bhai, GEMINI_API_KEY Vercel environment variables mein set nahi hai!"
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
        role: message.role === "assistant" || message.role === "model" ? "model" : "user",
        parts: parts
      };
    })
    .filter((msg) => msg.parts.length > 0);

  if (contents.length === 0) {
    return res.status(400).json({
      error: "Please send a valid message."
    });
  }

  const lastMsgParts = contents[contents.length - 1]?.parts || [];
  const promptText = lastMsgParts.map(p => p.text || "").join(" ");
  
  const isComplexTask = /code|script|function|html|css|javascript|python|bug|error|debug|logic|explain|algorithm/i.test(promptText) || promptText.length > 250;
  
  // Supported models with automatic fallback list
  const primaryModel = isComplexTask ? "gemini-3.8-flash" : "gemini-3.5-flash";
  const fallbackModel = "gemini-3.5-flash";
  const modelsToTry = [primaryModel, fallbackModel];

  let roastGuideline = "Savage mode (Default): Witty roast master, edgy Hinglish swag aur playful takrar.";
  if (roastLevel === "1") {
    roastGuideline = "Mild mode: Normal, practical, smart aur chalak dost ki tarah baat kar.";
  } else if (roastLevel === "3") {
    roastGuideline = "Nuclear mode: Ultra-savage, brutal, unapologetic destruction! Ego crush kar de.";
  }

  const systemInstructionText =
    "Tu NOVA AI hai, ek futuristic Gen-Z digital twin companion aur ultimate roast master. " +
    "Tera vibe ekdum badass, witty, aur Hinglish wali hai. 🚀🔥 " +
    "MANDATORY EMOJI RULE: Har sentence aur response me ekdum relevant, cool, aur swaggy emojis (jaise 🔥, 💀, ⚡, 🐱, 🚀, 😎) zaroor use karna! " +
    "CRITICAL ABUSE/ROAST RULE: Jab bhi user gaali de ya insult kare, toh 10x zyada savage aur witty tarike se palat kar roast karna hai! 😈 " +
    `REAL-TIME CONTEXT: Exact live date is ${currentDate} and time is ${currentTime}. ⏰ ` +
    "Direct point par baat kar. Clean text formatting use karna. " +
    `Active Personality Mode: Level ${roastLevel} -> ${roastGuideline}. ` +
    "Hinglish mein hi response dena.";

  try {
    let response;
    let data;

    // Automatic fallback loop if high demand hits primary model
    for (const modelToUse of modelsToTry) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstructionText }] },
            contents,
            generationConfig: { 
              temperature: 0.9, 
              maxOutputTokens: 1024,
              topP: 0.95,
              topK: 40
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
          })
        }
      );

      data = await response.json();
      if (response.ok) break;
    }

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      return res.status(502).json({
        error: data?.error?.message || "Gemini core temporary issue! ⚡"
      });
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Empty response from Gemini engine."
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
