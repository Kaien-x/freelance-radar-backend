const database = require('../database/database');

class JobPost {
  static async create(jobData) {
    const { reddit_post_id, subreddit, title, body, url, posted_at } = jobData;
    const sql = `
      INSERT INTO job_posts (reddit_post_id, subreddit, title, body, url, posted_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    try {
      const result = await database.run(sql, [reddit_post_id, subreddit, title, body, url, posted_at]);
      return await this.findById(result.id);
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    const sql = `
      SELECT id, reddit_post_id, subreddit, title, body, url, posted_at, created_at, updated_at
      FROM job_posts WHERE id = ?
    `;
    return await database.get(sql, [id]);
  }

  static async findByRedditPostId(redditPostId) {
    const sql = `
      SELECT id, reddit_post_id, subreddit, title, body, url, posted_at, created_at, updated_at
      FROM job_posts WHERE reddit_post_id = ?
    `;
    return await database.get(sql, [redditPostId]);
  }

  static async getAll(limit = 50, offset = 0) {
    const sql = `
      SELECT id, reddit_post_id, subreddit, title, body, url, posted_at, created_at, updated_at
      FROM job_posts 
      ORDER BY posted_at DESC
      LIMIT ? OFFSET ?
    `;
    return await database.all(sql, [limit, offset]);
  }

  static async getBySubreddit(subreddit, limit = 50, offset = 0) {
    const sql = `
      SELECT id, reddit_post_id, subreddit, title, body, url, posted_at, created_at, updated_at
      FROM job_posts 
      WHERE subreddit = ?
      ORDER BY posted_at DESC
      LIMIT ? OFFSET ?
    `;
    return await database.all(sql, [subreddit, limit, offset]);
  }

  static async search(query, limit = 50, offset = 0) {
    const sql = `
      SELECT id, reddit_post_id, subreddit, title, body, url, posted_at, created_at, updated_at
      FROM job_posts 
      WHERE title LIKE ? OR body LIKE ?
      ORDER BY posted_at DESC
      LIMIT ? OFFSET ?
    `;
    const searchTerm = `%${query}%`;
    return await database.all(sql, [searchTerm, searchTerm, limit, offset]);
  }

  static async getRecent(limit = 20) {
    const sql = `
      SELECT id, reddit_post_id, subreddit, title, body, url, posted_at, created_at, updated_at
      FROM job_posts 
      ORDER BY posted_at DESC
      LIMIT ?
    `;
    return await database.all(sql, [limit]);
  }

  static async update(id, jobData) {
    const { subreddit, title, body, url, posted_at } = jobData;
    const sql = `
      UPDATE job_posts 
      SET subreddit = ?, title = ?, body = ?, url = ?, posted_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await database.run(sql, [subreddit, title, body, url, posted_at, id]);
    return await this.findById(id);
  }

  static async delete(id) {
    const sql = 'DELETE FROM job_posts WHERE id = ?';
    const result = await database.run(sql, [id]);
    return result.changes > 0;
  }
}

module.exports = JobPost;
