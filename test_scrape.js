const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const url = 'https://en.wikipedia.org/wiki/3_(2012_film)';
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const $ = cheerio.load(res.data);
    console.log('Title:', $('title').text());
    console.log('Infobox image class exists?:', $('.infobox-image img').length);
    $('.infobox-image img').each((i, el) => {
      console.log(i, $(el).attr('src'), $(el).attr('alt'));
    });
    console.log('--- ALL INFOBOX IMAGES ---');
    $('table.infobox img').each((i, el) => {
      console.log(i, $(el).attr('src'), $(el).attr('alt'));
    });
  } catch(e) {
    console.error('Error:', e.message);
  }
}
test();
