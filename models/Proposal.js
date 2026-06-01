const database = require('../database/database');

class Proposal {
  static async create(userId, jobMatchId, content, tone = 'professional') {
    const sql = `
      INSERT INTO proposals (user_id, job_match_id, content, tone)
      VALUES (?, ?, ?, ?)
    `;
    
    try {
      const result = await database.run(sql, [userId, jobMatchId, content, tone]);
      return await this.findById(result.id);
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    const sql = `
      SELECT p.*, u.name as user_name, jp.title as job_title, jp.subreddit
      FROM proposals p
      JOIN users u ON p.user_id = u.id
      JOIN job_matches jm ON p.job_match_id = jm.id
      JOIN job_posts jp ON jm.job_post_id = jp.id
      WHERE p.id = ?
    `;
    return await database.get(sql, [id]);
  }

  static async findByUserId(userId, limit = 20, offset = 0) {
    const sql = `
      SELECT p.*, jm.match_score, jp.title, jp.body, jp.url, jp.subreddit, jp.posted_at
      FROM proposals p
      JOIN job_matches jm ON p.job_match_id = jm.id
      JOIN job_posts jp ON jm.job_post_id = jp.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await database.all(sql, [userId, limit, offset]);
  }

  static async findByJobMatchId(jobMatchId) {
    const sql = `
      SELECT p.*, u.name as user_name
      FROM proposals p
      JOIN users u ON p.user_id = u.id
      WHERE p.job_match_id = ?
      ORDER BY p.created_at DESC
    `;
    return await database.all(sql, [jobMatchId]);
  }

  static async findByUserAndJobMatch(userId, jobMatchId) {
    const sql = `
      SELECT p.*, jm.match_score, jp.title, jp.body, jp.url, jp.subreddit, jp.posted_at
      FROM proposals p
      JOIN job_matches jm ON p.job_match_id = jm.id
      JOIN job_posts jp ON jm.job_post_id = jp.id
      WHERE p.user_id = ? AND p.job_match_id = ?
    `;
    return await database.get(sql, [userId, jobMatchId]);
  }

  static async update(id, content, tone) {
    const sql = `
      UPDATE proposals 
      SET content = ?, tone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await database.run(sql, [content, tone, id]);
    return await this.findById(id);
  }

  static async getTodayProposals(userId) {
    const sql = `
      SELECT p.*, jm.match_score, jp.title, jp.subreddit
      FROM proposals p
      JOIN job_matches jm ON p.job_match_id = jm.id
      JOIN job_posts jp ON jm.job_post_id = jp.id
      WHERE p.user_id = ? AND DATE(p.created_at) = DATE('now')
      ORDER BY p.created_at DESC
    `;
    return await database.all(sql, [userId]);
  }

  static async getRecentProposals(userId, limit = 10) {
    const sql = `
      SELECT p.*, jm.match_score, jp.title, jp.subreddit
      FROM proposals p
      JOIN job_matches jm ON p.job_match_id = jm.id
      JOIN job_posts jp ON jm.job_post_id = jp.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT ?
    `;
    return await database.all(sql, [userId, limit]);
  }

  static async delete(id) {
    const sql = 'DELETE FROM proposals WHERE id = ?';
    const result = await database.run(sql, [id]);
    return result.changes > 0;
  }

  static async deleteByUserId(userId) {
    const sql = 'DELETE FROM proposals WHERE user_id = ?';
    const result = await database.run(sql, [userId]);
    return result.changes > 0;
  }

  static async deleteByJobMatchId(jobMatchId) {
    const sql = 'DELETE FROM proposals WHERE job_match_id = ?';
    const result = await database.run(sql, [jobMatchId]);
    return result.changes > 0;
  }
}

module.exports = Proposal;
