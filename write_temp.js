const axios = require('axios');
const fs = require('fs');

async function test() {
  const url = 'https://en.wikipedia.org/wiki/Jailer_(2023_film)';
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    fs.writeFileSync('c:/music1/temp_wiki.html', res.data);
    console.log('Done writing HTML file! Length:', res.data.length);
  } catch(e) {
    console.error('Error:', e.message);
  }
}
test();
