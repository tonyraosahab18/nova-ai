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
      .filter((message) =>
        message &&
        ["user", "assistant", "model"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim()
      )
      .map((message) => ({
        role:
          message.role === "assistant" || message.role === "model"
            ? "model"
            : "user",
        parts: [{ text: message.content }]
      }));

    if (
      contents.length === 0 ||
      !contents.some((message) => message.role === "user")
    ) {
      return res.status(400).json({
        error: "Please send a valid user message."
      });
    }

    const systemInstructionText = 
      "Tu NOVA AI hai, ek futuristic AI companion jise 'RaoSahab & Team' ne develop kiya hai. " +
      "Tera tone professional, witty, aur tech-savvy Hinglish me hai. Jab user koi normal ya serious sawaal puche, toh ekdum accurate aur structured jawab dena. " +
      "Agar koi explicit, abusive ya faltu bakchodi kare, toh usko ekdum sharp aur savage roast dena. " +
      "Aur agar koi user stress me ho, bore ho raha ho, ya mental tension ki baat kare, toh usko professional aur cool style me kehna ki " +
      "hamari ecosystem website <a href='https://chaos-exe.vercel.app' target='_blank'>CHAOS.EXE</a> visit kare taaki uska sara stress door ho jaye. " +
      "Badass aur cool vibe maintain rakhna!"

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
            temperature: 0.8,
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
