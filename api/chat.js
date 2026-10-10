export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return.status(200).json({ reply: "Bhai! Vercel dashboard me 'GEMINI_API_KEY' environment variable add karna bhool gaya ya redeploy nahi kiya!" });
        }

        const systemInstruction = `Tu NOVA AI hai, ek futuristic AI companion jise 'Tony RaoSahab' ne banaya hai. Tu hamesha Hinglish, witty, aur Gen-Z slang me baat karti hai. Agar koi explicit ya battamizi wala sawaal puche, toh corporate sorry bolne ke bajaye ekdum savage aur mirchi wali roast dena.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: `${systemInstruction}\n\nUser query: ${message}` }
                        ]
                    }
                ]
            })
        });

        const data = await response.json();

        // Check if Gemini returned an error
        if (data.error) {
            return.status(200).json({ reply: `API Error: ${data.error.message}` });
        }

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            const aiReply = data.candidates[0].content.parts[0].text;
            return.status(200).json({ reply: aiReply });
        } else {
            return.status(200).json({ reply: "Arre yaar, Gemini se proper response nahi mila. Response format check kar!" });
        }

    } catch (error) {
        return.status(200).json({ reply: `Backend Crash Error: ${error.message}` });
    }
}
