const axios = require('axios');

axios.get('https://api.reddit.com/r/forhire/new?limit=5')
  .then(res => {
    console.log(res.status);
  })
  .catch(err => {
    console.log(err.response?.status);
    console.log(err.response?.headers);
  });