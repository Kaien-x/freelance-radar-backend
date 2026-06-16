'use strict';

/**
 * Seed SubredditMeta collection with all known freelance/job subreddits.
 * Run: node scripts/seedSubreddits.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SubredditMeta = require('../models/SubredditMeta');

const SUBREDDITS = [
  // Core Freelance Job Boards
  { name: 'forhire',            subscribers: 580000  },
  { name: 'freelance',          subscribers: 420000  },
  { name: 'slavelabour',        subscribers: 390000  },
  { name: 'hiring',             subscribers: 45000   },
  { name: 'WorkOnline',         subscribers: 340000  },
  { name: 'remotejobs',         subscribers: 95000   },
  { name: 'jobbit',             subscribers: 50000   },

  // Web & Software Development
  { name: 'webdev',             subscribers: 2200000 },
  { name: 'webdesign',          subscribers: 390000  },
  { name: 'Wordpress',          subscribers: 340000  },
  { name: 'shopify',            subscribers: 380000  },
  { name: 'gamedev',            subscribers: 650000  },
  { name: 'androiddev',         subscribers: 320000  },
  { name: 'iOSProgramming',     subscribers: 170000  },
  { name: 'unity3d',            subscribers: 250000  },
  { name: 'unrealengine',       subscribers: 310000  },
  { name: 'godot',              subscribers: 420000  },
  { name: 'devops',             subscribers: 240000  },
  { name: 'netsec',             subscribers: 440000  },
  { name: 'ethdev',             subscribers: 60000   },

  // Design & Visual Creative
  { name: 'graphic_design',     subscribers: 510000  },
  { name: 'logodesign',         subscribers: 180000  },
  { name: 'UI_Design',          subscribers: 140000  },
  { name: 'MotionDesign',       subscribers: 90000   },
  { name: 'VideoEditing',       subscribers: 290000  },
  { name: 'Filmmakers',         subscribers: 340000  },
  { name: '3Dmodeling',         subscribers: 200000  },
  { name: 'blender',            subscribers: 1200000 },
  { name: 'animation',          subscribers: 250000  },
  { name: 'artcommissions',     subscribers: 130000  },
  { name: 'Illustrators',       subscribers: 310000  },
  { name: 'photography',        subscribers: 4200000 },

  // Writing & Content
  { name: 'HireaWriter',        subscribers: 30000   },
  { name: 'copywriting',        subscribers: 180000  },
  { name: 'freelanceWriters',   subscribers: 75000   },
  { name: 'technicalwriting',   subscribers: 50000   },
  { name: 'content_marketing',  subscribers: 100000  },

  // Audio, Music & Voice
  { name: 'VoiceActing',        subscribers: 140000  },
  { name: 'sounddesign',        subscribers: 120000  },
  { name: 'WeAreTheMusicMakers', subscribers: 720000 },
  { name: 'podcasting',         subscribers: 200000  },

  // Data, AI & Analytics
  { name: 'datascience',        subscribers: 1400000 },
  { name: 'MachineLearning',    subscribers: 2900000 },
  { name: 'dataengineering',    subscribers: 260000  },

  // Marketing & Growth
  { name: 'DigitalMarketing',   subscribers: 390000  },
  { name: 'SEO',                subscribers: 310000  },
  { name: 'socialmedia',        subscribers: 430000  },
  { name: 'PPC',                subscribers: 80000   },

  // Productivity & Automation
  { name: 'Excel',              subscribers: 920000  },
  { name: 'sheets',             subscribers: 130000  },

  // Translation & Language
  { name: 'translators',        subscribers: 60000   },

  // Virtual Assistant & Admin
  { name: 'VirtualAssistant',   subscribers: 50000   },

  // Business & Startups
  { name: 'startups',           subscribers: 1400000 },
  { name: 'Entrepreneur',       subscribers: 3600000 },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected\n');

    await SubredditMeta.deleteMany({});
    console.log('Cleared existing entries\n');

    for (const sr of SUBREDDITS) {
      await SubredditMeta.create({ name: sr.name, subscribers: sr.subscribers, lastChecked: Date.now() });
      console.log(`  + ${sr.name}`);
    }

    console.log(`\nDone: ${SUBREDDITS.length} subreddits seeded`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
