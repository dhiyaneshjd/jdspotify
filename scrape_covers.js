const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');
const HEADERS = {
  'User-Agent': 'JDMusicAppScraper/1.0 (contact@jdmusic.com) Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
};

const movieUpdates = {
  "cloudinary_1": { movie: "Meesaya Murukku", movieTamil: "மீசைய முறுக்கு", wiki: "Meesaya Murukku" },
  "cloudinary_2": { movie: "Kadal", movieTamil: "கடல்", wiki: "Kadal (2013 film)" },
  "cloudinary_3": { movie: "Thalapathi", movieTamil: "தளபதி", wiki: "Thalapathi" },
  "cloudinary_4": { movie: "Theri", movieTamil: "தெறி", wiki: "Theri (film)" },
  "cloudinary_5": { movie: "Tickets to My Downfall", movieTamil: "Tickets to My Downfall", wiki: "Tickets to My Downfall" },
  "cloudinary_6": { movie: "Teddy", movieTamil: "டெடி", wiki: "Teddy (film)" },
  "cloudinary_7": { movie: "3", movieTamil: "3", wiki: "3 (2012 Indian film)" },
  "cloudinary_8": { movie: "Naan", movieTamil: "நான்", wiki: "Naan (2012 film)" },
  "cloudinary_9": { movie: "Karnan", movieTamil: "கர்ணன்", wiki: "Karnan (2021 film)" },
  "cloudinary_10": { movie: "Leo", movieTamil: "லியோ", wiki: "Leo (2023 Indian film)" },
  "cloudinary_11": { movie: "Jagame Thandhiram", movieTamil: "ஜகமே தந்திரம்", wiki: "Jagame Thandhiram" },
  "cloudinary_12": { movie: "Soodhu Kavvum", movieTamil: "சூது கவ்வும்", wiki: "Soodhu Kavvum" },
  "cloudinary_13": { movie: "Karagattakaran", movieTamil: "கரகாட்டக்காரன்", wiki: "Karagattakaran" },
  "cloudinary_14": { movie: "Kanaa", movieTamil: "கனா", wiki: "Kanaa (film)" },
  "cloudinary_15": { movie: "Karuthamma", movieTamil: "கருத்தம்மா", wiki: "Karuthamma" },
  "cloudinary_16": { movie: "Jailer", movieTamil: "ஜெயிலர்", wiki: "Jailer (2023 Tamil film)" },
  "cloudinary_17": { movie: "Joker", movieTamil: "ஜோக்கர்", wiki: "Joker (2016 film)" },
  "cloudinary_18": { movie: "Asuran", movieTamil: "அசுரன்", wiki: "Asuran (2019 film)" },
  "cloudinary_19": { movie: "Payanangal Mudivathillai", movieTamil: "பயணங்கள் முடிவதில்லை", wiki: "Payanangal Mudivathillai" },
  "cloudinary_20": { movie: "Ghilli", movieTamil: "கில்லி", wiki: "Ghilli" }
};

async function getWikiImageUrl(wikiPage) {
  try {
    const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiPage.replace(/\s+/g, '_'))}`;
    console.log(`Fetching page: ${pageUrl}`);
    const res = await axios.get(pageUrl, { headers: HEADERS });
    const $ = cheerio.load(res.data);

    // Look for image inside standard Wikipedia infoboxes
    let imgSrc = null;
    
    // 1. Try infobox-image class
    const infoboxImg = $('.infobox-image img').first();
    if (infoboxImg.length > 0) {
      imgSrc = infoboxImg.attr('src');
    }
    
    // 2. Try any image inside table.infobox
    if (!imgSrc) {
      const firstTableImg = $('table.infobox img').first();
      if (firstTableImg.length > 0) {
        imgSrc = firstTableImg.attr('src');
      }
    }
    
    // 3. Fallback to thumbimage or standard img
    if (!imgSrc) {
      imgSrc = $('.thumbimage').first().attr('src') || $('img.mw-file-element').first().attr('src');
    }

    if (imgSrc) {
      if (imgSrc.startsWith('//')) {
        imgSrc = 'https:' + imgSrc;
      }
      return imgSrc;
    }
  } catch (err) {
    console.error(`Error fetching page "${wikiPage}":`, err.message);
  }
  return null;
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  
  for (let song of db.songs) {
    const update = movieUpdates[song.id];
    if (update) {
      console.log(`\nSong ID: ${song.id} | Title: "${song.title}"`);
      console.log(`Updating movie field to: "${update.movie}" / "${update.movieTamil}"`);
      
      song.movie = update.movie;
      song.movieTamil = update.movieTamil;
      
      const wikiImg = await getWikiImageUrl(update.wiki);
      if (wikiImg) {
        console.log(`Success! Found poster: ${wikiImg}`);
        song.coverUrl = wikiImg;
      } else {
        console.log(`Could not find Wikipedia poster. Keeping current cover.`);
      }
      
      // Wait to respect rate limits
      await new Promise(r => setTimeout(r, 800));
    }
  }
  
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  console.log('\nWikipedia cover scraping and movie updates complete! database.json updated.');
}

main();
