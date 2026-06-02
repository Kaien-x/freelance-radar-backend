const axios = require('axios');

(async () => {
  try {
    const res = await axios.get(
      'https://www.reddit.com/r/forhire/new/.rss',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36',
        },
        validateStatus: () => true,
      }
    );

    console.log('STATUS:', res.status);
    console.log('TYPE:', res.headers['content-type']);
    console.log(
      typeof res.data === 'string'
        ? res.data.slice(0, 300)
        : res.data
    );
  } catch (err) {
    console.error(err);
  }
})();