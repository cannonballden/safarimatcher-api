/**
 * SafariMatcher API (Express)
 *
 * This file implements the SafariMatcher backend.  It exposes
 * endpoints under the `/api` prefix for retrieving catalog data,
 * persisting user preferences and computing safari matches.  The
 * matching algorithm multiplies user ranking weights against the
 * probability of seeing each animal or performing each activity and
 * applies a modest boost for the user's preferred travel months.
 */

const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const catalogData = require('./data.json');

// Pull configuration from the environment with sensible defaults
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://chatgpt:w4SbfWlDtDi0MeQH@safaridevcluster.tlabvl4.mongodb.net/?retryWrites=true&w=majority&appName=SafariDevCluster';
const DATABASE_NAME = process.env.DB_NAME || 'safarimatcher';

// Memoize the MongoClient so we only connect once
let client;
async function connectDB(){
  if (!client){
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return client.db(DATABASE_NAME);
}

async function fetchCatalog(){
  return catalogData;
onst db = await connectDB();
  const [animals, adventures, months, camps] = await Promise.all([
    db.collection('animals').find({}).toArray(),
    db.collection('adventures').find({}).toArray(),
    db.collection('months').find({}).toArray(),
    db.collection('camps').find({}).toArray()
  ]);
  return { animals, adventures, months, camps };
}

// Create the Express app and apply middleware
const app = express();
app.use(cors());
app.use(express.json());

// GET /api/catalog -> full catalog of animals, adventures, months and camps
app.get('/api/catalog', async (req,res) => {
  // const catalogData = require('./data.json');

  try {
    const catalog = await fetchCatalog();
    res.json(catalog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

// POST /api/preferences -> stores user preferences for analytics
app.post('/api/preferences', async (req,res) => {
  try {
    const prefs = req.body;
    const db = await connectDB();
    await db.collection('user_preferences').insertOne({ prefs, createdAt: new Date() });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// Compute a score for a camp given the user's ranked items, month preferences and range
function computeScore(camp, animals, adventures, months){
  // Rank weights correspond to positions in the priority list
  const rankWeights = [25,20,16,13,10,8,6,5,4,3,2.5,2,1.5,1,0.5];
  let score = 0;
  animals.forEach((item, idx) => {
    const weight = rankWeights[idx] || 0;
    // Prefer full name but fall back to label
    const prob = (camp.animalProb && (camp.animalProb[item.full] ?? camp.animalProb[item.label])) || 0;
    score += weight * prob;
  });
  adventures.forEach((item, idx) => {
    const weight = rankWeights[idx] || 0;
    // Activities are always weighted at 0.75 if present
    const available = (camp.adventures || []).some(a => a === item.full || a === item.label);
    score += weight * (available ? 0.75 : 0);
  });
  // Month weighting: earlier selections have stronger influence
  const monthWeight = (monthId) => {
    const idx = months.indexOf(monthId);
    return idx === -1 ? 0 : (months.length - idx) / months.length;
  };
  if (camp.monthsBest)   score += 3 * monthWeight(camp.monthsBest);
  if (camp.monthsSecond) score += 2 * monthWeight(camp.monthsSecond);
  if (camp.monthsThird)  score += 1 * monthWeight(camp.monthsThird);
  return score;
}

// POST /api/match -> returns the top 3 camps in each category matching prefs
app.post('/api/match', async (req,res) => {
  try {
    const { rankedItems = [], months = [], range = { min: 1, max: 60 } } = req.body;
    const db = await connectDB();
    // Only include camps within the requested nights range
    const camps = await db.collection('camps').find({
      minDuration: { $lte: range.max },
      maxDuration: { $gte: range.min }
    }).toArray();
    const animals  = rankedItems.filter(x => x.type === 'animal');
    const adv      = rankedItems.filter(x => x.type === 'adventure');
    const scored   = camps.map(camp => ({ camp, score: computeScore(camp, animals, adv, months) }));
    const categories = ['CAMP','GLAMP','FANCY'];
    const results = {};
    categories.forEach(cat => {
      results[cat] = scored
        .filter(x => (x.camp.category === cat))
        .sort((a,b) => b.score - a.score)
        .slice(0, 3);
    });
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to match safaris' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`SafariMatcher API listening on port ${PORT}`);
});
