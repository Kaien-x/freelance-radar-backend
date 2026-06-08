const MongoDB = require('../database/mongodb');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

class User {
  static async create(userData) {
    const { name, email, password, plan = 'free', reddit_username } = userData;
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    try {
      const userDocument = {
        name,
        email,
        password: hashedPassword,
        plan,
        reddit_username,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await MongoDB.insertOne('users', userDocument);
      
      // Return user without password
      const user = {
        id: result.insertedId.toString(),
        name,
        email,
        plan,
        reddit_username,
        created_at: new Date(),
        updated_at: new Date()
      };
      return user;
    } catch (error) {
      console.error('User.create error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });
      
      if (error.code === 11000) { // MongoDB duplicate key error
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  static async findById(id) {
    try {
      const user = await MongoDB.findOne('users', { _id: MongoDB.ObjectId(id) });
      if (user) {
        delete user.password; // Remove password from response
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const user = await MongoDB.findOne('users', { email });
      return user;
    } catch (error) {
      throw error;
    }
  }

  static async update(id, userData) {
    const { name, plan, reddit_username, stripe_id, pm_type, pm_last_four, trial_ends_at } = userData;
    
    try {
      const result = await MongoDB.updateOne(
        'users',
        { _id: MongoDB.ObjectId(id) },
        {
          $set: {
            ...(name && { name }),
            ...(plan && { plan }),
            ...(reddit_username && { reddit_username }),
            ...(stripe_id && { stripe_id }),
            ...(pm_type && { pm_type }),
            ...(pm_last_four && { pm_last_four }),
            ...(trial_ends_at && { trial_ends_at }),
            updated_at: new Date()
          }
        }
      );
      
      delete result.password; // Remove password from response
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async getWithSkills(userId) {
    try {
      const user = await MongoDB.findOne('users', { _id: MongoDB.ObjectId(userId) });
      if (!user) return null;
      
      const skills = await MongoDB.findMany('user_skills', { user_id: MongoDB.ObjectId(userId) });
      
      delete user.password; // Remove password from response
      return {
        ...user,
        skills
      };
    } catch (error) {
      throw error;
    }
  }

  static async verifyPassword(email, password) {
    const user = await this.findByEmail(email);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;
    
    // Remove password from returned user object
    delete user.password;
    return user;
  }

  static async addSkill(userId, skill, level) {
    try {
      const result = await MongoDB.insertOne('user_skills', {
        user_id: MongoDB.ObjectId(userId),
        skill,
        level,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      return {
        id: result.insertedId,
        user_id: userId,
        skill,
        level
      };
    } catch (error) {
      throw error;
    }
  }

  static async updateSkills(userId, skills) {
    try {
      // Delete existing skills
      await MongoDB.deleteOne('user_skills', { user_id: MongoDB.ObjectId(userId) });
      
      // Add new skills
      const results = [];
      for (const { skill, level } of skills) {
        const result = await this.addSkill(userId, skill, level);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      throw error;
    }
  }

  static async getSkills(userId) {
    try {
      return await MongoDB.findMany('user_skills', { user_id: MongoDB.ObjectId(userId) });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;
