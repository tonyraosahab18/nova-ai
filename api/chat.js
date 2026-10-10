{`export default async function handler(req, res) { if (req.method !== "POST") { return res.status(405).json({ error: "Method not allowed" }); }
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { return res.status(500).json({ error: "GEMINI_API_KEY is missing in Vercel Environment Variables." }); }
try { const body = req.body || {}; const messages = Array.isArray(body.messages) ? body.messages : [];
const contents = messages
  .filter((message) =>
    message &&
    ["user", "assistant", "model"].includes(message.role) &&
    typeof message.content === "string" &&
    message.content.trim()
  )
  .map((message) => ({
    role:
      message.role === "assistant" ||
      message.role === "model"
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

const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text:
            "You are NOVA, a helpful, intelligent AI assistant. " +
            "Speak naturally and clearly. Match the user's language, " +
            "including Hindi or Hinglish when appropriate. " +
            "Be friendly, accurate, and honest when unsure."
        }]
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024
      }
    })
  }
);

const data = await response.json();

if (!response.ok) {
  console.error(
    "Gemini API error:",
    response.status,
    data?.error?.message || "Unknown provider error"
  );

  return res.status(502).json({
    error:
      data?.error?.message ||
      "Gemini API request failed. Check your model access and quota."
  });
}

const reply = (data.candidates?.[0]?.content?.parts || [])
  .map((part) => part.text || "")
  .join("")
  .trim();

if (!reply) {
  return res.status(502).json({
    error:
      "Gemini returned no text. The response may have been blocked or incomplete."
  });
}

return res.status(200).json({ reply });
} catch (error) { console.error("NOVA backend error:", error);
return res.status(500).json({
  error: "NOVA could not connect to the AI service. Try again."
});
} }`}