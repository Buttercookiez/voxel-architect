export default async function handler(req, res) {
    // 1. CORS Headers (Allow your frontend to talk to this backend)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle Preflight Options
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Server is missing API Key." });
    }

    // 2. LIST OF MODELS TO TRY (In order of preference)
    // If one fails, the code immediately tries the next one.
    const modelsToTry = [
        "gemini-1.5-flash-latest", // Newest
        "gemini-1.5-flash",        // Standard
        "gemini-1.5-flash-001",    // Specific Version
        "gemini-1.5-pro",          // High Intelligence
        "gemini-pro"               // Legacy / Most Compatible
    ];

    let lastError = "";

    // 3. Loop through models until one works
    for (const modelName of modelsToTry) {
        try {
            console.log(`Attempting model: ${modelName}`);
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            const systemPrompt = `
                You are a Voxel Generator.
                Task: Create a JSON array of voxels for: "${prompt}".
                Format: [{"x":0,"y":0,"z":0,"c":"#FF0000"}, ...]
                Rules: Size approx 12x12x12. Return ONLY valid JSON. No markdown.
            `;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemPrompt }] }],
                    generationConfig: { temperature: 0.4, maxOutputTokens: 10000 }
                })
            });

            // If Google says "404 Not Found" for this model, throw error to trigger next loop
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || response.statusText);
            }

            const data = await response.json();

            if (!data.candidates || !data.candidates[0].content) {
                throw new Error("Empty response from AI");
            }

            // 4. Clean and Parse
            let text = data.candidates[0].content.parts[0].text;
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const first = text.indexOf('[');
            const last = text.lastIndexOf(']');
            if (first !== -1 && last !== -1) text = text.substring(first, last + 1);

            const json = JSON.parse(text);

            // 5. Success! Send data back to frontend
            return res.status(200).json(json);

        } catch (e) {
            console.warn(`Model ${modelName} failed: ${e.message}`);
            lastError = e.message;
            // Loop continues to next model...
        }
    }

    // 6. If ALL models fail
    return res.status(500).json({ error: `All models failed. Last error: ${lastError}` });
}