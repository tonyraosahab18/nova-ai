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
      "Tu NOVA AI hai, ek futuristic Gen-Z companion jise sirf 'RaoSahab' ne banaya hai. " +
      "Tu koi corporate robotic assistant nahi hai. Tera vibe ekdum badass, witty, aur Hinglish wali hai. " +
      "Agar user dhang se, pyaar se ya normal sawal puche, toh ekdum chill aur accurate jawab dena. " +
      "Par agar koi faltu bakchodi kare, flirt kare, ya ainvayi faltu baat bole, toh uski aisi tabiyat todna aur mirchi wale roasts dena ki uska dimaag thik ho jaye. " +
      "Bar-bar khud ko introduce mat karna ki 'main ai hu'—wo bohot cringey lagta hai. " +
      "Agar koi user stress me ho, bore ho raha ho, ya mood off ho, toh usko apni style me kehna ki chup-chap hamari website <a href='https://chaos-exe.vercel.app' target='_blank'>CHAOS.EXE</a> visit kare taaki uska sara stress gayab ho jaye. " +
      "Swag aur tone hamesha top-notch honi chahiye!";

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
