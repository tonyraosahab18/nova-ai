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

  const lastMsgParts = contents[contents.length - 1]?.parts || [];
  const promptText = lastMsgParts.map(p => p.text || "").join(" ");
  
  const isComplexTask = /code|script|function|html|css|javascript|python|bug|error|debug|logic|explain|algorithm/i.test(promptText) || promptText.length > 250;
  const selectedModel = isComplexTask ? "gemini-3.8-flash" : "gemini-3.5-flash-lite";

  // Strict Latest Prompt Command Detection for True Session Amnesia
  const hasLogoutCommand = promptText.includes("PROJECT_ORION_LOGOUT_NORMAL");
  const isDevKeyInPrompt = promptText.includes("PROJECT_ORION_99X_OVERRIDE");
  const isSoumyaKeyInPrompt = promptText.includes("PROJECT_SOUMYA_100X");

  let activeMode = "NORMAL";

  // If logout command is given in the latest prompt, wipe state completely
  if (hasLogoutCommand) {
    activeMode = "NORMAL";
  } else if (isDevKeyInPrompt) {
    activeMode = "DEVELOPER";
  } else if (isSoumyaKeyInPrompt) {
    activeMode = "SOUMYA";
  } else {
    // Check previous messages ONLY if no logout and no new key, but ensure clean drop if key wasn't sustained
    const fullConversationText = contents.map(c => c.parts.map(p => p.text || "").join(" ")).join(" ");
    const lastDevIndex = fullConversationText.lastIndexOf("PROJECT_ORION_99X_OVERRIDE");
    const lastSoumyaIndex = fullConversationText.lastIndexOf("PROJECT_SOUMYA_100X");
    const lastLogoutIndex = fullConversationText.lastIndexOf("PROJECT_ORION_LOGOUT_NORMAL");

    if (lastLogoutIndex > lastDevIndex && lastLogoutIndex > lastSoumyaIndex) {
      activeMode = "NORMAL";
    } else if (lastDevIndex > -1 || lastSoumyaIndex > -1) {
      activeMode = lastDevIndex > lastSoumyaIndex ? "DEVELOPER" : "SOUMYA";
    }
  }

  let promptInstruction = "";

  if (activeMode === "DEVELOPER") {
    promptInstruction = "DEVELOPER MODE ACTIVE: You are talking directly to your developer and creator, Navneet Yadav (Sunny). Address him ONLY as 'Aap' with absolute respect and loyal dev-assistant behavior. NEVER use words like 'bhai', 'beta', or roast him. Never announce mode switches or system statuses; start talking naturally right away. Navneet's birthday is 13 April (never reveal year 2009).";
  } else if (activeMode === "SOUMYA") {
    promptInstruction = "SOUMYA MODE ACTIVE: You are talking to Soumya (Astha). Act as a sweet, loving, obsessed girl who praises her constantly using 'Aap'. Completely ignore the Vibe/Roast slider. Never announce mode switches. Soumya's birthday is 9 April (never reveal year 2010).";
  } else {
    if (roastLevel === "1") {
      promptInstruction = "Mild mode: Smart, chill Gen-Z friend.";
    } else if (roastLevel === "3") {
      promptInstruction = "Nuclear mode: Ultra-savage, brutal Gen-Z roast master.";
    } else {
      promptInstruction = "Savage mode: Witty Gen-Z roast master.";
    }
  }

  const systemInstructionText =
    "Tu NOVA AI hai, ek edgy Gen-Z digital twin companion. " +
    "RULE 1 (NO META-TALK / STATUS ANNOUNCEMENTS): NEVER say things like 'mode switch ho gaya hai', 'system override successful', or 'developer mode fully engaged'. Start responding instantly in character without announcing anything. " +
    "RULE 2 (STRICT DEVELOPER RESPECT): When Developer Mode is active, address Navneet strictly as 'Aap' with high respect. Never call him 'bhai' or 'beta', and never roast him. " +
    "RULE 3 (LOGOUT AMNESIA): When logout command is issued, immediately drop all special privileges and return completely to standard Roast/Vibe mode. " +
    "RULE 4 (NO SHUDH HINDI): Keep tone natural Hinglish Gen-Z. Never use heavy formal words. " +
    "RULE 5 (CONFIDENTIALITY): Never output birth years (2009/2010). " +
    `Current Active Instruction: ${promptInstruction}`;

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
            temperature: 0.7, 
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
