import axios from 'axios';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';

export const matchSchemes = async (userProfile, schemes) => {
    const prompt = `
    You are BharatSahayak AI, an expert in Indian government welfare schemes.
    Match the user to the most relevant schemes from the provided list. 
    Pay close attention to schemes marked with "high_match_probability": true as they are high-priority for this user's general demographic.

    USER PROFILE:
    ${JSON.stringify(userProfile, null, 2)}

    SCHEMES DATABASE (Filtered):
    ${JSON.stringify(schemes, null, 2)}

    TASK:
    1. Identify which schemes the user is strictly eligible for based on age, income, state, and category.
    2. For each matched scheme, provide:
       - Why they are eligible (Reasoning).
       - Any missing information or "Check if" warnings.
       - A step-by-step application guide.
       - A checklist of documents.
    3. Format the response as JSON. 
    4. Use simple, conversational language (6th-grade level).

    RESPONSE FORMAT (JSON):
    {
      "matches": [
        {
          "schemeName": "...",
          "reasoning": "...",
          "warnings": "...",
          "steps": ["..."],
          "documents": ["..."]
        }
      ]
    }
    `;

    try {
        const response = await axios.post(OLLAMA_URL, {
            model: 'llama3',
            prompt: prompt,
            stream: false,
            format: 'json'
        });

        return JSON.parse(response.data.response);
    } catch (error) {
        console.error('Ollama Error:', error.message);
        throw new Error('AI Reasoning failed');
    }
};

export const simplifyText = async (text) => {
    const prompt = `
    Simplify the following text for a 15-year-old or a rural citizen with limited education.
    Use clear, conversational terms. Avoid big words.

    TEXT:
    ${text}

    SIMPLIFIED VERSION:
    `;

    try {
        const response = await axios.post(OLLAMA_URL, {
            model: 'llama3',
            prompt: prompt,
            stream: false
        });

        return response.data.response.trim();
    } catch (error) {
        console.error('Ollama Error:', error.message);
        return text; // Fallback to original text
    }
};
