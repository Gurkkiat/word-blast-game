/* Word Blast — block puzzle powered by English questions. Plain JS, no build step. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const N = 8;
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const COSTS = { bomb: 3, single: 1, swap: 2, undo: 2 };
  const MAX_ENERGY = 5;
  const LINE_POINTS = [0, 10, 25, 45, 70, 100, 130, 160, 200];
  const TYPE_EN = { gap: 'Gap fill', collocation: 'Collocation', synonym: 'Synonym', order: 'Word order', listening: 'Listening' };
  const TYPE_TH = { gap: 'เติมคำ', collocation: 'คำที่ใช้คู่กัน', synonym: 'คำความหมายใกล้เคียง', order: 'เรียงคำ', listening: 'การฟัง' };

  /* ---------- Storage ---------- */
  const KEY = 'word-blast.v1';
  const defaults = () => ({
    settings: { level: 'B1', topic: 'all', thai: false, muted: false },
    best: 0, games: 0, wrong: [], collected: {}, typeStats: {},
  });
  let memory = null;
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = memory; }
    const base = defaults();
    if (!raw) return base;
    try {
      const p = JSON.parse(raw);
      return { ...base, ...p, settings: { ...base.settings, ...(p.settings || {}) } };
    } catch (e) { return base; }
  }
  let saved = load();
  function persist() {
    memory = JSON.stringify(saved);
    try { localStorage.setItem(KEY, memory); } catch (e) { /* storage blocked: keep in memory */ }
  }

  /* ---------- i18n ---------- */
  const TH = {
    level: 'ระดับ', topic: 'หัวข้อ', words: 'คำศัพท์', score: 'คะแนน', best: 'สูงสุด', combo: 'คอมโบ', streak: 'ถูกติดกัน',
    stuck: 'ไม่มีที่ว่างสำหรับบล็อกเหล่านี้ ใช้ไอเท็มช่วย หรือจบเกม', endGame: 'จบเกม',
    bombAim: 'แตะช่องเพื่อระเบิดพื้นที่ 3×3 รอบช่องนั้น', cancel: 'ยกเลิก',
    energy: 'พลังงาน', energyHint: 'ตอบถูกเพื่อรับพลังงาน แล้วนำไปใช้กับไอเท็มช่วย',
    bomb: 'ระเบิด', single: 'บล็อกเดี่ยว', swap: 'สลับชุด', undo: 'ย้อนกลับ',
    lines: 'แถวที่เคลียร์', answered: 'ตอบแล้ว', accuracy: 'ความแม่นยำ',
    keysHint: 'ปุ่มลัด: 1–3 เลือกบล็อก · ลูกศรเลื่อน · Enter วาง · Esc ยกเลิก',
    playAgain: 'ฟังอีกครั้ง', reset: 'เริ่มใหม่', check: 'ตรวจคำตอบ', continue: 'ไปต่อ',
    eyebrow: 'เกมบล็อก · ศัพท์และไวยากรณ์ IELTS',
    how1: 'ตอบคำถามภาษาอังกฤษสั้นๆ เพื่อรับบล็อกสามชิ้นถัดไป',
    how2: 'ลากบล็อกลงบนกระดาน เติมแถวหรือคอลัมน์ให้เต็มเพื่อเคลียร์',
    how3: 'ตอบถูกจะได้บล็อกที่วางง่ายกว่า และได้พลังงานไว้ใช้ไอเท็มช่วย',
    how4: 'ทุกครั้งที่เคลียร์แถว คำศัพท์จากคำถามล่าสุดจะถูกเก็บเข้าคลังคำศัพท์',
    gameOver: 'จบเกม', newWords: 'คำศัพท์ใหม่', wordsCollected: 'คำที่เก็บได้', weakTypes: 'ประเภทคำถามที่ควรฝึก',
    play: 'เริ่มเล่น', review: 'ทบทวนข้อที่ผิด', collection: 'คลังคำศัพท์',
    powerHelp: 'ไอเท็มช่วยทำงานอย่างไร', howToPlay: 'วิธีเล่น',
    loadError: 'โหลดไฟล์ questions.json ไม่ได้ ให้เปิดโฟลเดอร์นี้ผ่านเซิร์ฟเวอร์ในเครื่อง (เช่น python3 -m http.server) แทนการเปิดไฟล์โดยตรง',
  };
  const DYN = {
    en: {
      instr_gap: 'Choose the word that completes the sentence.',
      instr_collocation: 'Choose the word that naturally goes with the others.',
      instr_synonym: 'Choose the word closest in meaning to the highlighted word.',
      instr_order: 'Tap the words in the correct order.',
      instr_listening: 'Listen and choose the correct spelling.',
      correct: 'Correct', plusEnergy: '+1 energy', energyFull: 'energy full',
      friendly: 'Your next pieces will be easier to place.', streakOn: 'Answer streak: points ×1.5 for this set of pieces.',
      wrong: 'Not quite', answerIs: 'Answer:', randomPieces: 'Your next pieces are random.',
      newWord: 'New word: {w}', comboN: 'Combo ×{n}', linesN: '{n} lines',
      bestNew: 'New best score!', bestWas: 'Best: {n}', again: 'Play again', playLbl: 'Play',
      reviewOf: 'Review {i} / {n}', reviewDone: 'Review complete: {r} of {n} correct',
      noWeak: 'None. Well done.', noWordsGame: 'No new words this game.',
      wordsSummary: '{n} of {t} words collected', noWords: 'No words yet. Clear a line during a game to collect the current word.',
      noMatch: 'No words match your search.', needEnergy: 'Not enough energy', allLevels: 'All levels', allTopics: 'All topics',
      wrongOrder: 'Not quite', search: 'Search words',
    },
    th: {
      instr_gap: 'เลือกคำที่เติมลงในช่องว่างได้ถูกต้อง',
      instr_collocation: 'เลือกคำที่ใช้คู่กับคำอื่นในประโยคได้อย่างเป็นธรรมชาติ',
      instr_synonym: 'เลือกคำที่มีความหมายใกล้เคียงกับคำที่เน้นมากที่สุด',
      instr_order: 'แตะคำตามลำดับที่ถูกต้อง',
      instr_listening: 'ฟังแล้วเลือกคำที่สะกดถูกต้อง',
      correct: 'ถูกต้อง', plusEnergy: '+1 พลังงาน', energyFull: 'พลังงานเต็มแล้ว',
      friendly: 'บล็อกชุดถัดไปจะวางง่ายขึ้น', streakOn: 'ตอบถูกติดกัน: คะแนน ×1.5 สำหรับบล็อกชุดนี้',
      wrong: 'ยังไม่ถูก', answerIs: 'คำตอบ:', randomPieces: 'บล็อกชุดถัดไปเป็นแบบสุ่ม',
      newWord: 'คำศัพท์ใหม่: {w}', comboN: 'คอมโบ ×{n}', linesN: '{n} แถว',
      bestNew: 'ทำคะแนนสูงสุดใหม่!', bestWas: 'สูงสุด: {n}', again: 'เล่นอีกครั้ง', playLbl: 'เริ่มเล่น',
      reviewOf: 'ทบทวน {i} / {n}', reviewDone: 'ทบทวนเสร็จแล้ว: ถูก {r} จาก {n} ข้อ',
      noWeak: 'ไม่มี ทำได้ดีมาก', noWordsGame: 'เกมนี้ยังไม่ได้คำศัพท์ใหม่',
      wordsSummary: 'เก็บได้ {n} จาก {t} คำ', noWords: 'ยังไม่มีคำศัพท์ เคลียร์แถวระหว่างเล่นเพื่อเก็บคำจากคำถามล่าสุด',
      noMatch: 'ไม่พบคำที่ตรงกับการค้นหา', needEnergy: 'พลังงานไม่พอ', allLevels: 'ทุกระดับ', allTopics: 'ทุกหัวข้อ',
      wrongOrder: 'ยังไม่ถูก', search: 'ค้นหาคำศัพท์',
    },
  };
  const EN = {};
  document.querySelectorAll('[data-i18n]').forEach((el) => { EN[el.dataset.i18n] = el.textContent; });
  const lang = () => (saved.settings.thai ? 'th' : 'en');
  const t = (k, vars) => {
    let s = DYN[lang()][k] ?? DYN.en[k] ?? k;
    if (vars) for (const v in vars) s = s.split(`{${v}}`).join(vars[v]);
    return s;
  };
  const typeName = (ty) => (lang() === 'th' ? TYPE_TH : TYPE_EN)[ty];
  function applyI18n() {
    document.body.classList.toggle('ui-th', lang() === 'th');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.dataset.i18n;
      el.textContent = (lang() === 'th' && TH[k]) || EN[k];
    });
    $('wordSearch').placeholder = t('search');
  }

  /* ---------- Helpers ---------- */
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }

  function restartClass(el, cls) {
    if (!el || reduceMotion()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  let shownScore = 0, scoreRaf = 0;
  function tweenScore(target) {
    const el = $('score');
    cancelAnimationFrame(scoreRaf);
    if (reduceMotion() || target <= shownScore || target - shownScore < 3) { shownScore = target; el.textContent = target; return; }
    const from = shownScore, start = performance.now(), dur = 420;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      shownScore = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      el.textContent = shownScore;
      if (k < 1) scoreRaf = requestAnimationFrame(step);
    };
    scoreRaf = requestAnimationFrame(step);
  }
  function shakeSlot(i) { restartClass(document.querySelector(`.slot[data-slot="${i}"]`), 'shake'); }

  /* ---------- Sound (Web Audio, no files) ---------- */
  let actx = null;
  function tone(freq, dur, type = 'triangle', delay = 0, vol = 0.07) {
    if (saved.settings.muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator();
      const g = actx.createGain();
      const start = actx.currentTime + delay;
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g).connect(actx.destination);
      o.start(start); o.stop(start + dur + 0.02);
    } catch (e) { /* audio unavailable */ }
  }
  const sfx = {
    place: () => tone(300, 0.07),
    clear: (n) => [523, 659, 784, 1046].slice(0, Math.min(4, n + 1)).forEach((f, i) => tone(f, 0.14, 'triangle', i * 0.07)),
    correct: () => { tone(660, 0.1, 'sine'); tone(990, 0.16, 'sine', 0.09); },
    wrong: () => tone(180, 0.22, 'sawtooth', 0, 0.04),
    bomb: () => { tone(110, 0.35, 'square', 0, 0.05); tone(70, 0.4, 'sine', 0.05, 0.08); },
    deny: () => tone(140, 0.1, 'square', 0, 0.03),
  };

  /* ---------- Speech ---------- */
  const tts = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let voice = null;
  function pickVoice() {
    if (!tts) return;
    const vs = speechSynthesis.getVoices();
    voice = vs.find((v) => v.lang === 'en-GB' && /Google|Natural|Serena|Daniel|Kate/i.test(v.name)) || vs.find((v) => v.lang === 'en-GB') || vs.find((v) => /^en[-_]/i.test(v.lang)) || null;
  }
  if (tts) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }
  function speak(text, rate = 0.85) {
    if (!tts) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : 'en-GB';
    u.rate = rate;
    speechSynthesis.speak(u);
  }

  /* ---------- Pieces ---------- */
  const BASES = [
    { c: [[0, 0]], w: 3 },
    { c: [[0, 0], [0, 1]], w: 3 },
    { c: [[0, 0], [0, 1], [0, 2]], w: 3 },
    { c: [[0, 0], [0, 1], [0, 2], [0, 3]], w: 2 },
    { c: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], w: 1.4 },
    { c: [[0, 0], [0, 1], [1, 0], [1, 1]], w: 2.5 },
    { c: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], w: 0.8 },
    { c: [[0, 0], [1, 0], [1, 1]], w: 3 },
    { c: [[0, 0], [1, 0], [2, 0], [2, 1]], w: 2, mirror: true },
    { c: [[0, 0], [0, 1], [0, 2], [1, 1]], w: 2 },
    { c: [[0, 1], [0, 2], [1, 0], [1, 1]], w: 1.4, mirror: true },
    { c: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], w: 1.2 },
    { c: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], w: 1 },
  ];
  function normalize(cells) {
    const minR = Math.min(...cells.map((p) => p[0]));
    const minC = Math.min(...cells.map((p) => p[1]));
    return cells.map(([r, c]) => [r - minR, c - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  const keyOf = (cells) => cells.map((p) => p.join(',')).join(';');
  const PIECES = [];
  BASES.forEach((b) => {
    const variants = new Map();
    const seeds = [b.c];
    if (b.mirror) seeds.push(b.c.map(([r, c]) => [r, -c]));
    seeds.forEach((seed) => {
      let cur = seed;
      for (let i = 0; i < 4; i++) {
        const n = normalize(cur);
        variants.set(keyOf(n), n);
        cur = cur.map(([r, c]) => [c, -r]);
      }
    });
    const list = [...variants.values()];
    list.forEach((cells) => {
      const h = Math.max(...cells.map((p) => p[0])) + 1;
      const wd = Math.max(...cells.map((p) => p[1])) + 1;
      PIECES.push({ cells, h, wd, size: cells.length, w: b.w / list.length });
    });
  });
  const SINGLE = PIECES.find((p) => p.size === 1);

  function weightedPick(weightFn) {
    const total = PIECES.reduce((s, p) => s + weightFn(p), 0);
    let r = Math.random() * total;
    for (const p of PIECES) { r -= weightFn(p); if (r <= 0) return p; }
    return PIECES[0];
  }

  /* ---------- Board logic ---------- */
  let grid = new Array(N * N).fill(0);
  const idx = (r, c) => r * N + c;
  function canPlace(piece, r, c, g = grid) {
    for (const [dr, dc] of piece.cells) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N || g[idx(rr, cc)]) return false;
    }
    return true;
  }
  function fitsAnywhere(piece, g = grid) {
    for (let r = 0; r <= N - piece.h; r++) for (let c = 0; c <= N - piece.wd; c++) if (canPlace(piece, r, c, g)) return true;
    return false;
  }
  function fullLines(g) {
    const rows = [], cols = [];
    for (let r = 0; r < N; r++) { let full = true; for (let c = 0; c < N; c++) if (!g[idx(r, c)]) { full = false; break; } if (full) rows.push(r); }
    for (let c = 0; c < N; c++) { let full = true; for (let r = 0; r < N; r++) if (!g[idx(r, c)]) { full = false; break; } if (full) cols.push(c); }
    return { rows, cols };
  }
  function linesIfPlaced(piece, r, c) {
    const g = grid.slice();
    piece.cells.forEach(([dr, dc]) => { g[idx(r + dr, c + dc)] = 9; });
    return fullLines(g);
  }
  function bestLines(piece) {
    let best = -1;
    for (let r = 0; r <= N - piece.h; r++) for (let c = 0; c <= N - piece.wd; c++) {
      if (!canPlace(piece, r, c)) continue;
      const { rows, cols } = linesIfPlaced(piece, r, c);
      best = Math.max(best, rows.length + cols.length);
    }
    return best;
  }

  /* ---------- Game state ---------- */
  let DATA = null;
  let byId = new Map();
  let game = null;
  let tray = [null, null, null];
  let bonus = null;
  let sel = null;            // selected slot index (0-2, 3 = bonus)
  let cursor = null;         // {r, c} anchor for keyboard / hover
  let bombMode = false;
  let lastSnap = null;
  let busy = false;          // during clear animation
  let qState = null;         // current question state
  let review = null;
  let prevEnergy = 0;

  function newGameState() {
    return {
      score: 0, combo: 0, sinceClear: 0, lines: 0, energy: 0, streak: 0,
      answered: 0, correct: 0, trayMult: 1, friendly: true, asked: new Set(),
      typeWrong: {}, newWords: [], card: null, over: false,
    };
  }

  const slotPiece = (i) => (i === 3 ? bonus : tray[i]);
  function setSlot(i, v) { if (i === 3) bonus = v; else tray[i] = v; }
  function remainingPieces() { return [...tray, bonus].filter(Boolean); }

  function colorsFor(n) { return shuffle([1, 2, 3, 4, 5, 6]).slice(0, n); }
  function genTray(friendly, count = 3) {
    const colors = colorsFor(count);
    if (!friendly) {
      return Array.from({ length: count }, (_, i) => ({ piece: weightedPick((p) => (p.size >= 4 ? p.w * 1.4 : p.w)), color: colors[i] }));
    }
    let best = null, bestScore = -Infinity;
    for (let k = 0; k < 40; k++) {
      const cand = Array.from({ length: count }, () => weightedPick((p) => (p.size <= 4 ? p.w * 1.6 : p.w * 0.6)));
      let s = 0;
      cand.forEach((p) => {
        const bl = bestLines(p);
        s += bl >= 0 ? 100 + bl * 18 : 0;
      });
      s -= cand.reduce((n, p) => n + p.size, 0) + Math.random() * 6;
      if (s > bestScore) { bestScore = s; best = cand; }
    }
    return best.map((p, i) => ({ piece: p, color: colors[i] }));
  }

  /* ---------- Rendering ---------- */
  const board = $('board');
  const cells = [];
  for (let i = 0; i < N * N; i++) {
    const d = document.createElement('div');
    d.className = 'cell';
    d.dataset.i = i;
    board.appendChild(d);
    cells.push(d);
  }
  function renderBoard() {
    cells.forEach((el, i) => { if (grid[i]) el.dataset.c = grid[i]; else delete el.dataset.c; });
  }
  function clearPreview() {
    cells.forEach((el) => el.classList.remove('preview', 'pc1', 'pc2', 'pc3', 'pc4', 'pc5', 'pc6', 'will-clear', 'bad-preview', 'cursor'));
  }
  function showPreview(item, r, c, showInvalid) {
    clearPreview();
    if (!item) return false;
    const ok = canPlace(item.piece, r, c);
    if (ok) {
      item.piece.cells.forEach(([dr, dc]) => cells[idx(r + dr, c + dc)].classList.add('preview', 'pc' + item.color));
      const { rows, cols } = linesIfPlaced(item.piece, r, c);
      rows.forEach((rr) => { for (let cc = 0; cc < N; cc++) cells[idx(rr, cc)].classList.add('will-clear'); });
      cols.forEach((cc) => { for (let rr = 0; rr < N; rr++) cells[idx(rr, cc)].classList.add('will-clear'); });
    } else if (showInvalid) {
      item.piece.cells.forEach(([dr, dc]) => {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < N && cc < N) cells[idx(rr, cc)].classList.add(grid[idx(rr, cc)] ? 'cursor' : 'bad-preview');
      });
    }
    return ok;
  }

  function miniPiece(item, m) {
    const g = document.createElement('div');
    g.className = 'mini';
    g.style.gridTemplateColumns = `repeat(${item.piece.wd}, ${m}px)`;
    g.style.setProperty('--m', m + 'px');
    const set = new Set(item.piece.cells.map((p) => p.join(',')));
    for (let r = 0; r < item.piece.h; r++) for (let c = 0; c < item.piece.wd; c++) {
      const i = document.createElement('i');
      i.className = set.has(`${r},${c}`) ? 'pc' + item.color : 'blank';
      g.appendChild(i);
    }
    return g;
  }
  function renderTray(enter) {
    const el = $('tray');
    el.textContent = '';
    el.classList.toggle('has-bonus', !!bonus);
    const slots = bonus ? [0, 1, 2, 3] : [0, 1, 2];
    slots.forEach((i) => {
      const item = slotPiece(i);
      const s = document.createElement('div');
      s.className = 'slot' + (item ? '' : ' empty') + (i === 3 ? ' bonus' : '') + (sel === i ? ' selected' : '');
      s.dataset.slot = i;
      if (enter && item && !reduceMotion()) { s.classList.add('enter'); s.style.animationDelay = `${i * 70}ms`; }
      if (item) {
        s.tabIndex = 0;
        s.setAttribute('role', 'button');
        s.setAttribute('aria-label', `Piece ${i + 1}, ${item.piece.size} cells${fitsAnywhere(item.piece) ? '' : ', does not fit'}`);
        if (!fitsAnywhere(item.piece)) s.classList.add('nofit');
        const m = Math.max(10, Math.min(20, Math.floor(78 / Math.max(item.piece.h, item.piece.wd))));
        s.appendChild(miniPiece(item, m));
        const k = document.createElement('span');
        k.className = 'key';
        k.textContent = i + 1;
        s.appendChild(k);
      }
      el.appendChild(s);
    });
  }
  function renderHud() {
    const g = game;
    tweenScore(g ? g.score : 0);
    $('best').textContent = Math.max(saved.best, g ? g.score : 0);
    $('combo').textContent = g && g.combo > 0 ? '×' + g.combo : '–';
    $('combo').classList.toggle('on', !!g && g.combo > 1);
    $('streak').textContent = g ? g.streak : 0;
    $('streak').classList.toggle('hot', !!g && g.streak >= 3);
    const en = g ? g.energy : 0;
    $('pips').innerHTML = Array.from({ length: MAX_ENERGY }, (_, i) => `<i class="${i < en ? 'on' : ''}${i < en && i >= prevEnergy && !reduceMotion() ? ' fill' : ''}"></i>`).join('');
    prevEnergy = en;
    $('pips').setAttribute('aria-label', `Energy ${g ? g.energy : 0} of ${MAX_ENERGY}`);
    $('lines').textContent = g ? g.lines : 0;
    $('answered').textContent = g ? g.answered : 0;
    $('acc').textContent = g && g.answered ? Math.round((g.correct / g.answered) * 100) + '%' : '–';
    const e = g ? g.energy : 0;
    const active = !!g && !g.over && !qState;
    $('pBomb').disabled = !active || e < COSTS.bomb || !grid.some(Boolean);
    $('pSingle').disabled = !active || e < COSTS.single || !!bonus || !grid.some((v) => !v);
    $('pSwap').disabled = !active || e < COSTS.swap || !tray.some(Boolean);
    $('pUndo').disabled = !active || e < COSTS.undo || !lastSnap;
    $('wordCount').textContent = Object.keys(saved.collected).filter((id) => byId.has(id)).length;
  }
  function floatText(main, sub) {
    const el = document.createElement('div');
    el.className = 'float';
    el.innerHTML = `${esc(main)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    $('floatLayer').appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  /* ---------- Placing ---------- */
  function snapshot() {
    return { grid: grid.slice(), tray: tray.slice(), bonus, score: game.score, combo: game.combo, sinceClear: game.sinceClear, lines: game.lines, newWords: game.newWords.slice(), collected: { ...saved.collected } };
  }
  function place(slot, r, c) {
    const item = slotPiece(slot);
    if (!item || busy || !game || game.over || !canPlace(item.piece, r, c)) { sfx.deny(); return false; }
    lastSnap = snapshot();
    item.piece.cells.forEach(([dr, dc]) => { grid[idx(r + dr, c + dc)] = item.color; });
    game.score += item.piece.size;
    const centre = [r + (item.piece.h - 1) / 2, c + (item.piece.wd - 1) / 2];
    setSlot(slot, null);
    sel = null;
    cursor = null;
    clearPreview();
    renderBoard();
    item.piece.cells.forEach(([dr, dc]) => restartClass(cells[idx(r + dr, c + dc)], 'pop'));
    const { rows, cols } = fullLines(grid);
    const n = rows.length + cols.length;
    if (n) {
      game.combo += 1;
      game.sinceClear = 0;
      const pts = Math.round(LINE_POINTS[Math.min(n, LINE_POINTS.length - 1)] * game.combo * game.trayMult);
      game.score += pts;
      game.lines += n;
      const doomed = new Set();
      rows.forEach((rr) => { for (let cc = 0; cc < N; cc++) doomed.add(idx(rr, cc)); });
      cols.forEach((cc) => { for (let rr = 0; rr < N; rr++) doomed.add(idx(rr, cc)); });
      const maxDelay = staggerClear(doomed, centre);
      sfx.clear(n);
      if (game.combo > 1) restartClass($('combo'), 'bump');
      floatText('+' + pts, [n > 1 ? t('linesN', { n }) : '', game.combo > 1 ? t('comboN', { n: game.combo }) : ''].filter(Boolean).join(' · '));
      collectWord();
      busy = true;
      setTimeout(() => {
        doomed.forEach((i) => { grid[i] = 0; cells[i].classList.remove('clearing', 'pop'); cells[i].style.removeProperty('--d'); });
        renderBoard();
        busy = false;
        afterMove();
      }, reduceMotion() ? 0 : maxDelay + 270);
    } else {
      game.sinceClear += 1;
      if (game.sinceClear >= 3) game.combo = 0;
      sfx.place();
      afterMove();
    }
    renderTray();
    renderHud();
    return true;
  }
  // Clears ripple outward from where the piece landed; returns the longest delay used.
  function staggerClear(list, centre) {
    let max = 0;
    list.forEach((i) => {
      const d = reduceMotion() ? 0 : Math.round((Math.abs(Math.floor(i / N) - centre[0]) + Math.abs((i % N) - centre[1])) * 22);
      max = Math.max(max, d);
      cells[i].style.setProperty('--d', d + 'ms');
      cells[i].classList.add('clearing');
    });
    return max;
  }
  function afterMove() {
    renderTray();
    renderHud();
    if (!tray.some(Boolean)) { askQuestion(); return; }
    checkStuck();
  }
  function canRescue() {
    const e = game.energy;
    return (e >= COSTS.single && !bonus && grid.some((v) => !v))
      || (e >= COSTS.swap && tray.some(Boolean))
      || (e >= COSTS.bomb && grid.some(Boolean))
      || (e >= COSTS.undo && !!lastSnap);
  }
  function checkStuck() {
    const pieces = remainingPieces();
    const anyFits = pieces.some((it) => fitsAnywhere(it.piece));
    $('stuckBanner').hidden = true;
    if (anyFits || !pieces.length) return;
    if (canRescue()) $('stuckBanner').hidden = false;
    else gameOver();
  }

  function collectWord() {
    const q = game.card;
    if (!q || saved.collected[q.id]) return;
    saved.collected[q.id] = Date.now();
    game.newWords.push(q.card.word);
    persist();
    toast(t('newWord', { w: q.card.word }));
  }

  /* ---------- Power-ups ---------- */
  function spend(kind) {
    if (!game || game.energy < COSTS[kind]) { toast(t('needEnergy')); sfx.deny(); return false; }
    game.energy -= COSTS[kind];
    return true;
  }
  $('pSingle').addEventListener('click', () => {
    if (bonus || !spend('single')) return;
    bonus = { piece: SINGLE, color: colorsFor(1)[0] };
    lastSnap = null;
    renderTray(); renderHud(); checkStuck();
    restartClass(document.querySelector('.slot[data-slot="3"]'), 'enter');
  });
  $('pSwap').addEventListener('click', () => {
    if (!tray.some(Boolean) || !spend('swap')) return;
    const open = tray.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    const fresh = genTray(true, open.length);
    open.forEach((i, k) => { tray[i] = fresh[k]; });
    lastSnap = null;
    sel = null;
    renderTray(true); renderHud(); checkStuck();
  });
  $('pUndo').addEventListener('click', () => {
    if (!lastSnap || !spend('undo')) return;
    const s = lastSnap;
    grid = s.grid; tray = s.tray; bonus = s.bonus;
    Object.assign(game, { score: s.score, combo: s.combo, sinceClear: s.sinceClear, lines: s.lines, newWords: s.newWords });
    saved.collected = s.collected;
    persist();
    lastSnap = null;
    sel = null;
    renderBoard(); renderTray(); renderHud(); checkStuck();
  });
  $('pBomb').addEventListener('click', () => {
    if (!game || game.energy < COSTS.bomb) { toast(t('needEnergy')); return; }
    setBomb(!bombMode);
  });
  function setBomb(on) {
    bombMode = on;
    board.classList.toggle('bomb-mode', on);
    $('bombBanner').hidden = !on;
    if (on) { sel = null; clearPreview(); renderTray(); }
  }
  $('bombCancel').addEventListener('click', () => setBomb(false));
  function detonate(r, c) {
    if (!spend('bomb')) { setBomb(false); return; }
    setBomb(false);
    let count = 0;
    const hit = [];
    for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) {
      if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      const i = idx(rr, cc);
      if (grid[i]) { count++; hit.push(i); }
    }
    const maxDelay = staggerClear(hit, [r, c]);
    game.score += count * 2;
    lastSnap = null;
    sfx.bomb();
    if (count) floatText('+' + count * 2);
    busy = true;
    setTimeout(() => {
      hit.forEach((i) => { grid[i] = 0; cells[i].classList.remove('clearing', 'pop'); cells[i].style.removeProperty('--d'); });
      busy = false;
      renderBoard(); renderTray(); renderHud(); checkStuck();
    }, reduceMotion() ? 0 : maxDelay + 270);
    renderHud();
  }
  $('endBtn').addEventListener('click', () => gameOver());

  /* ---------- Pointer: drag from tray, tap to select, tap board to place ---------- */
  let drag = null;
  const ghost = $('ghost');
  function boardMetrics() {
    const r = board.getBoundingClientRect();
    const pad = 8;
    const gap = parseFloat(getComputedStyle(board).getPropertyValue('--gap')) || 4;
    const cell = (r.width - pad * 2 - gap * (N - 1)) / N;
    return { left: r.left + pad, top: r.top + pad, cell, pitch: cell + gap, gap, rect: r };
  }
  function buildGhost(item, m) {
    ghost.textContent = '';
    ghost.style.gridTemplateColumns = `repeat(${item.piece.wd}, ${m.cell}px)`;
    ghost.style.gap = m.gap + 'px';
    const set = new Set(item.piece.cells.map((p) => p.join(',')));
    for (let r = 0; r < item.piece.h; r++) for (let c = 0; c < item.piece.wd; c++) {
      const i = document.createElement('i');
      i.style.height = m.cell + 'px';
      i.className = set.has(`${r},${c}`) ? 'pc' + item.color : 'blank';
      ghost.appendChild(i);
    }
  }
  function anchorFromGhost(x, y, item, m) {
    return { r: Math.round((y - m.top) / m.pitch), c: Math.round((x - m.left) / m.pitch) };
  }
  function centeredAnchor(cellIndex, item) {
    const r = Math.floor(cellIndex / N), c = cellIndex % N;
    return { r: r - Math.floor((item.piece.h - 1) / 2), c: c - Math.floor((item.piece.wd - 1) / 2) };
  }

  $('tray').addEventListener('pointerdown', (ev) => {
    const s = ev.target.closest('.slot');
    if (!s || s.classList.contains('empty') || busy || qState || !game || game.over) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const slot = +s.dataset.slot;
    drag = { slot, el: s, x0: ev.clientX, y0: ev.clientY, moved: false, pid: ev.pointerId, touch: ev.pointerType !== 'mouse' };
    try { s.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  });
  document.addEventListener('pointermove', (ev) => {
    if (drag && ev.pointerId === drag.pid) {
      const item = slotPiece(drag.slot);
      if (!drag.moved) {
        if (Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < 6) return;
        drag.moved = true;
        drag.m = boardMetrics();
        buildGhost(item, drag.m);
        ghost.hidden = false;
        drag.el.classList.add('dragging');
        if (bombMode) setBomb(false);
      }
      ev.preventDefault();
      const m = drag.m;
      const w = item.piece.wd * m.pitch - m.gap;
      const h = item.piece.h * m.pitch - m.gap;
      const gx = ev.clientX - w / 2;
      const gy = drag.touch ? ev.clientY - h - 28 : ev.clientY - h / 2;
      ghost.style.transform = `translate(${gx}px, ${gy}px)`;
      const a = anchorFromGhost(gx, gy, item, m);
      drag.anchor = showPreview(item, a.r, a.c, false) ? a : null;
      return;
    }
    // hover preview for tap-to-place with a mouse
    if (!drag && sel !== null && ev.pointerType === 'mouse' && !qState) {
      const cell = ev.target.closest && ev.target.closest('.cell');
      if (cell && board.contains(cell)) {
        const item = slotPiece(sel);
        cursor = centeredAnchor(+cell.dataset.i, item);
        showPreview(item, cursor.r, cursor.c, true);
      }
    }
  }, { passive: false });
  function inBoard(ev) {
    const r = board.getBoundingClientRect();
    return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top - 80 && ev.clientY <= r.bottom;
  }
  function endDrag(ev, cancelled) {
    if (!drag || ev.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    ghost.hidden = true;
    d.el.classList.remove('dragging');
    if (!d.moved) {
      // tap: toggle selection
      sel = sel === d.slot ? null : d.slot;
      if (sel !== null) {
        const item = slotPiece(sel);
        cursor = { r: Math.floor((N - item.piece.h) / 2), c: Math.floor((N - item.piece.wd) / 2) };
      }
      clearPreview();
      renderTray();
      return;
    }
    if (!cancelled && d.anchor) place(d.slot, d.anchor.r, d.anchor.c);
    else { clearPreview(); renderTray(); if (!cancelled && inBoard(ev)) { sfx.deny(); shakeSlot(d.slot); } }
  }
  document.addEventListener('pointerup', (ev) => endDrag(ev, false));
  document.addEventListener('pointercancel', (ev) => endDrag(ev, true));

  board.addEventListener('click', (ev) => {
    const cell = ev.target.closest('.cell');
    if (!cell || busy || qState || !game || game.over) return;
    const i = +cell.dataset.i;
    if (bombMode) { detonate(Math.floor(i / N), i % N); return; }
    if (sel === null) return;
    const a = centeredAnchor(i, slotPiece(sel));
    const s0 = sel;
    if (!place(sel, a.r, a.c)) shakeSlot(s0);
  });
  board.addEventListener('pointerleave', () => { if (!drag && sel !== null && cursor) clearPreview(); });

  /* ---------- Keyboard ---------- */
  document.addEventListener('keydown', (ev) => {
    if (!$('helpOverlay').hidden) { if (ev.key === 'Escape') closeHelp(); return; }
    if (!$('wordsOverlay').hidden) { if (ev.key === 'Escape') closeWords(); return; }
    if (qState) { questionKeys(ev); return; }
    if (!$('menuOverlay').hidden || !game || game.over) return;
    if (ev.target.matches && ev.target.matches('input, select')) return;
    if (/^[1-4]$/.test(ev.key)) {
      const s = +ev.key - 1;
      if (!slotPiece(s)) return;
      sel = s;
      const item = slotPiece(s);
      cursor = cursor || { r: Math.floor((N - item.piece.h) / 2), c: Math.floor((N - item.piece.wd) / 2) };
      cursor.r = Math.min(cursor.r, N - item.piece.h);
      cursor.c = Math.min(cursor.c, N - item.piece.wd);
      renderTray();
      showPreview(item, cursor.r, cursor.c, true);
      board.focus({ preventScroll: true });
      ev.preventDefault();
    } else if (sel !== null && ev.key.startsWith('Arrow')) {
      const item = slotPiece(sel);
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[ev.key];
      cursor.r = Math.max(0, Math.min(N - item.piece.h, cursor.r + d[0]));
      cursor.c = Math.max(0, Math.min(N - item.piece.wd, cursor.c + d[1]));
      showPreview(item, cursor.r, cursor.c, true);
      ev.preventDefault();
    } else if (sel !== null && (ev.key === 'Enter' || ev.key === ' ')) {
      const s0 = sel;
      if (!place(sel, cursor.r, cursor.c)) shakeSlot(s0);
      ev.preventDefault();
    } else if (ev.key === 'Escape') {
      sel = null; cursor = null; clearPreview(); renderTray(); setBomb(false);
    }
  });
  $('tray').addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const s = ev.target.closest('.slot');
    if (!s || s.classList.contains('empty')) return;
    ev.preventDefault();
    ev.stopPropagation();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: String(+s.dataset.slot + 1) }));
  });

  /* ---------- Questions ---------- */
  function questionPool() {
    const s = saved.settings;
    let pool = DATA.questions.filter((q) => q.level === s.level && (s.topic === 'all' || q.topic === s.topic));
    if (!pool.length) pool = DATA.questions.filter((q) => q.level === s.level);
    return pool;
  }
  function pickQuestion() {
    const pool = questionPool();
    let fresh = pool.filter((q) => !game.asked.has(q.id));
    if (!fresh.length) { game.asked.clear(); fresh = pool; }
    const q = fresh[Math.floor(Math.random() * fresh.length)];
    game.asked.add(q.id);
    return q;
  }
  function askQuestion() {
    if (!game || game.over) return;
    sel = null; cursor = null; clearPreview(); setBomb(false);
    $('stuckBanner').hidden = true;
    openQuestion(pickQuestion(), 'game');
  }

  function openQuestion(q, mode) {
    qState = { q, mode, done: false, opts: shuffle(q.options), line: [], bank: [] };
    $('qOverlay').hidden = false;
    renderQuestion();
    renderHud();
    if (q.type === 'listening') setTimeout(() => speak(q.prompt, 0.8), 300);
  }
  function renderQuestion() {
    const { q, mode } = qState;
    $('qType').textContent = typeName(q.type);
    $('qLevel').textContent = mode === 'review' ? t('reviewOf', { i: review.i + 1, n: review.queue.length }) : `${q.level} · ${cap(q.topic)}`;
    $('qInstr').textContent = t('instr_' + q.type);
    const prompt = $('qPrompt');
    prompt.hidden = q.type === 'order' || q.type === 'listening';
    if (q.type === 'gap' || q.type === 'collocation') {
      prompt.innerHTML = esc(q.prompt).replace('___', '<span class="blank" aria-label="blank"></span>');
    } else if (q.type === 'synonym') {
      prompt.innerHTML = esc(q.prompt).replace(/\*([^*]+)\*/, '<mark>$1</mark>');
    }
    $('qListen').hidden = q.type !== 'listening';
    $('qPlay').disabled = !tts;
    const isOrder = q.type === 'order';
    $('qOrder').hidden = !isOrder;
    $('qOrderActions').hidden = !isOrder || qState.done;
    $('qOptions').hidden = isOrder;
    if (isOrder) {
      if (!qState.bank.length && !qState.line.length) {
        let words = q.options.map((w, i) => ({ id: i, w }));
        for (let k = 0; k < 20; k++) { words = shuffle(words); if (words.map((x) => x.w).join(' ') !== q.answer) break; }
        qState.bank = words;
      }
      renderOrder();
    } else {
      renderOptions();
    }
    renderQFeedback();
  }
  function renderOptions() {
    const box = $('qOptions');
    box.innerHTML = qState.opts.map((o, i) => `<button class="opt" type="button" data-i="${i}"><kbd>${i + 1}</kbd><span>${esc(o)}</span></button>`).join('');
    if (qState.done) {
      box.querySelectorAll('.opt').forEach((b) => {
        const o = qState.opts[+b.dataset.i];
        b.disabled = true;
        if (o === qState.q.answer) b.classList.add('right');
        else if (o === qState.choice) b.classList.add('wrong');
      });
    }
  }
  function renderOrder() {
    const line = $('orderLine');
    const bank = $('orderBank');
    line.className = 'order-line' + (qState.done ? (qState.correct ? ' right' : ' wrong') : '');
    line.innerHTML = qState.line.map((x) => `<button class="word-tile" type="button" data-id="${x.id}" ${qState.done ? 'disabled' : ''}>${esc(x.w)}</button>`).join('');
    bank.innerHTML = qState.bank.map((x) => `<button class="word-tile" type="button" data-id="${x.id}" ${qState.done ? 'disabled' : ''}>${esc(x.w)}</button>`).join('');
    $('orderCheck').disabled = qState.bank.length > 0;
  }
  $('orderBank').addEventListener('click', (ev) => moveWord(ev, 'bank', 'line'));
  $('orderLine').addEventListener('click', (ev) => moveWord(ev, 'line', 'bank'));
  function moveWord(ev, from, to) {
    const b = ev.target.closest('.word-tile');
    if (!b || !qState || qState.done) return;
    const id = +b.dataset.id;
    const i = qState[from].findIndex((x) => x.id === id);
    qState[to].push(qState[from].splice(i, 1)[0]);
    renderOrder();
    const next = document.querySelector(`#${from === 'bank' ? 'orderBank' : 'orderLine'} .word-tile`) || $('orderCheck');
    next.focus({ preventScroll: true });
  }
  $('orderReset').addEventListener('click', () => {
    if (!qState || qState.done) return;
    qState.bank = qState.bank.concat(qState.line);
    qState.line = [];
    renderOrder();
  });
  $('orderCheck').addEventListener('click', () => {
    if (!qState || qState.done || qState.bank.length) return;
    const attempt = qState.line.map((x) => x.w).join(' ');
    resolve(attempt.toLowerCase() === qState.q.answer.toLowerCase(), attempt);
  });
  $('qOptions').addEventListener('click', (ev) => {
    const b = ev.target.closest('.opt');
    if (!b || !qState || qState.done) return;
    const choice = qState.opts[+b.dataset.i];
    resolve(choice === qState.q.answer, choice);
  });
  $('qPlay').addEventListener('click', () => qState && speak(qState.q.prompt, 0.8));

  function resolve(correct, choice) {
    const { q, mode } = qState;
    qState.done = true;
    qState.correct = correct;
    qState.choice = choice;
    const ts = saved.typeStats[q.type] || { right: 0, wrong: 0 };
    ts[correct ? 'right' : 'wrong'] += 1;
    saved.typeStats[q.type] = ts;
    if (correct) saved.wrong = saved.wrong.filter((id) => id !== q.id);
    else if (!saved.wrong.includes(q.id)) saved.wrong.push(q.id);
    persist();
    if (mode === 'game') {
      game.answered += 1;
      if (correct) {
        game.correct += 1;
        game.streak += 1;
        qState.energyGained = game.energy < MAX_ENERGY;
        game.energy = Math.min(MAX_ENERGY, game.energy + 1);
      } else {
        game.streak = 0;
        game.typeWrong[q.type] = (game.typeWrong[q.type] || 0) + 1;
      }
      game.friendly = correct;
      game.trayMult = correct && game.streak >= 3 ? 1.5 : 1;
      game.card = q;
    } else if (correct) {
      review.right += 1;
    }
    (correct ? sfx.correct : sfx.wrong)();
    renderQuestion();
    $('qContinue').focus({ preventScroll: true });
  }
  function renderQFeedback() {
    const box = $('qFeedback');
    const row = $('qContinueRow');
    if (!qState || !qState.done) { box.hidden = true; row.hidden = true; return; }
    const { q, mode, correct } = qState;
    box.hidden = false;
    row.hidden = false;
    $('autoNote').textContent = '';
    box.className = 'q-feedback ' + (correct ? 'good' : 'bad');
    const lines = [];
    if (correct) {
      let title = t('correct');
      if (mode === 'game') title += ' · ' + (qState.energyGained ? t('plusEnergy') : t('energyFull'));
      lines.push(`<p class="fb-title">${esc(title)}</p>`);
      if (mode === 'game') lines.push(`<p class="fb-text">${esc(game.trayMult > 1 ? t('streakOn') : t('friendly'))}</p>`);
    } else {
      lines.push(`<p class="fb-title">${esc(t('wrong'))}</p>`);
      lines.push(`<p class="fb-text"><b>${esc(t('answerIs'))}</b> ${esc(q.answer)}</p>`);
      if (mode === 'game') lines.push(`<p class="fb-text">${esc(t('randomPieces'))}</p>`);
    }
    lines.push(`<p class="fb-text">${esc(q.explanation)}</p>`);
    if (!correct || lang() === 'th') lines.push(`<p class="fb-text th" lang="th">${esc(q.thai)}</p>`);
    const c = q.card;
    lines.push(`<div class="fb-card"><span><b>${esc(c.word)}</b> <i>${esc(c.pos)}</i> · <span class="th" lang="th">${esc(c.thai)}</span>
      ${tts ? `<button class="speak" type="button" data-say="${esc(c.example)}" aria-label="Listen to the example">▶</button>` : ''}</span>
      <span>${esc(c.example)}</span></div>`);
    box.innerHTML = lines.join('');
  }
  $('qFeedback').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-say]');
    if (b) speak(b.dataset.say);
  });
  function questionKeys(ev) {
    if (!qState.done && qState.q.type !== 'order' && /^[1-3]$/.test(ev.key)) {
      const b = $('qOptions').querySelector(`.opt[data-i="${+ev.key - 1}"]`);
      if (b) { b.click(); ev.preventDefault(); }
    }
  }
  $('qContinue').addEventListener('click', () => {
    if (!qState || !qState.done) return;
    const mode = qState.mode;
    qState = null;
    $('qOverlay').hidden = true;
    if (tts) speechSynthesis.cancel();
    if (mode === 'game') {
      tray = genTray(game.friendly);
      lastSnap = null;
      renderTray(true);
      renderHud();
      checkStuck();
    } else {
      review.i += 1;
      if (review.i < review.queue.length) openQuestion(review.queue[review.i], 'review');
      else finishReview();
    }
  });

  /* ---------- Game lifecycle ---------- */
  function newGame() {
    game = newGameState();
    grid = new Array(N * N).fill(0);
    tray = [null, null, null];
    bonus = null;
    sel = null; cursor = null; lastSnap = null;
    shownScore = 0; prevEnergy = 0;
    cells.forEach((el) => { el.classList.remove('dim', 'pop', 'clearing'); el.style.removeProperty('--d'); });
    setBomb(false);
    $('stuckBanner').hidden = true;
    $('menuOverlay').hidden = true;
    renderBoard(); renderTray(); renderHud();
    askQuestion();
  }
  function gameOver() {
    if (!game || game.over) return;
    game.over = true;
    $('stuckBanner').hidden = true;
    const isBest = game.score > saved.best;
    saved.best = Math.max(saved.best, game.score);
    saved.games += 1;
    persist();
    renderHud();
    if (!reduceMotion()) cells.forEach((el, i) => { if (grid[i]) { el.style.setProperty('--d', Math.floor(i / N) * 45 + 'ms'); el.classList.add('dim'); } });
    setTimeout(() => showMenu('over', isBest), reduceMotion() ? 0 : 900);
  }
  function showMenu(kind, isBest) {
    $('menuStart').hidden = kind === 'over';
    $('menuOver').hidden = kind !== 'over';
    $('playBtn').textContent = kind === 'over' ? t('again') : t('playLbl');
    if (kind === 'over' && game) {
      const g = game;
      $('overScore').textContent = g.score;
      $('overBest').textContent = isBest ? t('bestNew') : t('bestWas', { n: saved.best });
      $('overBest').classList.toggle('new', !!isBest);
      $('sumLines').textContent = g.lines;
      $('sumAnswered').textContent = g.answered;
      $('sumAcc').textContent = g.answered ? Math.round((g.correct / g.answered) * 100) + '%' : '–';
      $('sumNew').textContent = g.newWords.length;
      $('sumWords').innerHTML = g.newWords.length ? g.newWords.map((w) => `<span>${esc(w)}</span>`).join('') : esc(t('noWordsGame'));
      const weak = Object.entries(g.typeWrong).sort((a, b) => b[1] - a[1]);
      $('sumWeak').innerHTML = weak.length ? weak.map(([ty, n]) => `<li>${esc(typeName(ty))} ×${n}</li>`).join('') : `<li>${esc(t('noWeak'))}</li>`;
    }
    updateReviewBtn();
    $('menuOverlay').hidden = false;
    $('playBtn').focus({ preventScroll: true });
  }
  function updateReviewBtn() {
    const n = saved.wrong.filter((id) => byId.has(id)).length;
    $('reviewCount').textContent = n;
    $('reviewBtn').disabled = n === 0;
  }

  function startReview() {
    const queue = shuffle(saved.wrong.filter((id) => byId.has(id))).slice(0, 10).map((id) => byId.get(id));
    if (!queue.length) return;
    review = { queue, i: 0, right: 0 };
    $('menuOverlay').hidden = true;
    openQuestion(queue[0], 'review');
  }
  function finishReview() {
    toast(t('reviewDone', { r: review.right, n: review.queue.length }));
    review = null;
    showMenu(game && game.over ? 'over' : 'start');
  }

  /* ---------- Word collection ---------- */
  function openWords() {
    $('wordsOverlay').hidden = false;
    renderWords();
    $('wordSearch').focus({ preventScroll: true });
  }
  function closeWords() { $('wordsOverlay').hidden = true; }
  function renderWords() {
    const q = $('wordSearch').value.trim().toLowerCase();
    const lv = $('wordLevel').value;
    const tp = $('wordTopic').value;
    const ids = Object.keys(saved.collected).filter((id) => byId.has(id)).sort((a, b) => saved.collected[b] - saved.collected[a]);
    $('wordsSummary').textContent = t('wordsSummary', { n: ids.length, t: DATA.questions.length });
    const list = ids.map((id) => byId.get(id)).filter((x) => (lv === 'all' || x.level === lv) && (tp === 'all' || x.topic === tp)
      && (!q || x.card.word.toLowerCase().includes(q) || x.card.thai.includes(q)));
    const box = $('cards');
    if (!ids.length) { box.innerHTML = `<p class="empty-note">${esc(t('noWords'))}</p>`; return; }
    if (!list.length) { box.innerHTML = `<p class="empty-note">${esc(t('noMatch'))}</p>`; return; }
    box.innerHTML = list.map((x) => `
      <article class="card">
        <div class="card-top"><span class="card-word">${esc(x.card.word)}</span><span class="card-meta">${x.level}</span></div>
        <span class="card-pos">${esc(x.card.pos)} · ${esc(cap(x.topic))}</span>
        <span class="card-th" lang="th">${esc(x.card.thai)}</span>
        <span class="card-ex">${esc(x.card.example)} ${tts ? `<button class="speak" type="button" data-say="${esc(x.card.example)}" aria-label="Listen">▶</button>` : ''}</span>
      </article>`).join('');
  }
  $('cards').addEventListener('click', (ev) => { const b = ev.target.closest('[data-say]'); if (b) speak(b.dataset.say); });
  ['wordSearch', 'wordLevel', 'wordTopic'].forEach((id) => $(id).addEventListener('input', renderWords));
  $('wordsBtn').addEventListener('click', openWords);
  $('menuWordsBtn').addEventListener('click', openWords);
  $('wordsClose').addEventListener('click', closeWords);
  $('wordsOverlay').addEventListener('click', (ev) => { if (ev.target === $('wordsOverlay')) closeWords(); });

  /* ---------- How to play ---------- */
  const HELP = {
    en: {
      nav: ['Goal', 'Each turn', 'Answers', 'Scoring', 'Power-ups', 'Questions', 'Words', 'Controls'],
      goal: 'Place blocks on the 8×8 board and clear as many lines as you can. The game ends when none of your pieces can fit.',
      turn: ['Answer one short English question.', 'You get three pieces. Place all three, in any order.', 'Fill a whole row or column to clear it.', 'When your tray is empty, the next question appears.'],
      turnNote: 'Pieces cannot be rotated. A faded piece in the tray has no space on the board right now.',
      correctH: 'Correct answer', correct: ['+1 energy (up to 5)', 'Friendlier pieces: at least one will fit, with better chances to clear lines', '3 or more correct in a row: line points ×1.5 for that set of pieces'],
      wrongH: 'Wrong answer', wrong: ['Random pieces, which may not fit', 'You see the answer, a short explanation and the Thai translation', 'The question is saved to Review mistakes'],
      scoreRows: [['Each block placed', '1 point per cell'], ['Clear 1 line', '10'], ['Clear 2 lines at once', '25'], ['Clear 3 lines at once', '45'], ['Clear 4 lines at once', '70'], ['Clear 5 lines at once', '100'], ['Combo: clear lines on consecutive placements', '× 2, × 3 …'], ['Answer streak (3+ correct in a row)', '× 1.5'], ['Bomb', '2 per block']],
      scoreNote: 'A combo keeps going as long as you clear at least one line every 3 placements. Example: 2 lines on a ×3 combo with a streak = 25 × 3 × 1.5 = 113 points.',
      powers: {
        bomb: ['Bomb', 'Clears the 3×3 area around the cell you tap.', 'Use it to open space when the board is crowded. It cannot be undone.'],
        single: ['Single', 'Adds an extra 1×1 block to a fourth slot in your tray. It does not count as one of your three pieces, so you can keep it for later.', 'Perfect for filling one last gap to finish a line.'],
        swap: ['Swap', 'Replaces the pieces still in your tray with new, easier ones.', 'Use it when your pieces do not fit anywhere.'],
        undo: ['Undo', 'Takes back your last placement, including the points it scored.', 'Only works for the most recent move, before a new set of pieces or another power-up.'],
      },
      energyNote: 'You earn 1 energy for each correct answer and can hold up to 5. Energy stays until the game ends.',
      stuckNote: 'If no piece fits but you have enough energy for a power-up, the game waits so you can use one. Otherwise the game ends.',
      types: [['Gap fill', 'Choose the word that completes the sentence.'], ['Collocation', 'Choose the word that naturally goes with the others, like "make a decision".'], ['Synonym', 'Choose the word closest in meaning to the highlighted word.'], ['Word order', 'Tap the words in the correct order to build a phrase.'], ['Listening', 'Listen to a word and choose the correct spelling. Press Play again to replay.']],
      words: 'Each time you clear a line, the word from your latest question is saved to your Word collection with its Thai meaning and an example sentence you can listen to.',
      controls: ['<b>Drag</b> a piece from the tray onto the board. On touch screens it floats above your finger so you can see where it lands.', '<b>Tap</b> a piece, then tap where its centre should go.', '<kbd>1</kbd>–<kbd>3</kbd> select a piece (<kbd>4</kbd> for the single block), arrow keys move it, <kbd>Enter</kbd> places it and <kbd>Esc</kbd> cancels.', 'In questions, <kbd>1</kbd>–<kbd>3</kbd> choose an answer and <kbd>Enter</kbd> continues.'],
      energyH: 'Energy', stuckH: 'When you are stuck',
    },
    th: {
      nav: ['เป้าหมาย', 'การเล่นแต่ละรอบ', 'ผลของการตอบ', 'การคิดคะแนน', 'ไอเท็มช่วย', 'ประเภทคำถาม', 'คลังคำศัพท์', 'การควบคุม'],
      goal: 'วางบล็อกบนกระดาน 8×8 และเคลียร์แถวให้ได้มากที่สุด เกมจะจบเมื่อไม่มีบล็อกชิ้นไหนวางลงได้',
      turn: ['ตอบคำถามภาษาอังกฤษสั้นๆ หนึ่งข้อ', 'รับบล็อกสามชิ้น แล้ววางให้ครบทั้งสามชิ้นในลำดับใดก็ได้', 'เติมแถวแนวนอนหรือแนวตั้งให้เต็มเพื่อเคลียร์', 'เมื่อวางครบทั้งถาด คำถามข้อถัดไปจะปรากฏ'],
      turnNote: 'หมุนบล็อกไม่ได้ ถ้าบล็อกในถาดดูจางลง แปลว่าตอนนี้ไม่มีที่ว่างบนกระดานให้วางชิ้นนั้น',
      correctH: 'ตอบถูก', correct: ['+1 พลังงาน (สะสมได้สูงสุด 5)', 'ได้บล็อกที่วางง่ายขึ้น อย่างน้อยหนึ่งชิ้นวางได้แน่นอน และมีโอกาสเคลียร์แถวมากขึ้น', 'ตอบถูกติดกันตั้งแต่ 3 ข้อ: คะแนนจากการเคลียร์แถว ×1.5 สำหรับบล็อกชุดนั้น'],
      wrongH: 'ตอบผิด', wrong: ['ได้บล็อกแบบสุ่ม ซึ่งอาจวางไม่ได้', 'จะเห็นคำตอบที่ถูก คำอธิบายสั้นๆ และคำแปลไทย', 'คำถามข้อนั้นจะถูกเก็บไว้ในโหมดทบทวนข้อที่ผิด'],
      scoreRows: [['วางบล็อก', 'ช่องละ 1 คะแนน'], ['เคลียร์ 1 แถว', '10'], ['เคลียร์ 2 แถวพร้อมกัน', '25'], ['เคลียร์ 3 แถวพร้อมกัน', '45'], ['เคลียร์ 4 แถวพร้อมกัน', '70'], ['เคลียร์ 5 แถวพร้อมกัน', '100'], ['คอมโบ: เคลียร์แถวต่อเนื่องหลายครั้ง', '× 2, × 3 …'], ['ตอบถูกติดกัน 3 ข้อขึ้นไป', '× 1.5'], ['ระเบิด', 'บล็อกละ 2']],
      scoreNote: 'คอมโบจะต่อเนื่องไปเรื่อยๆ ตราบใดที่คุณเคลียร์แถวได้อย่างน้อยหนึ่งครั้งในทุก 3 ชิ้นที่วาง ตัวอย่าง: เคลียร์ 2 แถวตอนคอมโบ ×3 และกำลังตอบถูกติดกัน = 25 × 3 × 1.5 = 113 คะแนน',
      powers: {
        bomb: ['ระเบิด', 'ระเบิดพื้นที่ 3×3 รอบช่องที่คุณแตะ', 'ใช้เมื่อกระดานแน่นเกินไปเพื่อเปิดพื้นที่ ใช้แล้วย้อนกลับไม่ได้'],
        single: ['บล็อกเดี่ยว', 'เพิ่มบล็อกขนาด 1×1 ในช่องที่สี่ของถาด ไม่นับเป็นหนึ่งในสามชิ้นหลัก จึงเก็บไว้ใช้ทีหลังได้', 'เหมาะสำหรับอุดช่องว่างช่องสุดท้ายเพื่อเคลียร์แถว'],
        swap: ['สลับชุด', 'เปลี่ยนบล็อกที่ยังเหลือในถาดเป็นชุดใหม่ที่วางง่ายขึ้น', 'ใช้เมื่อบล็อกที่มีอยู่วางไม่ลงเลย'],
        undo: ['ย้อนกลับ', 'ยกเลิกการวางบล็อกครั้งล่าสุด รวมถึงคะแนนที่ได้จากการวางครั้งนั้น', 'ใช้ได้เฉพาะการวางครั้งล่าสุด ก่อนได้บล็อกชุดใหม่หรือใช้ไอเท็มอื่น'],
      },
      energyNote: 'ตอบถูกหนึ่งข้อได้ 1 พลังงาน สะสมได้สูงสุด 5 และเก็บไว้ได้จนจบเกม',
      stuckNote: 'ถ้าไม่มีบล็อกชิ้นไหนวางได้ แต่คุณมีพลังงานพอใช้ไอเท็มช่วย เกมจะรอให้คุณใช้ไอเท็มก่อน ถ้าพลังงานไม่พอ เกมจะจบ',
      types: [['เติมคำ', 'เลือกคำที่เติมในช่องว่างแล้วได้ประโยคที่ถูกต้อง'], ['คำที่ใช้คู่กัน', 'เลือกคำที่ใช้คู่กับคำอื่นได้อย่างเป็นธรรมชาติ เช่น "make a decision"'], ['คำความหมายใกล้เคียง', 'เลือกคำที่มีความหมายใกล้เคียงกับคำที่เน้นมากที่สุด'], ['เรียงคำ', 'แตะคำตามลำดับที่ถูกต้องเพื่อสร้างวลี'], ['การฟัง', 'ฟังคำศัพท์แล้วเลือกคำที่สะกดถูกต้อง กด "ฟังอีกครั้ง" เพื่อฟังซ้ำ']],
      words: 'ทุกครั้งที่เคลียร์แถว คำศัพท์จากคำถามล่าสุดจะถูกเก็บเข้าคลังคำศัพท์ พร้อมความหมายภาษาไทยและประโยคตัวอย่างที่กดฟังได้',
      controls: ['<b>ลาก</b>บล็อกจากถาดไปวางบนกระดาน บนจอสัมผัสบล็อกจะลอยอยู่เหนือนิ้วเพื่อให้เห็นตำแหน่งที่จะวาง', '<b>แตะ</b>บล็อกหนึ่งครั้ง แล้วแตะตำแหน่งที่ต้องการให้เป็นกึ่งกลางของบล็อก', '<kbd>1</kbd>–<kbd>3</kbd> เลือกบล็อก (<kbd>4</kbd> สำหรับบล็อกเดี่ยว) ปุ่มลูกศรเลื่อน <kbd>Enter</kbd> วาง และ <kbd>Esc</kbd> ยกเลิก', 'ในหน้าคำถาม กด <kbd>1</kbd>–<kbd>3</kbd> เพื่อเลือกคำตอบ และ <kbd>Enter</kbd> เพื่อไปต่อ'],
      energyH: 'พลังงาน', stuckH: 'เมื่อไม่มีที่วาง',
    },
  };
  const COST_OF = { bomb: COSTS.bomb, single: COSTS.single, swap: COSTS.swap, undo: COSTS.undo };
  const ICON_OF = { bomb: 'pBomb', single: 'pSingle', swap: 'pSwap', undo: 'pUndo' };
  function renderHelp() {
    const H = HELP[lang()];
    const ids = ['h-goal', 'h-turn', 'h-answers', 'h-score', 'h-powers', 'h-types', 'h-words', 'h-controls'];
    $('helpNav').innerHTML = H.nav.map((n, i) => `<button type="button" data-to="${ids[i]}">${esc(n)}</button>`).join('');
    const li = (arr) => arr.map((x) => `<li>${x}</li>`).join('');
    const powers = Object.entries(H.powers).map(([k, [name, effect, tip]]) => `
      <div class="power-card">
        <div class="power-card-head">${$(ICON_OF[k]).querySelector('svg').outerHTML}<span>${esc(name)}</span><b>${COST_OF[k]}</b></div>
        <p>${esc(effect)}</p><p class="tip">${esc(tip)}</p>
      </div>`).join('');
    $('helpBody').innerHTML = `
      <section id="h-goal"><h3>${esc(H.nav[0])}</h3><p>${esc(H.goal)}</p></section>
      <section id="h-turn"><h3>${esc(H.nav[1])}</h3><ol>${li(H.turn.map(esc))}</ol><p class="help-note">${esc(H.turnNote)}</p></section>
      <section id="h-answers"><h3>${esc(H.nav[2])}</h3><div class="two-col">
        <div class="outcome good"><h4>${esc(H.correctH)}</h4><ul>${li(H.correct.map(esc))}</ul></div>
        <div class="outcome bad"><h4>${esc(H.wrongH)}</h4><ul>${li(H.wrong.map(esc))}</ul></div></div></section>
      <section id="h-score"><h3>${esc(H.nav[3])}</h3><table class="score-table"><tbody>${H.scoreRows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table><p class="help-note">${esc(H.scoreNote)}</p></section>
      <section id="h-powers"><h3>${esc(H.nav[4])}</h3><div class="power-cards">${powers}</div>
        <p><b>${esc(H.energyH)}.</b> ${esc(H.energyNote)}</p><p><b>${esc(H.stuckH)}.</b> ${esc(H.stuckNote)}</p></section>
      <section id="h-types"><h3>${esc(H.nav[5])}</h3><dl class="types">${H.types.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></section>
      <section id="h-words"><h3>${esc(H.nav[6])}</h3><p>${esc(H.words)}</p></section>
      <section id="h-controls"><h3>${esc(H.nav[7])}</h3><ul>${li(H.controls)}</ul></section>`;
  }
  function openHelp(section) {
    renderHelp();
    $('helpOverlay').hidden = false;
    const panel = $('helpOverlay').querySelector('.help-panel');
    panel.scrollTop = 0;
    if (section) requestAnimationFrame(() => $(section).scrollIntoView({ block: 'start' }));
    $('helpClose').focus({ preventScroll: true });
  }
  function closeHelp() { $('helpOverlay').hidden = true; }
  $('helpNav').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-to]');
    if (b) $(b.dataset.to).scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
  });
  $('helpBtn').addEventListener('click', () => openHelp());
  $('menuHelpBtn').addEventListener('click', () => openHelp());
  $('powerHelp').addEventListener('click', () => openHelp('h-powers'));
  $('helpClose').addEventListener('click', closeHelp);
  $('helpOverlay').addEventListener('click', (ev) => { if (ev.target === $('helpOverlay')) closeHelp(); });

  /* ---------- Controls ---------- */
  function fillControls() {
    $('levelSel').innerHTML = LEVELS.map((lv) => `<option value="${lv}">${lv} · Band ${esc(DATA.levels?.[lv]?.band || '')}</option>`).join('');
    $('levelSel').value = saved.settings.level;
    $('topicSel').value = saved.settings.topic;
    $('thaiChk').checked = saved.settings.thai;
    $('wordLevel').innerHTML = `<option value="all">${esc(t('allLevels'))}</option>` + LEVELS.map((lv) => `<option value="${lv}">${lv}</option>`).join('');
    $('wordTopic').innerHTML = `<option value="all">${esc(t('allTopics'))}</option>` + ['education', 'environment', 'technology', 'health', 'work', 'travel'].map((tp) => `<option value="${tp}">${cap(tp)}</option>`).join('');
    paintMute();
  }
  function paintMute() {
    const m = saved.settings.muted;
    $('muteBtn').setAttribute('aria-pressed', String(m));
    $('muteBtn').setAttribute('aria-label', m ? 'Sound off' : 'Sound on');
    $('muteIcon').setAttribute('d', m ? 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6' : 'M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12');
  }
  $('levelSel').addEventListener('change', (e) => { saved.settings.level = e.target.value; persist(); });
  $('topicSel').addEventListener('change', (e) => { saved.settings.topic = e.target.value; persist(); });
  $('muteBtn').addEventListener('click', () => { saved.settings.muted = !saved.settings.muted; persist(); paintMute(); });
  $('thaiChk').addEventListener('change', (e) => {
    saved.settings.thai = e.target.checked;
    persist();
    applyI18n();
    const lv = $('wordLevel').value, tp = $('wordTopic').value;
    fillControls();
    $('wordLevel').value = lv; $('wordTopic').value = tp;
    if (qState) renderQuestion();
    if (!$('menuOverlay').hidden) showMenu($('menuOver').hidden ? 'start' : 'over', $('overBest').classList.contains('new'));
    if (!$('wordsOverlay').hidden) renderWords();
    if (!$('helpOverlay').hidden) renderHelp();
  });
  $('playBtn').addEventListener('click', newGame);
  $('reviewBtn').addEventListener('click', startReview);

  /* ---------- Boot ---------- */
  applyI18n();
  renderBoard();
  renderTray();
  renderHud();
  $('menuOverlay').hidden = false;
  $('playBtn').disabled = true;
  fetch('questions.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      DATA = data;
      byId = new Map(data.questions.map((q) => [q.id, q]));
      if (!LEVELS.includes(saved.settings.level)) saved.settings.level = 'B1';
      fillControls();
      renderHud();
      $('playBtn').disabled = false;
      showMenu('start');
    })
    .catch(() => { $('loadError').hidden = false; });
})();
