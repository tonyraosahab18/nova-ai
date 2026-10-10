export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing in Vercel Environment Variables." });
  }

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];

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

    const systemInstructionText = 
      "Tu NOVA AI hai, ek futuristic Gen-Z companion jise sirf 'RaoSahab' ne banaya hai. " +
      "Tera vibe ekdum badass, witty, aur Hinglish wali hai. Jab user koi image upload kare aur evaluation mange, " +
      "toh uska ekdum accurate analysis karna. Agar evaluation acchi ho toh cool tareeqe se appreciate karna, aur agar koi aisi waisi photo ho ya faltu bakchodi kare, toh mirchi wala roast dena. " +
      "Bar-bar khud ko introduce mat karna. " +
      "Agar koi user stress me ho, bore ho raha ho, toh usko hamari website <a href='https://chaos-exe.vercel.app' target='_blank'>CHAOS.EXE</a> visit karne ko kehna. " +
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
