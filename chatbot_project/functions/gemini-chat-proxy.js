// Filename: gemini-chat-proxy.js (Node.js example for serverless platforms)
const fetch = require('node-fetch'); // Or use built-in fetch in Node 18+

// This function signature might vary slightly depending on your serverless platform
// (e.g., Netlify, Vercel, Google Cloud Functions, AWS Lambda use similar concepts but specific handlers)
exports.handler = async function(event, context) {
    // --- Basic Security & Request Validation ---
    if (event.httpMethod !== 'POST') { // For Netlify/Vercel, GCF/Lambda check event structure
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const conversationHistoryFromClient = requestBody.conversation_history;
    if (!conversationHistoryFromClient || !Array.isArray(conversationHistoryFromClient) || conversationHistoryFromClient.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid conversation_history' }) };
    }

    // --- API Key Handling (Secure Way) ---
    const GEMINI_API_KEY = process.env.MY_GEMINI_API_KEY; // Choose your env variable name

    if (!GEMINI_API_KEY) {
        console.error('CRITICAL: MY_GEMINI_API_KEY environment variable is not set on the server!');
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error: API Key missing' }) };
    }

    // --- Call to Gemini API ---
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: conversationHistoryFromClient,
                // You can add generationConfig or safetySettings here if needed,
                // matching what you had in AI Studio:
                // "generationConfig": { "temperature": 0.7, "maxOutputTokens": 250 },
                // "safetySettings": [ { "category": "HARM_CATEGORY_...", "threshold": "BLOCK_..." } ]
            }),
        });

        const responseBodyText = await geminiResponse.text(); // Get raw text first for debugging
        let responseData;

        try {
            responseData = JSON.parse(responseBodyText);
        } catch (e) {
            console.error("Gemini API - Non-JSON response:", responseBodyText);
            return { statusCode: 500, body: JSON.stringify({ error: `Gemini API returned non-JSON: ${responseBodyText}` }) };
        }

        if (!geminiResponse.ok) {
            console.error("Gemini API Error Response:", responseData);
            return { statusCode: geminiResponse.status, body: JSON.stringify({ error: `Gemini API Error: ${responseData.error?.message || responseBodyText}` }) };
        }

        // --- Extracting the Reply ---
        // This path might need adjustment based on the exact model and API version
        let botReply = "Sorry, I couldn't formulate a response.";
        if (responseData.candidates && responseData.candidates[0]?.content?.parts[0]?.text) {
            botReply = responseData.candidates[0].content.parts[0].text;
        } else {
            console.warn("Gemini API - Could not extract reply from expected path in response:", responseData);
        }

        // --- Sending Response Back to Client ---
        return {
            statusCode: 200,
            // CORS Headers - adjust as needed for security
            headers: {
                'Access-Control-Allow-Origin': '*', // Or specify your WordPress domain
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS' // OPTIONS is needed for preflight requests
            },
            body: JSON.stringify({ reply: botReply }),
        };

    } catch (error) {
        console.error("Proxy Function - General Error:", error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' }, // For errors too
            body: JSON.stringify({ error: 'Internal Server Error in proxy function: ' + error.message })
        };
    }
};