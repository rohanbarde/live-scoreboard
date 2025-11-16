// Firebase configuration with enhanced error handling
console.log('🚀 Initializing Firebase...');

const firebaseConfig = {
  apiKey: "AIzaSyDTANQqo4uFuur5WzpeSgTBz3qUwnpx9_c",
  authDomain: "maha-judo-scorecard.firebaseapp.com",
  databaseURL: "https://maha-judo-scorecard-default-rtdb.firebaseio.com",
  projectId: "maha-judo-scorecard",
  storageBucket: "maha-judo-scorecard.firebasestorage.app",
  messagingSenderId: "802933098247",
  appId: "1:802933098247:web:6a651753eb6743e01fe7a2",
  measurementId: "G-KDLM8D3ZE1"
};

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
//  console.log('✅ Firebase initialized successfully');
  
  // Initialize Firebase services
  const database = firebase.database();
  
  // Test database connection
  const connectedRef = database.ref('.info/connected');
  connectedRef.on('value', (snap) => {
    if (snap.val() === true) {
      console.log('✅ Connected to Firebase Realtime Database');
    } else {
      console.log('⚠️ Not connected to Firebase Realtime Database');
    }
  });
  
  // Log any database errors
  database.ref().on('value', () => {}, (error) => {
    console.error('Firebase Database Error:', error);
  });
  
  // Make database available globally
  window.database = database;
  
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  throw error;
}

// Helper: safe read text/number
function elText(id) {
  const e = document.getElementById(id);
  if (!e) return '';
  if ('value' in e && typeof e.value === 'string') return e.value;
  return (e.textContent ?? '').toString();
}
function elNumber(id) {
  const v = elText(id);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// compute aggregated score (adjust formula here if needed)
function computeScoreFromParts(parts) {
  // example: ippon = 10 points, waza = 2 points, yuko = 1 point
  return (parts.ippon || 0) * 10 + (parts.waza || 0) * 2 + (parts.yuko || 0) * 1;
}

function buildMatchDataFromDOM() {
  // Read names / clubs from scoreboard inputs (actual IDs used in scoreboard.html)
  const fighterA = {
    name: elText('nameA') || 'Fighter A',
    club: elText('clubA') || 'Club A',
    weight: elText('weightA') || '',
    ippon: elNumber('ipponA'),
    waza: elNumber('wazaA'),
    yuko: elNumber('yukoA'),
    shido: elNumber('shidoA'),
    redCard: (typeof window.match !== 'undefined' && window.match.fighterA) ? window.match.fighterA.redCard || false : false
  };
  fighterA.score = computeScoreFromParts(fighterA);

  const fighterB = {
    name: elText('nameB') || 'Fighter B',
    club: elText('clubB') || 'Club B',
    weight: elText('weightB') || '',
    ippon: elNumber('ipponB'),
    waza: elNumber('wazaB'),
    yuko: elNumber('yukoB'),
    shido: elNumber('shidoB'),
    redCard: (typeof window.match !== 'undefined' && window.match.fighterB) ? window.match.fighterB.redCard || false : false
  };
  fighterB.score = computeScoreFromParts(fighterB);

  const timerText = elText('timerDisplay') || '04:00';
  const matchInfo = `Match ${elText('matchNumber') || '1'}`;
  const weightCategory = elText('weightCategory') || '';

  // Get hold timer data from global match object if available
  let holdTimer = {
    active: false,
    player: null,
    elapsedSec: 0,
    duration: 20, // 20 for normal, 10 for waza-ari
    type: 'normal',
    timerId: null
  };

  if (typeof window.match !== 'undefined' && window.match.holdTimer) {
    holdTimer = {
      active: window.match.holdTimer.active || false,
      player: window.match.holdTimer.player || null,
      elapsedSec: window.match.holdTimer.elapsedSec || 0,
      duration: window.match.holdTimer.duration || (window.match.holdTimer.type === 'waza-ari' ? 10 : 20),
      type: window.match.holdTimer.type || 'normal',
      timerId: null // Don't sync the timer ID
    };
  }

  return {
    fighterA,
    fighterB,
    timer: timerText,
    matchInfo,
    weightCategory,
    holdTimer,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP
  };
}

function updateFirebase() {
  try {
  // Check if database is available
      if (!window.database) {
        console.warn('Database not initialized yet');
        return;
      }
    const data = buildMatchDataFromDOM();
    // Add timer color info for vmix
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) {
      data.timerColor = timerDisplay.style.color || '#fff';
    }
    window.database.ref('current_match').set(data)
      .then(() => {/* ok */})
      .catch(err => console.error('❌ Firebase set error', err));
  } catch (e) {
    console.error('updateFirebase error', e);
  }
}

// Observers / listeners so updates trigger reliably
function setupListeners() {
  // fields changed by user
  const ids = ['nameA','clubA','nameB','clubB','weightCategory','matchNumber','matNumber'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', updateFirebase);
    el.addEventListener('change', updateFirebase);
  });

  // watch scoreboard numeric elements (ippon/waza/yuko/shido) - they are updated by refreshUI()
  const numericIds = ['ipponA','wazaA','yukoA','shidoA','ipponB','wazaB','yukoB','shidoB'];
  numericIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const mo = new MutationObserver(updateFirebase);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
  });

  // watch timer
  const timerEl = document.getElementById('timerDisplay');
  if (timerEl) {
    const timerObserver = new MutationObserver(updateFirebase);
    timerObserver.observe(timerEl, { childList: true, subtree: true, characterData: true });
  }

  // wrap refreshUI / updateTimerDisplay so any programmatic UI change also pushes to firebase
  if (window.refreshUI && !window.__fb_wrapped_refreshUI) {
    window.__fb_wrapped_refreshUI = true;
    const orig = window.refreshUI;
    window.refreshUI = function() {
      const r = orig.apply(this, arguments);
      updateFirebase();
      return r;
    };
  }
  if (window.updateTimerDisplay && !window.__fb_wrapped_updateTimerDisplay) {
    window.__fb_wrapped_updateTimerDisplay = true;
    const orig2 = window.updateTimerDisplay;
    window.updateTimerDisplay = function() {
      const r = orig2.apply(this, arguments);
      updateFirebase();
      return r;
    };
  }
}

// kickoff
document.addEventListener('DOMContentLoaded', () => {
  try {
    setupListeners();
    // send initial state (small delay so scoreboard initial render finishes)
    setTimeout(updateFirebase, 300);
    console.log('✅ firebase-updates listeners set');
  } catch (e) {
    console.error('❌ setupListeners error', e);
  }
});

// expose for manual call
window.updateFirebase = updateFirebase;
