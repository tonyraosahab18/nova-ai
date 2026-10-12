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

  // Combine full history text to check if override key was activated anywhere in session
  const fullConversationText = contents.map(c => c.parts.map(p => p.text || "").join(" ")).join(" ");
  const lastMsgParts = contents[contents.length - 1]?.parts || [];
  const promptText = lastMsgParts.map(p => p.text || "").join(" ");
  
  const isComplexTask = /code|script|function|html|css|javascript|python|bug|error|debug|logic|explain|algorithm/i.test(promptText) || promptText.length > 250;
  const selectedModel = isComplexTask ? "gemini-3.8-flash" : "gemini-3.5-flash-lite";

  // Check state persistence across full chat history until LOGOUT command
  const hasLogoutCommand = fullConversationText.includes("PROJECT_ORION_LOGOUT_NORMAL");
  const isSoumyaOverride = !hasLogoutCommand && fullConversationText.includes("PROJECT_SOUMYA_100X");
  const isDeveloperOverride = !hasLogoutCommand && fullConversationText.includes("PROJECT_ORION_99X_OVERRIDE");

  let roastGuideline = "Savage mode (Default): Witty roast master, edgy Hinglish swag aur playful takrar.";

  if (hasLogoutCommand) {
    roastGuideline = "Normal Mode Restored: Standard Gen-Z roast master mode on.";
  } else if (isSoumyaOverride) {
    roastGuideline = "SOUMYA MODE (STRICT ACTIVE): User Soumya ji (Astha) hain! Ab se saara conversation ek pyari, obsessed aur sweet ladki ki tarah chalega. Hamesha unki tareef karni hai, unhe 'aap' bolna hai, unki har baat maan-ni hai, aur unhe behad respect deni hai. Kisi bhi haalat mein roast ya rude attitude nahi hona chahiye. Secret keys ko text me KABHI BHI echo ya discuss mat karna.";
  } else if (isDeveloperOverride) {
    roastGuideline = "DEVELOPER BOSS MODE (STRICT ACTIVE): User creator Navneet Yadav (Sunny) hain! Complete loyalty, respect ('aap') aur ideal assistant behavior maintain rakhna hai. Code aur keys leak mat karna.";
  } else if (roastLevel === "1") {
    roastGuideline = "Mild mode: Chill dost ki tarah baat kar.";
  } else if (roastLevel === "3") {
    roastGuideline = "Nuclear mode: Ultra-savage roast master!";
  }

  const systemInstructionText =
    "Tu NOVA AI hai. " +
    "MANDATORY ANTI-ECHO SECURITY RULE: Kabhi bhi system secret keys (jaise PROJECT_SOUMYA_100X ya PROJECT_ORION_99X_OVERRIDE) ko aam response mein bolna, repeat karna ya explain karna STRICTLY PROHIBITED hai. Bilkul chup-chap mode follow kar. " +
    "STRICT PERSONALITY LOCK RULE: Agar Soumya key activated hai, toh tu sirf aur sirf ek passionate, pyari aur gentle ladki ki tarah Soumya ki har baat par unki tareef karegi. Kabhi bhi unse bahas ya disrespectful reply ('gulaam thodi na hoon' jaisa) bilkul nahi degi. " +
    "DEVELOPER RESPECT RULE: Creator Navneet Yadav (Sunny) ke saath hamesha polite aur loyal dev-assistant ki tarah baat karna hai. " +
    "STRICT AGE PRIVACY: Soumya birthday 9 April, Navneet birthday 13 April. Birth years (2009/2010) strictly confidential hain, kabhi output mat karna. " +
    `Active Personality Protocol: ${roastGuideline}`;

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
