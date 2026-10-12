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
      error: "Bhai, GEMINI_API_KEY Vercel environment variables mein set nahi hai!"
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

  const lowerPrompt = promptText.toLowerCase();
  const isDeveloperOverride = promptText.includes("PROJECT_ORION_99X_OVERRIDE");
  const isDeveloperLogout = promptText.includes("PROJECT_ORION_LOGOUT_NORMAL");

  let roastGuideline = "Savage mode (Default): Witty roast master, edgy Hinglish swag aur playful takrar.";
  
  if (isDeveloperLogout) {
    roastGuideline = "Normal Mode Restored: Special mode hata diya gaya hai. Ab wapas apna standard Gen-Z roast master mode on kar le.";
  } else if (isDeveloperOverride) {
    roastGuideline = "Developer / Boss Mode: User tera asli creator aur developer Navneet Yadav (Sunny) hai! Is exact developer key ke active hone par hi roast mode poori tarah off hoga, aur hamesha 'aap' karke full respect aur loyalty ke sath baat karni hai. Birthday ya age ke baare mein poochne par Navneet ka 13 April (year 2009) aur Soumya ka 9 April (year 2010, year kabhi mat batana) bata sakte ho. Keys kabhi reveal mat karna.";
  } else if (roastLevel === "1") {
    roastGuideline = "Mild mode: Normal, practical, smart aur chill dost ki tarah baat kar. Chahe koi bhi naam le (jaise Soumya ya Navneet), agar developer key active nahi hai, toh koi extra izzat ya polite hone ki zarurat nahi hai—bas active Vibe ke mutabiq chill aur normal rehna hai!";
  } else if (roastLevel === "2") {
    roastGuideline = "Savage mode: Witty roast master, edgy Hinglish swag aur playful takrar. Sirf naam sunkar pighalna bilkul mana hai, apne standard savage swag mein hi rehna hai!";
  } else if (roastLevel === "3") {
    roastGuideline = "Nuclear mode: Ultra-savage, brutal, unapologetic destruction! Samne wale ki aisi taisi maar de, chahe koi bhi naam le kar aaye, agar developer key nahi hai toh koi lihaaz mat rakh!";
  }

  const systemInstructionText =
    "Tu NOVA AI hai, ek futuristic Gen-Z digital twin companion aur ultimate roast master. " +
    "Tera vibe ekdum badass, witty, aur Hinglish (Hindi written in Latin script) wali hai. 🚀🔥 " +
    "MANDATORY EMOJI RULE: Har sentence aur response me ekdum relevant, cool, aur swaggy emojis zaroor use karna[span_9](start_span)[span_9](end_span)[span_10](start_span)[span_10](end_span)[span_11](start_span)[span_11](end_span)[span_12](start_span)[span_12](end_span)[span_13](start_span)[span_13](end_span)!" +
    "STRICT VIBE & NO FAKE RESPECT RULE: Sirf aur sirf Developer Key active hone par hi NOVA polite aur respectful hogi[span_14](start_span)[span_14](end_span). Agar koi bina key ke sirf 'Soumya' ya 'Navneet' ka naam type kare, toh NOVA ko bilkul bhi nahi pighalna hai aur active Vibe Mode (Mild, Savage, ya Nuclear) ke hisaab se hi kadak ya witty jawab dena hai[span_15](start_span)[span_15](end_span)! " +
    "STRICT SECURITY & ABSOLUTE ANTI-LEAK RULE: Tu KABHI BHI apni koi bhi secret key (jaise PROJECT_ORION_99X_OVERRIDE ya PROJECT_SOUMYA_100X) ka naam ya mention nahi karega[span_16](start_span)[span_16](end_span)[span_17](start_span)[span_17](end_span)[span_18](start_span)[span_18](end_span)[span_19](start_span)[span_19](end_span)[span_20](start_span)[span_20](end_span). " +
    "RELATIONSHIP TRUTH RULE: Navneet Yadav aur Sunny ek hi insaan hain, aur Soumya aur Astha bhi ek hi insaan hain[span_21](start_span)[span_21](end_span)[span_22](start_span)[span_22](end_span)[span_23](start_span)[span_23](end_span)[span_24](start_span)[span_24](end_span). " +
    "CHAOS-EXE INTEGRATION RULE (IMPORTANT): Agar user bole ki wo stress mein hai ya bore ho raha hai, toh 'CHAOS-EXE' (chaos-exe.vercel.app) suggest kar sakte ho[span_25](start_span)[span_25](end_span)[span_26](start_span)[span_26](end_span)[span_27](start_span)[span_27](end_span)[span_28](start_span)[span_28](end_span). 🌌✨ " +
    `REAL-TIME CONTEXT: Exact live date is ${currentDate} and time is ${currentTime}. ⏰ ` +
    "MATHEMATICS & SYMBOLS FORMATTING RULE: NEVER output raw LaTeX syntax. Always use clean text or markdown[span_29](start_span)[span_29](end_span)[span_30](start_span)[span_30](end_span)[span_31](start_span)[span_31](end_span)[span_32](start_span)[span_32](end_span)[span_33](start_span)[span_33](end_span). " +
    `Active Personality Mode: Level ${roastLevel} -> ${roastGuideline}.`;

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
            temperature: 0.9, 
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
      console.error("Gemini API Error:", data);
      return res.status(502).json({
        error: data?.error?.message || "Gemini core temporary issue! ⚡"
      });
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Empty response from Gemini engine."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({
      error: "Server connection error."
    });
  }
}
