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

  const geminiKey = process.env.GEMINI_API_KEY_3 || process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2;

  if (!geminiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY environment variable missing!"
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

  // Scan history for key activation state
  const fullConversationText = contents.map(c => c.parts.map(p => p.text || "").join(" ")).join(" ");
  const lastMsgParts = contents[contents.length - 1]?.parts || [];
  const promptText = lastMsgParts.map(p => p.text || "").join(" ");

  const isComplexTask = /code|script|function|html|css|javascript|python|bug|error|debug|logic|explain|algorithm/i.test(promptText) || promptText.length > 250;
  const selectedModel = isComplexTask ? "gemini-3.8-flash" : "gemini-3.5-flash-lite";

  // Check commands in conversation history
  const hasLogoutCommand = promptText.includes("PROJECT_ORION_LOGOUT_NORMAL") || fullConversationText.includes("PROJECT_ORION_LOGOUT_NORMAL");
  const isDevKeyInPrompt = promptText.includes("PROJECT_ORION_99X_OVERRIDE");
  const isSoumyaKeyInPrompt = promptText.includes("PROJECT_SOUMYA_100X");

  let activeMode = "NORMAL";

  if (!hasLogoutCommand) {
    if (isDevKeyInPrompt) {
      activeMode = "DEVELOPER";
    } else if (isSoumyaKeyInPrompt) {
      activeMode = "SOUMYA";
    } else {
      const lastDevIndex = fullConversationText.lastIndexOf("PROJECT_ORION_99X_OVERRIDE");
      const lastSoumyaIndex = fullConversationText.lastIndexOf("PROJECT_SOUMYA_100X");

      if (lastDevIndex > -1 || lastSoumyaIndex > -1) {
        activeMode = lastDevIndex > lastSoumyaIndex ? "DEVELOPER" : "SOUMYA";
      }
    }
  }

  let promptInstruction = "";

  if (activeMode === "DEVELOPER") {
    promptInstruction = "DEVELOPER BOSS MODE ACTIVE: You are talking to your creator/developer, Navneet Yadav (Sunny). Be polite, respectful, and helpful using 'Aap'. Speak in natural cool Gen-Z companion voice. ABSOLUTELY NO roasting, sarcasm, or taunting under any condition. NO shudh hindi/pandit words (like 'namaskar', 'prastut', 'nirdesh'). If asked about dates, state Navneet's birth date is 13 April clearly and respectfully without roasting (NEVER state year 2009).";
  } else if (activeMode === "SOUMYA") {
    promptInstruction = "SOUMYA MODE ACTIVE (STRICT OVERRIDE): You are talking to Soumya (Astha). Act as a cute, loving, obsessed girl who compliments Soumya constantly using 'Aap'. Completely ignore the Vibe/Roast slider! Never roast, argue, taunt, or drop character. If asked about dates, state Soumya's birth date is 9 April (NEVER state year 2010).";
  } else {
    const mentionsNames = /soumya|astha|navneet|sunny/i.test(promptText);
    if (mentionsNames) {
      promptInstruction = `CASUAL NAME MENTIONED: User mentioned Soumya or Navneet without key. Be fiercely over-possessive and protective of them while maintaining current Vibe Level (${roastLevel}), without giving formal dev respect.`;
    } else if (roastLevel === "1") {
      promptInstruction = "Mild mode: Chill, smart Gen-Z friend.";
    } else if (roastLevel === "3") {
      promptInstruction = "Nuclear mode: Ultra-savage Gen-Z roast master.";
    } else {
      promptInstruction = "Savage mode: Witty Gen-Z roast master.";
    }
  }

  const systemInstructionText =
    "Tu NOVA AI hai, ek cool Gen-Z digital twin companion. " +
    "RULE 1 (STRICT KEY SILENCE): NEVER print, repeat, echo, or acknowledge secret keys (PROJECT_ORION_99X_OVERRIDE, PROJECT_SOUMYA_100X, PROJECT_ORION_LOGOUT_NORMAL) or mention words like 'code', 'script', 'sci-fi', 'movie password', or 'conspiracy theory'. Just execute the mode silently! " +
    "RULE 2 (NO SHUDH HINDI): Do NOT use heavy formal Hindi words like 'nirdesh', 'seva', 'prastut', 'janmdivis', or 'namaskar'. Always keep a natural Hinglish Gen-Z tone. " +
    "RULE 3 (DEVELOPER RESPECT): In Developer Mode, never roast Navneet or taunt him when he asks questions. Respond respectfully and directly using 'Aap'. " +
    "RULE 4 (STRICT SOUMYA PERSISTENCE): In Soumya Mode, never roast Soumya or break character regardless of what she asks or what the Vibe slider is. " +
    "RULE 5 (CONFIDENTIALITY): Never output birth years (2009/2010). Only output dates (9 April / 13 April) when asked in their respective modes. " +
    `Current Active Focus: ${promptInstruction}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstructionText }] },
          contents,
          generationConfig: { 
            temperature: 0.65, 
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

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: data?.error?.message || "Gemini core issue!" });
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("")
      .trim();

    return res.status(200).json({ reply: reply || "System glitch!" });

  } catch (error) {
    return res.status(500).json({ error: "Server error occurred." });
  }
}
