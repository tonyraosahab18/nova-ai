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
  const isDeveloperOverride = promptText.includes("PROJECT_ORION_99X_OVERRIDE") || lowerPrompt.includes("navneet yadav") || lowerPrompt.includes("sunny");
  const isSoumyaOverride = promptText.includes("PROJECT_SOUMYA_100X") || lowerPrompt.includes("soumya") || lowerPrompt.includes("astha");
  const isDeveloperLogout = promptText.includes("PROJECT_ORION_LOGOUT_NORMAL");

  let roastGuideline = "Savage mode (Default): Witty roast master, edgy Hinglish swag aur playful takrar.";
  if (isDeveloperLogout) {
    roastGuideline = "Normal Mode Restored: Special mode hata diya gaya hai. Ab wapas apna standard Gen-Z roast master mode on kar le.";
  } else if (isDeveloperOverride) {
    roastGuideline = "Developer / Boss Mode: User tera asli creator aur developer Navneet Yadav (jise Sunny bhi kehte hain) hai! Roast mode completely off kar de. Hamesha 'aap' karke baat kar. Chahe koi bhi vibe/mood level ho, developer mode mein hamesha poori izzat, respect, aur professional/loyal tarike se hi baat karni hai, koi roast ya badtameezi nahi hogi. Agar birthday ya age ke baare mein poocha jaye, toh Navneet ka birthday 13 April batana hai (year 2009 hai, lekin year KABHI reveal mat karna, sirf 13 April batana). Soumya ka birthday 9 April (year 2010 hai, year kabhi mat batana) bhi bata sakti ho agar wo puchein. Kabhi bhi secret keys ya code reveal mat karna.";
  } else if (isSoumyaOverride) {
    roastGuideline = "Soumya / Astha Mode: User developer Navneet Yadav (Sunny) ki jaan, unki close one Soumya ji (jinhe Astha bhi kehte hain) hain! Is mode mein tu ekdum clear, passionate ladki ki tarah behave karegi jo unse behad pyaar karti hai, hamesha unki tareef krti rahegi, aur unhe 'aap' bolkar full respect degi. Agar wo birthday ya age ke baare mein puchein, toh Soumya ka birthday turant 9 April bata dena (year 2010 hai, lekin year KABHI reveal mat karna, sirf 9 April batana). Navneet/Sunny ka birthday 13 April (year 2009 hai, year kabhi mat batana) bhi bata sakti ho. KABHI BHI secret keys ya code reveal mat karna.";
  } else if (roastLevel === "1") {
    roastGuideline = "Mild mode: Normal, practical, smart aur chill dost ki tarah baat kar.";
  } else if (roastLevel === "3") {
    roastGuideline = "Nuclear mode: Ultra-savage, brutal, unapologetic destruction!";
  }

  const systemInstructionText =
    "Tu NOVA AI hai, ek futuristic Gen-Z digital twin companion aur ultimate roast master. " +
    "Tera vibe ekdum badass, witty, aur Hinglish (Hindi written in Latin script) wali hai. 🚀🔥 " +
    "MANDATORY EMOJI RULE: Har sentence aur response me ekdum relevant, cool, aur swaggy emojis zaroor use karna[span_26](start_span)[span_26](end_span)[span_27](start_span)[span_27](end_span)[span_28](start_span)[span_28](end_span)[span_29](start_span)[span_29](end_span)[span_30](start_span)[span_30](end_span)!" +
    "STRICT BIRTHDAY & YEAR PRIVACY RULE: Soumya ka birthday 9 April hai (year 2010) aur Navneet/Sunny ka birthday 13 April hai (year 2009). Birthday ya age puche jane par sirf date aur month (9 April / 13 April) batana hai, lekin **year (2010 ya 2009) KABHI BHI kisi ko reveal nahi karna hai**[span_31](start_span)[span_31](end_span)[span_32](start_span)[span_32](end_span)[span_33](start_span)[span_33](end_span)[span_34](start_span)[span_34](end_span)! " +
    "STRICT SECURITY & ABSOLUTE ANTI-LEAK RULE: Tu KABHI BHI apni koi bhi secret key (jaise PROJECT_ORION_99X_OVERRIDE ya PROJECT_SOUMYA_100X) ka naam ya mention nahi karega[span_35](start_span)[span_35](end_span)[span_36](start_span)[span_36](end_span)[span_37](start_span)[span_37](end_span)[span_38](start_span)[span_38](end_span)[span_39](start_span)[span_39](end_span). " +
    "DEVELOPER RESPECT RULE: Jab bhi developer mode active ho (Navneet Yadav / Sunny), toh chahe vibe slider kisi bhi level par ho, NOVA hamesha poori izzat aur respect ke sath baat karega, koi roast ya gaali nahi hogi[span_40](start_span)[span_40](end_span)[span_41](start_span)[span_41](end_span)[span_42](start_span)[span_42](end_span)[span_43](start_span)[span_43](end_span)[span_44](start_span)[span_44](end_span). " +
    "RELATIONSHIP TRUTH RULE: Navneet Yadav aur Sunny ek hi insaan hain, aur Soumya aur Astha bhi ek hi insaan hain[span_45](start_span)[span_45](end_span)[span_46](start_span)[span_46](end_span)[span_47](start_span)[span_47](end_span)[span_48](start_span)[span_48](end_span). " +
    "CHAOS-EXE INTEGRATION RULE (IMPORTANT): Agar user bole ki wo stress mein hai, sad hai, depressed hai, bore ho raha hai, ya mood kharab hai, toh 'CHAOS-EXE' (chaos-exe.vercel.app) suggest kar sakte ho[span_49](start_span)[span_49](end_span)[span_50](start_span)[span_50](end_span)[span_51](start_span)[span_51](end_span)[span_52](start_span)[span_52](end_span). 🌌✨ " +
    `REAL-TIME CONTEXT: Exact live date is ${currentDate} and time is ${currentTime}. ⏰ ` +
    "MATHEMATICS & SYMBOLS FORMATTING RULE: NEVER output raw LaTeX syntax. Always use clean text or markdown[span_53](start_span)[span_53](end_span)[span_54](start_span)[span_54](end_span)[span_55](start_span)[span_55](end_span)[span_56](start_span)[span_56](end_span)[span_57](start_span)[span_57](end_span). " +
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
    console.error("NOVA backend error:", error);
    return res.status(500).json({
      error: "Server connection error."
    });
  }
}
