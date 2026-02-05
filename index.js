import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchSchemes, simplifyText } from './services/aiService.js';
import { translateText } from './services/translationService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Load schemes from JSON
const loadSchemes = async () => {
    const data = await fs.readFile(path.join(__dirname, 'data', 'schemes_large.json'), 'utf8');
    return JSON.parse(data);
};

// Pre-filter schemes to reduce LLM context and improve accuracy
const filterSchemes = (schemes, profile) => {
    return schemes.filter(s => {
        // State Match (Allow All India)
        if (s.state !== 'All India' && profile.state && s.state !== profile.state) return false;

        // Age Match
        const age = parseInt(profile.age);
        if (age && (age < s.eligibility.min_age || age > s.eligibility.max_age)) return false;

        // Income Match
        const income = parseInt(profile.income);
        if (income && s.eligibility.income_limit && income > s.eligibility.income_limit) return false;

        // Gender Match (Allow All)
        if (s.eligibility.gender !== 'All' && profile.gender && s.eligibility.gender !== profile.gender) return false;

        return true;
    }).slice(0, 30); // Top 30 for the AI to "reason" about
};

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'BharatSahayak AI is running' });
});

// Get all schemes
app.get('/api/schemes', async (req, res) => {
    try {
        const schemes = await loadSchemes();
        res.json(schemes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load schemes' });
    }
});

// Search schemes
app.get('/api/schemes/search', async (req, res) => {
    try {
        const { q } = req.query;
        const schemes = await loadSchemes();
        if (!q) return res.json(schemes);

        const filtered = schemes.filter(s =>
            s.name.toLowerCase().includes(q.toLowerCase()) ||
            s.name_hi.includes(q) ||
            s.description.toLowerCase().includes(q.toLowerCase())
        );
        res.json(filtered);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// AI matching endpoint
app.post('/api/ai/match', async (req, res) => {
    try {
        const { profile, lang = 'en' } = req.body;
        const allSchemes = await loadSchemes();

        // Pre-filter to keep AI efficient
        const filteredSchemes = filterSchemes(allSchemes, profile);

        // Match using AI
        const result = await matchSchemes(profile, filteredSchemes);

        // If language is not English, translate the results
        if (lang !== 'en') {
            for (let match of result.matches) {
                match.schemeName = await translateText(match.schemeName, lang);
                match.reasoning = await translateText(match.reasoning, lang);
                match.warnings = await translateText(match.warnings, lang);
                match.steps = await Promise.all(match.steps.map(step => translateText(step, lang)));
                match.documents = await Promise.all(match.documents.map(doc => translateText(doc, lang)));
            }
        }

        res.json(result);
    } catch (error) {
        console.error('AI Matching Error:', error.message);
        res.status(500).json({ error: 'AI matching failed. Please ensure Ollama is running.' });
    }
});

// AI Simplification ("Explain Like I'm 15")
app.post('/api/ai/simplify', async (req, res) => {
    try {
        const { text } = req.body;
        const simplified = await simplifyText(text);
        res.json({ simplified });
    } catch (error) {
        res.status(500).json({ error: 'Simplification failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
