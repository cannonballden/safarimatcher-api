// populate_db.js
// This script populates the MongoDB database with animals, adventures, months and camps
// data extracted from the Safari Matcher frontend. It connects to the MongoDB cluster
// specified by the MONGODB_URI environment variable or falls back to a default
// connection string if none is provided. Collections are cleared before inserting
// the new documents to avoid duplicates.

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Load the catalog data from the JSON file. Adjust the path if you move the data file.
const dataPath = path.join(__dirname, 'data.json');
const catalog = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// Connection configuration
const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://chatgpt:w4SbfWlDtDi0MeQH@safaridevcluster.tlabvl4.mongodb.net/?retryWrites=true&w=majority&appName=SafariDevCluster';
const DB_NAME = process.env.DB_NAME || 'safarimatcher';

async function run() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('Connected to MongoDB. Populating collections...');

    // Define the collections and the corresponding arrays from the catalog
    const collections = {
      animals: catalog.animals,
      adventures: catalog.adventures,
      months: catalog.months,
      camps: catalog.camps.map(camp => {
        // Ensure minDuration and maxDuration fields exist for the range slider
        const minDuration = camp.minDuration ?? 3;
        const maxDuration = camp.maxDuration ?? 10;
        return { ...camp, minDuration, maxDuration };
      })
    };

    for (const [name, docs] of Object.entries(collections)) {
      const collection = db.collection(name);
      // Clear existing data
      await collection.deleteMany({});
      if (docs && docs.length) {
        await collection.insertMany(docs);
        console.log(`Inserted ${docs.length} documents into '${name}' collection.`);
      } else {
        console.log(`No documents to insert for '${name}'.`);
      }
    }

    console.log('Database population complete.');
  } catch (err) {
    console.error('Error populating database:', err);
  } finally {
    await client.close();
  }
}

run();