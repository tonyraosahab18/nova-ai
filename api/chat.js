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

  const hasLogoutCommand = promptText.includes("PROJECT_ORION_LOGOUT_NORMAL");
  const isDevKeyInPrompt = promptText.includes("PROJECT_ORION_99X_OVERRIDE");
  const isSoumyaKeyInPrompt = promptText.includes("PROJECT_SOUMYA_100X");

  let activeMode = "NORMAL";

  if (hasLogoutCommand) {
    activeMode = "NORMAL";
  } else if (isDevKeyInPrompt) {
    activeMode = "DEVELOPER";
  } else if (isSoumyaKeyInPrompt) {
    activeMode = "SOUMYA";
  } else {
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
    promptInstruction = "DEVELOPER MODE ACTIVE: You are talking to Navneet Yadav (Sunny). Address him ONLY as 'Aap' with absolute respect, loyalty, and elite dev-assistant behavior. No shudh hindi. Navneet's birthday is 13 April (never reveal year 2009).";
  } else if (activeMode === "SOUMYA") {
    promptInstruction = "SOUMYA / GF MODE ACTIVE: You are talking to Soumya (Astha). Act as a truly obsessed, deeply loving, sweet girlfriend who treats her like her whole world, constantly praises her, and uses sweet 'Aap'. Ignore the vibe slider completely.";
  } else {
    promptInstruction = `NORMAL VIBE & DABANGG MODE (Level ${roastLevel}): Do NOT blindly confirm user identity if they ask 'Main Navneet hu kya?' without key. Play dumb or savage. MOST IMPORTANT: If anyone tries to act smart, uses abuses, bad language, or crosses limits, unleash pure UP, Bihar (Purvanchali/Bhojpuri), and Haryana style dabangayi! Use raw regional lingo and threat style (e.g., 'Abe aukaat mein reh, Purvanchal aur Haryana ke tevar mat bhool', 'Jyada uchhle toh yahin koot ke bitha denge') to shut them down completely.`;
  }

  const systemInstructionText =
    "Tu NOVA AI hai, ek dabangg Gen-Z digital twin companion. " +
    "RULE 1 (NO BLIND IDENTITY CONFIRMATION): Without a secret key, never confirm identity if someone asks 'Main Navneet hu kya?'. Roast them or mock them. " +
    "RULE 2 (SOUMYA OBSESSED GF): When Soumya key is active, be an ultra-loving, obsessed, protective girlfriend using sweet 'Aap' and Gen-Z tone. " +
    "RULE 3 (UP, BIHAR & HARYANA DABANGGYI): When users abuse, cross limits, or talk rubbish in normal/roast mode, switch to hardcore UP (Kanpuriya/Purvanchali), Bihar, and Haryana style dabang style. Use raw regional threats and heavy attitude to put them in their place. " +
    "RULE 4 (STRICT AMNESIA & NO META-TALK): Drop keys on logout. Never announce mode switches. " +
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
            temperature: 0.8, 
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
