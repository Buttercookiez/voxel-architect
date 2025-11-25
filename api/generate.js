export default async function handler(req, res) {
    // 1. Setup headers for CORS (allows your site to talk to this function)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. Get the Prompt from the frontend
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Server missing API Key" });
    }

    // 3. Define the Model (We use the stable Flash model)
    const modelName = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const systemPrompt = `
        You are a Voxel Generator.
        Create a JSON array of voxels for: "${prompt}".
        Format: [{"x":0,"y":0,"z":0,"c":"#FF0000"}, ...]
        Rules: Size approx 12x12x12. Return ONLY valid JSON. No markdown.
    `;

    try {
        // 4. Call Google
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 10000 }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "Google API Error");
        }

        // 5. Extract and Clean JSON
        let text = data.candidates[0].content.parts[0].text;
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const first = text.indexOf('[');
        const last = text.lastIndexOf(']');
        if (first !== -1 && last !== -1) text = text.substring(first, last + 1);

        // 6. Send pure JSON back to frontend
        res.status(200).json(JSON.parse(text));

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}