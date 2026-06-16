const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database Helpers
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ songs: [], playlists: [] }, null, 2));
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database:', err);
    return { songs: [], playlists: [] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing database:', err);
    return false;
  }
}

// --- Translation Helper ---
async function translateToTamil(text) {
  if (!text) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ta&dt=t&q=${encodeURIComponent(text)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    // Google Translate returns format: [[[translatedText, originalText, ...]]]
    if (response.data && response.data[0] && response.data[0][0]) {
      return response.data[0].map(item => item[0]).join('').trim();
    }
  } catch (err) {
    console.error(`Translation error for text "${text}":`, err.message);
  }
  return text; // Fallback to original text if translation fails
}

// --- Wikipedia Scraping Utility ---
async function scrapeTamilFilms(year) {
  const url = `https://en.wikipedia.org/wiki/List_of_Tamil_films_of_${year}`;
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const films = [];

    $('table.wikitable').each((tableIdx, tableEl) => {
      const headers = [];
      $(tableEl).find('tr').first().find('th, td').each((i, el) => {
        headers.push($(el).text().trim().toLowerCase());
      });

      // Filter tables that look like monthly release film listings (usually contain Title & Director)
      if (headers.includes('title')) {
        const grid = [];
        const rows = $(tableEl).find('tr');

        // Parse tables resolving rowspans/colspans
        rows.each((rowIndex, rowEl) => {
          let colIndex = 0;
          $(rowEl).find('td, th').each((cellIndex, cellEl) => {
            while (grid[rowIndex] && grid[rowIndex][colIndex] !== undefined) {
              colIndex++;
            }

            const text = $(cellEl).text().trim();
            const linkHref = $(cellEl).find('a').first().attr('href') || '';
            const rowspan = parseInt($(cellEl).attr('rowspan') || '1', 10);
            const colspan = parseInt($(cellEl).attr('colspan') || '1', 10);

            for (let r = 0; r < rowspan; r++) {
              const targetRow = rowIndex + r;
              if (!grid[targetRow]) {
                grid[targetRow] = [];
              }
              for (let c = 0; c < colspan; c++) {
                grid[targetRow][colIndex + c] = { text, linkHref };
              }
            }
            colIndex += colspan;
          });
        });

        // Determine column indexes
        const headerRow = grid[0] || [];
        let titleCol = -1;
        let directorCol = -1;
        let musicCol = -1;
        let castCol = -1;

        for (let c = 0; c < headerRow.length; c++) {
          if (headerRow[c]) {
            const hText = headerRow[c].text.toLowerCase();
            if (hText === 'title') titleCol = c;
            else if (hText === 'director') directorCol = c;
            else if (hText.includes('music') || hText.includes('composer')) musicCol = c;
            else if (hText === 'cast') castCol = c;
          }
        }

        if (titleCol !== -1) {
          for (let r = 1; r < grid.length; r++) {
            const row = grid[r];
            if (!row || !row[titleCol]) continue;

            let title = row[titleCol].text.replace(/\[\d+\]/g, '').trim();
            title = title.replace(/^["']|["']$/g, '').trim();

            if (!title || title.toLowerCase() === 'title' || title.toLowerCase() === 'untitled') continue;

            const director = directorCol !== -1 && row[directorCol] ? row[directorCol].text.replace(/\[\d+\]/g, '').trim() : 'Unknown';
            const music = musicCol !== -1 && row[musicCol] ? row[musicCol].text.replace(/\[\d+\]/g, '').trim() : 'Unknown';
            const cast = castCol !== -1 && row[castCol] ? row[castCol].text.replace(/\[\d+\]/g, '').trim() : 'Unknown';
            const wikiUrl = row[titleCol].linkHref ? `https://en.wikipedia.org${row[titleCol].linkHref}` : '';

            if (!films.some(f => f.title.toLowerCase() === title.toLowerCase())) {
              films.push({ title, director, music, cast, wikiUrl, year });
            }
          }
        }
      }
    });

    return films;
  } catch (err) {
    console.error(`Failed to scrape Wikipedia for year ${year}:`, err.message);
    return [];
  }
}

// --- API Endpoints ---

// GET: Scrape films from Wikipedia
app.get('/api/scrape-wiki', async (req, res) => {
  try {
    const films2025 = await scrapeTamilFilms(2025);
    const films2026 = await scrapeTamilFilms(2026);
    const allFilms = [...films2025, ...films2026].sort((a, b) => a.title.localeCompare(b.title));
    res.json({ success: true, films: allFilms });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to scrape Wikipedia tables', details: err.message });
  }
});

// GET: Translate text to Tamil
app.get('/api/translate', async (req, res) => {
  const { text } = req.query;
  if (!text) {
    return res.status(400).json({ error: 'Text query parameter is required' });
  }
  const translated = await translateToTamil(text);
  res.json({ original: text, translated });
});

// --- SONG CRUD API ---

// GET: Retrieve all songs
app.get('/api/songs', (req, res) => {
  const db = readDb();
  res.json(db.songs);
});

// POST: Add new song
app.post('/api/songs', async (req, res) => {
  const { title, movie, artist, audioUrl, coverUrl, accentColor } = req.body;

  if (!title || !audioUrl) {
    return res.status(400).json({ error: 'Title and Audio URL are required fields' });
  }

  const db = readDb();
  const id = 'song_' + Date.now();

  // Auto-translate names if not provided
  const titleTamil = req.body.titleTamil || await translateToTamil(title);
  const movieTamil = movie ? await translateToTamil(movie) : '';

  const newSong = {
    id,
    title,
    titleTamil,
    movie: movie || 'Single',
    movieTamil,
    artist: artist || 'Unknown Artist',
    audioUrl,
    coverUrl: coverUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop',
    accentColor: accentColor || '#1db954',
    isFavorite: false
  };

  db.songs.push(newSong);
  writeDb(db);

  res.status(201).json({ success: true, song: newSong });
});

// PUT: Update song
app.put('/api/songs/:id', async (req, res) => {
  const { id } = req.params;
  const { title, titleTamil, movie, artist, audioUrl, coverUrl, accentColor, isFavorite } = req.body;

  const db = readDb();
  const songIndex = db.songs.findIndex(s => s.id === id);

  if (songIndex === -1) {
    return res.status(404).json({ error: 'Song not found' });
  }

  const existingSong = db.songs[songIndex];

  // Update fields if provided
  if (title !== undefined) existingSong.title = title;
  if (titleTamil !== undefined) {
    existingSong.titleTamil = titleTamil;
  } else if (title !== undefined && title !== existingSong.title) {
    existingSong.titleTamil = await translateToTamil(title);
  }

  if (movie !== undefined) existingSong.movie = movie;
  if (artist !== undefined) existingSong.artist = artist;
  if (audioUrl !== undefined) existingSong.audioUrl = audioUrl;
  if (coverUrl !== undefined) existingSong.coverUrl = coverUrl;
  if (accentColor !== undefined) existingSong.accentColor = accentColor;
  if (isFavorite !== undefined) existingSong.isFavorite = isFavorite;

  writeDb(db);
  res.json({ success: true, song: existingSong });
});

// DELETE: Remove song
app.delete('/api/songs/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const initialCount = db.songs.length;

  db.songs = db.songs.filter(s => s.id !== id);
  
  // Also remove from any playlists
  db.playlists.forEach(playlist => {
    playlist.songIds = playlist.songIds.filter(sid => sid !== id);
  });

  if (db.songs.length === initialCount) {
    return res.status(404).json({ error: 'Song not found' });
  }

  writeDb(db);
  res.json({ success: true, message: 'Song deleted successfully' });
});

// --- PLAYLIST API ---

// GET: Retrieve all playlists
app.get('/api/playlists', (req, res) => {
  const db = readDb();
  res.json(db.playlists);
});

// POST: Create playlist
app.post('/api/playlists', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }

  const db = readDb();
  const id = 'playlist_' + Date.now();

  const newPlaylist = {
    id,
    name,
    songIds: []
  };

  db.playlists.push(newPlaylist);
  writeDb(db);

  res.status(201).json({ success: true, playlist: newPlaylist });
});

// POST: Add song to playlist
app.post('/api/playlists/:id/add', (req, res) => {
  const { id } = req.params;
  const { songId } = req.body;

  if (!songId) {
    return res.status(400).json({ error: 'Song ID is required' });
  }

  const db = readDb();
  const playlist = db.playlists.find(p => p.id === id);
  const songExists = db.songs.some(s => s.id === songId);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  if (!songExists) {
    return res.status(404).json({ error: 'Song not found' });
  }

  if (!playlist.songIds.includes(songId)) {
    playlist.songIds.push(songId);
    writeDb(db);
  }

  res.json({ success: true, playlist });
});

// DELETE: Remove song from playlist
app.delete('/api/playlists/:id/remove/:songId', (req, res) => {
  const { id, songId } = req.params;

  const db = readDb();
  const playlist = db.playlists.find(p => p.id === id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  playlist.songIds = playlist.songIds.filter(sid => sid !== songId);
  writeDb(db);

  res.json({ success: true, playlist });
});

// DELETE: Remove entire playlist
app.delete('/api/playlists/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const initialCount = db.playlists.length;

  db.playlists = db.playlists.filter(p => p.id !== id);

  if (db.playlists.length === initialCount) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  writeDb(db);
  res.json({ success: true, message: 'Playlist deleted successfully' });
});

// --- DOWNLOAD PROXY ---
app.get('/api/download', async (req, res) => {
  const { url, title } = req.query;

  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    const downloadTitle = title ? `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3` : 'song.mp3';
    
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadTitle)}"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    response.data.pipe(res);
  } catch (err) {
    console.error('Download proxy error:', err.message);
    res.status(500).send('Failed to download audio file via proxy');
  }
});

// GET: Search actual song metadata and audio file from JioSaavn API
app.get('/api/search-media', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    // 1. Search for songs on JioSaavn API
    const searchRes = await axios.get(`https://saavn.sumit.co/api/search/songs?query=${encodeURIComponent(query)}`);
    if (!searchRes.data.success || !searchRes.data.data.results || searchRes.data.data.results.length === 0) {
      return res.json({ success: false, message: 'No songs found for this query' });
    }

    // Get the first result's ID
    const topResult = searchRes.data.data.results[0];
    const songId = topResult.id;

    // 2. Fetch full song details containing download URLs
    const detailsRes = await axios.get(`https://saavn.sumit.co/api/songs?ids=${songId}`);
    if (!detailsRes.data.success || !detailsRes.data.data || detailsRes.data.data.length === 0) {
      return res.json({ success: false, message: 'Failed to retrieve song details' });
    }

    const song = detailsRes.data.data[0];
    
    // Extract high-quality download/streaming URL (usually 320kbps is the last one)
    const downloadUrls = song.downloadUrl || [];
    const bestUrlObj = downloadUrls.find(d => d.quality === '320kbps') || downloadUrls.find(d => d.quality === '160kbps') || downloadUrls[downloadUrls.length - 1];
    const audioUrl = bestUrlObj ? bestUrlObj.url : '';

    // Extract high-quality image URL (500x500 is the last one)
    const images = song.image || [];
    const bestImageObj = images.find(img => img.quality === '500x500') || images[images.length - 1];
    const coverUrl = bestImageObj ? bestImageObj.url : '';

    // Artist
    const artist = song.artists && song.artists.primary && song.artists.primary.length > 0 
      ? song.artists.primary.map(a => a.name).join(', ') 
      : (song.label || 'Unknown Artist');

    // Movie/Album
    const movie = song.album ? song.album.name : 'Single';

    // Tamil Title Auto-Translation
    const titleTamil = await translateToTamil(song.name);

    res.json({
      success: true,
      song: {
        title: song.name,
        titleTamil,
        movie,
        artist,
        audioUrl,
        coverUrl,
        accentColor: '#1db954'
      }
    });

  } catch (err) {
    console.error('Search media error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch song from JioSaavn network', details: err.message });
  }
});

// --- STREAM PROXY ---
app.get('/api/stream', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('URL query parameter is required');
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0'
    };
    
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: headers
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
    
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    
    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
      res.status(206);
    } else {
      res.status(200);
    }

    response.data.pipe(res);
  } catch (err) {
    console.error('Stream proxy error:', err.message);
    res.status(500).send('Failed to stream audio file via proxy');
  }
});

// --- LYRICS GET API ---
app.get('/api/lyrics/:songId', (req, res) => {
  const { songId } = req.params;
  const db = readDb();
  const song = db.songs.find(s => s.id === songId);
  if (!song) {
    return res.status(404).json({ error: 'Song not found' });
  }
  res.json({ id: song.id, title: song.title, lyrics: song.lyrics || '[00:00.00] No lyrics available for this song.' });
});

// --- GEMINI AI & OFFLINE SIMULATION API ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

async function callGemini(systemInstruction, userPrompt) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not found');
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await axios.post(url, {
    contents: [{ parts: [{ text: `${systemInstruction}\n\nUser Input:\n${userPrompt}` }] }]
  });
  if (response.data && response.data.candidates && response.data.candidates[0].content.parts[0].text) {
    return response.data.candidates[0].content.parts[0].text.trim();
  }
  throw new Error('Invalid response from Gemini');
}

// POST: AI Chat DJ Desk
app.post('/api/ai/chat', async (req, res) => {
  const { prompt, history } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const db = readDb();
  const songListText = db.songs.map(s => `- "${s.title}" by ${s.artist} (Genre/Movie: ${s.movie})`).join('\n');

  const systemInstruction = `You are the Resident AI DJ at "JD's Music", an upbeat, enthusiastic, and knowledgeable host. 
Your goal is to suggest tracks, chat about genres, and recommend songs based on the user's queries.
You have the following songs available in the database:\n${songListText}\n
Whenever you recommend a song, be sure to mention the exact title so the player can load it. Keep your replies concise and engaging.`;

  try {
    const reply = await callGemini(systemInstruction, prompt);
    res.json({ success: true, response: reply });
  } catch (err) {
    // Fallback simulation
    const simulatedResponse = getSimulatedDJResponse(prompt, history, db.songs);
    res.json({ success: true, response: simulatedResponse, simulated: true });
  }
});

// POST: AI Lyrics Actions
app.post('/api/ai/lyrics-action', async (req, res) => {
  const { action, lyrics, songTitle, songArtist } = req.body;
  if (!action || !lyrics) {
    return res.status(400).json({ error: 'Action and lyrics are required' });
  }

  let prompt = '';
  let systemInstruction = '';

  if (action === 'translate') {
    systemInstruction = `You are a poetic translator. Poetically translate the provided song lyrics line-by-line into English. 
Keep the timestamps intact if they exist, or translate line-by-line. Make the lines feel emotional and beautiful.`;
    prompt = `Song: "${songTitle}" by ${songArtist}\n\nLyrics:\n${lyrics}`;
  } else if (action === 'explain') {
    systemInstruction = `You are a music analyst. Summarize the key themes, emotional contours, and backstories of the composition. 
Provide a clear analysis in 3 short bullet points (Theme, Emotional Outline, Backstory).`;
    prompt = `Song: "${songTitle}" by ${songArtist}\n\nLyrics:\n${lyrics}`;
  } else if (action === 'rewrite') {
    systemInstruction = `You are a creative lyricist. Rewrite the provided song lyrics into a completely different musical genre (e.g. pop-punk, acoustic folk, or rap). 
Include emojis and chord/guitar indicators like 🎸 or 🥁 to emphasize the new style. Keep the structure recognizable.`;
    prompt = `Song: "${songTitle}" by ${songArtist}\n\nLyrics:\n${lyrics}`;
  }

  try {
    const result = await callGemini(systemInstruction, prompt);
    res.json({ success: true, result });
  } catch (err) {
    // Fallback simulation
    const simulatedResult = getSimulatedLyricsAction(action, lyrics, songTitle, songArtist);
    res.json({ success: true, result: simulatedResult, simulated: true });
  }
});

// Helper functions for offline simulation fallback
function getSimulatedDJResponse(prompt, history, songs) {
  const query = prompt.toLowerCase();
  
  if (query.includes('recommend') || query.includes('suggest') || query.includes('play')) {
    const randomSong = songs[Math.floor(Math.random() * songs.length)];
    return `Hey there! 🎧 As your Resident AI DJ, I highly recommend checking out **"${randomSong.title}"** by *${randomSong.artist}* (from the film ${randomSong.movie}). It's got an amazing rhythm that perfectly maps to our visualizers! Let's load it into your queue!`;
  }
  
  if (query.includes('hello') || query.includes('hi') || query.includes('hey') || query.includes('yo')) {
    return `Yo! Welcome to the DJ Desk at **JD's Music**! 🎵 I am your AI DJ assistant. Ask me to recommend some tracks, explain the backing themes, or suggest songs to match your mood!`;
  }
  
  if (query.includes('sad') || query.includes('relax') || query.includes('study') || query.includes('sleep') || query.includes('chill')) {
    const calm = songs.find(s => s.title.includes('Malli') || s.title.includes('Poga') || s.title.includes('Aasa'));
    const song = calm || songs[0];
    return `I feel you. Let's wind down with a mellow tune: **"${song.title}"** by ${song.artist}. It's got those soothing frequencies that look beautiful on the Oscilloscope wave. Grab a warm drink and let the sound flow. ☕✨`;
  }
  
  if (query.includes('happy') || query.includes('energy') || query.includes('dance') || query.includes('workout') || query.includes('mass')) {
    const hype = songs.find(s => s.title.includes('Kacheri') || s.title.includes('God Mode') || s.title.includes('Oorum'));
    const song = hype || songs[2];
    return `⚡ Boom! Time for some high-voltage acoustic energy! Let's blast **"${song.title}"** by ${song.artist}. Open the visualizer dashboard and set it to Cyberpunk Pink or Spotify Neon to watch the Spectrum bars dance with peak energy! Let's go!`;
  }

  // Default response listing a couple of cool songs
  return `As your Resident AI DJ, I recommend spinning some local folk fusion like **"Singari"** or **"Mutta Kalakki"** to test out the visualizers, or checking out Dhanush's melodic **"Kannukulla Reprise"**! Tell me what genre you are craving!`;
}

function getSimulatedLyricsAction(action, lyrics, songTitle, songArtist) {
  const cleanLyrics = lyrics.replace(/\[\d+:\d+\.\d+\]/g, '').trim();
  
  if (action === 'translate') {
    return `[Poetic English Translation for "${songTitle}"]\n\n` + 
      cleanLyrics.split('\n').map(line => {
        if (!line.trim()) return '';
        if (line.includes('Aathi raasathi')) return 'Oh dearest princess, my love...';
        if (line.includes('Kannukkulla unna vachen')) return 'I kept you in my eyes, I stole and locked you in my heart...';
        if (line.includes('Adi parandhu pona')) return 'Oh beloved bird who flew away, please return to me...';
        if (line.includes('Pavazha malli')) return 'Coral jasmine flower, your scent draws me close...';
        if (line.includes('Pesum vizhiye')) return 'Your speaking eyes, your gaze captures me...';
        if (line.includes('Oorum blood-um')) return 'My body and blood are rising with rapid energy...';
        if (line.includes('Thalapathy kacheri')) return 'The royal concert of our leader has begun...';
        return `[Trans]: ${line} (Poetically translated to match the melody)`;
      }).join('\n');
  }
  
  if (action === 'explain') {
    return `[AI Composition Analysis for "${songTitle}" by ${songArtist}]\n\n` +
      `* **Theme & Mood**: Romance, cultural heritage, and modern rhythmic storytelling.\n` +
      `* **Emotional Outline**: Melancholic longing meets acoustic warmth. The singer expresses devotion, keeping the beloved protected in their sights and heart.\n` +
      `* **Backstory**: Seeded as a core track on JD's Music database. Built with traditional Tamil melodies interlaced with contemporary pop production.`;
  }
  
  if (action === 'rewrite') {
    return `[AI Lyric Metamorphosis: "${songTitle}" (Pop Punk/Acoustic Folk Style)]\n\n` +
      cleanLyrics.split('\n').map(line => {
        if (!line.trim()) return '';
        return `🎸 (Strum) / 🥁 (Beat) -> ${line.replace('raasathi', 'rockstar').replace('malli', 'darling')} (Yeah, we sing it loud!)`;
      }).join('\n');
  }
  
  return 'Unknown action';
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
