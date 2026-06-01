const { MongoClient } = require('mongodb');

class MongoDB {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect() {
    try {
      // Parse MongoDB connection string from environment variable
      const connectionString = process.env.MONGODB_URI;
      
      this.client = new MongoClient(connectionString);
      
      this.client = new MongoClient(connectionString);

      await this.client.connect();
      this.db = this.client.db('freelance_radar');
      
      console.log('Connected to MongoDB Atlas');
      return true;
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  async initialize() {
    try {
      // Create collections with indexes
      const collections = [
        'users',
        'resumes', 
        'user_skills',
        'job_posts',
        'job_matches',
        'proposals'
      ];

      for (const collectionName of collections) {
        const collection = this.db.collection(collectionName);
        
        // Create indexes for better performance
        if (collectionName === 'users') {
          await collection.createIndex({ email: 1 }, { unique: true });
          await collection.createIndex({ created_at: -1 });
        } else if (collectionName === 'job_posts') {
          await collection.createIndex({ reddit_post_id: 1 }, { unique: true });
          await collection.createIndex({ posted_at: -1 });
        } else if (collectionName === 'job_matches') {
          await collection.createIndex({ user_id: 1, job_post_id: 1 });
          await collection.createIndex({ match_score: -1 });
        } else if (collectionName === 'proposals') {
          await collection.createIndex({ user_id: 1, job_match_id: 1 });
        }
        
        console.log(`Collection ${collectionName} initialized with indexes`);
      }

      console.log('MongoDB collections initialized');
      return true;
    } catch (error) {
      console.error('MongoDB initialization error:', error);
      throw error;
    }
  }

  async insertOne(collectionName, document) {
    try {
      const collection = this.db.collection(collectionName);
      const result = await collection.insertOne({
        ...document,
        created_at: new Date(),
        updated_at: new Date()
      });
      return result;
    } catch (error) {
      console.error(`Insert error in ${collectionName}:`, error);
      throw error;
    }
  }

  async findOne(collectionName, query) {
    try {
      const collection = this.db.collection(collectionName);
      return await collection.findOne(query);
    } catch (error) {
      console.error(`Find error in ${collectionName}:`, error);
      throw error;
    }
  }

  async findMany(collectionName, query = {}, options = {}) {
    try {
      const collection = this.db.collection(collectionName);
      return await collection.find(query, options).toArray();
    } catch (error) {
      console.error(`Find many error in ${collectionName}:`, error);
      throw error;
    }
  }

  async updateOne(collectionName, query, update) {
    try {
      const collection = this.db.collection(collectionName);
      const result = await collection.updateOne(
        query,
        { $set: { ...update, updated_at: new Date() } }
      );
      return result;
    } catch (error) {
      console.error(`Update error in ${collectionName}:`, error);
      throw error;
    }
  }

  async deleteOne(collectionName, query) {
    try {
      const collection = this.db.collection(collectionName);
      const result = await collection.deleteOne(query);
      return result;
    } catch (error) {
      console.error(`Delete error in ${collectionName}:`, error);
      throw error;
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      console.log('MongoDB connection closed');
    }
  }
}

module.exports = new MongoDB();
