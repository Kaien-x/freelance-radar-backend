const database = require('../database/database');

class Resume {
  static async create(userId, filePath, content = null) {
    const sql = `
      INSERT INTO resumes (user_id, file_path, content)
      VALUES (?, ?, ?)
    `;
    
    try {
      const result = await database.run(sql, [userId, filePath, content]);
      return await this.findById(result.id);
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    const sql = `
      SELECT id, user_id, file_path, content, created_at, updated_at
      FROM resumes WHERE id = ?
    `;
    return await database.get(sql, [id]);
  }

  static async findByUserId(userId) {
    const sql = `
      SELECT id, user_id, file_path, content, created_at, updated_at
      FROM resumes WHERE user_id = ?
    `;
    return await database.get(sql, [userId]);
  }

  static async update(id, filePath, content = null) {
    const sql = `
      UPDATE resumes 
      SET file_path = ?, content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await database.run(sql, [filePath, content, id]);
    return await this.findById(id);
  }

  static async delete(id) {
    const sql = 'DELETE FROM resumes WHERE id = ?';
    const result = await database.run(sql, [id]);
    return result.changes > 0;
  }

  static async deleteByUserId(userId) {
    const sql = 'DELETE FROM resumes WHERE user_id = ?';
    const result = await database.run(sql, [userId]);
    return result.changes > 0;
  }
}

module.exports = Resume;
