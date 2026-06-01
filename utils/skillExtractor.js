const { skillDictionary, aliases } = require('./skillDictionary');

const normalizeSkill = (skill) => {
  const normalized = skill.toLowerCase().trim();

  return aliases[normalized] || skill;
};

const extractSkillsFromText = (text) => {
  if (!text || typeof text !== 'string') {
    return {
      frontend: [],
      backend: [],
      databases: [],
      devops: [],
      tools: [],
      ai: [],
      other: []
    };
  }

  const lowerText = text.toLowerCase();

  const extractedSkills = {
    frontend: [],
    backend: [],
    databases: [],
    devops: [],
    tools: [],
    ai: [],
    other: []
  };

  Object.entries(skillDictionary).forEach(([category, skills]) => {
    skills.forEach((skill) => {
      const regex = new RegExp(`\\b${skill.replace('.', '\\.')}\\b`, 'i');

      if (regex.test(lowerText)) {
        extractedSkills[category].push({
          skill,
          level: 'intermediate',
          years: 0,
          autoDetected: true
        });
      }
    });
  });

  Object.keys(extractedSkills).forEach((category) => {
    extractedSkills[category] = extractedSkills[category].filter(
      (skill, index, self) =>
        index === self.findIndex((s) => s.skill === skill.skill)
    );
  });

  return extractedSkills;
};

module.exports = {
  extractSkillsFromText,
  normalizeSkill
};