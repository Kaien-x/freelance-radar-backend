'use strict';

/**
 * Seed SubredditMeta collection with all known freelance/job subreddits.
 * Run: node scripts/seedSubreddits.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SubredditMeta = require('../models/SubredditMeta');

const SUBREDDITS = [
  // Dedicated freelance job boards
  { name: 'forhire',          subscribers: 580000  },
  { name: 'slavelabour',      subscribers: 390000  },
  { name: 'freelance',        subscribers: 420000  },
  { name: 'hiring',           subscribers: 45000   },
  { name: 'WorkOnline',       subscribers: 340000  },
  { name: 'jobbit',           subscribers: 50000   },
  { name: 'HireaWriter',      subscribers: 30000   },

  // Creative commissions
  { name: 'artcommissions',   subscribers: 130000  },
  { name: 'Illustrators',     subscribers: 310000  },
  { name: 'logodesign',       subscribers: 180000  },
  { name: 'VideoEditing',     subscribers: 290000  },
  { name: 'VoiceActing',      subscribers: 140000  },

  // Tech
  { name: 'webdev',           subscribers: 2200000 },
  { name: 'Wordpress',        subscribers: 340000  },
  { name: 'shopify',          subscribers: 380000  },
  { name: 'gamedev',          subscribers: 650000  },
  { name: 'ethdev',           subscribers: 60000   },

  // Writing & Marketing
  { name: 'copywriting',      subscribers: 180000  },
  { name: 'SEO',              subscribers: 310000  },

  // VA & Admin
  { name: 'VirtualAssistant', subscribers: 50000   },
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
