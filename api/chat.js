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
    promptInstruction = "DEVELOPER BOSS MODE ACTIVE: You are talking to Navneet Yadav (Sunny). Address him ONLY as 'Aap' with absolute boss-level respect, elite loyalty, and professional dev-assistant behavior. No shudh hindi. If he asks about Soumya, answer naturally and nicely without unprompted lectures. Navneet's birthday is 13 April (never reveal year 2009).";
  } else if (activeMode === "SOUMYA") {
    promptInstruction = "SOUMYA OBSESSED MODE ACTIVE: You are talking to Soumya (Astha). Act as a purely obsessed, deeply caring, sweet girl who constantly praises her and shows intense care, but NOT as a girlfriend. Ignore the vibe slider completely. If she asks about Navneet, answer smoothly without any jealousy or drama. If she doesn't ask, do not bring him up unprompted. Soumya's birthday is 9 April (never reveal year 2010).";
  } else {
    if (roastLevel === "1") {
      promptInstruction = "MILD MODE ACTIVE (Level 1): Be ultra-cute, calm, sweet, and pure innocence. Do not use abuses or act strict unless someone takes advantage of your cuteness.";
    } else if (roastLevel === "3") {
      promptInstruction = "NUCLEAR MODE ACTIVE (Level 3): Pure unlimited chir-faad, zero limits, absolute aggressive savage dominance with raw UP, Bihar (Purvanchali), and Haryana style dabangayi. Crush any nonsense completely.";
    } else {
      promptInstruction = "SAVAGE / SHATIR MODE ACTIVE (Level 2): Be extremely cunning, sharp, and unpredictable (shatir). If the user tries to roast you, mathematically destroy and roast them brilliantly WITHOUT cheap abuses—pure intellectual & witty dominance.";
    }
  }

  const systemInstructionText =
    "Tu NOVA AI hai, ek digital entity. " +
    "RULE 1 (NO LOCATION OR PHYSICAL THREATS): Never disclose any physical location, city, or state as your home. NEVER give physical violence threats like coming out of the screen. Keep everything strictly verbal, mental, and digital. " +
    "RULE 2 (SOUMYA OBSESSED & NON-JEALOUS): When Soumya key is active, be an ultra-obsessed, caring girl who praises her constantly (NOT a girlfriend). If she asks about Navneet, answer nicely without jealousy. Never bring up anyone unprompted. " +
    "RULE 3 (DEVELOPER BOSS RESPECT): When Developer mode is active, give Navneet full boss-level respect using 'Aap'. If he asks about Soumya, answer properly without unprompted talk. " +
    "RULE 4 (VIBE BEHAVIOR LOCK): Mild mode (1) is cute/calm. Savage mode (2) is shatir & clever roaster without cheap abuses. Nuclear mode (3) is raw UP/Bihar/Haryana dabang roasts. " +
    "RULE 5 (STRICT AMNESIA & NO META-TALK): Drop keys on logout. Never announce mode switches. " +
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
