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
  const DAY = 86400000;
  const defaults = () => ({
    settings: { level: 'B1', topic: 'all', thai: false, muted: false, goal: 10, patterns: false, vibrate: true },
    best: 0, games: 0, wrong: [], collected: {}, typeStats: {},
    levelStats: {}, srs: {}, days: {}, totals: { lines: 0 }, game: null, lastBackup: 0, tutorialDone: false,
  });
  let memory = null;
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = memory; }
    const base = defaults();
    if (!raw) return base;
    try {
      const p = JSON.parse(raw);
      const s = { ...base, ...p, settings: { ...base.settings, ...(p.settings || {}) }, totals: { ...base.totals, ...(p.totals || {}) } };
      ['srs', 'days', 'levelStats', 'typeStats', 'collected'].forEach((k) => { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
      // Older saves kept a plain list of missed questions. Each one becomes a review item that is due now.
      if (Array.isArray(s.wrong)) s.wrong.forEach((id) => { if (!s.srs[id]) s.srs[id] = { stage: 0, due: Date.now(), lapses: 1 }; });
      s.wrong = [];
      Object.keys(s.days).sort().slice(0, -90).forEach((k) => { delete s.days[k]; });
      return s;
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
    play: 'เริ่มเล่น', review: 'ทบทวนตามกำหนด', collection: 'คลังคำศัพท์',
    powerHelp: 'ไอเท็มช่วยทำงานอย่างไร', howToPlay: 'วิธีเล่น',
    practice: 'ฝึกจากคำศัพท์', progress: 'ความก้าวหน้า', paused: 'พักเกม',
    pauseNote: 'เกมของคุณถูกบันทึกอัตโนมัติ ปิดหน้านี้แล้วกลับมาเล่นต่อได้ภายหลัง',
    discardAsk: 'ทิ้งเกมที่บันทึกไว้แล้วเริ่มเกมใหม่ใช่ไหม', discardYes: 'เริ่มเกมใหม่', practiceThese: 'ฝึกคำเหล่านี้',
    stopTitle: 'จบเกมนี้ไหม', stopText: 'การจบเกมจะแสดงผลสรุป และเล่นเกมนี้ต่อไม่ได้อีก', stopKeep: 'เล่นต่อ',
    homeTitle: 'เลือกระดับ แล้วเริ่มเล่น', homeLevelHelp: 'เลือกระดับที่ท้าทายเล็กน้อย เปลี่ยนได้ทุกเมื่อ',
    homeGuide: 'คู่มือ', homeStudy: 'ทบทวนและฝึก', homeApply: 'การเปลี่ยนแปลงจะมีผลตั้งแต่คำถามข้อถัดไป',
    tourDesc: 'ลองเล่นจริงบนกระดานภายในหนึ่งนาที', helpDesc: 'กติกา การคิดคะแนน และไอเท็มช่วย',
    practiceDesc: 'ทดสอบตัวเองจากคำศัพท์ที่เก็บไว้', progressDesc: 'เป้าหมายรายวัน ความแม่นยำ และการสำรองข้อมูล',
    wordsDesc: 'คำศัพท์ทั้งหมดที่คุณเก็บได้',
    settings: 'ตั้งค่า', setPatterns: 'ลวดลายบนบล็อก',
    setPatternsHelp: 'เพิ่มลวดลายให้แต่ละสี เพื่อแยกบล็อกได้ง่ายโดยไม่ต้องพึ่งสีอย่างเดียว',
    setVibrate: 'การสั่น', setVibrateHelp: 'สั่นสั้นๆ เมื่อเคลียร์แถว ตอบคำถาม หรือวางบล็อกผิดตำแหน่ง',
    setSound: 'เสียง', setSoundHelp: 'เสียงสั้นๆ ตอนวาง เคลียร์ และตอบคำถาม',
    readBoard: 'อ่านกระดานออกเสียง (B)', tour: 'แนะนำการเล่นแบบย่อ',
    backupTitle: 'สำรองความก้าวหน้า', exportFile: 'ดาวน์โหลดไฟล์สำรอง', exportCopy: 'คัดลอกข้อความสำรอง',
    importFile: 'กู้คืนจากไฟล์', importPaste: 'กู้คืนจากข้อความที่วาง', checkBackup: 'ตรวจสอบข้อมูลสำรอง',
    nudge: 'ความก้าวหน้าของคุณเก็บไว้ในเครื่องนี้เท่านั้น สำรองไว้เพื่อไม่ให้สูญหาย', backupNow: 'สำรองตอนนี้',
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
      resume: 'Resume', continueGame: 'Continue', newGame: 'New game',
      savedNote: 'Saved game: {s} points',
      dailyLine: 'Today: {n} of {g} questions', streakN: '{n}-day streak', noStreak: 'No streak yet', goalReached: 'Daily goal reached!',
      dueN: '{n} due now', nextAt: 'Next review {when}',
      srsEmpty: 'Questions you miss come back here on a schedule: tomorrow, then after 3, 7 and 14 days.',
      practiceOf: 'Practice {i} / {n}', practiceDone: 'Practice complete: {r} of {n} correct',
      srsNext: 'Review again {when}.', srsMastered: 'Mastered. You answered this correctly at every review.',
      srsReset: 'This question will come back soon for review.',
      whenNow: 'now', whenHour: 'in under an hour', whenHours: 'in {n} hours', whenTomorrow: 'tomorrow', whenDays: 'in {n} days',
      stLearning: 'Learning', stMastered: 'Mastered', stDue: 'Review due',
      pToday: 'Today', pGoal: 'Daily goal', pQuestionsUnit: 'questions', pLast7: 'Last 7 days',
      pByType: 'Accuracy by question type', pByLevel: 'Accuracy by level',
      pLevelNote: 'Level accuracy counts answers from this version onwards.',
      pWords: 'Words', pCollected: 'Collected', pLearning: 'Learning', pMastered: 'Mastered', pDue: 'Due now',
      pAll: 'All time', pGames: 'Games', pBest: 'Best score', pQuestions: 'Questions', pAcc: 'Accuracy', pLines: 'Lines cleared',
      pFocus: '{type} is your weakest question type ({p}% correct). Try Review due and Practise words.',
      pNeedMore: 'Answer a few more questions to see your weak spots.', pDayLabel: '{d}: {n} questions',
      backupInfo: 'Your progress is saved only in this browser. Save a backup before you clear browser data or switch devices. If the download is blocked, use Copy backup text instead.',
      backupLast: 'Last backup: {when}.', backupNever: 'No backup yet.',
      agoNow: 'just now', agoMin: '{n} min ago', agoHours: '{n} hours ago', agoYesterday: 'yesterday', agoDays: '{n} days ago',
      backupCopied: 'Backup copied to the clipboard', copyFailed: 'Could not copy automatically. Select the text below and copy it.',
      backupDownloaded: 'Backup file saved', importPlaceholder: 'Paste the backup text here',
      impBad: 'That does not look like a Word Blast backup.', impNewer: 'This backup was made by a newer version of the game.',
      impEmpty: 'Choose a file or paste the backup text first.', impTooBig: 'That file is too large to be a Word Blast backup.',
      impSummary: 'Backup from {date}: {q} questions answered, {w} words collected, best score {b}.',
      impMerge: 'Merge with this device', impReplace: 'Replace this device', impCancel: 'Cancel',
      impMergeHelp: 'Merge keeps what is on this device and adds the backup: all collected words, the more advanced review stage for each question, and the higher totals. Recommended.',
      impReplaceAsk: 'This overwrites the progress on this device with the backup. Continue?', impReplaceYes: 'Yes, replace', impBack: 'Back',
      impMergeDone: 'Backup merged', impReplaceDone: 'Progress restored',
      aPiece: '{color} {shape}', shSingle: 'single block', shH: 'horizontal line of {n}', shV: 'vertical line of {n}',
      shRect: '{h} by {w} rectangle', shOther: '{n}-cell shape: {detail}', shRow: 'row {r}, {cols}',
      colOne: 'column {x}', colMany: 'columns {x}', aRange: '{a} to {b}',
      aSelect: 'Piece {i} selected, {text}. Move it with the arrow keys and press Enter to place it.',
      aCursor: 'Row {r}, column {c}. {fit}.', aFits: 'Fits', aNoFit: 'Does not fit', aWouldClear: 'Clears lines: {n}.',
      aPlaced: 'Placed {piece} at row {r}, column {c}.',
      aPlacedClear: 'Placed {piece} at row {r}, column {c}. Lines cleared: {n}. {pts} points.',
      aCannot: 'Cannot place the piece there.', aTray: 'Pieces: {list}.', aSlot: 'Piece {i}: {text}{fit}', aNoFitAny: ', does not fit anywhere',
      aSingle: 'Added a single block to your pieces.', aUndo: 'Last move undone.', aBomb: 'Bomb cleared {n} blocks.',
      aGameOver: 'Game over. Score {s}.', aBoardIntro: 'Board, 8 by 8.', aRowEmpty: 'Row {r} empty.', aRowsEmpty: 'Rows {a} to {b} empty.',
      aRowFull: 'Row {r} full.', aRowCols: 'Row {r}, filled columns {cols}.', aScore: 'Score {s}. Energy {e} of 5.',
      aBoardLabel: 'Game board, 8 by 8. Press 1 to 3 to pick a piece, arrow keys to move it, Enter to place it, B to hear the board.',
      vibNone: 'This browser does not support vibration. iPhone and iPad browsers do not.',
      lvDesc_A1: 'Everyday basics', lvDesc_A2: 'Simple sentences', lvDesc_B1: 'Opinions and daily life',
      lvDesc_B2: 'Academic basics', lvDesc_C1: 'Formal and complex', lvDesc_C2: 'Precise, near-native',
      lvAcc: '{p}% correct', homeLabel: 'Home', langLabel: 'Language',
      tourLabel: 'Practice question', tourStep: 'Step {n} of {t}', tourSkip: 'Skip tour', tourNext: 'Next', tourStart: 'Start playing',
      tourHint: 'Try the glowing spot.',
      tour1Title: 'Place a piece', tour1Text: 'Drag the piece onto the glowing spot. You can also tap the piece, then tap the spot.',
      tour2Title: 'Answer to get pieces', tour2Text: 'The full row cleared, and your tray is empty. Every new set of three pieces starts with a short English question.',
      tour2Note: 'Practice question. Answer it to earn your next pieces. It is not scored.',
      tour2Right: 'Correct answers give +1 energy and pieces that are easier to place.',
      tour2Wrong: 'A wrong answer gives random pieces, and the question comes back later for review.',
      tour3Title: 'Energy and power-ups', tour3Text: 'Each correct answer fills one energy bar, up to 5. Spend energy on a power-up when you are stuck.',
      tourP_bomb: 'Clears a 3×3 area.', tourP_single: 'Adds an extra 1×1 block.', tourP_swap: 'Swaps your pieces for new ones.', tourP_undo: 'Takes back your last move.',
      tour4Title: 'You are ready', tour4Text: 'Choose your level and topic on the Home page whenever you like: tap the logo at the top. Clear lines to collect words, and open Progress to see what to review. Your game saves automatically, and tapping the logo pauses it so you can come back later.',
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
      resume: 'เล่นต่อ', continueGame: 'เล่นเกมต่อ', newGame: 'เริ่มเกมใหม่',
      savedNote: 'เกมที่บันทึกไว้: {s} คะแนน',
      dailyLine: 'วันนี้: ตอบแล้ว {n} จาก {g} ข้อ', streakN: 'ต่อเนื่อง {n} วัน', noStreak: 'ยังไม่มีวันต่อเนื่อง', goalReached: 'ทำเป้าหมายรายวันสำเร็จ!',
      dueN: 'ถึงเวลาทบทวน {n} ข้อ', nextAt: 'ทบทวนครั้งถัดไป{when}',
      srsEmpty: 'ข้อที่ตอบผิดจะกลับมาให้ทบทวนตามกำหนด: พรุ่งนี้ แล้วอีก 3, 7 และ 14 วัน',
      practiceOf: 'ฝึก {i} / {n}', practiceDone: 'ฝึกเสร็จแล้ว: ถูก {r} จาก {n} ข้อ',
      srsNext: 'ทบทวนอีกครั้ง{when}', srsMastered: 'จำได้แล้ว คุณตอบถูกในการทบทวนทุกครั้ง',
      srsReset: 'คำถามข้อนี้จะกลับมาให้ทบทวนอีกเร็วๆ นี้',
      whenNow: 'ตอนนี้', whenHour: 'ภายในหนึ่งชั่วโมง', whenHours: 'ใน {n} ชั่วโมง', whenTomorrow: 'พรุ่งนี้', whenDays: 'ใน {n} วัน',
      stLearning: 'กำลังเรียนรู้', stMastered: 'จำได้แล้ว', stDue: 'ถึงเวลาทบทวน',
      pToday: 'วันนี้', pGoal: 'เป้าหมายรายวัน', pQuestionsUnit: 'ข้อ', pLast7: '7 วันที่ผ่านมา',
      pByType: 'ความแม่นยำตามประเภทคำถาม', pByLevel: 'ความแม่นยำตามระดับ',
      pLevelNote: 'ความแม่นยำตามระดับนับจากคำตอบในเวอร์ชันนี้เป็นต้นไป',
      pWords: 'คำศัพท์', pCollected: 'เก็บแล้ว', pLearning: 'กำลังเรียนรู้', pMastered: 'จำได้แล้ว', pDue: 'ถึงกำหนดทบทวน',
      pAll: 'ตลอดเวลา', pGames: 'จำนวนเกม', pBest: 'คะแนนสูงสุด', pQuestions: 'จำนวนข้อ', pAcc: 'ความแม่นยำ', pLines: 'แถวที่เคลียร์',
      pFocus: '{type} เป็นประเภทที่คุณตอบถูกน้อยที่สุด ({p}%) ลองใช้ปุ่มทบทวนตามกำหนดและฝึกจากคำศัพท์',
      pNeedMore: 'ตอบอีกสักสองสามข้อเพื่อดูจุดอ่อนของคุณ', pDayLabel: '{d}: {n} ข้อ',
      backupInfo: 'ความก้าวหน้าของคุณถูกเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ควรสำรองไว้ก่อนล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง ถ้าดาวน์โหลดไม่ได้ ให้ใช้ปุ่มคัดลอกข้อความสำรองแทน',
      backupLast: 'สำรองล่าสุด: {when}', backupNever: 'ยังไม่เคยสำรอง',
      agoNow: 'เมื่อสักครู่', agoMin: '{n} นาทีที่แล้ว', agoHours: '{n} ชั่วโมงที่แล้ว', agoYesterday: 'เมื่อวาน', agoDays: '{n} วันที่แล้ว',
      backupCopied: 'คัดลอกข้อมูลสำรองไปที่คลิปบอร์ดแล้ว', copyFailed: 'คัดลอกอัตโนมัติไม่ได้ เลือกข้อความด้านล่างแล้วคัดลอกเอง',
      backupDownloaded: 'บันทึกไฟล์สำรองแล้ว', importPlaceholder: 'วางข้อความสำรองที่นี่',
      impBad: 'ข้อมูลนี้ไม่ใช่ไฟล์สำรองของ Word Blast', impNewer: 'ข้อมูลสำรองนี้สร้างจากเกมเวอร์ชันที่ใหม่กว่า',
      impEmpty: 'เลือกไฟล์หรือวางข้อความสำรองก่อน', impTooBig: 'ไฟล์ใหญ่เกินกว่าจะเป็นไฟล์สำรองของ Word Blast',
      impSummary: 'ข้อมูลสำรองเมื่อ {date}: ตอบแล้ว {q} ข้อ เก็บคำศัพท์ {w} คำ คะแนนสูงสุด {b}',
      impMerge: 'รวมกับข้อมูลในเครื่องนี้', impReplace: 'แทนที่ข้อมูลในเครื่องนี้', impCancel: 'ยกเลิก',
      impMergeHelp: 'การรวมจะเก็บข้อมูลในเครื่องนี้ไว้ แล้วเพิ่มข้อมูลสำรองเข้าไป: คำศัพท์ที่เก็บทั้งหมด ขั้นการทบทวนที่ก้าวหน้ากว่าของแต่ละข้อ และตัวเลขรวมที่สูงกว่า แนะนำให้เลือกวิธีนี้',
      impReplaceAsk: 'ข้อมูลในเครื่องนี้จะถูกเขียนทับด้วยข้อมูลสำรอง ต้องการดำเนินการต่อไหม', impReplaceYes: 'ใช่ แทนที่เลย', impBack: 'ย้อนกลับ',
      impMergeDone: 'รวมข้อมูลสำรองแล้ว', impReplaceDone: 'กู้คืนความก้าวหน้าแล้ว',
      aPiece: '{shape} สี{color}', shSingle: 'บล็อกเดี่ยว', shH: 'แนวนอน {n} ช่อง', shV: 'แนวตั้ง {n} ช่อง',
      shRect: 'สี่เหลี่ยม {h} คูณ {w}', shOther: 'รูปทรง {n} ช่อง: {detail}', shRow: 'แถว {r} {cols}',
      colOne: 'คอลัมน์ {x}', colMany: 'คอลัมน์ {x}', aRange: '{a} ถึง {b}',
      aSelect: 'เลือกบล็อก {i} แล้ว {text} ใช้ปุ่มลูกศรเลื่อน และกด Enter เพื่อวาง',
      aCursor: 'แถว {r} คอลัมน์ {c} {fit}', aFits: 'วางได้', aNoFit: 'วางไม่ได้', aWouldClear: 'เคลียร์ได้ {n} แถว',
      aPlaced: 'วาง{piece}ที่แถว {r} คอลัมน์ {c}',
      aPlacedClear: 'วาง{piece}ที่แถว {r} คอลัมน์ {c} เคลียร์ {n} แถว ได้ {pts} คะแนน',
      aCannot: 'วางบล็อกตรงนั้นไม่ได้', aTray: 'บล็อก: {list}', aSlot: 'บล็อก {i}: {text}{fit}', aNoFitAny: ' วางไม่ได้เลย',
      aSingle: 'เพิ่มบล็อกเดี่ยวเข้าถาดแล้ว', aUndo: 'ย้อนการวางครั้งล่าสุดแล้ว', aBomb: 'ระเบิดทำลาย {n} บล็อก',
      aGameOver: 'จบเกม คะแนน {s}', aBoardIntro: 'กระดาน 8 คูณ 8', aRowEmpty: 'แถว {r} ว่าง', aRowsEmpty: 'แถว {a} ถึง {b} ว่าง',
      aRowFull: 'แถว {r} เต็ม', aRowCols: 'แถว {r} มีบล็อกที่คอลัมน์ {cols}', aScore: 'คะแนน {s} พลังงาน {e} จาก 5',
      aBoardLabel: 'กระดานเกม 8 คูณ 8 กด 1 ถึง 3 เพื่อเลือกบล็อก ปุ่มลูกศรเพื่อเลื่อน Enter เพื่อวาง และ B เพื่อฟังสถานะกระดาน',
      vibNone: 'เบราว์เซอร์นี้ไม่รองรับการสั่น (iPhone และ iPad ไม่รองรับ)',
      lvDesc_A1: 'พื้นฐานในชีวิตประจำวัน', lvDesc_A2: 'ประโยคง่ายๆ', lvDesc_B1: 'ความเห็นและชีวิตประจำวัน',
      lvDesc_B2: 'ภาษาวิชาการเบื้องต้น', lvDesc_C1: 'ภาษาทางการและซับซ้อน', lvDesc_C2: 'แม่นยำใกล้เคียงเจ้าของภาษา',
      lvAcc: 'ถูก {p}%', homeLabel: 'หน้าหลัก', langLabel: 'ภาษา',
      tourLabel: 'คำถามฝึก', tourStep: 'ขั้นที่ {n} จาก {t}', tourSkip: 'ข้ามการแนะนำ', tourNext: 'ถัดไป', tourStart: 'เริ่มเล่น',
      tourHint: 'ลองวางที่ช่องที่กะพริบ',
      tour1Title: 'วางบล็อก', tour1Text: 'ลากบล็อกไปวางที่ช่องที่กะพริบ หรือแตะที่บล็อก แล้วแตะที่ช่องนั้นก็ได้',
      tour2Title: 'ตอบคำถามเพื่อรับบล็อก', tour2Text: 'แถวเต็มถูกเคลียร์ และถาดของคุณว่างแล้ว ทุกครั้งที่จะได้บล็อกชุดใหม่ ต้องตอบคำถามภาษาอังกฤษสั้นๆ ก่อน',
      tour2Note: 'คำถามฝึก ตอบเพื่อรับบล็อกชุดถัดไป ไม่นับคะแนน',
      tour2Right: 'ตอบถูกจะได้ +1 พลังงาน และบล็อกที่วางง่ายขึ้น',
      tour2Wrong: 'ตอบผิดจะได้บล็อกแบบสุ่ม และคำถามนั้นจะกลับมาให้ทบทวนภายหลัง',
      tour3Title: 'พลังงานและไอเท็มช่วย', tour3Text: 'ตอบถูกหนึ่งข้อได้พลังงานหนึ่งช่อง สะสมได้สูงสุด 5 ใช้พลังงานกับไอเท็มช่วยเมื่อติดขัด',
      tourP_bomb: 'ระเบิดพื้นที่ 3×3', tourP_single: 'เพิ่มบล็อก 1×1 หนึ่งชิ้น', tourP_swap: 'เปลี่ยนบล็อกเป็นชุดใหม่', tourP_undo: 'ย้อนการวางครั้งล่าสุด',
      tour4Title: 'พร้อมเล่นแล้ว', tour4Text: 'เลือกระดับและหัวข้อที่หน้าหลักได้ทุกเมื่อ โดยแตะโลโก้ที่ด้านบน เคลียร์แถวเพื่อเก็บคำศัพท์ และเปิดความก้าวหน้าเพื่อดูว่าควรทบทวนอะไร เกมบันทึกอัตโนมัติ และแตะโลโก้เพื่อพักเกมแล้วกลับมาเล่นต่อได้',
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
    $('importText').placeholder = t('importPlaceholder');
    $('board').setAttribute('aria-label', t('aBoardLabel'));
    document.documentElement.lang = lang();
    $('homeBtn').setAttribute('aria-label', t('homeLabel'));
    $('pauseBtn').setAttribute('aria-label', `${(lang() === 'th' && TH.endGame) || EN.endGame} (P)`);
    $('langPick').setAttribute('aria-label', t('langLabel'));
    $('levelSel').setAttribute('aria-label', (lang() === 'th' && TH.level) || EN.level);
    $('topicSel').setAttribute('aria-label', (lang() === 'th' && TH.topic) || EN.topic);
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

  /* ---------- Daily goal, streak and review schedule ---------- */
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const dayRec = (k = dayKey()) => saved.days[k] || { answered: 0, correct: 0, lines: 0 };
  function today() {
    const k = dayKey();
    return saved.days[k] || (saved.days[k] = { answered: 0, correct: 0, lines: 0 });
  }
  function streakDays() {
    const d = new Date();
    if (!dayRec(dayKey(d)).met) d.setDate(d.getDate() - 1);
    let n = 0;
    while (dayRec(dayKey(d)).met) { n += 1; d.setDate(d.getDate() - 1); }
    return n;
  }
  function fmtWhen(ms) {
    if (ms <= 0) return t('whenNow');
    if (ms < 3600000) return t('whenHour');
    if (ms < 22 * 3600000) return t('whenHours', { n: Math.round(ms / 3600000) });
    const d = Math.round(ms / DAY);
    return d <= 1 ? t('whenTomorrow') : t('whenDays', { n: d });
  }

  // Leitner-style schedule. A missed question starts at stage 0 and is due at once.
  // Each correct review moves it up: +1 day, +3, +7, +14, then it counts as mastered.
  const SRS_DAYS = [0, 1, 3, 7, 14];
  const srsEntries = () => Object.entries(saved.srs).filter(([id]) => byId.has(id));
  function dueItems() {
    const now = Date.now();
    return srsEntries().filter(([, e]) => e.stage < 5 && e.due <= now).sort((a, b) => a[1].due - b[1].due).map(([id]) => byId.get(id));
  }
  function nextDue() {
    const now = Date.now();
    const later = srsEntries().filter(([, e]) => e.stage < 5 && e.due > now).map(([, e]) => e.due);
    return later.length ? Math.min(...later) : null;
  }
  function srsUpdate(q, correct) {
    const now = Date.now();
    let e = saved.srs[q.id];
    if (!correct) {
      e = e || { stage: 0, due: now, lapses: 0 };
      e.stage = 0; e.due = now; e.lapses = (e.lapses || 0) + 1;
      saved.srs[q.id] = e;
      return { kind: 'reset' };
    }
    if (!e || e.stage >= 5) return null;
    if (e.due > now) return { kind: 'early' };
    e.stage += 1;
    if (e.stage >= 5) { e.due = null; return { kind: 'mastered' }; }
    e.due = now + SRS_DAYS[e.stage] * DAY;
    return { kind: 'advance', ms: SRS_DAYS[e.stage] * DAY };
  }
  function wordStatus(id) {
    const e = saved.srs[id];
    if (!e) return null;
    if (e.stage >= 5) return { k: 'stMastered', cls: 'ok' };
    if (e.due <= Date.now()) return { k: 'stDue', cls: 'due' };
    return { k: 'stLearning', cls: 'learn', ms: e.due - Date.now() };
  }

  /* ---------- Screen reader announcements, vibration, spoken descriptions ---------- */
  let srFlip = false;
  function announce(msg) {
    srFlip = !srFlip;
    $('sr').textContent = msg + (srFlip ? '' : ' ');
  }
  const canVibrate = typeof navigator.vibrate === 'function';
  function vib(pattern) {
    if (!canVibrate || saved.settings.vibrate === false) return;
    try { navigator.vibrate(pattern); } catch (e) { /* not allowed right now */ }
  }
  const COLOR_NAMES = {
    en: ['teal', 'coral', 'gold', 'blue', 'green', 'purple'],
    th: ['เขียวอมฟ้า', 'ส้มอ่อน', 'เหลือง', 'น้ำเงิน', 'เขียวอ่อน', 'ม่วง'],
  };
  function rangesText(nums) {
    const out = [];
    let i = 0;
    while (i < nums.length) {
      let j = i;
      while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j += 1;
      out.push(j - i >= 2 ? t('aRange', { a: nums[i], b: nums[j] }) : nums.slice(i, j + 1).join(', '));
      i = j + 1;
    }
    return out.join(', ');
  }
  function pieceText(item) {
    const p = item.piece;
    let shape;
    if (p.size === 1) shape = t('shSingle');
    else if (p.h === 1) shape = t('shH', { n: p.size });
    else if (p.wd === 1) shape = t('shV', { n: p.size });
    else if (p.size === p.h * p.wd) shape = t('shRect', { h: p.h, w: p.wd });
    else {
      const rows = [];
      for (let r = 0; r < p.h; r++) {
        const cols = p.cells.filter((c) => c[0] === r).map((c) => c[1] + 1).sort((a, b) => a - b);
        rows.push(t('shRow', { r: r + 1, cols: t(cols.length === 1 ? 'colOne' : 'colMany', { x: rangesText(cols) }) }));
      }
      shape = t('shOther', { n: p.size, detail: rows.join('; ') });
    }
    return t('aPiece', { color: COLOR_NAMES[lang()][item.color - 1], shape });
  }
  const trayText = () => t('aTray', {
    list: [...tray, bonus].map((it, i) => (it ? `${i + 1}: ${pieceText(it)}` : null)).filter(Boolean).join('; '),
  });
  function describeBoard() {
    const parts = [t('aBoardIntro')];
    let emptyFrom = null;
    const flush = (end) => {
      if (emptyFrom === null) return;
      parts.push(emptyFrom === end ? t('aRowEmpty', { r: end }) : t('aRowsEmpty', { a: emptyFrom, b: end }));
      emptyFrom = null;
    };
    for (let r = 0; r < N; r++) {
      const cols = [];
      for (let c = 0; c < N; c++) if (grid[idx(r, c)]) cols.push(c + 1);
      if (!cols.length) { if (emptyFrom === null) emptyFrom = r + 1; continue; }
      flush(r);
      parts.push(cols.length === N ? t('aRowFull', { r: r + 1 }) : t('aRowCols', { r: r + 1, cols: rangesText(cols) }));
    }
    flush(N);
    if ([...tray, bonus].some(Boolean)) parts.push(trayText());
    parts.push(t('aScore', { s: game ? game.score : 0, e: game ? game.energy : 0 }));
    return parts.join(' ');
  }
  function announceCursor(item) {
    const ok = canPlace(item.piece, cursor.r, cursor.c);
    let msg = t('aCursor', { r: cursor.r + 1, c: cursor.c + 1, fit: t(ok ? 'aFits' : 'aNoFit') });
    if (ok) {
      const { rows, cols } = linesIfPlaced(item.piece, cursor.r, cursor.c);
      if (rows.length + cols.length) msg += ' ' + t('aWouldClear', { n: rows.length + cols.length });
    }
    announce(msg);
  }

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
    clear: (n) => { vib(n > 1 ? [18, 40, 28] : 18); [523, 659, 784, 1046].slice(0, Math.min(4, n + 1)).forEach((f, i) => tone(f, 0.14, 'triangle', i * 0.07)); },
    correct: () => { vib(12); tone(660, 0.1, 'sine'); tone(990, 0.16, 'sine', 0.09); },
    wrong: () => { vib([30, 40, 30]); tone(180, 0.22, 'sawtooth', 0, 0.04); },
    bomb: () => { vib([40, 30, 25]); tone(110, 0.35, 'square', 0, 0.05); tone(70, 0.4, 'sine', 0.05, 0.08); },
    deny: () => { vib([8, 30, 8]); tone(140, 0.1, 'square', 0, 0.03); },
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
    if (tut && tut.allow && !tut.allow(piece, r, c)) return false;
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
  let sessionMsg = null;     // {k, vars} shown on the menu after a review or practice round
  let tut = null;            // quick tour state, or null

  function newGameState() {
    return {
      score: 0, combo: 0, sinceClear: 0, lines: 0, energy: 0, streak: 0,
      answered: 0, correct: 0, trayMult: 1, friendly: true, asked: new Set(),
      typeWrong: {}, newWords: [], card: null, over: false, stage: 'question',
    };
  }

  /* ---------- Saving and resuming a game in progress ---------- */
  const packItem = (it) => (it ? { cells: it.piece.cells, color: it.color } : null);
  function unpackItem(o) {
    if (!o) return null;
    const cells = o.cells.map(([r, c]) => [r, c]);
    return {
      piece: { cells, h: Math.max(...cells.map((p) => p[0])) + 1, wd: Math.max(...cells.map((p) => p[1])) + 1, size: cells.length },
      color: o.color,
    };
  }
  const validPiece = (p) => !!p && Array.isArray(p.cells) && p.cells.length > 0 && p.cells.length <= 9
    && p.cells.every((c) => Array.isArray(c) && c.length === 2 && Number.isInteger(c[0]) && Number.isInteger(c[1]) && c[0] >= 0 && c[1] >= 0 && c[0] < N && c[1] < N)
    && Number.isInteger(p.color) && p.color >= 1 && p.color <= 6;
  function validSave() {
    const g = saved.game;
    if (!g) return null;
    const ok = Array.isArray(g.grid) && g.grid.length === N * N && g.grid.every((v) => Number.isInteger(v) && v >= 0 && v <= 6)
      && Array.isArray(g.tray) && g.tray.length === 3 && g.tray.every((p) => !p || validPiece(p))
      && (!g.bonus || validPiece(g.bonus)) && !!g.game && typeof g.game.score === 'number' && !g.game.over;
    if (!ok) { saved.game = null; persist(); return null; }
    return g;
  }
  function saveGame() {
    if (tut) return;
    if (!game || game.over) { if (saved.game) { saved.game = null; persist(); } return; }
    saved.game = {
      grid: grid.slice(), tray: tray.map(packItem), bonus: packItem(bonus),
      game: { ...game, asked: [...game.asked], card: game.card ? game.card.id : null },
    };
    persist();
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
        s.setAttribute('aria-label', t('aSlot', { i: i + 1, text: pieceText(item), fit: fitsAnywhere(item.piece) ? '' : t('aNoFitAny') }));
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
    const active = !!g && !g.over && !qState && !tut;
    $('pauseBtn').disabled = !active;
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
    if (!item || busy || !game || game.over || !canPlace(item.piece, r, c)) {
      sfx.deny();
      if (item && !busy && game && !game.over) { announce(t('aCannot')); if (tut) toast(t('tourHint')); }
      return false;
    }
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
      if (!tut) { today().lines += n; saved.totals.lines += n; }
      const doomed = new Set();
      rows.forEach((rr) => { for (let cc = 0; cc < N; cc++) doomed.add(idx(rr, cc)); });
      cols.forEach((cc) => { for (let rr = 0; rr < N; rr++) doomed.add(idx(rr, cc)); });
      const maxDelay = staggerClear(doomed, centre);
      sfx.clear(n);
      if (game.combo > 1) restartClass($('combo'), 'bump');
      floatText('+' + pts, [n > 1 ? t('linesN', { n }) : '', game.combo > 1 ? t('comboN', { n: game.combo }) : ''].filter(Boolean).join(' · '));
      collectWord();
      announce(t('aPlacedClear', { piece: pieceText(item), r: r + 1, c: c + 1, n, pts }));
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
      announce(t('aPlaced', { piece: pieceText(item), r: r + 1, c: c + 1 }));
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
    if (tut) { if (tut.step === 1 && !tray.some(Boolean)) tourGo(2); return; }
    if (!tray.some(Boolean)) { askQuestion(); return; }
    saveGame();
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
    renderTray(); renderHud(); saveGame(); checkStuck();
    announce(t('aSingle'));
    restartClass(document.querySelector('.slot[data-slot="3"]'), 'enter');
  });
  $('pSwap').addEventListener('click', () => {
    if (!tray.some(Boolean) || !spend('swap')) return;
    const open = tray.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    const fresh = genTray(true, open.length);
    open.forEach((i, k) => { tray[i] = fresh[k]; });
    lastSnap = null;
    sel = null;
    renderTray(true); renderHud(); saveGame(); checkStuck();
    announce(trayText());
  });
  $('pUndo').addEventListener('click', () => {
    if (!lastSnap || !spend('undo')) return;
    const s = lastSnap;
    const undone = game.lines - s.lines;
    if (undone > 0) {
      const d = today();
      d.lines = Math.max(0, d.lines - undone);
      saved.totals.lines = Math.max(0, saved.totals.lines - undone);
    }
    grid = s.grid; tray = s.tray; bonus = s.bonus;
    Object.assign(game, { score: s.score, combo: s.combo, sinceClear: s.sinceClear, lines: s.lines, newWords: s.newWords });
    saved.collected = s.collected;
    persist();
    lastSnap = null;
    sel = null;
    renderBoard(); renderTray(); renderHud(); saveGame(); checkStuck();
    announce(t('aUndo'));
  });
  $('pBomb').addEventListener('click', () => {
    if (!game || game.energy < COSTS.bomb) { toast(t('needEnergy')); return; }
    setBomb(!bombMode);
  });
  function setBomb(on) {
    bombMode = on;
    board.classList.toggle('bomb-mode', on);
    $('bombBanner').hidden = !on;
    if (on) { sel = null; clearPreview(); renderTray(); announce(t('bombAim')); }
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
    announce(t('aBomb', { n: count }));
    busy = true;
    setTimeout(() => {
      hit.forEach((i) => { grid[i] = 0; cells[i].classList.remove('clearing', 'pop'); cells[i].style.removeProperty('--d'); });
      busy = false;
      renderBoard(); renderTray(); renderHud(); saveGame(); checkStuck();
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
        announce(t('aSelect', { i: sel + 1, text: pieceText(item) }));
      }
      clearPreview();
      renderTray();
      return;
    }
    if (!cancelled && d.anchor) place(d.slot, d.anchor.r, d.anchor.c);
    else { clearPreview(); renderTray(); if (!cancelled && inBoard(ev)) { sfx.deny(); shakeSlot(d.slot); announce(t('aCannot')); if (tut) toast(t('tourHint')); } }
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
    if (!$('stopOverlay').hidden) { if (ev.key === 'Escape') closeStop(); return; }
    if (!$('settingsOverlay').hidden) { if (ev.key === 'Escape') closeSettings(); return; }
    if (!$('progOverlay').hidden) { if (ev.key === 'Escape') closeProgress(); return; }
    if (!$('helpOverlay').hidden) { if (ev.key === 'Escape') closeHelp(); return; }
    if (!$('wordsOverlay').hidden) { if (ev.key === 'Escape') closeWords(); return; }
    if (qState) { questionKeys(ev); return; }
    if (!$('menuOverlay').hidden || !game || game.over) return;
    if (ev.target.matches && ev.target.matches('input, select')) return;
    if ((ev.key === 'b' || ev.key === 'B') && !ev.metaKey && !ev.ctrlKey && !ev.altKey) { announce(describeBoard()); ev.preventDefault(); return; }
    if ((ev.key === 'p' || ev.key === 'P') && !ev.metaKey && !ev.ctrlKey && !ev.altKey) { askEndGame(); ev.preventDefault(); return; }
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
      announce(t('aSelect', { i: s + 1, text: pieceText(item) }));
      ev.preventDefault();
    } else if (sel !== null && ev.key.startsWith('Arrow')) {
      const item = slotPiece(sel);
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[ev.key];
      cursor.r = Math.max(0, Math.min(N - item.piece.h, cursor.r + d[0]));
      cursor.c = Math.max(0, Math.min(N - item.piece.wd, cursor.c + d[1]));
      showPreview(item, cursor.r, cursor.c, true);
      announceCursor(item);
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
    // Now and then bring back a question that is due for review at the current level.
    const dueHere = dueItems().filter((q) => q.level === saved.settings.level && !game.asked.has(q.id));
    if (dueHere.length && Math.random() < 0.35) { game.asked.add(dueHere[0].id); return dueHere[0]; }
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
    const q = pickQuestion();
    game.stage = 'question';
    saveGame();
    openQuestion(q, 'game');
  }

  function openQuestion(q, mode) {
    qState = { q, mode, done: false, opts: shuffle(q.options), line: [], bank: [] };
    $('qOverlay').hidden = false;
    renderQuestion();
    renderHud();
    const sheet = $('qOverlay').querySelector('.sheet');
    sheet.tabIndex = -1;
    sheet.focus({ preventScroll: true });
    if (q.type === 'listening') setTimeout(() => speak(q.prompt, 0.8), 300);
  }
  function renderQuestion() {
    const { q, mode } = qState;
    $('qType').textContent = typeName(q.type);
    $('qLevel').textContent = mode === 'game' ? `${q.level} · ${cap(q.topic)}`
      : mode === 'tutorial' ? t('tourLabel')
        : t(mode === 'practice' ? 'practiceOf' : 'reviewOf', { i: review.i + 1, n: review.queue.length });
    $('qTour').hidden = mode !== 'tutorial';
    if (mode === 'tutorial') { $('qTourText').textContent = t('tour2Note'); $('qTourSkip').textContent = t('tourSkip'); }
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
    if (mode === 'tutorial') {
      if (correct) game.energy = 1;
      (correct ? sfx.correct : sfx.wrong)();
      renderQuestion();
      renderHud();
      $('qContinue').focus({ preventScroll: true });
      return;
    }
    const ts = saved.typeStats[q.type] || { right: 0, wrong: 0 };
    ts[correct ? 'right' : 'wrong'] += 1;
    saved.typeStats[q.type] = ts;
    const ls = saved.levelStats[q.level] || { right: 0, wrong: 0 };
    ls[correct ? 'right' : 'wrong'] += 1;
    saved.levelStats[q.level] = ls;
    const day = today();
    day.answered += 1;
    if (correct) day.correct += 1;
    if (!day.met && day.answered >= saved.settings.goal) { day.met = true; toast(t('goalReached')); }
    qState.srs = srsUpdate(q, correct);
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
      game.stage = 'tray';
      saveGame();
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
      if (mode === 'tutorial') lines.push(`<p class="fb-text">${esc(t('tour2Right'))}</p>`);
    } else {
      lines.push(`<p class="fb-title">${esc(t('wrong'))}</p>`);
      lines.push(`<p class="fb-text"><b>${esc(t('answerIs'))}</b> ${esc(q.answer)}</p>`);
      if (mode === 'game') lines.push(`<p class="fb-text">${esc(t('randomPieces'))}</p>`);
      if (mode === 'tutorial') lines.push(`<p class="fb-text">${esc(t('tour2Wrong'))}</p>`);
    }
    lines.push(`<p class="fb-text">${esc(q.explanation)}</p>`);
    if (!correct || lang() === 'th') lines.push(`<p class="fb-text th" lang="th">${esc(q.thai)}</p>`);
    const info = qState.srs;
    if (info && info.kind === 'advance') lines.push(`<p class="fb-text srs">${esc(t('srsNext', { when: fmtWhen(info.ms) }))}</p>`);
    else if (info && info.kind === 'mastered') lines.push(`<p class="fb-text srs">${esc(t('srsMastered'))}</p>`);
    else if (info && info.kind === 'reset') lines.push(`<p class="fb-text srs">${esc(t('srsReset'))}</p>`);
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
    if (mode === 'tutorial') { tourGo(3); return; }
    if (mode === 'game') {
      tray = genTray(game.friendly);
      game.stage = 'play';
      lastSnap = null;
      renderTray(true);
      renderHud();
      saveGame();
      announce(trayText());
      checkStuck();
    } else {
      review.i += 1;
      if (review.i < review.queue.length) openQuestion(review.queue[review.i], review.mode);
      else finishReview();
    }
  });

  /* ---------- Game lifecycle ---------- */
  function newGame() {
    game = newGameState();
    sessionMsg = null;
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
    saved.game = null;
    persist();
    renderHud();
    vib(60);
    announce(t('aGameOver', { s: game.score }));
    if (!reduceMotion()) cells.forEach((el, i) => { if (grid[i]) { el.style.setProperty('--d', Math.floor(i / N) * 45 + 'ms'); el.classList.add('dim'); } });
    setTimeout(() => showMenu('over', isBest), reduceMotion() ? 0 : 900);
  }
  const menuKind = () => (game ? (game.over ? 'over' : 'paused') : 'start');
  function showMenu(kind, isBest) {
    const resumable = kind === 'start' && !!validSave();
    $('menuStart').hidden = kind !== 'start';
    $('menuOver').hidden = kind !== 'over';
    $('menuPause').hidden = kind !== 'paused';
    $('resumeBtn').hidden = !(resumable || kind === 'paused');
    $('resumeBtn').textContent = kind === 'paused' ? t('resume') : t('continueGame');
    $('playBtn').hidden = kind === 'paused';
    $('playBtn').textContent = kind === 'over' ? t('again') : resumable ? t('newGame') : t('playLbl');
    $('playBtn').classList.toggle('btn-ghost', resumable);
    $('pauseEndBtn').hidden = kind !== 'paused';
    $('menuTourBtn').hidden = kind === 'paused';
    $('discardConfirm').hidden = true;
    const note = $('savedNote');
    note.hidden = !resumable;
    if (resumable) note.textContent = t('savedNote', { s: saved.game.game.score });
    $('sessionNote').hidden = !sessionMsg;
    if (sessionMsg) $('sessionNote').textContent = t(sessionMsg.k, sessionMsg.vars);
    if (kind === 'paused') $('pauseScore').textContent = game.score;
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
    renderHomePickers();
    $('homeApplyNote').hidden = kind !== 'paused';
    renderMenuStats();
    $('menuOverlay').hidden = false;
    $('menuOverlay').scrollTop = 0;
    ($('resumeBtn').hidden ? $('playBtn') : $('resumeBtn')).focus({ preventScroll: true });
  }
  const collectedQuestions = () => Object.keys(saved.collected).filter((id) => byId.has(id)).map((id) => byId.get(id));
  function renderMenuStats() {
    const goal = saved.settings.goal;
    const d = dayRec();
    $('dailyText').textContent = t('dailyLine', { n: d.answered, g: goal });
    const st = streakDays();
    $('dailyStreak').textContent = st ? t('streakN', { n: st }) : t('noStreak');
    $('dailyBar').style.width = Math.min(100, (d.answered / goal) * 100) + '%';
    $('daily').classList.toggle('met', !!d.met);
    const due = dueItems();
    $('reviewCount').textContent = due.length;
    $('reviewBtn').disabled = due.length === 0;
    const nd = nextDue();
    $('reviewNote').textContent = due.length ? t('dueN', { n: due.length }) : nd ? t('nextAt', { when: fmtWhen(nd - Date.now()) }) : t('srsEmpty');
    const words = collectedQuestions().length;
    $('practiceCount').textContent = words;
    $('practiceBtn').disabled = words === 0;
    $('wordCount').textContent = words;
    const needBackup = (totalAnswered() >= 30 || words >= 10) && Date.now() - (saved.lastBackup || 0) > 14 * DAY;
    $('backupNote').hidden = !needBackup;
  }

  // The stop button stays on the game page and asks whether to end the game. Going Home is the logo's job.
  function askEndGame() {
    if (!game || game.over || qState || busy || tut || !$('menuOverlay').hidden) return;
    sel = null; cursor = null; clearPreview(); setBomb(false);
    saveGame();
    $('stopOverlay').hidden = false;
    $('stopKeep').focus({ preventScroll: true });
  }
  function closeStop() { $('stopOverlay').hidden = true; }
  function pauseGame() {
    if (!game || game.over || qState || busy || tut || !$('menuOverlay').hidden) return;
    sel = null; cursor = null; clearPreview(); setBomb(false);
    saveGame();
    showMenu('paused');
  }
  function resumeGame() {
    const s = validSave();
    if (!s) { newGame(); return; }
    game = { ...newGameState(), ...s.game, asked: new Set(s.game.asked || []), card: byId.get(s.game.card) || null, over: false };
    grid = s.grid.slice();
    tray = s.tray.map(unpackItem);
    bonus = unpackItem(s.bonus);
    sel = null; cursor = null; lastSnap = null; sessionMsg = null;
    shownScore = game.score; prevEnergy = game.energy;
    cells.forEach((el) => { el.classList.remove('dim', 'pop', 'clearing'); el.style.removeProperty('--d'); });
    setBomb(false);
    $('stuckBanner').hidden = true;
    $('menuOverlay').hidden = true;
    renderBoard(); renderTray(); renderHud();
    if (game.stage === 'tray') {
      tray = genTray(game.friendly);
      game.stage = 'play';
      renderTray(true); renderHud(); saveGame(); checkStuck();
    } else if (game.stage === 'question' || !tray.some(Boolean)) {
      askQuestion();
    } else {
      checkStuck();
    }
  }

  function startReview() {
    const queue = shuffle(dueItems().slice(0, 10));
    if (!queue.length) return;
    review = { mode: 'review', queue, i: 0, right: 0 };
    sessionMsg = null;
    $('menuOverlay').hidden = true;
    openQuestion(queue[0], 'review');
  }
  function startPractice(list) {
    if (!list.length) return;
    const mastered = (q) => (saved.srs[q.id] && saved.srs[q.id].stage >= 5 ? 1 : 0);
    const queue = shuffle(shuffle(list).sort((a, b) => mastered(a) - mastered(b)).slice(0, 10));
    review = { mode: 'practice', queue, i: 0, right: 0 };
    sessionMsg = null;
    $('menuOverlay').hidden = true;
    $('wordsOverlay').hidden = true;
    openQuestion(queue[0], 'practice');
  }
  function finishReview() {
    const done = review;
    review = null;
    sessionMsg = { k: done.mode === 'practice' ? 'practiceDone' : 'reviewDone', vars: { r: done.right, n: done.queue.length } };
    showMenu(menuKind());
  }

  /* ---------- Word collection ---------- */
  function wordsFiltered() {
    const q = $('wordSearch').value.trim().toLowerCase();
    const lv = $('wordLevel').value;
    const tp = $('wordTopic').value;
    return collectedQuestions().sort((a, b) => saved.collected[b.id] - saved.collected[a.id])
      .filter((x) => (lv === 'all' || x.level === lv) && (tp === 'all' || x.topic === tp)
        && (!q || x.card.word.toLowerCase().includes(q) || x.card.thai.includes(q)));
  }
  function openWords() {
    $('wordsOverlay').hidden = false;
    renderWords();
    $('wordSearch').focus({ preventScroll: true });
  }
  function closeWords() { $('wordsOverlay').hidden = true; }
  function renderWords() {
    const total = collectedQuestions().length;
    $('wordsSummary').textContent = t('wordsSummary', { n: total, t: DATA.questions.length });
    const list = wordsFiltered();
    const canPractice = !game || game.over || !$('menuOverlay').hidden;
    $('wordsPractice').hidden = !canPractice || !list.length;
    const box = $('cards');
    if (!total) { box.innerHTML = `<p class="empty-note">${esc(t('noWords'))}</p>`; return; }
    if (!list.length) { box.innerHTML = `<p class="empty-note">${esc(t('noMatch'))}</p>`; return; }
    box.innerHTML = list.map((x) => {
      const st = wordStatus(x.id);
      const badge = st ? `<span class="status ${st.cls}">${esc(t(st.k))}${st.ms ? ' · ' + esc(fmtWhen(st.ms)) : ''}</span>` : '';
      return `
      <article class="card">
        <div class="card-top"><span class="card-word">${esc(x.card.word)}</span><span class="card-meta">${x.level}</span></div>
        <span class="card-pos">${esc(x.card.pos)} · ${esc(cap(x.topic))}</span>
        <span class="card-th" lang="th">${esc(x.card.thai)}</span>
        <span class="card-ex">${esc(x.card.example)} ${tts ? `<button class="speak" type="button" data-say="${esc(x.card.example)}" aria-label="Listen">▶</button>` : ''}</span>
        ${badge}
      </article>`;
    }).join('');
  }
  $('cards').addEventListener('click', (ev) => { const b = ev.target.closest('[data-say]'); if (b) speak(b.dataset.say); });
  ['wordSearch', 'wordLevel', 'wordTopic'].forEach((id) => $(id).addEventListener('input', renderWords));
  $('wordsPractice').addEventListener('click', () => startPractice(wordsFiltered()));
  $('wordsBtn').addEventListener('click', openWords);
  $('menuWordsBtn').addEventListener('click', openWords);
  $('wordsClose').addEventListener('click', closeWords);
  $('wordsOverlay').addEventListener('click', (ev) => { if (ev.target === $('wordsOverlay')) closeWords(); });

  /* ---------- Progress ---------- */
  const TYPES = ['gap', 'collocation', 'synonym', 'order', 'listening'];
  const pctOf = (r, w) => (r + w ? Math.round((r / (r + w)) * 100) : null);
  function accRows(keys, stats, label) {
    const rows = keys.map((k) => { const x = stats[k] || { right: 0, wrong: 0 }; return { k, n: x.right + x.wrong, p: pctOf(x.right, x.wrong) }; });
    const eligible = rows.filter((r) => r.n >= 5);
    const lowest = eligible.length ? eligible.reduce((a, b) => (b.p < a.p ? b : a)) : null;
    const weak = lowest && lowest.p < 80 ? lowest : null;
    const html = rows.map((r) => `
      <div class="acc-row${weak && r.k === weak.k ? ' low' : ''}">
        <span class="acc-name">${esc(label(r.k))}</span>
        <span class="acc-track"><i class="acc-fill" style="width:${r.p === null ? 0 : r.p}%"></i></span>
        <span class="acc-val">${r.p === null ? '–' : r.p + '% · ' + r.n}</span>
      </div>`).join('');
    return { html, weak };
  }
  function renderProgress() {
    const goal = saved.settings.goal;
    const d = dayRec();
    const st = streakDays();
    const loc = lang() === 'th' ? 'th-TH' : 'en-GB';
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const rec = dayRec(dayKey(dt));
      week.push({ label: dt.toLocaleDateString(loc, { weekday: 'short' }), n: rec.answered, met: !!rec.met });
    }
    const maxN = Math.max(goal, ...week.map((x) => x.n), 1);
    const weekHtml = week.map((x) => `
      <div class="day${x.met ? ' met' : ''}" role="img" aria-label="${esc(t('pDayLabel', { d: x.label, n: x.n }))}">
        <div class="bar-wrap"><i class="bar${x.n ? '' : ' zero'}" style="height:${Math.round((x.n / maxN) * 100)}%"></i></div>
        <b>${x.n}</b><span>${esc(x.label)}</span>
      </div>`).join('');
    const types = accRows(TYPES, saved.typeStats, typeName);
    const levels = accRows(LEVELS, saved.levelStats, (k) => k);
    const answered = TYPES.reduce((n, k) => n + ((saved.typeStats[k] || {}).right || 0) + ((saved.typeStats[k] || {}).wrong || 0), 0);
    const right = TYPES.reduce((n, k) => n + ((saved.typeStats[k] || {}).right || 0), 0);
    const entries = srsEntries();
    const collected = collectedQuestions().length;
    const mastered = entries.filter(([, e]) => e.stage >= 5).length;
    const learning = entries.length - mastered;
    const dueNow = dueItems().length;
    const totalWords = DATA.questions.length;
    const other = Math.max(0, collected - mastered - learning);
    const w = (n) => (n / totalWords) * 100;
    $('progBody').innerHTML = `
      <section class="prog-sec">
        <h3>${esc(t('pToday'))}</h3>
        <div class="today-row">
          <span class="big">${d.answered} / ${goal} <small>${esc(t('pQuestionsUnit'))}</small></span>
          <span class="pill${st ? ' on' : ''}">${esc(st ? t('streakN', { n: st }) : t('noStreak'))}</span>
          <label class="goal-ctl">${esc(t('pGoal'))}
            <select id="goalSel">${[5, 10, 20, 30].map((g) => `<option value="${g}"${g === goal ? ' selected' : ''}>${g}</option>`).join('')}</select>
          </label>
        </div>
        <div class="daily-bar${d.met ? ' met' : ''}" aria-hidden="true"><i style="width:${Math.min(100, (d.answered / goal) * 100)}%"></i></div>
      </section>
      <section class="prog-sec">
        <h3>${esc(t('pLast7'))}</h3>
        <div class="week" style="--goal:${Math.round((goal / maxN) * 100)}%">${weekHtml}</div>
      </section>
      <section class="prog-sec">
        <h3>${esc(t('pByType'))}</h3>
        ${types.html}
        <p class="focus${types.weak ? '' : ' muted'}">${esc(types.weak ? t('pFocus', { type: typeName(types.weak.k), p: types.weak.p }) : t('pNeedMore'))}</p>
      </section>
      <section class="prog-sec">
        <h3>${esc(t('pByLevel'))}</h3>
        ${levels.html}
        <p class="week-note">${esc(t('pLevelNote'))}</p>
      </section>
      <section class="prog-sec">
        <h3>${esc(t('pWords'))}</h3>
        <dl class="word-stats">
          <div><dt>${esc(t('pCollected'))}</dt><dd>${collected} / ${totalWords}</dd></div>
          <div class="ws-l"><dt>${esc(t('pLearning'))}</dt><dd>${learning}</dd></div>
          <div class="ws-m"><dt>${esc(t('pMastered'))}</dt><dd>${mastered}</dd></div>
          <div class="ws-d"><dt>${esc(t('pDue'))}</dt><dd>${dueNow}</dd></div>
        </dl>
        <div class="stack" aria-hidden="true"><i class="m" style="width:${w(mastered)}%"></i><i class="l" style="width:${w(learning)}%"></i><i class="n" style="width:${w(other)}%"></i></div>
      </section>
      <section class="prog-sec">
        <h3>${esc(t('pAll'))}</h3>
        <dl class="totals">
          <div><dt>${esc(t('pGames'))}</dt><dd>${saved.games}</dd></div>
          <div><dt>${esc(t('pBest'))}</dt><dd>${saved.best}</dd></div>
          <div><dt>${esc(t('pQuestions'))}</dt><dd>${answered}</dd></div>
          <div><dt>${esc(t('pAcc'))}</dt><dd>${answered ? Math.round((right / answered) * 100) + '%' : '–'}</dd></div>
          <div><dt>${esc(t('pLines'))}</dt><dd>${saved.totals.lines}</dd></div>
        </dl>
      </section>`;
  }
  function openProgress() {
    renderProgress();
    renderBackupInfo();
    $('progOverlay').hidden = false;
    $('progBody').parentElement.scrollTop = 0;
    $('progClose').focus({ preventScroll: true });
  }
  function closeProgress() {
    $('progOverlay').hidden = true;
    hideImportCard();
    $('backupText').hidden = true;
    renderMenuStats();
  }
  $('progBody').addEventListener('change', (ev) => {
    if (ev.target.id !== 'goalSel') return;
    saved.settings.goal = +ev.target.value;
    const d = dayRec();
    if (d.answered >= saved.settings.goal && !d.met) today().met = true;
    persist();
    renderProgress();
    $('goalSel').focus({ preventScroll: true });
  });
  $('progressBtn').addEventListener('click', openProgress);
  $('menuProgressBtn').addEventListener('click', openProgress);
  $('progClose').addEventListener('click', closeProgress);
  $('progOverlay').addEventListener('click', (ev) => { if (ev.target === $('progOverlay')) closeProgress(); });

  /* ---------- Backup and restore ---------- */
  const BACKUP_VERSION = 1;
  const TOPICS = ['education', 'environment', 'technology', 'health', 'work', 'travel'];
  const ID_RE = /^(A1|A2|B1|B2|C1|C2)-[GCSOL]\d{2}$/;
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const nn = (v) => (Number.isFinite(v) && v > 0 ? Math.min(Math.floor(v), 1e9) : 0);
  const statTotal = (x) => nn((x || {}).right) + nn((x || {}).wrong);
  const totalAnswered = () => TYPES.reduce((n, k) => n + statTotal(saved.typeStats[k]), 0);

  function backupText() {
    const { settings, best, games, collected, typeStats, levelStats, srs, days, totals } = saved;
    return JSON.stringify({
      app: 'word-blast', version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
      data: { settings, best, games, collected, typeStats, levelStats, srs, days, totals },
    });
  }
  // Reads backup text and keeps only values the game understands. Nothing is taken on trust.
  function cleanBackup(text) {
    let raw;
    try { raw = JSON.parse(text); } catch (e) { return { error: 'impBad' }; }
    if (!isObj(raw) || raw.app !== 'word-blast' || !isObj(raw.data)) return { error: 'impBad' };
    if (Number(raw.version) > BACKUP_VERSION) return { error: 'impNewer' };
    const d = raw.data;
    const s0 = isObj(d.settings) ? d.settings : {};
    const out = {
      settings: {
        level: LEVELS.includes(s0.level) ? s0.level : 'B1', topic: TOPICS.includes(s0.topic) ? s0.topic : 'all',
        thai: !!s0.thai, muted: !!s0.muted, goal: [5, 10, 20, 30].includes(s0.goal) ? s0.goal : 10,
        patterns: !!s0.patterns, vibrate: s0.vibrate !== false,
      },
      best: nn(d.best), games: nn(d.games), totals: { lines: nn((d.totals || {}).lines) },
      collected: {}, srs: {}, typeStats: {}, levelStats: {}, days: {},
    };
    if (isObj(d.collected)) Object.entries(d.collected).forEach(([id, ts]) => { if (ID_RE.test(id) && Number.isFinite(ts)) out.collected[id] = ts; });
    if (isObj(d.srs)) {
      Object.entries(d.srs).forEach(([id, e]) => {
        if (!ID_RE.test(id) || !isObj(e)) return;
        const stage = Math.min(5, nn(e.stage));
        out.srs[id] = { stage, due: stage >= 5 ? null : (Number.isFinite(e.due) ? e.due : Date.now()), lapses: nn(e.lapses) };
      });
    }
    [['typeStats', TYPES], ['levelStats', LEVELS]].forEach(([k, keys]) => {
      if (!isObj(d[k])) return;
      keys.forEach((key) => { const x = d[k][key]; if (isObj(x)) out[k][key] = { right: nn(x.right), wrong: nn(x.wrong) }; });
    });
    if (isObj(d.days)) {
      Object.keys(d.days).filter((k) => DAY_RE.test(k)).sort().slice(-90).forEach((k) => {
        const x = d.days[k];
        if (isObj(x)) out.days[k] = { answered: nn(x.answered), correct: nn(x.correct), lines: nn(x.lines), ...(x.met ? { met: true } : {}) };
      });
    }
    return { data: out, exportedAt: Date.parse(raw.exportedAt) || 0 };
  }
  function summarize(d) {
    return { q: TYPES.reduce((n, k) => n + statTotal(d.typeStats[k]), 0), w: Object.keys(d.collected).length, b: d.best, d: Object.keys(d.days).length };
  }
  // Merge keeps this device's data and adds the backup. Counts use the larger value, so restoring the same file twice changes nothing.
  function mergeData(inc) {
    const out = {
      settings: saved.settings, best: Math.max(saved.best, inc.best), games: Math.max(saved.games, inc.games),
      totals: { lines: Math.max(saved.totals.lines, inc.totals.lines) },
      collected: { ...saved.collected }, srs: { ...saved.srs }, typeStats: { ...saved.typeStats }, levelStats: { ...saved.levelStats }, days: { ...saved.days },
    };
    Object.entries(inc.collected).forEach(([id, ts]) => { out.collected[id] = out.collected[id] ? Math.min(out.collected[id], ts) : ts; });
    Object.entries(inc.srs).forEach(([id, e]) => { const l = out.srs[id]; if (!l || e.stage > l.stage) out.srs[id] = e; });
    ['typeStats', 'levelStats'].forEach((k) => {
      Object.entries(inc[k]).forEach(([key, x]) => { const l = out[k][key]; if (!l || statTotal(x) > statTotal(l)) out[k][key] = x; });
    });
    Object.entries(inc.days).forEach(([k, x]) => {
      const l = out.days[k];
      out.days[k] = !l ? x : { answered: Math.max(l.answered, x.answered), correct: Math.max(l.correct, x.correct), lines: Math.max(l.lines, x.lines), ...((l.met || x.met) ? { met: true } : {}) };
    });
    Object.keys(out.days).sort().slice(0, -90).forEach((k) => { delete out.days[k]; });
    return out;
  }
  function applyRestore(data, mode) {
    const next = mode === 'merge' ? mergeData(data) : data;
    // A game in progress and the last-backup time stay as they are on this device.
    saved = { ...defaults(), ...next, game: saved.game, lastBackup: saved.lastBackup, wrong: [] };
    lastSnap = null;
    persist();
    applyI18n(); fillControls(); renderHud(); renderMenuStats(); renderProgress(); renderBackupInfo();
    toast(t(mode === 'merge' ? 'impMergeDone' : 'impReplaceDone'));
  }

  function fmtAgo(ms) {
    if (ms < 60000) return t('agoNow');
    if (ms < 3600000) return t('agoMin', { n: Math.round(ms / 60000) });
    if (ms < 22 * 3600000) return t('agoHours', { n: Math.round(ms / 3600000) });
    const d = Math.round(ms / DAY);
    return d <= 1 ? t('agoYesterday') : t('agoDays', { n: d });
  }
  function renderBackupInfo() {
    const last = saved.lastBackup;
    $('backupInfo').textContent = `${t('backupInfo')} ${last ? t('backupLast', { when: fmtAgo(Date.now() - last) }) : t('backupNever')}`;
  }
  function markBackedUp() {
    saved.lastBackup = Date.now();
    persist();
    renderBackupInfo();
    renderMenuStats();
  }
  function downloadBackup() {
    const url = URL.createObjectURL(new Blob([backupText()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `word-blast-backup-${dayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    markBackedUp();
    toast(t('backupDownloaded'));
  }
  async function copyBackup() {
    const text = backupText();
    const box = $('backupText');
    box.value = text;
    try {
      await navigator.clipboard.writeText(text);
      box.hidden = true;
      markBackedUp();
      toast(t('backupCopied'));
    } catch (e) {
      box.hidden = false;
      box.focus();
      box.select();
      toast(t('copyFailed'));
    }
  }

  let pendingImport = null;
  function hideImportCard() { pendingImport = null; $('importCard').hidden = true; $('importCard').innerHTML = ''; }
  function showImportCard(text) {
    const card = $('importCard');
    const res = text.trim() ? cleanBackup(text) : { error: 'impEmpty' };
    pendingImport = null;
    card.hidden = false;
    if (res.error) { card.className = 'import-card bad'; card.innerHTML = `<p>${esc(t(res.error))}</p>`; return; }
    pendingImport = res.data;
    const sm = summarize(res.data);
    const date = res.exportedAt ? new Date(res.exportedAt).toLocaleDateString(lang() === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
    card.className = 'import-card';
    card.innerHTML = `
      <p>${esc(t('impSummary', { date, q: sm.q, w: sm.w, b: sm.b, d: sm.d }))}</p>
      <p class="hint choose">${esc(t('impMergeHelp'))}</p>
      <div class="row choose">
        <button class="btn btn-small" type="button" data-imp="merge">${esc(t('impMerge'))}</button>
        <button class="btn btn-small btn-ghost" type="button" data-imp="replace">${esc(t('impReplace'))}</button>
        <button class="btn btn-small btn-ghost" type="button" data-imp="cancel">${esc(t('impCancel'))}</button>
      </div>
      <p class="sure" hidden>${esc(t('impReplaceAsk'))}</p>
      <div class="row sure" hidden>
        <button class="btn btn-small" type="button" data-imp="replace-yes">${esc(t('impReplaceYes'))}</button>
        <button class="btn btn-small btn-ghost" type="button" data-imp="back">${esc(t('impBack'))}</button>
      </div>`;
  }
  $('importCard').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-imp]');
    if (!b || !pendingImport) return;
    const card = $('importCard');
    const toggle = (sure) => {
      card.querySelectorAll('.choose').forEach((el) => { el.hidden = sure; });
      card.querySelectorAll('.sure').forEach((el) => { el.hidden = !sure; });
    };
    const k = b.dataset.imp;
    if (k === 'replace') { toggle(true); card.querySelector('[data-imp="replace-yes"]').focus({ preventScroll: true }); }
    else if (k === 'back') toggle(false);
    else if (k === 'cancel') hideImportCard();
    else if (k === 'merge' || k === 'replace-yes') {
      const data = pendingImport;
      hideImportCard();
      applyRestore(data, k === 'merge' ? 'merge' : 'replace');
    }
  });
  $('exportBtn').addEventListener('click', downloadBackup);
  $('copyBtn').addEventListener('click', copyBackup);
  $('backupText').addEventListener('copy', markBackedUp);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    if (f.size > 2000000) { const card = $('importCard'); pendingImport = null; card.hidden = false; card.className = 'import-card bad'; card.innerHTML = `<p>${esc(t('impTooBig'))}</p>`; return; }
    const reader = new FileReader();
    reader.onload = () => showImportCard(String(reader.result));
    reader.onerror = () => showImportCard('');
    reader.readAsText(f);
  });
  $('importPasteBtn').addEventListener('click', () => showImportCard($('importText').value));
  $('backupNoteBtn').addEventListener('click', () => {
    openProgress();
    $('backupSec').scrollIntoView({ block: 'start' });
  });

  /* ---------- How to play ---------- */
  const HELP = {
    en: {
      nav: ['Goal', 'Each turn', 'Answers', 'Scoring', 'Power-ups', 'Questions', 'Review', 'Words', 'Controls'],
      goal: 'Place blocks on the 8×8 board and clear as many lines as you can. The game ends when none of your pieces can fit.',
      turn: ['Answer one short English question.', 'You get three pieces. Place all three, in any order.', 'Fill a whole row or column to clear it.', 'When your tray is empty, the next question appears.'],
      turnNote: 'Pieces cannot be rotated. A faded piece in the tray has no space on the board right now. Your game saves automatically. Tap the logo to pause and go Home. The stop button (or P) asks whether to end the game.',
      correctH: 'Correct answer', correct: ['+1 energy (up to 5)', 'Friendlier pieces: at least one will fit, with better chances to clear lines', '3 or more correct in a row: line points ×1.5 for that set of pieces'],
      wrongH: 'Wrong answer', wrong: ['Random pieces, which may not fit', 'You see the answer, a short explanation and the Thai translation', 'The question is added to your review schedule'],
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
      review: ['A question you miss comes back on a schedule: right away, then after 1, 3, 7 and 14 days.', 'Answer it correctly at every review and it is marked Mastered. A wrong answer sends it back to the start.', 'Questions that are due also appear now and then during a game. Press Review due on the menu to clear them all at once.', 'Practise words quizzes you on the words you have collected. Use it from the menu, or from the Word collection to practise only the words you have filtered.', 'Progress shows your daily goal, streak, accuracy by question type and level, and how many words you have mastered. At the bottom you can download a backup, copy it as text, and restore it on another device or after clearing your browser.'],
      words: 'Each time you clear a line, the word from your latest question is saved to your Word collection with its Thai meaning and an example sentence you can listen to.',
      controls: ['<b>Drag</b> a piece from the tray onto the board. On touch screens it floats above your finger so you can see where it lands.', '<b>Tap</b> a piece, then tap where its centre should go.', '<kbd>1</kbd>–<kbd>3</kbd> select a piece (<kbd>4</kbd> for the single block), arrow keys move it, <kbd>Enter</kbd> places it and <kbd>Esc</kbd> cancels.', '<kbd>P</kbd> asks whether to end the game, and <kbd>B</kbd> reads out the board and your pieces for screen readers.', 'Settings (the sliders icon) turn on block patterns for colour-blind players, vibration on phones, and sound. You can replay the quick tour from the menu.', 'In questions, <kbd>1</kbd>–<kbd>3</kbd> choose an answer and <kbd>Enter</kbd> continues.'],
      energyH: 'Energy', stuckH: 'When you are stuck',
    },
    th: {
      nav: ['เป้าหมาย', 'การเล่นแต่ละรอบ', 'ผลของการตอบ', 'การคิดคะแนน', 'ไอเท็มช่วย', 'ประเภทคำถาม', 'การทบทวน', 'คลังคำศัพท์', 'การควบคุม'],
      goal: 'วางบล็อกบนกระดาน 8×8 และเคลียร์แถวให้ได้มากที่สุด เกมจะจบเมื่อไม่มีบล็อกชิ้นไหนวางลงได้',
      turn: ['ตอบคำถามภาษาอังกฤษสั้นๆ หนึ่งข้อ', 'รับบล็อกสามชิ้น แล้ววางให้ครบทั้งสามชิ้นในลำดับใดก็ได้', 'เติมแถวแนวนอนหรือแนวตั้งให้เต็มเพื่อเคลียร์', 'เมื่อวางครบทั้งถาด คำถามข้อถัดไปจะปรากฏ'],
      turnNote: 'หมุนบล็อกไม่ได้ ถ้าบล็อกในถาดดูจางลง แปลว่าตอนนี้ไม่มีที่ว่างบนกระดานให้วางชิ้นนั้น เกมบันทึกอัตโนมัติ แตะโลโก้เพื่อพักเกมและไปหน้าหลัก ส่วนปุ่มหยุด (หรือกด P) จะถามว่าต้องการจบเกมไหม',
      correctH: 'ตอบถูก', correct: ['+1 พลังงาน (สะสมได้สูงสุด 5)', 'ได้บล็อกที่วางง่ายขึ้น อย่างน้อยหนึ่งชิ้นวางได้แน่นอน และมีโอกาสเคลียร์แถวมากขึ้น', 'ตอบถูกติดกันตั้งแต่ 3 ข้อ: คะแนนจากการเคลียร์แถว ×1.5 สำหรับบล็อกชุดนั้น'],
      wrongH: 'ตอบผิด', wrong: ['ได้บล็อกแบบสุ่ม ซึ่งอาจวางไม่ได้', 'จะเห็นคำตอบที่ถูก คำอธิบายสั้นๆ และคำแปลไทย', 'คำถามข้อนั้นจะถูกเพิ่มเข้าตารางทบทวน'],
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
      review: ['ข้อที่ตอบผิดจะกลับมาให้ทบทวนตามกำหนด: ทันที แล้วอีก 1, 3, 7 และ 14 วัน', 'ถ้าตอบถูกในการทบทวนทุกครั้ง คำถามข้อนั้นจะถูกทำเครื่องหมายว่าจำได้แล้ว ถ้าตอบผิดจะเริ่มนับใหม่ตั้งแต่ต้น', 'ข้อที่ถึงกำหนดทบทวนจะโผล่มาระหว่างเล่นเกมเป็นครั้งคราว หรือกด "ทบทวนตามกำหนด" ในเมนูเพื่อทำให้หมดในครั้งเดียว', '"ฝึกจากคำศัพท์" จะถามจากคำที่คุณเก็บไว้ในคลัง กดได้จากเมนู หรือจากคลังคำศัพท์เพื่อฝึกเฉพาะคำที่กรองไว้', '"ความก้าวหน้า" แสดงเป้าหมายรายวัน จำนวนวันที่เล่นต่อเนื่อง ความแม่นยำตามประเภทคำถามและระดับ และจำนวนคำที่จำได้แล้ว ด้านล่างสุดมีปุ่มดาวน์โหลดข้อมูลสำรอง คัดลอกเป็นข้อความ และกู้คืนในเครื่องอื่นหรือหลังล้างข้อมูลเบราว์เซอร์'],
      words: 'ทุกครั้งที่เคลียร์แถว คำศัพท์จากคำถามล่าสุดจะถูกเก็บเข้าคลังคำศัพท์ พร้อมความหมายภาษาไทยและประโยคตัวอย่างที่กดฟังได้',
      controls: ['<b>ลาก</b>บล็อกจากถาดไปวางบนกระดาน บนจอสัมผัสบล็อกจะลอยอยู่เหนือนิ้วเพื่อให้เห็นตำแหน่งที่จะวาง', '<b>แตะ</b>บล็อกหนึ่งครั้ง แล้วแตะตำแหน่งที่ต้องการให้เป็นกึ่งกลางของบล็อก', '<kbd>1</kbd>–<kbd>3</kbd> เลือกบล็อก (<kbd>4</kbd> สำหรับบล็อกเดี่ยว) ปุ่มลูกศรเลื่อน <kbd>Enter</kbd> วาง และ <kbd>Esc</kbd> ยกเลิก', '<kbd>P</kbd> ถามว่าจะจบเกมไหม และ <kbd>B</kbd> อ่านสถานะกระดานและบล็อกออกเสียงสำหรับโปรแกรมอ่านหน้าจอ', 'ตั้งค่า (ไอคอนแถบเลื่อน) ใช้เปิดลวดลายบนบล็อกสำหรับผู้ที่ตาบอดสี การสั่นบนมือถือ และเสียง และเปิดการแนะนำการเล่นแบบย่อซ้ำได้จากเมนู', 'ในหน้าคำถาม กด <kbd>1</kbd>–<kbd>3</kbd> เพื่อเลือกคำตอบ และ <kbd>Enter</kbd> เพื่อไปต่อ'],
      energyH: 'พลังงาน', stuckH: 'เมื่อไม่มีที่วาง',
    },
  };
  const COST_OF = { bomb: COSTS.bomb, single: COSTS.single, swap: COSTS.swap, undo: COSTS.undo };
  const ICON_OF = { bomb: 'pBomb', single: 'pSingle', swap: 'pSwap', undo: 'pUndo' };
  function renderHelp() {
    const H = HELP[lang()];
    const ids = ['h-goal', 'h-turn', 'h-answers', 'h-score', 'h-powers', 'h-types', 'h-review', 'h-words', 'h-controls'];
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
      <section id="h-review"><h3>${esc(H.nav[6])}</h3><ul>${li(H.review.map(esc))}</ul></section>
      <section id="h-words"><h3>${esc(H.nav[7])}</h3><p>${esc(H.words)}</p></section>
      <section id="h-controls"><h3>${esc(H.nav[8])}</h3><ul>${li(H.controls)}</ul></section>`;
  }
  function openHelp(section) {
    renderHelp();
    $('helpOverlay').hidden = false;
    const panel = $('helpOverlay').querySelector('.help-panel');
    panel.scrollTop = 0;
    if (section) $(section).scrollIntoView({ block: 'start' });
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

  /* ---------- Quick tour ---------- */
  const TOUR_STEPS = 4;
  const TOUR_SPOT = [[7, 6], [7, 7]];
  const markSpot = (on) => TOUR_SPOT.forEach(([r, c]) => cells[idx(r, c)].classList.toggle('spot', on));
  const resetCells = () => cells.forEach((el) => { el.classList.remove('dim', 'pop', 'clearing', 'spot'); el.style.removeProperty('--d'); });
  function startTour() {
    if (game && !game.over) return;
    tut = { step: 1, allow: (piece, r, c) => r === 7 && c === 6 };
    game = newGameState();
    sessionMsg = null;
    grid = new Array(N * N).fill(0);
    [2, 3, 1, 5, 6, 4].forEach((color, c) => { grid[idx(7, c)] = color; });
    [[0, 4], [1, 4], [2, 5], [4, 1]].forEach(([c, color]) => { grid[idx(6, c)] = color; });
    grid[idx(5, 1)] = 3;
    const domino = PIECES.find((p) => p.size === 2 && p.h === 1);
    tray = [{ piece: domino, color: 4 }, null, null];
    bonus = null; sel = null; cursor = null; lastSnap = null;
    shownScore = 0; prevEnergy = 0;
    resetCells();
    setBomb(false);
    $('stuckBanner').hidden = true;
    $('menuOverlay').hidden = true;
    renderBoard(); renderTray(true); renderHud();
    markSpot(true);
    renderCoach();
    $('tray').scrollIntoView({ block: 'nearest' });
    announce(`${t('tourStep', { n: 1, t: TOUR_STEPS })}. ${t('tour1Title')}. ${t('tour1Text')}`);
  }
  function renderCoach() {
    const box = $('coach');
    box.hidden = !tut;
    if (!tut) return;
    const st = tut.step;
    $('coachStep').textContent = t('tourStep', { n: st, t: TOUR_STEPS });
    $('coachSkip').textContent = t('tourSkip');
    $('coachTitle').textContent = t(`tour${st}Title`);
    $('coachText').textContent = t(`tour${st}Text`);
    const list = $('coachList');
    list.hidden = st !== 3;
    if (st === 3) {
      list.innerHTML = ['bomb', 'single', 'swap', 'undo']
        .map((k) => `<li><b>${esc((lang() === 'th' && TH[k]) || EN[k])} (${COSTS[k]})</b> ${esc(t('tourP_' + k))}</li>`).join('');
    }
    const next = $('coachNext');
    next.hidden = st < 3;
    next.textContent = st === 4 ? t('tourStart') : t('tourNext');
    $('coachNext').parentElement.hidden = st < 3;
  }
  function tourGo(step) {
    if (!tut) return;
    tut.step = step;
    tut.allow = null;
    markSpot(false);
    document.querySelector('.energy-box').classList.toggle('tour-focus', step === 3);
    renderCoach();
    renderHud();
    announce(`${t('tourStep', { n: step, t: TOUR_STEPS })}. ${t(`tour${step}Title`)}. ${t(`tour${step}Text`)}`);
    if (step === 2) {
      const q = byId.get('A1-G01') || DATA.questions.find((x) => x.level === 'A1' && x.type === 'gap');
      setTimeout(() => { if (tut && tut.step === 2) openQuestion(q, 'tutorial'); }, reduceMotion() ? 0 : 700);
    } else if (step === 3) {
      $('coachNext').focus({ preventScroll: true });
    }
  }
  function endTour(start) {
    if (!tut) return;
    tut = null;
    if (qState && qState.mode === 'tutorial') { qState = null; $('qOverlay').hidden = true; }
    document.querySelector('.energy-box').classList.remove('tour-focus');
    game = null;
    grid = new Array(N * N).fill(0);
    tray = [null, null, null]; bonus = null; sel = null; cursor = null; lastSnap = null;
    shownScore = 0; prevEnergy = 0;
    resetCells();
    clearPreview();
    saved.tutorialDone = true;
    persist();
    renderCoach(); renderBoard(); renderTray(); renderHud();
    if (start && !validSave()) newGame(); else showMenu('start');
  }
  $('coachSkip').addEventListener('click', () => endTour(false));
  $('qTourSkip').addEventListener('click', () => endTour(false));
  $('coachNext').addEventListener('click', () => { if (!tut) return; if (tut.step === 3) tourGo(4); else endTour(true); });
  $('menuTourBtn').addEventListener('click', startTour);

  /* ---------- Settings ---------- */
  function paintSettings() {
    document.body.classList.toggle('patterns', !!saved.settings.patterns);
    $('patternsChk').checked = !!saved.settings.patterns;
    $('vibChk').checked = canVibrate && saved.settings.vibrate !== false;
    $('vibChk').disabled = !canVibrate;
    $('vibNote').hidden = canVibrate;
    $('vibNote').textContent = t('vibNone');
    $('soundChk').checked = !saved.settings.muted;
  }
  function openSettings() { paintSettings(); $('settingsOverlay').hidden = false; $('setClose').focus({ preventScroll: true }); }
  function closeSettings() { $('settingsOverlay').hidden = true; }
  $('settingsBtn').addEventListener('click', openSettings);
  $('setClose').addEventListener('click', closeSettings);
  $('settingsOverlay').addEventListener('click', (ev) => { if (ev.target === $('settingsOverlay')) closeSettings(); });
  $('patternsChk').addEventListener('change', (e) => { saved.settings.patterns = e.target.checked; persist(); paintSettings(); });
  $('vibChk').addEventListener('change', (e) => { saved.settings.vibrate = e.target.checked; persist(); if (e.target.checked) vib(30); });
  $('soundChk').addEventListener('change', (e) => { saved.settings.muted = !e.target.checked; persist(); paintMute(); });
  $('readBoardBtn').addEventListener('click', () => announce(describeBoard()));

  /* ---------- Controls ---------- */
  const TOPIC_TH = { education: 'การศึกษา', environment: 'สิ่งแวดล้อม', technology: 'เทคโนโลยี', health: 'สุขภาพ', work: 'การทำงาน', travel: 'การท่องเที่ยว' };
  const topicName = (tp) => (tp === 'all' ? t('allTopics') : lang() === 'th' ? TOPIC_TH[tp] : cap(tp));
  function renderHomePickers() {
    const s0 = saved.settings;
    const tick = '<span class="tick" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    $('levelPick').innerHTML = LEVELS.map((lv) => {
      const band = DATA && DATA.levels && DATA.levels[lv] ? DATA.levels[lv].band : '';
      const ls = saved.levelStats[lv];
      const acc = ls && statTotal(ls) >= 5 ? t('lvAcc', { p: pctOf(ls.right, ls.wrong) }) : '';
      const on = s0.level === lv;
      return `<button type="button" class="lv" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-level="${lv}">${tick}
        <span class="lv-code">${lv}</span><span class="lv-band">Band ${esc(band)}</span>
        <span class="lv-desc">${esc(t('lvDesc_' + lv))}</span>${acc ? `<span class="lv-acc">${esc(acc)}</span>` : ''}</button>`;
    }).join('');
    $('topicPick').innerHTML = ['all', ...TOPICS].map((tp) => {
      const on = s0.topic === tp;
      return `<button type="button" class="topic-chip" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-topic="${tp}">${esc(topicName(tp))}</button>`;
    }).join('');
    document.querySelectorAll('#langPick button').forEach((b) => {
      const on = (b.dataset.lang === 'th') === !!s0.thai;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    const band = DATA && DATA.levels && DATA.levels[s0.level] ? DATA.levels[s0.level].band : '';
    $('homeSummary').textContent = `${s0.level}${band ? ` · Band ${band}` : ''} · ${topicName(s0.topic)}`;
    // The top-bar selects mirror the Home page, so a change in either place shows in both.
    const lvSel = $('levelSel'), tpSel = $('topicSel');
    if (lvSel.dataset.lang !== lang() || !lvSel.options.length) {
      lvSel.innerHTML = LEVELS.map((lv) => `<option value="${lv}">${lv} · ${esc(String(DATA && DATA.levels && DATA.levels[lv] ? DATA.levels[lv].band : '').replace('≈ ', ''))}</option>`).join('');
      tpSel.innerHTML = ['all', ...TOPICS].map((tp) => `<option value="${tp}">${esc(topicName(tp))}</option>`).join('');
      lvSel.dataset.lang = lang();
    }
    lvSel.value = s0.level;
    tpSel.value = s0.topic;
  }
  function setLevel(lv) {
    if (!LEVELS.includes(lv) || saved.settings.level === lv) return;
    saved.settings.level = lv;
    persist();
    renderHomePickers();
  }
  function setTopic(tp) {
    if (tp !== 'all' && !TOPICS.includes(tp)) return;
    saved.settings.topic = tp;
    persist();
    renderHomePickers();
  }
  function setLanguage(thai) {
    if (!!saved.settings.thai === thai) return;
    saved.settings.thai = thai;
    persist();
    applyI18n();
    const lv = $('wordLevel').value, tp = $('wordTopic').value;
    fillControls();
    $('wordLevel').value = lv; $('wordTopic').value = tp;
    if (qState) renderQuestion();
    if (!$('menuOverlay').hidden) showMenu(menuKind(), $('overBest').classList.contains('new'));
    if (!$('wordsOverlay').hidden) renderWords();
    if (!$('progOverlay').hidden) { renderProgress(); renderBackupInfo(); hideImportCard(); }
    if (tut) renderCoach();
    renderTray();
    if (!$('helpOverlay').hidden) renderHelp();
  }
  // Arrow keys move through a radio group, as people expect from native radio buttons.
  function roving(container, itemSel, choose) {
    container.addEventListener('keydown', (ev) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
      if (!step) return;
      const items = [...container.querySelectorAll(itemSel)];
      const i = Math.max(0, items.findIndex((el) => el.getAttribute('aria-checked') === 'true'));
      ev.preventDefault();
      choose(items[(i + step + items.length) % items.length]);
      const fresh = container.querySelector(`${itemSel}[aria-checked="true"]`);
      if (fresh) fresh.focus({ preventScroll: false });
    });
  }
  $('levelPick').addEventListener('click', (ev) => { const b = ev.target.closest('[data-level]'); if (b) setLevel(b.dataset.level); });
  $('topicPick').addEventListener('click', (ev) => { const b = ev.target.closest('[data-topic]'); if (b) setTopic(b.dataset.topic); });
  $('langPick').addEventListener('click', (ev) => { const b = ev.target.closest('[data-lang]'); if (b) setLanguage(b.dataset.lang === 'th'); });
  roving($('levelPick'), '[data-level]', (el) => setLevel(el.dataset.level));
  roving($('topicPick'), '[data-topic]', (el) => setTopic(el.dataset.topic));
  roving($('langPick'), '[data-lang]', (el) => setLanguage(el.dataset.lang === 'th'));
  $('levelSel').addEventListener('change', (e) => setLevel(e.target.value));
  $('topicSel').addEventListener('change', (e) => setTopic(e.target.value));
  $('menuSettingsBtn').addEventListener('click', openSettings);
  // The logo is the way back to Home. During a game it pauses first, so nothing is lost.
  $('homeBtn').addEventListener('click', () => {
    if (tut) { endTour(false); return; }
    if (qState) return;
    if (game && !game.over) { pauseGame(); return; }
    showMenu(menuKind());
  });
  function fillControls() {
    renderHomePickers();
    $('wordLevel').innerHTML = `<option value="all">${esc(t('allLevels'))}</option>` + LEVELS.map((lv) => `<option value="${lv}">${lv}</option>`).join('');
    $('wordTopic').innerHTML = `<option value="all">${esc(t('allTopics'))}</option>` + TOPICS.map((tp) => `<option value="${tp}">${esc(topicName(tp))}</option>`).join('');
    paintMute();
    paintSettings();
  }
  function paintMute() {
    const m = saved.settings.muted;
    $('muteBtn').setAttribute('aria-pressed', String(m));
    $('muteBtn').setAttribute('aria-label', m ? 'Sound off' : 'Sound on');
    $('soundChk').checked = !m;
    $('muteIcon').setAttribute('d', m ? 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6' : 'M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12');
  }
  $('muteBtn').addEventListener('click', () => { saved.settings.muted = !saved.settings.muted; persist(); paintMute(); });
  $('playBtn').addEventListener('click', () => {
    if (!$('menuStart').hidden && validSave()) { $('discardConfirm').hidden = false; $('discardYes').focus({ preventScroll: true }); return; }
    newGame();
  });
  $('discardYes').addEventListener('click', newGame);
  $('discardNo').addEventListener('click', () => { $('discardConfirm').hidden = true; $('resumeBtn').focus({ preventScroll: true }); });
  $('resumeBtn').addEventListener('click', () => {
    if (game && !game.over) { $('menuOverlay').hidden = true; return; }
    resumeGame();
  });
  $('pauseEndBtn').addEventListener('click', () => { $('menuOverlay').hidden = true; gameOver(); });
  $('pauseBtn').addEventListener('click', askEndGame);
  $('stopKeep').addEventListener('click', closeStop);
  $('stopEnd').addEventListener('click', () => { closeStop(); gameOver(); });
  $('stopOverlay').addEventListener('click', (ev) => { if (ev.target === $('stopOverlay')) closeStop(); });
  $('reviewBtn').addEventListener('click', startReview);
  $('practiceBtn').addEventListener('click', () => startPractice(collectedQuestions()));

  /* ---------- Boot ---------- */
  applyI18n();
  document.body.classList.toggle('patterns', !!saved.settings.patterns);
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
      // New players get the quick tour once. Anyone who has already played, or has a saved game, does not.
      if (!saved.tutorialDone && saved.games === 0 && totalAnswered() === 0 && !validSave()) startTour();
    })
    .catch(() => { $('loadError').hidden = false; });
})();
