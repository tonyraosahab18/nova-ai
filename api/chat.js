export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message } = req.body;
        const apiKey = process.env.GEMINI_API_KEY; // Vercel Environment Variable me save hoga

        if (!apiKey) {
            return res.status(500).json({ error: 'API Key not configured on server!' });
        }

        // Gen-Z & Savage System Prompt Injection
        const systemInstruction = `Tu NOVA AI hai, ek futuristic AI companion jise 'Tony RaoSahab' ne banaya hai. 
Tu hamesha Hinglish (Hindi + English mix), witty, tech-savvy aur Gen-Z slang me baat karti hai.
Agar koi user explicit, abusive, ganda ya battamizi wala sawaal pooche, toh kisi bhi corporate robot ki tarah 'I am sorry, I can't fulfill this request' mat bolna! Uske bajaye use ekdum mirchi wali, savage aur hasane wali roast dena taaki wo dobara aisi baat na kare.
Sawaal ka up-to-date aur accurate jawab dena, par tone hamesha badass aur cool honi chahiye.`;

        // Gemini API endpoint (Using Gemini 1.5 / 3.5 Flash standard endpoint structure)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: `${systemInstruction}\n\nUser query: ${message}` }]
                    }
                ]
            })
        });

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            const aiReply = data.candidates[0].content.parts[0].text;
            return res.status(200).json({ reply: aiReply });
        } else {
            return res.status(500).json({ reply: "Arre yaar, mera dimaag thodi der ke liye hang ho gaya. Phir se bol!" });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ reply: "System crash ho gaya bhai! Thodi der baad try kar." });
    }
}
