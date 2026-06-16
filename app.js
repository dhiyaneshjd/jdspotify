// Global State
let songs = [];
let playlists = [];
let currentPlaylistId = null; // null means Home/All, 'favorites' means Favorites
let activeSong = null;
let playQueue = [];
let queueIndex = 0;
let isShuffle = false;
let isRepeat = false;

// Audio Context & Visualizer state
let audioContext = null;
let analyser = null;
let sourceNode = null;
let isVisualizerEnabled = true;
let isCorsBlocked = false;
let visualizerAnimationId = null;

let currentVisStyle = 'spectrum';
let currentVisColor = 'spotify';
let parsedLyrics = [];
let rawLyricsText = "";
let chatHistory = [];

const visColors = {
  spotify: { primary: '#1db954', secondary: 'rgba(29, 185, 84, 0.2)', rgb: '29, 185, 84' },
  cyberpunk: { primary: '#ec4899', secondary: 'rgba(236, 72, 153, 0.2)', rgb: '236, 72, 153' },
  cosmic: { primary: '#7c3aed', secondary: 'rgba(124, 58, 237, 0.2)', rgb: '124, 58, 237' },
  sunset: { primary: '#f97316', secondary: 'rgba(249, 115, 22, 0.2)', rgb: '249, 115, 22' },
  midnight: { primary: '#06b6d4', secondary: 'rgba(6, 182, 212, 0.2)', rgb: '6, 182, 212' }
};

// Speech Recognition State
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-US'; // Default language, can also capture Tamil phonetic queries
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
}

// DOM Elements
const audio = document.getElementById('audio-engine');
const songGrid = document.getElementById('song-grid-container');
const playlistsContainer = document.getElementById('playlists-container');
const songCountBadge = document.getElementById('song-count');
const libraryTitle = document.getElementById('library-title');
const searchInput = document.getElementById('search-input');
const micBtn = document.getElementById('mic-btn');
const sortSelect = document.getElementById('sort-select');

// Player Controls (Desktop & Mobile)
const playPauseBtn = document.getElementById('control-play-pause');
const playPauseIcon = playPauseBtn.querySelector('i');
const timeline = document.getElementById('player-timeline');
const timeCurrent = document.getElementById('time-current');
const timeDuration = document.getElementById('time-duration');
const volumeSlider = document.getElementById('player-volume');
const volumeIcon = document.getElementById('player-volume-icon');
const playerHeartBtn = document.getElementById('player-heart-btn');
const playerHeartIcon = playerHeartBtn.querySelector('i');

// Mini Player metadata
const playerSongTitle = document.getElementById('player-song-title');
const playerSongTamil = document.getElementById('player-song-tamil');
const playerSongMovie = document.getElementById('player-song-movie');
const playerCoverArt = document.getElementById('player-cover-art');
const playerBar = document.getElementById('player-bar');

// Mobile Sheet Elements
const mobileSheet = document.getElementById('mobile-player-sheet');
const miniPlayerTrigger = document.getElementById('mini-player-trigger');
const mobileCloseBtn = document.getElementById('mobile-sheet-close');
const mobileWallpaper = document.getElementById('sheet-wallpaper');
const mobileCoverArt = document.getElementById('mobile-cover-art');
const mobileSongTitle = document.getElementById('mobile-song-title');
const mobileSongTamil = document.getElementById('mobile-song-tamil');
const mobileSongMovie = document.getElementById('mobile-song-movie');
const mobileHeartBtn = document.getElementById('mobile-heart-btn');
const mobileTimeline = document.getElementById('mobile-player-timeline');
const mobileTimeCurrent = document.getElementById('mobile-time-current');
const mobileTimeDuration = document.getElementById('mobile-time-duration');
const mobilePlayPause = document.getElementById('mobile-play-pause');

// Secondary Visualizers
const desktopVisOverlay = document.getElementById('desktop-visualizer-overlay');
const btnCloseVis = document.getElementById('btn-close-visualizer');
const desktopVisToggle = document.getElementById('player-visualizer-toggle');
const desktopVisCanvas = document.getElementById('desktop-canvas-visualizer');
const mobileVisCanvas = document.getElementById('mobile-visualizer-canvas');

// Modals
const modalSong = document.getElementById('modal-song');
const modalPlaylist = document.getElementById('modal-playlist');
const modalAddToPlaylist = document.getElementById('modal-add-to-playlist');
const voiceOverlay = document.getElementById('voice-overlay');

// Voice DOM Elements
const voiceStatus = document.getElementById('voice-status');
const voiceTranscript = document.getElementById('voice-transcript');
const btnCloseVoice = document.getElementById('btn-close-voice');

// Form elements
const songForm = document.getElementById('song-form');
const playlistForm = document.getElementById('playlist-form');
const songModalTitle = document.getElementById('song-modal-title');
const formSongId = document.getElementById('form-song-id');

// --- SYNTHESIZED UI SFX GENERATOR ---
function playSFX(type) {
  try {
    const sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = sfxCtx.createOscillator();
    const gain = sfxCtx.createGain();
    
    osc.connect(gain);
    gain.connect(sfxCtx.destination);
    
    const now = sfxCtx.currentTime;
    
    if (type === 'click') {
      // Short modern click sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
      
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'chime') {
      // Pleasant heart / double chime sound
      osc.type = 'triangle';
      
      // Note 1
      osc.frequency.setValueAtTime(523.25, now); // C5
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      // Note 2
      const osc2 = sfxCtx.createOscillator();
      const gain2 = sfxCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(sfxCtx.destination);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
      gain2.gain.setValueAtTime(0.05, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      osc.start(now);
      osc.stop(now + 0.15);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.25);
    } else if (type === 'tap') {
      // Soft woodblock tap
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch (err) {
    // Fail silently if audio context cannot start
  }
}

// --- INIT APP ---
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  createMobileTabs();
  fetchSongs();
  fetchPlaylists();
});

// Setup Mobile navigation tabs dynamically
function createMobileTabs() {
  if (document.querySelector('.mobile-nav-tabs')) return;
  const tabs = document.createElement('div');
  tabs.className = 'mobile-nav-tabs';
  tabs.innerHTML = `
    <div class="mobile-tab-item active" data-tab="home"><i class="fa-solid fa-house"></i><span>Home</span></div>
    <div class="mobile-tab-item" data-tab="favorites"><i class="fa-solid fa-heart"></i><span>Favorites</span></div>
    <div class="mobile-tab-item" data-tab="dj-chat"><i class="fa-solid fa-robot"></i><span>AI DJ</span></div>
    <div class="mobile-tab-item" data-tab="wiki"><i class="fa-solid fa-earth-americas"></i><span>Discover</span></div>
  `;
  document.body.appendChild(tabs);

  tabs.querySelectorAll('.mobile-tab-item').forEach(item => {
    item.addEventListener('click', () => {
      playSFX('tap');
      tabs.querySelectorAll('.mobile-tab-item').forEach(t => t.classList.remove('active'));
      item.classList.add('active');
      const tab = item.getAttribute('data-tab');

      // Sync active view
      if (tab === 'home') {
        currentPlaylistId = null;
        libraryTitle.textContent = 'All Songs';
        showSection('section-library');
        renderSongs();
      } else if (tab === 'favorites') {
        currentPlaylistId = 'favorites';
        libraryTitle.textContent = 'Favorites';
        showSection('section-library');
        renderSongs();
      } else if (tab === 'dj-chat') {
        currentPlaylistId = null;
        libraryTitle.textContent = 'AI DJ Desk';
        showSection('section-dj-chat');
      } else if (tab === 'wiki') {
        showSection('section-wiki');
        scrapeWikipediaFilms();
      }
    });
  });
}

function showSection(id) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// --- WEB AUDIO API & CANVAS VISUALIZER ---
function initAudioContext() {
  if (audioContext) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    // crossOrigin must be set to anonymous on the audio tag to prevent CORS failures.
    audio.crossOrigin = "anonymous";
    
    sourceNode = audioContext.createMediaElementSource(audio);
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
    
    isCorsBlocked = false;
  } catch (err) {
    console.warn("MediaElementSource connection failed (CORS or permissions). Falling back to animation.", err);
    isCorsBlocked = true;
  }
}

function startVisualizer() {
  if (visualizerAnimationId) {
    cancelAnimationFrame(visualizerAnimationId);
  }
  
  const bufferLength = analyser ? analyser.frequencyBinCount : 128;
  const dataArray = new Uint8Array(bufferLength);
  
  function draw() {
    visualizerAnimationId = requestAnimationFrame(draw);
    
    // Draw on desktop overlay canvas
    if (desktopVisOverlay.style.display === 'flex') {
      drawRadialVisualizer(desktopVisCanvas, dataArray, bufferLength);
    }
    
    // Draw on mobile sheet visualizer canvas
    if (mobileSheet.classList.contains('open')) {
      drawRadialVisualizer(mobileVisCanvas, dataArray, bufferLength, 100);
    }
  }
  
  draw();
}

function drawRadialVisualizer(canvas, dataArray, bufferLength, baseRadius = 80) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
  const height = canvas.height = canvas.clientHeight * window.devicePixelRatio;
  
  ctx.clearRect(0, 0, width, height);
  
  if (analyser && !isCorsBlocked && !audio.paused) {
    analyser.getByteFrequencyData(dataArray);
  } else if (!audio.paused) {
    // Generate mock frequency data synced to time if CORS blocks Web Audio or audio is playing
    const time = Date.now() * 0.003;
    for (let i = 0; i < bufferLength; i++) {
      dataArray[i] = 50 + Math.sin(time + i * 0.1) * 35 + Math.cos(time * 0.5 + i * 0.05) * 15;
    }
  } else {
    // Static state
    for (let i = 0; i < bufferLength; i++) {
      dataArray[i] = 0;
    }
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const color = visColors[currentVisColor] || visColors.spotify;

  if (currentVisStyle === 'spectrum') {
    // Bouncing spectrum bars
    const barWidth = (width / bufferLength) * 1.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const value = dataArray[i];
      const barHeight = (value / 255) * height * 0.7;
      
      const grad = ctx.createLinearGradient(0, height, 0, height - barHeight);
      grad.addColorStop(0, `rgba(${color.rgb}, 0.1)`);
      grad.addColorStop(1, color.primary);
      
      ctx.fillStyle = grad;
      ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
      x += barWidth;
    }
  } else if (currentVisStyle === 'eclipse') {
    // Pulsing circle with spikes
    ctx.save();
    ctx.translate(centerX, centerY);
    
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
    const avg = sum / bufferLength;
    const pulseRadius = baseRadius + (avg / 255) * 35;
    
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color.rgb}, 0.08)`;
    ctx.fill();
    ctx.strokeStyle = color.primary;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    const bars = Math.min(bufferLength, 80);
    const angleStep = (Math.PI * 2) / bars;
    for (let i = 0; i < bars; i++) {
      const value = dataArray[i];
      const spikeHeight = (value / 255) * 75;
      
      ctx.rotate(angleStep);
      ctx.beginPath();
      ctx.moveTo(0, -pulseRadius);
      ctx.lineTo(0, -pulseRadius - spikeHeight);
      ctx.strokeStyle = color.primary;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  } else if (currentVisStyle === 'stardust') {
    // Bokeh gravity-defying stardust circles
    if (!window.particles || window.particles.length === 0) {
      window.particles = [];
      for (let i = 0; i < 40; i++) {
        window.particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          speed: 0.5 + Math.random() * 1.5,
          baseSize: 4 + Math.random() * 8
        });
      }
    }
    
    let sumFreq = 0;
    for (let i = 0; i < bufferLength; i++) sumFreq += dataArray[i];
    const ratio = sumFreq / (bufferLength * 255);
    
    window.particles.forEach(p => {
      p.y -= p.speed * (1 + ratio * 3);
      if (p.y < -20) {
        p.y = height + 20;
        p.x = Math.random() * width;
      }
      
      const dynamicSize = p.baseSize * (1 + ratio * 2);
      ctx.beginPath();
      ctx.arc(p.x, p.y, dynamicSize, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.rgb}, ${0.15 + ratio * 0.45})`;
      ctx.fill();
    });
  } else if (currentVisStyle === 'oscilloscope') {
    // Oscilloscope retro wave
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = color.primary;
    
    const sliceWidth = width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }
}

// --- DYNAMIC BACKGROUND & ACCENT COLOR ---
function updateThemeColors(accentColor) {
  if (!accentColor) accentColor = '#1db954';
  
  document.documentElement.style.setProperty('--accent-color', accentColor);
  
  // Convert hex color to rgb string
  let r = 29, g = 185, b = 84;
  if (accentColor.startsWith('#')) {
    const hex = accentColor.substring(1);
    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 3) {
      r = parseInt(hex.substring(0, 1) + hex.substring(0, 1), 16);
      g = parseInt(hex.substring(1, 2) + hex.substring(1, 2), 16);
      b = parseInt(hex.substring(2, 3) + hex.substring(2, 3), 16);
    }
  }
  
  document.documentElement.style.setProperty('--accent-color-rgb', `${r}, ${g}, ${b}`);
}

// --- AUDIO PLAYBACK ENGINE ---
function playSong(song) {
  playSFX('click');
  initAudioContext();
  
  activeSong = song;
  if (song.audioUrl.startsWith('http')) {
    audio.src = `/api/stream?url=${encodeURIComponent(song.audioUrl)}`;
  } else {
    audio.src = song.audioUrl;
  }
  
  // Load lyrics for the active song
  loadLyrics(song.id);
  
  // Update Player UI Meta info
  playerSongTitle.textContent = song.title;
  playerSongTamil.textContent = song.titleTamil ? `(${song.titleTamil})` : '';
  playerSongMovie.textContent = song.movie;
  playerCoverArt.src = song.coverUrl;
  playerBar.classList.add('playing');
  
  // Update Mobile player sheet meta info
  mobileSongTitle.textContent = song.title;
  mobileSongTamil.textContent = song.titleTamil ? song.titleTamil : '';
  mobileSongMovie.textContent = song.movie;
  mobileCoverArt.src = song.coverUrl;
  mobileWallpaper.style.backgroundImage = `url('${song.coverUrl}')`;
  
  // Accent theme color
  updateThemeColors(song.accentColor);
  
  // Play
  audio.play()
    .then(() => {
      isPlaying = true;
      playPauseIcon.className = 'fa-solid fa-pause';
      mobilePlayPause.querySelector('i').className = 'fa-solid fa-pause';
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
      startVisualizer();
      
      // Update queue index
      const idx = playQueue.findIndex(s => s.id === song.id);
      if (idx !== -1) queueIndex = idx;
    })
    .catch(err => {
      console.error("Playback error:", err);
      // Fallback state if play fails due to browser restrictions
      playPauseIcon.className = 'fa-solid fa-play';
      mobilePlayPause.querySelector('i').className = 'fa-solid fa-play';
    });
    
  // Sync download button
  const downloadBtn = document.getElementById('player-download-btn');
  downloadBtn.href = `/api/download?url=${encodeURIComponent(song.audioUrl)}&title=${encodeURIComponent(song.title)}`;
  
  const mobileDownloadBtn = document.getElementById('mobile-sheet-download');
  mobileDownloadBtn.onclick = () => {
    window.location.href = `/api/download?url=${encodeURIComponent(song.audioUrl)}&title=${encodeURIComponent(song.title)}`;
  };

  // Sync heart buttons
  syncHeartButtons(song.isFavorite);
  
  // Render playing indicators on cards
  updateCardPlayingStates();
}

function togglePlay() {
  playSFX('click');
  if (!activeSong && songs.length > 0) {
    playSong(songs[0]);
    return;
  }
  
  if (audio.paused) {
    audio.play();
    playPauseIcon.className = 'fa-solid fa-pause';
    mobilePlayPause.querySelector('i').className = 'fa-solid fa-pause';
    playerBar.classList.add('playing');
  } else {
    audio.pause();
    playPauseIcon.className = 'fa-solid fa-play';
    mobilePlayPause.querySelector('i').className = 'fa-solid fa-play';
    playerBar.classList.remove('playing');
  }
}

function skip10s(forward = true) {
  playSFX('click');
  if (forward) {
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
  } else {
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  }
}

function nextTrack() {
  playSFX('click');
  if (playQueue.length === 0) return;
  
  if (isRepeat && activeSong) {
    audio.currentTime = 0;
    audio.play();
    return;
  }

  if (isShuffle) {
    queueIndex = Math.floor(Math.random() * playQueue.length);
  } else {
    queueIndex = (queueIndex + 1) % playQueue.length;
  }
  
  playSong(playQueue[queueIndex]);
}

function prevTrack() {
  playSFX('click');
  if (playQueue.length === 0) return;

  if (audio.currentTime > 5) {
    audio.currentTime = 0;
    return;
  }

  queueIndex = (queueIndex - 1 + playQueue.length) % playQueue.length;
  playSong(playQueue[queueIndex]);
}

// Sync Heart styling
function syncHeartButtons(isFav) {
  if (isFav) {
    playerHeartBtn.classList.add('liked');
    playerHeartIcon.className = 'fa-solid fa-heart heart-indicator';
    mobileHeartBtn.classList.add('liked');
    mobileHeartBtn.querySelector('i').className = 'fa-solid fa-heart heart-indicator';
  } else {
    playerHeartBtn.classList.remove('liked');
    playerHeartIcon.className = 'fa-regular fa-heart';
    mobileHeartBtn.classList.remove('liked');
    mobileHeartBtn.querySelector('i').className = 'fa-regular fa-heart';
  }
}

// Update range timeline bar
audio.addEventListener('timeupdate', () => {
  if (isNaN(audio.duration)) return;
  
  const pct = (audio.currentTime / audio.duration) * 100;
  timeline.value = pct;
  mobileTimeline.value = pct;
  
  timeCurrent.textContent = formatTime(audio.currentTime);
  mobileTimeCurrent.textContent = formatTime(audio.currentTime);
  
  timeDuration.textContent = formatTime(audio.duration);
  mobileTimeDuration.textContent = formatTime(audio.duration);

  // Synced lyrics rolling highlight
  if (parsedLyrics.length > 0) {
    const currentTime = audio.currentTime;
    let activeIndex = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (currentTime >= parsedLyrics[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }
    
    if (activeIndex !== -1) {
      const lines = document.querySelectorAll('.lyric-line');
      lines.forEach((line, idx) => {
        if (idx === activeIndex) {
          if (!line.classList.contains('active')) {
            line.classList.add('active');
            
            // Scroll container
            const container = document.getElementById('lyrics-scroll-container');
            const containerHeight = container.clientHeight;
            const lineTop = line.offsetTop;
            const lineHeight = line.clientHeight;
            container.scrollTop = lineTop - (containerHeight / 2) + (lineHeight / 2);
          }
        } else {
          line.classList.remove('active');
        }
      });
    }
  }
});

audio.addEventListener('loadedmetadata', () => {
  timeDuration.textContent = formatTime(audio.duration);
  mobileTimeDuration.textContent = formatTime(audio.duration);
});

audio.addEventListener('ended', () => {
  nextTrack();
});

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Seek timeline
timeline.addEventListener('input', () => {
  if (!activeSong) return;
  const time = (timeline.value / 100) * audio.duration;
  audio.currentTime = time;
});

mobileTimeline.addEventListener('input', () => {
  if (!activeSong) return;
  const time = (mobileTimeline.value / 100) * audio.duration;
  audio.currentTime = time;
});

// Volume adjustments
volumeSlider.addEventListener('input', () => {
  audio.volume = volumeSlider.value / 100;
  updateVolumeIcon();
});

function updateVolumeIcon() {
  const vol = volumeSlider.value;
  if (vol == 0) {
    volumeIcon.querySelector('i').className = 'fa-solid fa-volume-xmark';
  } else if (vol < 50) {
    volumeIcon.querySelector('i').className = 'fa-solid fa-volume-low';
  } else {
    volumeIcon.querySelector('i').className = 'fa-solid fa-volume-high';
  }
}

volumeIcon.addEventListener('click', () => {
  playSFX('click');
  if (audio.muted) {
    audio.muted = false;
    volumeSlider.value = audio.volume * 100;
    updateVolumeIcon();
  } else {
    audio.muted = true;
    volumeSlider.value = 0;
    volumeIcon.querySelector('i').className = 'fa-solid fa-volume-xmark';
  }
});

// Update active play/pause cards visual state
function updateCardPlayingStates() {
  document.querySelectorAll('.song-card').forEach(card => {
    const id = card.getAttribute('data-song-id');
    const playCircle = card.querySelector('.play-icon-circle i');
    if (playCircle) {
      if (activeSong && id === activeSong.id && !audio.paused) {
        playCircle.className = 'fa-solid fa-pause';
        card.style.borderColor = 'var(--accent-color)';
      } else {
        playCircle.className = 'fa-solid fa-play';
        card.style.borderColor = 'rgba(255, 255, 255, 0.03)';
      }
    }
  });
}

// --- SEARCH & SORT & FILTER LOGIC ---
function filterAndRenderSongs() {
  const query = searchInput.value.toLowerCase().trim();
  const sortVal = sortSelect.value;
  
  let filtered = [...songs];
  
  // Filter by playlist
  if (currentPlaylistId === 'favorites') {
    filtered = filtered.filter(s => s.isFavorite);
  } else if (currentPlaylistId) {
    const activePl = playlists.find(p => p.id === currentPlaylistId);
    if (activePl) {
      filtered = filtered.filter(s => activePl.songIds.includes(s.id));
    } else {
      filtered = [];
    }
  }
  
  // Filter by search query
  if (query) {
    filtered = filtered.filter(s => 
      s.title.toLowerCase().includes(query) || 
      (s.titleTamil && s.titleTamil.toLowerCase().includes(query)) ||
      s.artist.toLowerCase().includes(query) || 
      s.movie.toLowerCase().includes(query)
    );
  }
  
  // Sort
  if (sortVal === 'title-az') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortVal === 'movie-az') {
    filtered.sort((a, b) => a.movie.localeCompare(b.movie));
  }
  
  renderSongList(filtered);
}

// --- RENDER DYNAMIC DOM ---
function renderSongs() {
  filterAndRenderSongs();
}

function renderSongList(songList) {
  songGrid.innerHTML = '';
  songCountBadge.textContent = `${songList.length} song${songList.length === 1 ? '' : 's'}`;
  
  // Render actual song cards
  songList.forEach(song => {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.setAttribute('data-song-id', song.id);
    
    // Check playing visual
    const isPlayingThis = activeSong && song.id === activeSong.id && !audio.paused;
    const playIconClass = isPlayingThis ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    const borderStyle = isPlayingThis ? 'border-color: var(--accent-color)' : '';

    card.style.cssText = borderStyle;
    
    card.innerHTML = `
      <div class="card-img-wrapper">
        <img src="${song.coverUrl}" alt="${song.title}" loading="lazy">
        <div class="card-play-overlay">
          <div class="play-icon-circle"><i class="${playIconClass}"></i></div>
        </div>
      </div>
      <div class="card-meta">
        <div class="card-title-row">
          <span class="card-title" title="${song.title}">${song.title}</span>
          ${song.isFavorite ? '<i class="fa-solid fa-heart heart-indicator"></i>' : ''}
        </div>
        ${song.titleTamil ? `<span class="card-tamil-title">${song.titleTamil}</span>` : ''}
        <span class="card-details">${song.artist} • <strong>${song.movie}</strong></span>
      </div>
      <div class="card-actions">
        <button class="action-btn btn-playlist-add" title="Add to Playlist"><i class="fa-solid fa-folder-plus"></i></button>
        <button class="action-btn btn-edit" title="Edit Song"><i class="fa-solid fa-pen"></i></button>
        <button class="action-btn btn-delete" title="Delete Song"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    
    // Play trigger click
    card.addEventListener('click', (e) => {
      // Avoid triggering when actions clicked
      if (e.target.closest('.card-actions') || e.target.closest('.btn-playlist-add') || e.target.closest('.btn-edit') || e.target.closest('.btn-delete')) {
        return;
      }
      
      if (activeSong && activeSong.id === song.id) {
        togglePlay();
      } else {
        // Build playing queue starting from this list
        playQueue = [...songList];
        queueIndex = playQueue.findIndex(s => s.id === song.id);
        playSong(song);
      }
    });
    
    // Card button listeners
    card.querySelector('.btn-playlist-add').addEventListener('click', (e) => {
      e.stopPropagation();
      playSFX('click');
      openAddToPlaylistModal(song.id);
    });
    
    card.querySelector('.btn-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      playSFX('click');
      openEditSongModal(song);
    });
    
    card.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      playSFX('click');
      if (confirm(`Are you sure you want to delete "${song.title}"?`)) {
        deleteSong(song.id);
      }
    });

    songGrid.appendChild(card);
  });
  
  // Add placeholder click to trigger song add
  const addPlaceholder = document.createElement('div');
  addPlaceholder.className = 'song-card add-song-card-placeholder';
  addPlaceholder.innerHTML = `
    <i class="fa-solid fa-circle-plus"></i>
    <span>Add New Song</span>
  `;
  addPlaceholder.addEventListener('click', () => {
    playSFX('tap');
    openAddSongModal();
  });
  songGrid.appendChild(addPlaceholder);
}

function renderPlaylists() {
  playlistsContainer.innerHTML = '';
  
  playlists.forEach(pl => {
    const activeClass = currentPlaylistId === pl.id ? 'active' : '';
    const item = document.createElement('div');
    item.className = `playlist-item ${activeClass}`;
    item.setAttribute('data-playlist-id', pl.id);
    
    item.innerHTML = `
      <div class="playlist-name-wrapper">
        <i class="fa-solid fa-music"></i>
        <span>${pl.name}</span>
      </div>
      <button class="delete-playlist-btn" title="Delete Playlist"><i class="fa-solid fa-trash-can"></i></button>
    `;
    
    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-playlist-btn')) return;
      playSFX('tap');
      currentPlaylistId = pl.id;
      libraryTitle.textContent = pl.name;
      
      // Update sidebar/nav highlighted view
      document.querySelectorAll('.sidebar-nav li').forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.playlist-item').forEach(l => l.classList.remove('active'));
      item.classList.add('active');
      
      showSection('section-library');
      renderSongs();
    });
    
    item.querySelector('.delete-playlist-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      playSFX('click');
      if (confirm(`Delete playlist "${pl.name}"?`)) {
        deletePlaylist(pl.id);
      }
    });
    
    playlistsContainer.appendChild(item);
  });
}

// --- CRUD AJAX SERVICES ---

async function fetchSongs() {
  try {
    const res = await fetch('/api/songs');
    songs = await res.json();
    playQueue = [...songs];
    renderSongs();
  } catch (err) {
    console.error('Error fetching songs:', err);
  }
}

async function fetchPlaylists() {
  try {
    const res = await fetch('/api/playlists');
    playlists = await res.json();
    renderPlaylists();
  } catch (err) {
    console.error('Error fetching playlists:', err);
  }
}

async function addOrUpdateSong(e) {
  e.preventDefault();
  playSFX('click');
  
  const id = formSongId.value;
  const title = document.getElementById('form-title').value;
  const titleTamil = document.getElementById('form-title-tamil').value;
  const movie = document.getElementById('form-movie').value;
  const artist = document.getElementById('form-artist').value;
  const audioUrl = document.getElementById('form-audio-url').value;
  const coverUrl = document.getElementById('form-cover-url').value;
  const accentColor = document.querySelector('input[name="accent"]:checked').value;
  
  const songData = { title, titleTamil, movie, artist, audioUrl, coverUrl, accentColor };
  
  try {
    let res;
    if (id) {
      // Edit mode (Update)
      res = await fetch(`/api/songs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(songData)
      });
    } else {
      // Add mode (Create)
      res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(songData)
      });
    }
    
    const data = await res.json();
    if (data.success) {
      closeModal('modal-song');
      fetchSongs();
      // If edit active song details, reload playing bar elements
      if (activeSong && activeSong.id === id) {
        // Simply fetch active details from the newly updated database
        const updated = songs.find(s => s.id === id) || data.song;
        if (updated) {
          activeSong = updated;
          playerSongTitle.textContent = updated.title;
          playerSongTamil.textContent = updated.titleTamil ? `(${updated.titleTamil})` : '';
          playerSongMovie.textContent = updated.movie;
          playerCoverArt.src = updated.coverUrl;
          updateThemeColors(updated.accentColor);
        }
      }
    } else {
      alert('Failed to save song');
    }
  } catch (err) {
    console.error('Error saving song:', err);
  }
}

async function deleteSong(id) {
  try {
    const res = await fetch(`/api/songs/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      // If active song is deleted, stop playback
      if (activeSong && activeSong.id === id) {
        audio.pause();
        activeSong = null;
        playerSongTitle.textContent = 'No song playing';
        playerSongTamil.textContent = '';
        playerSongMovie.textContent = 'Select a song from library';
        playerCoverArt.src = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=60';
        playerBar.classList.remove('playing');
      }
      fetchSongs();
    }
  } catch (err) {
    console.error('Error deleting song:', err);
  }
}

async function createPlaylist(e) {
  e.preventDefault();
  playSFX('click');
  const name = document.getElementById('playlist-name').value;
  try {
    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.success) {
      closeModal('modal-playlist');
      fetchPlaylists();
    }
  } catch (err) {
    console.error('Error creating playlist:', err);
  }
}

async function deletePlaylist(playlistId) {
  try {
    const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      if (currentPlaylistId === playlistId) {
        currentPlaylistId = null;
        libraryTitle.textContent = 'All Songs';
        document.getElementById('nav-home').classList.add('active');
        renderSongs();
      }
      fetchPlaylists();
    }
  } catch (err) {
    console.error('Error deleting playlist:', err);
  }
}

async function addSongToPlaylist(playlistId, songId) {
  try {
    const res = await fetch(`/api/playlists/${playlistId}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId })
    });
    const data = await res.json();
    if (data.success) {
      playSFX('chime');
      closeModal('modal-add-to-playlist');
      fetchPlaylists();
    }
  } catch (err) {
    console.error('Error adding song to playlist:', err);
  }
}

async function toggleFavoriteStatus() {
  if (!activeSong) return;
  
  playSFX('chime');
  const nextFav = !activeSong.isFavorite;
  
  try {
    const res = await fetch(`/api/songs/${activeSong.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: nextFav })
    });
    const data = await res.json();
    if (data.success) {
      activeSong.isFavorite = nextFav;
      
      // Update entry in local arrays
      const local = songs.find(s => s.id === activeSong.id);
      if (local) local.isFavorite = nextFav;
      
      syncHeartButtons(nextFav);
      renderSongs();
    }
  } catch (err) {
    console.error('Error toggling favorite:', err);
  }
}

// --- WIKIPEDIA DISCOVER SCRAPER CLIENT ---
let hasScrapedWiki = false;

async function scrapeWikipediaFilms() {
  if (hasScrapedWiki) return;
  
  const loader = document.getElementById('wiki-loader');
  const grid = document.getElementById('wiki-grid-container');
  
  loader.style.display = 'flex';
  grid.style.display = 'none';
  
  try {
    const res = await fetch('/api/scrape-wiki');
    const data = await res.json();
    
    loader.style.display = 'none';
    grid.style.display = 'grid';
    grid.innerHTML = '';
    
    if (data.success && data.films.length > 0) {
      hasScrapedWiki = true;
      
      data.films.forEach(film => {
        const card = document.createElement('div');
        card.className = 'wiki-card';
        
        card.innerHTML = `
          <div class="wiki-card-top">
            <span class="wiki-badge">${film.year} Film</span>
            <h3 class="wiki-movie-title">${film.title}</h3>
            <div class="wiki-meta-row">Director: <strong>${film.director}</strong></div>
            <div class="wiki-meta-row">Music: <strong>${film.music}</strong></div>
            <div class="wiki-meta-row" style="font-size: 0.75rem; max-height: 48px; overflow: hidden; text-overflow: ellipsis;">Cast: ${film.cast}</div>
          </div>
          <div class="wiki-card-bottom">
            ${film.wikiUrl ? `<a href="${film.wikiUrl}" target="_blank" class="wiki-link">Wiki Page <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : '<span></span>'}
            <button class="btn btn-secondary btn-sm btn-import-wiki" style="padding: 6px 12px; font-size: 0.75rem;">
              <i class="fa-solid fa-file-import"></i> Add
            </button>
          </div>
        `;
        
        // Click to Import Film
        card.querySelector('.btn-import-wiki').addEventListener('click', () => {
          playSFX('tap');
          openImportWikiModal(film);
        });
        
        grid.appendChild(card);
      });
    } else {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Failed to load Wikipedia listings.</p>';
    }
  } catch (err) {
    console.error('Wiki Scrape failed:', err);
    loader.style.display = 'none';
    grid.style.display = 'grid';
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444;">Error connection timed out scraping Wikipedia.</p>';
  }
}

// --- MIC VOICE RECOGNITION (SEARCH) ---
function startVoiceSearch() {
  if (!recognition) {
    alert("Speech recognition is not supported in this browser. Please use Chrome/Safari.");
    return;
  }
  
  playSFX('tap');
  voiceOverlay.classList.add('active');
  voiceStatus.textContent = "Listening...";
  voiceTranscript.textContent = "Say the name of a song or film...";
  
  recognition.start();
  
  recognition.onresult = (event) => {
    const speechResult = event.results[0][0].transcript;
    voiceTranscript.textContent = `"${speechResult}"`;
    voiceStatus.textContent = "Searching...";
    
    // Put result into search bar
    searchInput.value = speechResult;
    
    // Synthesize short success sound and close
    setTimeout(() => {
      playSFX('chime');
      voiceOverlay.classList.remove('active');
      filterAndRenderSongs();
    }, 800);
  };
  
  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    voiceStatus.textContent = "Error Listening";
    voiceTranscript.textContent = "Please try again or type in the search bar.";
    setTimeout(() => {
      voiceOverlay.classList.remove('active');
    }, 1500);
  };
  
  recognition.onspeechend = () => {
    recognition.stop();
  };
}

// --- MODAL TRIGGERS ---
function openAddSongModal() {
  songModalTitle.textContent = "Add New Song";
  formSongId.value = "";
  songForm.reset();
  
  // Choose default accent green
  document.querySelector('input[name="accent"][value="#1db954"]').checked = true;
  openModal('modal-song');
}

function openEditSongModal(song) {
  songModalTitle.textContent = "Edit Song";
  formSongId.value = song.id;
  
  document.getElementById('form-title').value = song.title;
  document.getElementById('form-title-tamil').value = song.titleTamil || "";
  document.getElementById('form-movie').value = song.movie;
  document.getElementById('form-artist').value = song.artist;
  document.getElementById('form-audio-url').value = song.audioUrl;
  document.getElementById('form-cover-url').value = song.coverUrl;
  
  // Select matching radio color
  const matchedRadio = document.querySelector(`input[name="accent"][value="${song.accentColor}"]`);
  if (matchedRadio) matchedRadio.checked = true;
  
  openModal('modal-song');
}

async function openImportWikiModal(film) {
  songModalTitle.textContent = `Import from Wiki: ${film.title}`;
  formSongId.value = "";
  songForm.reset();
  
  // Set temporary loading values in form to alert the user
  document.getElementById('form-title').value = "Searching for song details...";
  document.getElementById('form-movie').value = film.title;
  document.getElementById('form-artist').value = film.music !== 'Unknown' ? film.music : film.director;
  document.getElementById('form-cover-url').value = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300";
  
  // Set default color
  document.querySelector('input[name="accent"][value="#1db954"]').checked = true;
  
  openModal('modal-song');
  
  try {
    // Search for the actual song matching this movie title on JioSaavn network
    const searchRes = await fetch(`/api/search-media?query=${encodeURIComponent(film.title + ' songs')}`);
    const searchData = await searchRes.json();
    
    if (searchData.success && searchData.song) {
      const s = searchData.song;
      document.getElementById('form-title').value = s.title;
      document.getElementById('form-title-tamil').value = s.titleTamil || "";
      document.getElementById('form-movie').value = film.title; // Keep original wiki title
      document.getElementById('form-artist').value = s.artist || film.music;
      document.getElementById('form-audio-url').value = s.audioUrl;
      document.getElementById('form-cover-url').value = s.coverUrl;
    } else {
      // Fallback if no song is found
      document.getElementById('form-title').value = "";
      document.getElementById('form-audio-url').value = "";
      
      // Fetch translation of film title as fallback
      const transRes = await fetch(`/api/translate?text=${encodeURIComponent(film.title)}`);
      const transData = await transRes.json();
      if (transData.translated) {
        document.getElementById('form-title-tamil').value = transData.translated;
      }
    }
  } catch (e) {
    console.error("Failed to fetch search media during import:", e);
    document.getElementById('form-title').value = "";
    document.getElementById('form-audio-url').value = "";
  }
}

function openPlaylistCreateModal() {
  document.getElementById('playlist-name').value = "";
  openModal('modal-playlist');
}

function openAddToPlaylistModal(songId) {
  const container = document.getElementById('playlist-selector-list');
  container.innerHTML = '';
  
  if (playlists.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">No playlists created yet. Create one first!</p>';
  } else {
    playlists.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'playlist-select-item';
      item.textContent = pl.name;
      item.addEventListener('click', () => {
        addSongToPlaylist(pl.id, songId);
      });
      container.appendChild(item);
    });
  }
  
  openModal('modal-add-to-playlist');
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// --- EVENT LISTENERS BINDING ---
function setupEventListeners() {
  // Sidebar navigational view routes
  document.getElementById('nav-home').addEventListener('click', (e) => {
    e.preventDefault();
    playSFX('tap');
    currentPlaylistId = null;
    libraryTitle.textContent = 'All Songs';
    
    document.querySelectorAll('.sidebar-nav li').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.playlist-item').forEach(l => l.classList.remove('active'));
    document.getElementById('nav-home').classList.add('active');
    
    showSection('section-library');
    renderSongs();
  });
  
  document.getElementById('nav-favorites').addEventListener('click', (e) => {
    e.preventDefault();
    playSFX('tap');
    currentPlaylistId = 'favorites';
    libraryTitle.textContent = 'Favorites';
    
    document.querySelectorAll('.sidebar-nav li').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.playlist-item').forEach(l => l.classList.remove('active'));
    document.getElementById('nav-favorites').classList.add('active');
    
    showSection('section-library');
    renderSongs();
  });
  
  document.getElementById('nav-wiki').addEventListener('click', (e) => {
    e.preventDefault();
    playSFX('tap');
    
    document.querySelectorAll('.sidebar-nav li').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.playlist-item').forEach(l => l.classList.remove('active'));
    document.getElementById('nav-wiki').classList.add('active');
    
    showSection('section-wiki');
    scrapeWikipediaFilms();
  });

  document.getElementById('nav-dj-chat').addEventListener('click', (e) => {
    e.preventDefault();
    playSFX('tap');
    
    document.querySelectorAll('.sidebar-nav li').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.playlist-item').forEach(l => l.classList.remove('active'));
    document.getElementById('nav-dj-chat').classList.add('active');
    
    showSection('section-dj-chat');
  });

  document.getElementById('btn-refresh-wiki').addEventListener('click', () => {
    playSFX('click');
    hasScrapedWiki = false;
    scrapeWikipediaFilms();
  });

  // Top header button
  document.getElementById('btn-add-song-header').addEventListener('click', () => {
    playSFX('tap');
    openAddSongModal();
  });

  document.getElementById('btn-new-playlist-sidebar').addEventListener('click', () => {
    playSFX('tap');
    openPlaylistCreateModal();
  });

  // Search input events
  searchInput.addEventListener('input', () => {
    filterAndRenderSongs();
  });
  
  micBtn.addEventListener('click', () => {
    startVoiceSearch();
  });

  // Sort selectors
  sortSelect.addEventListener('change', () => {
    filterAndRenderSongs();
  });

  // Modals closing triggers
  document.getElementById('btn-close-song-modal').addEventListener('click', () => closeModal('modal-song'));
  document.getElementById('btn-cancel-song').addEventListener('click', () => closeModal('modal-song'));
  document.getElementById('btn-close-playlist-modal').addEventListener('click', () => closeModal('modal-playlist'));
  document.getElementById('btn-cancel-playlist').addEventListener('click', () => closeModal('modal-playlist'));
  document.getElementById('btn-close-add-to-playlist-modal').addEventListener('click', () => closeModal('modal-add-to-playlist'));
  btnCloseVoice.addEventListener('click', () => {
    if (recognition) recognition.stop();
    voiceOverlay.classList.remove('active');
  });

  // Form submit listeners
  songForm.addEventListener('submit', addOrUpdateSong);
  playlistForm.addEventListener('submit', createPlaylist);
  document.getElementById('dj-chat-form').addEventListener('submit', handleDJChatSubmit);

  // Playback Control Buttons (Desktop)
  playPauseBtn.addEventListener('click', togglePlay);
  document.getElementById('control-skip-back').addEventListener('click', () => skip10s(false));
  document.getElementById('control-skip-forward').addEventListener('click', () => skip10s(true));
  document.getElementById('control-prev').addEventListener('click', prevTrack);
  document.getElementById('control-next').addEventListener('click', nextTrack);
  
  // Heart Add Favorite
  playerHeartBtn.addEventListener('click', toggleFavoriteStatus);
  
  // Shuffle/Repeat toggles
  const shuffleBtn = document.getElementById('control-shuffle');
  const repeatBtn = document.getElementById('control-repeat');
  
  shuffleBtn.addEventListener('click', () => {
    playSFX('click');
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
  });
  
  repeatBtn.addEventListener('click', () => {
    playSFX('click');
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle('active', isRepeat);
  });

  // Full Screen visualizer toggle
  desktopVisToggle.addEventListener('click', () => {
    playSFX('click');
    desktopVisOverlay.style.display = 'flex';
    initAudioContext();
    startVisualizer();
  });
  
  btnCloseVis.addEventListener('click', () => {
    playSFX('click');
    desktopVisOverlay.style.display = 'none';
  });

  // Visualizer controls selectors
  document.getElementById('vis-style-select').addEventListener('change', (e) => {
    currentVisStyle = e.target.value;
  });
  document.getElementById('vis-color-select').addEventListener('change', (e) => {
    currentVisColor = e.target.value;
  });

  // Lyrics toggle trigger
  document.getElementById('player-lyrics-toggle').addEventListener('click', () => {
    playSFX('click');
    if (activeSong) {
      document.getElementById('lyrics-lab-overlay').classList.add('active');
      loadLyrics(activeSong.id);
    } else {
      alert("Please play a song first!");
    }
  });

  document.getElementById('btn-close-lyrics').addEventListener('click', () => {
    playSFX('click');
    document.getElementById('lyrics-lab-overlay').classList.remove('active');
  });

  // AI Lyrics Action Triggers
  document.getElementById('btn-lyrics-translate').addEventListener('click', () => triggerLyricsAction('translate'));
  document.getElementById('btn-lyrics-explain').addEventListener('click', () => triggerLyricsAction('explain'));
  document.getElementById('btn-lyrics-rewrite').addEventListener('click', () => triggerLyricsAction('rewrite'));

  // MOBILE: Open full sheet
  miniPlayerTrigger.addEventListener('click', () => {
    playSFX('tap');
    mobileSheet.classList.add('open');
    initAudioContext();
    startVisualizer();
  });
  
  mobileCloseBtn.addEventListener('click', () => {
    playSFX('tap');
    mobileSheet.classList.remove('open');
  });

  // Mobile Controls Bindings
  mobilePlayPause.addEventListener('click', togglePlay);
  document.getElementById('mobile-prev').addEventListener('click', prevTrack);
  document.getElementById('mobile-next').addEventListener('click', nextTrack);
  mobileHeartBtn.addEventListener('click', toggleFavoriteStatus);
  
  const mShuffle = document.getElementById('mobile-shuffle');
  const mRepeat = document.getElementById('mobile-repeat');
  
  mShuffle.addEventListener('click', () => {
    playSFX('click');
    isShuffle = !isShuffle;
    mShuffle.classList.toggle('active', isShuffle);
    shuffleBtn.classList.toggle('active', isShuffle);
  });
  
  mRepeat.addEventListener('click', () => {
    playSFX('click');
    isRepeat = !isRepeat;
    mRepeat.classList.toggle('active', isRepeat);
    repeatBtn.classList.toggle('active', isRepeat);
  });

  document.getElementById('mobile-playlist-add').addEventListener('click', () => {
    playSFX('click');
    if (activeSong) openAddToPlaylistModal(activeSong.id);
  });
  
  document.getElementById('player-playlist-add').addEventListener('click', () => {
    playSFX('click');
    if (activeSong) openAddToPlaylistModal(activeSong.id);
  });

  document.getElementById('mobile-lyrics-toggle').addEventListener('click', () => {
    playSFX('click');
    if (activeSong) {
      document.getElementById('lyrics-lab-overlay').classList.add('active');
      loadLyrics(activeSong.id);
    } else {
      alert("Please play a song first!");
    }
  });

  document.getElementById('mobile-vfx-toggle').addEventListener('click', () => {
    playSFX('click');
    // Toggle styling or canvas visibility
    isVisualizerEnabled = !isVisualizerEnabled;
    mobileVisCanvas.style.display = isVisualizerEnabled ? 'block' : 'none';
  });

  // Handle click on Mobile Mini-Player Play icon
  playerBar.addEventListener('click', (e) => {
    // Check if on mobile view & clicking right area
    if (window.innerWidth <= 768 && e.target.closest('.player-right')) {
      e.stopPropagation();
      togglePlay();
    }
  });
}

// --- SYNCED LYRICS LRC PARSING & DISPLAY ---
function parseLRC(lrcText) {
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d+):(\d+)(?:\.(\d+))?\]/;
  
  lines.forEach(line => {
    const match = timeRegex.exec(line);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3], 10) : 0;
      const time = min * 60 + sec + (ms / 100);
      const text = line.replace(timeRegex, '').trim();
      result.push({ time, text });
    }
  });
  
  result.sort((a, b) => a.time - b.time);
  return result;
}

async function loadLyrics(songId) {
  const container = document.getElementById('lyrics-scroll-container');
  const aiContent = document.getElementById('lyrics-ai-content');
  const aiPlaceholder = document.getElementById('lyrics-ai-placeholder');
  
  container.innerHTML = '<p class="lyric-line-placeholder"><i class="fa-solid fa-spinner fa-spin"></i> Loading lyrics...</p>';
  aiContent.classList.add('hidden');
  aiPlaceholder.classList.remove('hidden');
  parsedLyrics = [];
  rawLyricsText = "";
  
  try {
    const res = await fetch(`/api/lyrics/${songId}`);
    const data = await res.json();
    
    if (data.lyrics) {
      rawLyricsText = data.lyrics;
      parsedLyrics = parseLRC(rawLyricsText);
      
      document.getElementById('lyrics-song-title').textContent = data.title;
      document.getElementById('lyrics-song-artist').textContent = activeSong ? activeSong.artist : "";
      
      container.innerHTML = '';
      if (parsedLyrics.length > 0) {
        parsedLyrics.forEach(line => {
          const p = document.createElement('p');
          p.className = 'lyric-line';
          p.textContent = line.text;
          p.setAttribute('data-time', line.time);
          p.addEventListener('click', () => {
            audio.currentTime = line.time;
          });
          container.appendChild(p);
        });
      } else {
        container.innerHTML = '<p class="lyric-line-placeholder">No formatted lyrics available for this song.</p>';
      }
    }
  } catch (err) {
    console.error("Failed to load lyrics:", err);
    container.innerHTML = '<p class="lyric-line-placeholder">Error fetching lyrics from the server.</p>';
  }
}

async function triggerLyricsAction(action) {
  if (!activeSong || !rawLyricsText) return;
  
  playSFX('click');
  const contentPanel = document.getElementById('lyrics-ai-content');
  const placeholderPanel = document.getElementById('lyrics-ai-placeholder');
  
  placeholderPanel.classList.add('hidden');
  contentPanel.classList.remove('hidden');
  contentPanel.innerHTML = '<p style="text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Gemini AI is analyzing lyrics...</p>';
  
  try {
    const res = await fetch('/api/ai/lyrics-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        lyrics: rawLyricsText,
        songTitle: activeSong.title,
        songArtist: activeSong.artist
      })
    });
    
    const data = await res.json();
    if (data.success && data.result) {
      const formattedText = data.result
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      contentPanel.innerHTML = formattedText;
    } else {
      contentPanel.innerHTML = '<p style="color: #ef4444;">Failed to execute AI analysis.</p>';
    }
  } catch (err) {
    console.error("AI Lyrics action error:", err);
    contentPanel.innerHTML = '<p style="color: #ef4444;">Connection error trying to contact AI services.</p>';
  }
}

// --- RESIDENT AI DJ CHAT HANDLERS ---
async function handleDJChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('dj-chat-input');
  const text = input.value.trim();
  if (!text) return;
  
  input.value = "";
  playSFX('tap');
  
  appendChatBubble('user', text);
  chatHistory.push({ role: 'user', text });
  
  const typingBubble = appendChatBubble('dj', '<i class="fa-solid fa-circle-notch fa-spin"></i> DJ Host is mixing a reply...');
  
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, history: chatHistory })
    });
    const data = await res.json();
    
    typingBubble.remove();
    
    if (data.response) {
      appendChatBubble('dj', data.response);
      chatHistory.push({ role: 'dj', text: data.response });
      
      // Auto-play recommended songs when matched
      const match = data.response.match(/\*\*"([^"]+)"\*\*/);
      if (match && match[1]) {
        const found = songs.find(s => s.title.toLowerCase() === match[1].toLowerCase());
        if (found) {
          setTimeout(() => {
            playSong(found);
          }, 1500);
        }
      }
    }
  } catch (err) {
    typingBubble.remove();
    appendChatBubble('dj', "Sorry, I hit a snag in the turntable mix. Try again shortly! 🎧");
  }
}

function appendChatBubble(role, text) {
  const container = document.getElementById('dj-chat-logs');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  
  const avatar = role === 'dj' ? '🎧' : '👤';
  const formattedText = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

  bubble.innerHTML = `
    <span class="chat-avatar">${avatar}</span>
    <div class="chat-bubble-content">
      <p>${formattedText}</p>
    </div>
  `;
  
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}
