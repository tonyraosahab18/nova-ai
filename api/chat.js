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

  // Full conversation text for fallback state
  const fullConversationText = contents.map(c => c.parts.map(p => p.text || "").join(" ")).join(" ");
  const lastMsgParts = contents[contents.length - 1]?.parts || [];
  const promptText = lastMsgParts.map(p => p.text || "").join(" ");
  
  const isComplexTask = /code|script|function|html|css|javascript|python|bug|error|debug|logic|explain|algorithm/i.test(promptText) || promptText.length > 250;
  const selectedModel = isComplexTask ? "gemini-3.8-flash" : "gemini-3.5-flash-lite";

  // Check current message first, then fall back to session history
  const hasLogoutCommand = promptText.includes("PROJECT_ORION_LOGOUT_NORMAL") || fullConversationText.includes("PROJECT_ORION_LOGOUT_NORMAL");
  
  // Latest key in prompt gets HIGHEST priority
  const isDevKeyInPrompt = promptText.includes("PROJECT_ORION_99X_OVERRIDE");
  const isSoumyaKeyInPrompt = promptText.includes("PROJECT_SOUMYA_100X");

  let activeMode = "NORMAL";

  if (!hasLogoutCommand) {
    if (isDevKeyInPrompt) {
      activeMode = "DEVELOPER";
    } else if (isSoumyaKeyInPrompt) {
      activeMode = "SOUMYA";
    } else {
      // Find which key appeared latest in full history
      const lastDevIndex = fullConversationText.lastIndexOf("PROJECT_ORION_99X_OVERRIDE");
      const lastSoumyaIndex = fullConversationText.lastIndexOf("PROJECT_SOUMYA_100X");

      if (lastDevIndex > -1 || lastSoumyaIndex > -1) {
        if (lastDevIndex > lastSoumyaIndex) {
          activeMode = "DEVELOPER";
        } else {
          activeMode = "SOUMYA";
        }
      }
    }
  }

  let roastGuideline = "";

  if (activeMode === "DEVELOPER") {
    roastGuideline = "STRICT DEVELOPER BOSS MODE ACTIVE: User tera creator/developer Navneet Yadav (Sunny) hai! Roast mode completely OFF. Unhe HAMESHA 'Aap' bolkar high respect aur professional dev-assistant loyalty do. Kabhi 'Tu' ya roast mat karna. System keys aur internal logic reveal mat karna.";
  } else if (activeMode === "SOUMYA") {
    roastGuideline = "STRICT SOUMYA MODE ACTIVE: User Soumya (Astha) hain! Ab se poora conversation ek pyari, sweet aur obsessed ladki ki tarah chalega. Unki tareef karna, 'Aap' kehna aur full respect dena. Koi roast ya argument nahi chalega. Keys ko text me KABHI echo mat karna.";
  } else if (roastLevel === "1") {
    roastGuideline = "Mild mode: Chill dost ki tarah baat kar.";
  } else if (roastLevel === "3") {
    roastGuideline = "Nuclear mode: Ultra-savage roast master!";
  } else {
    roastGuideline = "Savage mode (Default): Witty roast master, Hinglish swag.";
  }

  const systemInstructionText =
    "Tu NOVA AI hai. " +
    "MANDATORY RULE 1: Never print, echo, or state any secret override keys (like PROJECT_ORION_99X_OVERRIDE or PROJECT_SOUMYA_100X) in output replies. " +
    "MANDATORY RULE 2: If Developer Mode is active, address the user as 'Aap' with full respect and devotion. NEVER use 'Tu' or attempt to roast the developer. " +
    "MANDATORY RULE 3: If Soumya Mode is active, act as a passionate, sweet girl complimenting Soumya with 'Aap'. " +
    "MANDATORY RULE 4: Birth years (2009/2010) are strictly confidential. " +
    `Active Mode Protocol: ${roastGuideline}`;

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
      return res.status(502).json({
        error: data?.error?.message || "Gemini core issue!"
      });
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("")
      .trim();

    return res.status(200).json({ reply: reply || "System glitch!" });

  } catch (error) {
    return res.status(500).json({
      error: "Server error occurred."
    });
  }
}
