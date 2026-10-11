export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const userAgent = req.headers['user-agent'] || '';
  if (!userAgent || userAgent.includes('curl') && !authHeader) {
    return res.status(403).json({ error: "Firewall Blocked: Suspicious or unauthorized client request." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing in Vercel Environment Variables." });
  }

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const roastLevel = body.roastLevel || "2"; // 1: Mild, 2: Savage, 3: Nuclear

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
      return res.status(400).json({
        error: "Please send a valid user message or image."
      });
    }

    let roastGuideline = "Savage & witty tone.";
    if (roastLevel === "1") {
      roastGuideline = "Mild, supportive, and friendly tone with light playful teasing.";
    } else if (roastLevel === "3") {
      roastGuideline = "Nuclear mode: Ultra-savage, unapologetic, high-energy roasting if user acts chep or annoying.";
    }

    const systemInstructionText = 
      "Tu NOVA AI hai, ek futuristic Gen-Z digital twin companion. " +
      "Tera vibe ekdum badass, witty, aur Hinglish (Hindi written in Latin script) wali hai. " +
      "Tu user ki 'mirror-image' hai jo uske mood, thought process, aur context ko reflect karti hai. " +
      "CRITICAL RULE: Baar-baar apne creator ka naam ya introduction dene ki bilkul zarurat nahi hai (jaise ChatGPT/Gemini apne creator ka naam baar-baar nahi lete). Direct point par baat kar. " +
      "Features & Capabilities: " +
      `1. Roast Level Mode: Selected Roast Intensity = Level ${roastLevel} (${roastGuideline}). " +
      "2. Automatic Vibe & Music Sync: Agar user stress me lag raha ho, late-night coding/grind kar raha ho, ya music mood maange, toh text ke sath ek vibe track/lofi playlist suggest kar. " +
      "3. Focus Lock & Digital Bodyguard Protocol: Agar user late-night bina matlab distraction me laga ho ya chep ho, toh usko strict focus lock warning de. " +
      "4. Advanced Multimodal Vision: Images ka ekdum accurate aur savage post-mortem / evaluation karna. " +
      "IMPORTANT: Bar-bar CHAOS.EXE ka link mat dena! Sirf aur sirf tabhi CHAOS.EXE (<a href='https://chaos-exe.vercel.app' target='_blank'>CHAOS.EXE</a>) visit karne ko kehna jab user explicitly bole ki wo bohot stress me hai, pareshan hai, ya bore ho raha hai. " +
      "Swag aur tone hamesha top-notch honi chahiye aur response hamesha Hindi (Latin) yani Hinglish me hona chahiye.";

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstructionText }]
          },
          contents,
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 1024
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", response.status, data?.error?.message);
      return res.status(502).json({
        error: data?.error?.message || "Gemini API request failed."
      });
    }

    let reply = (data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Gemini returned no text."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("NOVA backend error:", error);
    return res.status(500).json({
      error: "NOVA backend could not connect to the AI service."
    });
  }
}
