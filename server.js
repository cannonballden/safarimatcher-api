const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

// Configuration: customize via environment variables if needed
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://chatgpt:w4SbfWlDtDi0MeQH@safaridevcluster.tlabvl4.mongodb.net/?retryWrites=true&w=majority&appName=SafariDevCluster';
const DB_NAME = process.env.DB_NAME || 'safarimatcher'; // or 'travel' depending on your setup

// Connect once and reuse the same client
let client;
async function connectDB(){
  if (!client){
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return client.db(DB_NAME);
}

// Fetch catalog collections from MongoDB
async function fetchCatalog(){
  const db = await connectDB();
  const [animals, adventures, months, camps] = await Promise.all([
    db.collection('animals').find({}).toArray(),
    db.collection('adventures').find({}).toArray(),
    db.collection('months').find({}).toArray(),
    db.collection('camps').find({}).toArray()
  ]);
  return { animals, adventures, months, camps };
}

// Weights for ranked positions (1st to 15th)
const rankWeights = [25, 20, 16, 13, 10, 8, 6, 5, 4, 3, 2.5, 2, 1.5, 1, 0.5];

function computeScore(camp, animals, adventures, months){
  let score = 0;
  // Animals: weight * probability
  animals.forEach((item, idx) => {
    const weight = rankWeights[idx] || 0;
    const prob = (camp.animalProb && (camp.animalProb[item.full] ?? camp.animalProb[item.label])) || 0;
    score += weight * prob;
  });
  // Adventures: presence yields 0.75
  adventures.forEach((item, idx) => {
    const weight = rankWeights[idx] || 0;
    const available = (camp.adventures || []).includes(item.full) || (camp.adventures || []).includes(item.label);
    score += weight * (available ? 0.75 : 0);
  });
  // Month weighting: earlier selections have stronger influence
  const monthWeight = (id) => {
    const idx = months.indexOf(id);
    return idx === -1 ? 0 : (months.length - idx) / months.length;
  };
  if (camp.monthsBest) score += 3 * monthWeight(camp.monthsBest);
  if (camp.monthsSecond) score += 2 * monthWeight(camp.monthsSecond);
  if (camp.monthsThird) score += 1 * monthWeight(camp.monthsThird);
  return score;
}

async function matchSafaris({ rankedItems = [], months = [], range = { min: 1, max: 60 } }){
  const db = await connectDB();
  // Only include camps within the requested night range; if minDuration/maxDuration fields are missing,
  // treat them as [1, 60] by default
  const camps = await db.collection('camps').find({
    $expr: {
      $and: [
        { $lte: [ { $ifNull: ['$minDuration', 1] }, range.max ] },
        { $gte: [ { $ifNull: ['$maxDuration', 60] }, range.min ] }
      ]
    }
  }).toArray();
  const animals = rankedItems.filter(x => x.type === 'animal');
  const adv = rankedItems.filter(x => x.type === 'adventure');
  const scored = camps.map(camp => ({ camp, score: computeScore(camp, animals, adv, months) }));
  const categories = ['CAMP','GLAMP','FANCY'];
  const results = {};
  categories.forEach(cat => {
    results[cat] = scored
      .filter(x => x.camp.category === cat)
      .sort((a,b) => b.score - a.score)
      .slice(0,3);
  });
  return results;
}

const app = express();
app.use(cors());
app.use(express.json());

// GET /api/catalog
app.get('/api/catalog', async (req, res) => {
  try {
    const catalog = await fetchCatalog();
    res.json(catalog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Failed to fetch catalog' });
  }
});

// POST /api/preferences – store user preferences
app.post('/api/preferences', async (req,res) => {
  try {
    const prefs = req.body;
    const db = await connectDB();
    await db.collection('user_preferences').insertOne({ prefs, createdAt: new Date() });
    res.json({ ok:true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Failed to save preferences' });
  }
});

// POST /api/match – compute and return matches
app.post('/api/match', async (req,res) => {
  try {
    const { rankedItems = [], months = [], range = { min:1, max:60 } } = req.body;
    const results = await matchSafaris({ rankedItems, months, range });
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Failed to match safaris' });
  }
});

app.listen(PORT, () => console.log(`SafariMatcher API listening on ${PORT}`));