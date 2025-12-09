#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import {
  lookupPokemon,
  validateMoveset,
  validateTeam,
  suggestTeamCoverage,
} from './tools.js';
import {
  getPopularSets,
  getMetaThreats,
  getTeammates,
  getChecksCounters,
  getMetagameStats,
} from './stats.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '0.2.0' });
});

// Basic tools
app.post('/api/lookup', async (req, res) => {
  try {
    const result = lookupPokemon(req.body);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/validate-moveset', async (req, res) => {
  try {
    const result = validateMoveset(req.body);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/validate-team', async (req, res) => {
  try {
    const result = validateTeam(req.body);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/coverage', async (req, res) => {
  try {
    const result = suggestTeamCoverage(req.body);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Stats tools
app.post('/api/popular-sets', async (req, res) => {
  try {
    const result = await getPopularSets(req.body);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/meta-threats', async (req, res) => {
  try {
    const result = await getMetaThreats(req.body);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/teammates', async (req, res) => {
  try {
    const result = await getTeammates(req.body);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/checks-counters', async (req, res) => {
  try {
    const result = await getChecksCounters(req.body);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/metagame', async (req, res) => {
  try {
    const result = await getMetagameStats(req.body);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.listen(PORT, () => {
  console.log(`Pokémon API Server running on http://localhost:${PORT}`);
});
