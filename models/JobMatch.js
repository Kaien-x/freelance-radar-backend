const database = require('../database/database');

class JobMatch {
  static async create(userId, jobPostId, matchScore) {
    const sql = `
      INSERT INTO job_matches (user_id, job_post_id, match_score)
      VALUES (?, ?, ?)
    `;
    
    try {
      const result = await database.run(sql, [userId, jobPostId, matchScore]);
      return await this.findById(result.id);
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    const sql = `
      SELECT jm.*, jp.title, jp.body, jp.url, jp.subreddit, jp.posted_at
      FROM job_matches jm
      JOIN job_posts jp ON jm.job_post_id = jp.id
      WHERE jm.id = ?
    `;
    return await database.get(sql, [id]);
  }

  static async findByUserId(userId, dismissed = false, limit = 20, offset = 0) {
    const sql = `
      SELECT jm.*, jp.title, jp.body, jp.url, jp.subreddit, jp.posted_at
      FROM job_matches jm
      JOIN job_posts jp ON jm.job_post_id = jp.id
      WHERE jm.user_id = ? AND jm.dismissed = ?
      ORDER BY jm.match_score DESC, jm.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await database.all(sql, [userId, dismissed ? 1 : 0, limit, offset]);
  }

  static async findByUserAndJob(userId, jobPostId) {
    const sql = `
      SELECT jm.*, jp.title, jp.body, jp.url, jp.subreddit, jp.posted_at
      FROM job_matches jm
      JOIN job_posts jp ON jm.job_post_id = jp.id
      WHERE jm.user_id = ? AND jm.job_post_id = ?
    `;
    return await database.get(sql, [userId, jobPostId]);
  }

  static async updateMatchScore(id, matchScore) {
    const sql = `
      UPDATE job_matches 
      SET match_score = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await database.run(sql, [matchScore, id]);
    return await this.findById(id);
  }

  static async dismiss(id) {
    const sql = `
      UPDATE job_matches 
      SET dismissed = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await database.run(sql, [id]);
    return await this.findById(id);
  }

  static async dismissByUserAndJob(userId, jobPostId) {
    const sql = `
      UPDATE job_matches 
      SET dismissed = 1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND job_post_id = ?
    `;
    
    await database.run(sql, [userId, jobPostId]);
    return await this.findByUserAndJob(userId, jobPostId);
  }

  static async getTopMatches(userId, limit = 10) {
    const sql = `
      SELECT jm.*, jp.title, jp.body, jp.url, jp.subreddit, jp.posted_at
      FROM job_matches jm
      JOIN job_posts jp ON jm.job_post_id = jp.id
      WHERE jm.user_id = ? AND jm.dismissed = 0
      ORDER BY jm.match_score DESC, jm.created_at DESC
      LIMIT ?
    `;
    return await database.all(sql, [userId, limit]);
  }

  static async getUnmatchedJobsForUser(userId, limit = 50) {
    const sql = `
      SELECT jp.*
      FROM job_posts jp
      LEFT JOIN job_matches jm ON jp.id = jm.job_post_id AND jm.user_id = ?
      WHERE jm.id IS NULL
      ORDER BY jp.posted_at DESC
      LIMIT ?
    `;
    return await database.all(sql, [userId, limit]);
  }

  static async delete(id) {
    const sql = 'DELETE FROM job_matches WHERE id = ?';
    const result = await database.run(sql, [id]);
    return result.changes > 0;
  }

  static async deleteByUserId(userId) {
    const sql = 'DELETE FROM job_matches WHERE user_id = ?';
    const result = await database.run(sql, [userId]);
    return result.changes > 0;
  }
}

module.exports = JobMatch;
