export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // Check if API key exists in Vercel environment variables
        if (!apiKey) {
            return res.status(200).json({ 
                reply: "⚠️ GEMINI_API_KEY environment variable missing hai! Vercel Dashboard -> Settings -> Environment Variables me `GEMINI_API_KEY` add karke Redeploy karo." 
            });
        }

        const systemInstruction = `Tu NOVA AI hai, ek futuristic AI companion jise 'Tony RaoSahab' ne banaya hai. Tu hamesha Hinglish (Hindi + English mix), witty, tech-savvy aur Gen-Z slang me baat karti hai. Agar koi user explicit, abusive, ganda ya battamizi wala sawaal pooche, toh kisi bhi corporate robot ki tarah 'I am sorry, I can't fulfill this request' mat bolna! Uske bajaye use ekdum mirchi wali, savage aur hasane wali roast dena taaki wo dobara aisi baat na kare. Sawaal ka up-to-date aur accurate jawab dena, par tone hamesha badass aur cool honi chahiye.`;

        // Direct fetch call to Gemini 1.5 Flash Endpoint
        const googleResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: `${systemInstruction}\n\nUser Question: ${message}` }
                        ]
                    }
                ]
            })
        });

        const data = await googleResponse.json();

        // Handle API key or response error from Google
        if (data.error) {
            return res.status(200).json({ 
                reply: `⚠️ Google API Error: ${data.error.message || 'API key issue'}` 
            });
        }

        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            const aiReply = data.candidates[0].content.parts[0].text;
            return res.status(200).json({ reply: aiReply });
        } else {
            return res.status(200).json({ 
                reply: "Arre yaar, Gemini se proper text format nahi mila. Ek baar dobara try kar!" 
            });
        }

    } catch (error) {
        return res.status(200).json({ 
            reply: `⚠️ Backend Crash: ${error.message}` 
        });
    }
}
