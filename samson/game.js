/* =============================================================
   SAMSON — Logique du jeu (modes, jokers, succès, stats, PWA)
   ============================================================= */
(function () {
  "use strict";

  /* ---------- Utilitaires ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const isLetter = (c) => /[a-zA-ZÀ-ÿ0-9]/.test(c);
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function mulberry32(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffleSeeded(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------- Stockage local ---------- */
  const STORE_KEY = "samson.save.v2";
  const DEFAULTS = {
    best: 0, totalStars: 0, bestCombo: 0, gamesPlayed: 0, wins: 0,
    totalCorrect: 0, totalAttempts: 0, totalScore: 0,
    tiers: {}, modeBest: {}, categories: {}, achievements: {},
    leaderboard: [], dailyStreak: 0, lastDailyDate: "", dailyDone: "",
    survieBest: 0, chronoBest: 0, custom: [], xp: 0, finishedDomains: [], examBest: {},
    sound: true, theme: "light", kbd: "azerty", anim: true, name: "Joueur", answerMode: "letters"
  };
  const store = {
    data: JSON.parse(JSON.stringify(DEFAULTS)),
    load() { try { const r = JSON.parse(localStorage.getItem(STORE_KEY)); if (r) this.data = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), r); } catch (e) {} },
    save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); } catch (e) {} },
    reset() { this.data = JSON.parse(JSON.stringify(DEFAULTS)); this.save(); }
  };
  store.load();

  /* ---------- Audio (Web Audio API) ---------- */
  const audio = {
    ctx: null, on: store.data.sound,
    ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } },
    beep(freq, dur = 0.12, type = "sine", vol = 0.15) {
      if (!this.on) return; this.ensure(); if (!this.ctx) return;
      const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur);
    },
    good() { this.beep(660, .1, "triangle"); setTimeout(() => this.beep(880, .14, "triangle"), 90); },
    bad() { this.beep(200, .2, "sawtooth", .12); },
    tick() { this.beep(1200, .04, "square", .05); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, .18, "triangle"), i * 120)); },
    lose() { [440, 330, 220].forEach((f, i) => setTimeout(() => this.beep(f, .22, "sawtooth", .1), i * 160)); },
    key() { this.beep(520, .03, "square", .04); },
    power() { this.beep(700, .08, "sine"); setTimeout(() => this.beep(1000, .1, "sine"), 70); }
  };

  /* ---------- Écrans ---------- */
  const screens = { show(id) { $$(".screen").forEach(s => s.classList.remove("active")); $("#screen-" + id).classList.add("active"); } };

  /* ---------- Toast ---------- */
  let toastT;
  function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1900); }

  /* ---------- Fenêtre modale (remplace confirm/prompt natifs) ---------- */
  function modalAsk(opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const ov = $("#modalOverlay"), msg = $("#modalMsg"), inp = $("#modalInput"),
        ok = $("#modalOk"), cancel = $("#modalCancel");
      msg.textContent = opts.message || "";
      const isInput = !!opts.input;
      inp.style.display = isInput ? "" : "none";
      if (isInput) { inp.value = opts.value || ""; inp.placeholder = opts.placeholder || ""; }
      ok.textContent = opts.okText || "Confirmer";
      cancel.textContent = opts.cancelText || "Annuler";
      cancel.style.display = opts.hideCancel ? "none" : "";
      ov.classList.add("show");
      if (isInput) setTimeout(() => { inp.focus(); inp.select(); }, 60);
      function done(res) {
        ov.classList.remove("show");
        ok.onclick = cancel.onclick = ov.onclick = inp.onkeydown = null;
        resolve(res);
      }
      ok.onclick = () => done(isInput ? (inp.value || "") : true);
      cancel.onclick = () => done(isInput ? null : false);
      ov.onclick = e => { if (e.target === ov) done(isInput ? null : false); };
      inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); ok.click(); } else if (e.key === "Escape") cancel.click(); };
    });
  }
  const confirmAsk = (message, okText) => modalAsk({ message, okText: okText || "Confirmer" });

  /* ---------- Thème / son / animations ---------- */
  function applyTheme(t) { document.documentElement.setAttribute("data-theme", t); $("#themeBtn").textContent = t === "dark" ? "☀️" : "🌙"; store.data.theme = t; store.save(); }
  function applySound() { audio.on = store.data.sound; $("#soundBtn").textContent = audio.on ? "🔊" : "🔇"; }
  function applyAnim() { document.documentElement.classList.toggle("no-anim", !store.data.anim); }
  applyTheme(store.data.theme || "light"); applySound(); applyAnim();
  $("#themeBtn").addEventListener("click", () => applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
  $("#soundBtn").addEventListener("click", () => { store.data.sound = !store.data.sound; store.save(); applySound(); if (audio.on) audio.key(); });

  /* ---------- État de la partie ---------- */
  let game = {};
  function resetRunStats() {
    Object.assign(game, {
      index: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, attempts: 0,
      revealedThisPuzzle: 0, hintsUsedGame: 0, solvedCats: {}, ended: false
    });
  }

  /* ---------- Accueil ---------- */
  function refreshHome() {
    $("#home-best").textContent = store.data.best;
    $("#home-stars").textContent = store.data.totalStars;
    $("#home-daily").textContent = store.data.dailyStreak + "🔥";
    renderRankBanner();
  }
  function currentRank(xp) {
    let rank = SAMSON_RANKS[0], idx = 0;
    SAMSON_RANKS.forEach((r, i) => { if (xp >= r.min) { rank = r; idx = i; } });
    return { rank, idx, next: SAMSON_RANKS[idx + 1] || null };
  }
  function renderRankBanner() {
    const xp = store.data.xp || 0; const { rank, next } = currentRank(xp);
    const pct = next ? clamp((xp - rank.min) / (next.min - rank.min) * 100, 0, 100) : 100;
    const info = next ? `${xp} / ${next.min} XP → ${next.icon} ${next.name}` : `Rang maximal · ${xp} XP`;
    $("#rankBanner").innerHTML = `<span class="r-ico">${rank.icon}</span>
      <span class="r-meta"><span class="r-name">Rang : ${rank.name}</span>
      <span class="r-xp">${info}</span>
      <span class="r-bar"><span class="r-fill" style="width:${pct}%"></span></span></span>`;
  }
  function levelUp(rank) {
    const el = $("#achToast");
    el.innerHTML = `<span class="at-ico">${rank.icon}</span><div><b>Niveau supérieur !</b><span>Nouveau rang : ${rank.name}</span></div>`;
    el.classList.add("show"); audio.win(); popConfetti(60);
    setTimeout(() => el.classList.remove("show"), 3200);
  }
  function gainXp(amount) {
    const d = store.data; const oldIdx = currentRank(d.xp || 0).idx;
    d.xp = (d.xp || 0) + Math.max(0, Math.round(amount));
    const nr = currentRank(d.xp);
    if (nr.idx >= 4) unlock("rankExpert");
    if (nr.idx > oldIdx) setTimeout(() => levelUp(nr.rank), 400);
  }
  function buildModeGrid() {
    const grid = $("#modeGrid"); grid.innerHTML = "";
    SAMSON_MODES.forEach(m => {
      const card = document.createElement("button");
      card.className = "mode-card"; card.type = "button";
      let badge = "";
      if (m.id === "daily") badge = store.data.dailyDone === todayStr()
        ? `<span class="m-badge done">FAIT ✓</span>` : `<span class="m-badge new">DU JOUR</span>`;
      const best = store.data.modeBest[m.id];
      card.innerHTML = `<span class="m-bar" style="background:${m.color}"></span>${badge}
        <span class="m-ico">${m.icon}</span><h3>${m.label}</h3><p>${m.desc}</p>
        ${best ? `<p style="color:${m.color};font-weight:800">Record : ${best}</p>` : ""}`;
      card.addEventListener("click", () => { audio.ensure(); onModeClick(m.id); });
      grid.appendChild(card);
    });
  }

  async function onModeClick(id) {
    if (id === "parcours") { buildTierGrid(); screens.show("levels"); return; }
    if (id === "culture") { buildDomainGrid(); screens.show("domains"); return; }
    if (id === "examen") { buildExamGrid(); screens.show("exam"); return; }
    if (id === "category") { buildCatGrid(); screens.show("category"); return; }
    if (id === "custom") { showEditor(); return; }
    if (id === "daily" && store.data.dailyDone === todayStr()) {
      const ok = await confirmAsk("Tu as déjà fait le défi du jour. Rejouer pour t'entraîner (sans compter la série) ?", "Rejouer");
      if (!ok) return;
    }
    startMode(id);
  }

  /* ---------- Choix parcours ---------- */
  function buildTierGrid() {
    const grid = $("#tierGrid"); grid.innerHTML = "";
    SAMSON_TIERS.forEach(tier => {
      const saved = store.data.tiers[tier.id] || {};
      const stars = saved.stars || 0;
      const card = document.createElement("button");
      card.className = "tier-card"; card.type = "button";
      card.innerHTML = `<span class="bar" style="background:${tier.color}"></span>
        <span class="tier-icon">${tier.icon}</span>
        <span class="tier-meta"><h3>${tier.label}</h3>
        <p>${tier.time}s · ${tier.hints} indice(s) · ${Math.round(tier.revealRatio * 100)}% offert</p>
        <span class="tier-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)} ${saved.best ? "· record " + saved.best : ""}</span></span>`;
      card.addEventListener("click", () => { audio.ensure(); startMode("parcours", { tier }); });
      grid.appendChild(card);
    });
  }

  /* ---------- Choix du thème (mode « Par thème ») ---------- */
  function buildCatGrid() {
    const grid = $("#catGrid"); grid.innerHTML = "";
    SAMSON_CATEGORIES.forEach(cat => {
      const count = SAMSON_PUZZLES.filter(p => p.category === cat.id).length;
      const card = document.createElement("button");
      card.className = "tier-card"; card.type = "button";
      card.innerHTML = `<span class="bar" style="background:${cat.color}"></span>
        <span class="tier-icon">${cat.icon}</span>
        <span class="tier-meta"><h3>${cat.label}</h3><p>${count} image(s) à deviner</p></span>`;
      card.addEventListener("click", () => { audio.ensure(); startMode("category", { category: cat.id }); });
      grid.appendChild(card);
    });
  }

  /* ---------- Choix de la matière (mode « Culture & Matières ») ---------- */
  function buildDomainGrid() {
    const grid = $("#domainGrid"); grid.innerHTML = "";
    SAMSON_DOMAINS.forEach(dom => {
      const count = SAMSON_QUIZ.filter(q => q.domain === dom.id).length;
      const done = (store.data.finishedDomains || []).includes(dom.id);
      const card = document.createElement("button");
      card.className = "tier-card"; card.type = "button";
      card.innerHTML = `<span class="bar" style="background:${dom.color}"></span>
        <span class="tier-icon">${dom.icon}</span>
        <span class="tier-meta"><h3>${dom.label} ${done ? "✅" : ""}</h3>
        <p>${dom.desc}</p><span class="tier-stars">${count} question(s)</span></span>`;
      card.addEventListener("click", () => { audio.ensure(); startMode("culture", { domain: dom.id }); });
      grid.appendChild(card);
    });
  }

  /* ---------- Mode Examen (noté sur 20, bulletin + correction) ---------- */
  function buildExamGrid() {
    const grid = $("#examGrid"); grid.innerHTML = "";
    const bests = store.data.examBest || {};
    const addCard = (id, icon, color, label, desc) => {
      const best = bests[id];
      const card = document.createElement("button");
      card.className = "tier-card"; card.type = "button";
      card.innerHTML = `<span class="bar" style="background:${color}"></span>
        <span class="tier-icon">${icon}</span>
        <span class="tier-meta"><h3>${label}</h3><p>${desc}</p>
        <span class="tier-stars">${best != null ? "Meilleure note : " + fmtNote(best) + "/20" : "Pas encore passé"}</span></span>`;
      card.addEventListener("click", () => { audio.ensure(); startExam(id); });
      grid.appendChild(card);
    };
    addCard("all", "🎓", "#0f766e", "Toutes les matières", "Examen général, questions variées");
    SAMSON_DOMAINS.filter(d => SAMSON_QUIZ.filter(q => q.domain === d.id).length >= 4)
      .forEach(d => addCard(d.id, d.icon, d.color, d.label, d.desc));
  }

  function startExam(domain) {
    const pool = domain === "all" ? SAMSON_QUIZ : SAMSON_QUIZ.filter(q => q.domain === domain);
    const n = Math.min(10, pool.length);
    game = { mode: "examen", examDomain: domain };
    resetRunStats();
    game.useLives = false; game.totalMode = false; game.noTimer = false; game.ramp = false;
    game.duo = null; game.examMode = true; game.examResults = [];
    game.queue = shuffle(pool).slice(0, n);
    game.revealRatio = 0.25; game.timePerQ = 40;
    game.jk = { hint: 0, time: 0, fifty: 0 }; game.jkBase = { hint: 0, time: 0, fifty: 0 };
    game.answerMode = store.data.answerMode || "letters";
    game.optionPool = SAMSON_QUIZ;
    screens.show("play");
    setupHud();
    loadPuzzle();
  }

  function examRecord(userAnswer) {
    if (game.ended) return;
    stopTimer();
    const p = game.current;
    const clean = (userAnswer == null) ? "" : String(userAnswer).replace(/\s+/g, " ").trim();
    const ok = clean !== "" && isCorrect(clean);
    if (ok) game.correct++;
    game.attempts++;
    game.examResults.push({ q: p.prompt || ("Image à identifier (" + (p.category || "objet") + ")"), correct: p.name, user: clean || "(sans réponse)", ok });
    game.index++;
    if (game.index >= game.queue.length) endExam(); else loadPuzzle();
  }

  const fmtNote = (n) => Number.isInteger(n) ? String(n) : n.toFixed(1);
  function noteMention(n) {
    if (n >= 18) return { label: "Félicitations du jury 🎉", appr: "Résultat exceptionnel, un sans-faute ou presque. Bravo !", cls: "good" };
    if (n >= 16) return { label: "Mention Très bien", appr: "Excellent travail, tu maîtrises très bien le sujet.", cls: "good" };
    if (n >= 14) return { label: "Mention Bien", appr: "Très bon résultat, continue sur cette lancée !", cls: "good" };
    if (n >= 12) return { label: "Mention Assez bien", appr: "Bon travail ; quelques révisions et ce sera parfait.", cls: "mid" };
    if (n >= 10) return { label: "Passable", appr: "La moyenne est atteinte, mais tu peux faire mieux !", cls: "mid" };
    if (n >= 8) return { label: "Insuffisant", appr: "Tout près de la moyenne : révise les corrections et retente.", cls: "bad" };
    return { label: "À revoir", appr: "Courage ! Relis attentivement la correction et recommence.", cls: "bad" };
  }

  function endExam() {
    game.ended = true; stopTimer();
    const total = game.queue.length || 1;
    const note = Math.round((game.correct / total) * 20 * 2) / 2;
    const M = noteMention(note);
    const d = store.data;
    d.gamesPlayed++;
    d.examBest = d.examBest || {};
    d.examBest[game.examDomain] = Math.max(d.examBest[game.examDomain] || 0, note);
    if (note >= 10) unlock("diplome");
    if (note >= 16) unlock("major");
    gainXp(game.correct * 3 + note * 4);
    store.save(); refreshHome();
    renderBulletin(note, M, total);
    (note >= 10 ? audio.win() : audio.lose());
    if (note >= 14) popConfetti(130); else if (note >= 10) popConfetti(60);
    screens.show("bulletin");
  }

  function examDomainLabel() {
    if (game.examDomain === "all") return "Toutes les matières";
    const d = SAMSON_DOMAINS.find(x => x.id === game.examDomain);
    return d ? d.label : game.examDomain;
  }

  function renderBulletin(note, M, total) {
    $("#gradeNote").textContent = fmtNote(note);
    $("#gradeCircle").className = "grade-circle " + M.cls;
    $("#bulletinTitle").textContent = M.label;
    $("#bulletinSub").textContent = `${examDomainLabel()} · ${game.correct}/${total} bonnes réponses`;
    $("#appreciation").textContent = "📝 Appréciation du professeur : " + M.appr;
    $("#correctionList").innerHTML = game.examResults.map((r, i) =>
      `<div class="correction-row ${r.ok ? "ok" : ""}"><span class="cr-mark">${r.ok ? "✅" : "❌"}</span>
        <span class="cr-body"><div class="cr-q">${i + 1}. ${escapeHtml(r.q)}</div>
        <div class="cr-a">${r.ok
        ? `Réponse : <b>${escapeHtml(r.correct)}</b>`
        : `Ta réponse : <span class="ko">${escapeHtml(r.user)}</span> &nbsp;·&nbsp; Correct : <b>${escapeHtml(r.correct)}</b>`}</div></span></div>`
    ).join("");
  }

  /* ---------- Sélection des énigmes par mode ---------- */
  function byLevel(l) { return SAMSON_PUZZLES.filter(p => p.level === l); }
  function dailyQueue() {
    let seed = 0; for (const c of todayStr()) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = mulberry32(seed || 1);
    return [
      ...shuffleSeeded(byLevel(1), rnd).slice(0, 3),
      ...shuffleSeeded(byLevel(2), rnd).slice(0, 3),
      ...shuffleSeeded(byLevel(3), rnd).slice(0, 2)
    ];
  }

  /* ---------- Démarrage d'un mode ---------- */
  function startMode(mode, opts) {
    opts = opts || {};
    game = { mode, tier: opts.tier || null, catFilter: opts.category || null };
    resetRunStats();
    game.lives = 3; game.useLives = true; game.totalMode = false; game.ramp = false; game.noTimer = false;
    game.duo = null;

    if (mode === "parcours") {
      const tier = game.tier;
      game.queue = shuffle(SAMSON_PUZZLES.filter(p => tier.levels.includes(p.level)));
      game.revealRatio = tier.revealRatio; game.timePerQ = tier.time;
      game.jk = { hint: tier.hints, time: tier.id === "expert" ? 0 : 1, fifty: tier.id === "expert" ? 0 : 1 };
    } else if (mode === "category") {
      game.queue = shuffle(SAMSON_PUZZLES.filter(p => p.category === game.catFilter));
      game.revealRatio = 0.35; game.timePerQ = 45;
      game.jk = { hint: 2, time: 1, fifty: 1 };
    } else if (mode === "culture") {
      game.domain = opts.domain;
      game.queue = shuffle(SAMSON_QUIZ.filter(q => q.domain === game.domain));
      game.revealRatio = 0.4; game.timePerQ = 60;
      game.jk = { hint: 3, time: 2, fifty: 2 };
    } else if (mode === "custom") {
      const list = store.data.custom || [];
      if (!list.length) { toast("Crée d'abord une énigme !"); showEditor(); return; }
      game.queue = shuffle(list.map(c => ({ id: c.id, name: c.name, hint: c.hint, category: c.category, emoji: c.emoji })));
      game.revealRatio = 0.35; game.timePerQ = 45;
      game.jk = { hint: 3, time: 1, fifty: 1 };
    } else if (mode === "zen") {
      game.queue = shuffle(SAMSON_PUZZLES);
      game.revealRatio = 0.4; game.useLives = false; game.noTimer = true;
      game.jk = { hint: 99, time: 0, fifty: 99 };
    } else if (mode === "daily") {
      game.queue = dailyQueue();
      game.revealRatio = 0.3; game.timePerQ = 45;
      game.jk = { hint: 2, time: 1, fifty: 1 };
    } else if (mode === "survie") {
      game.queue = shuffle(SAMSON_PUZZLES);
      game.revealRatio = 0.4; game.timePerQ = 40; game.ramp = true;
      game.jk = { hint: 3, time: 2, fifty: 1 };
    } else if (mode === "chrono") {
      game.queue = shuffle(SAMSON_PUZZLES).concat(shuffle(SAMSON_PUZZLES));
      game.revealRatio = 0.3; game.useLives = false; game.totalMode = true;
      game.totalMax = 90; game.totalLeft = 90;
      game.jk = { hint: 3, time: 2, fifty: 1 };
    } else if (mode === "duo") {
      game.useLives = false;
      game.revealRatio = 0.35; game.timePerQ = 40;
      const q = shuffle(SAMSON_PUZZLES).slice(0, 6);
      game.duo = { queue: q, player: 1, scores: [0, 0], names: [store.data.name || "Joueur 1", "Joueur 2"] };
      game.queue = q;
      game.jk = { hint: 2, time: 1, fifty: 1 };
    }
    game.jkBase = Object.assign({}, game.jk);
    game.answerMode = store.data.answerMode || "letters";
    game.optionPool = (mode === "culture") ? SAMSON_QUIZ : (mode === "custom") ? (store.data.custom || []) : SAMSON_PUZZLES;

    screens.show("play");
    if (game.totalMode) startTotalTimer();
    setupHud();
    loadPuzzle();
  }

  function setupHud() {
    const m = game.mode;
    const lbl = $("#hud-mode-lbl"), livesWrap = $("#hud-lives-wrap"), duo = $("#duoBanner");
    const exam = game.examMode;
    livesWrap.style.display = game.useLives ? "" : "none";
    $(".timer-wrap").style.display = game.noTimer ? "none" : "";
    $("#revealBtn").style.display = (m === "zen") ? "" : "none";
    $("#jokers").style.display = exam ? "none" : "";
    $(".answer-toggle").style.display = exam ? "none" : "";
    $("#hud-score-wrap").style.display = exam ? "none" : "";
    if (exam) lbl.textContent = "Question";
    else if (m === "survie" || m === "chrono" || m === "zen") lbl.textContent = "Trouvés";
    else lbl.textContent = "Niveau";
    if (game.duo) {
      duo.style.display = "block";
      updateDuoBanner();
    } else duo.style.display = "none";
    updateHud();
  }
  function updateDuoBanner() {
    const d = game.duo; if (!d) return;
    $("#duoBanner").innerHTML = `👤 ${d.names[d.player - 1]} joue · ${d.names[0]}: ${d.scores[0]} — ${d.names[1]}: ${d.scores[1]}`;
  }
  function updateHud() {
    if (game.mode === "survie" || game.mode === "chrono" || game.mode === "zen") $("#hud-level").textContent = game.correct;
    else $("#hud-level").textContent = `${game.index + 1}/${game.queue.length}`;
    $("#hud-score").textContent = game.score;
    if (game.useLives) $("#hud-lives").textContent = "❤️".repeat(Math.max(0, game.lives)) + "🖤".repeat(3 - Math.max(0, game.lives));
  }

  /* ---------- Paramètres dynamiques (survie) ---------- */
  function puzzleParams() {
    if (game.mode === "survie") {
      const step = Math.floor(game.correct / 4);
      return { ratio: clamp(0.4 - step * 0.08, 0, 0.4), time: clamp(40 - step * 3, 18, 40) };
    }
    return { ratio: game.revealRatio, time: game.timePerQ };
  }

  /* ---------- Masque de lettres ---------- */
  function buildMask(name, ratio) {
    const chars = [...name];
    const letterIdx = chars.map((c, i) => isLetter(c) ? i : -1).filter(i => i >= 0);
    const revealCount = Math.floor(letterIdx.length * ratio);
    const toReveal = new Set(shuffle(letterIdx).slice(0, revealCount));
    return chars.map((c, i) => ({ char: c, isLetter: isLetter(c), given: isLetter(c) ? toReveal.has(i) : true }));
  }

  /* ---------- Chargement d'une énigme ---------- */
  function loadPuzzle() {
    // survie / zen : rallonge la file si besoin
    if ((game.mode === "survie" || game.mode === "zen") && game.index >= game.queue.length - 1) game.queue = game.queue.concat(shuffle(SAMSON_PUZZLES));
    const p = game.queue[game.index];
    game.current = p; game.revealedThisPuzzle = 0;
    const params = puzzleParams();

    updateHud();
    if (p.prompt) {
      const dom = SAMSON_DOMAINS.find(d => d.id === p.domain);
      $("#catTag").textContent = (dom ? dom.label : p.domain || "") + (p.region ? " · " + p.region : "");
      $("#imgHolder").innerHTML = `<div class="quiz-card"><div class="quiz-emoji">${p.emoji || "❓"}</div><div class="quiz-q">${p.prompt}</div></div>`;
    } else {
      $("#catTag").textContent = p.category || "objet";
      $("#imgHolder").innerHTML = p.svg ? p.svg : `<div class="emoji-img">${p.emoji || "❓"}</div>`;
    }
    const ht = $("#hintText"); ht.textContent = "💡 " + (p.hint || ""); ht.classList.remove("show");
    $("#feedback").textContent = ""; $("#feedback").className = "feedback";

    renderAnswerArea();
    if (game.noTimer) { /* pas de minuteur en mode Zen */ }
    else if (!game.totalMode) startQuestionTimer(params.time);
    else updateTimerBar();
  }

  /* ---------- Zone de réponse (Lettres ou QCM) ---------- */
  function setPlayModeSeg() { $$("#segPlayMode button").forEach(b => b.classList.toggle("active", b.dataset.v === game.answerMode)); }
  function renderAnswerArea() {
    game.locked = false;
    $("#feedback").textContent = ""; $("#feedback").className = "feedback";
    const qcm = game.answerMode === "qcm";
    setPlayModeSeg();
    $("#answerBoxes").style.display = qcm ? "none" : "";
    $("#answerChoices").style.display = qcm ? "" : "none";
    $("#submitBtn").style.display = qcm ? "none" : "";
    $(".kbd-toggle").style.display = qcm ? "none" : "";
    if (qcm) $("#keyboard").style.display = "none";
    if (qcm) { game.mask = []; game.boxes = []; renderChoices(); }
    else {
      game.mask = buildMask(game.current.name, puzzleParams().ratio);
      renderBoxes(); sizeBoxes();
    }
    renderJokers();
    if (!qcm) focusFirstEmpty();
  }
  $("#segPlayMode").addEventListener("click", e => {
    const v = e.target.dataset.v;
    if (!v || game.ended || game.locked || !game.current || v === game.answerMode) return;
    game.answerMode = v;
    store.data.answerMode = v; store.save();
    setSeg("segAnswer", v);
    renderAnswerArea();
    audio.key();
  });

  /* ---------- Cases lettres ---------- */
  function renderBoxes() {
    const wrap = $("#answerBoxes"); wrap.innerHTML = ""; game.boxes = [];
    let group = document.createElement("div"); group.className = "word-group";
    game.mask.forEach((m, i) => {
      if (!m.isLetter && m.char === " ") {
        wrap.appendChild(group);
        const sp = document.createElement("div"); sp.className = "sep"; sp.textContent = "·"; wrap.appendChild(sp);
        group = document.createElement("div"); group.className = "word-group"; game.boxes.push(null); return;
      }
      if (!m.isLetter) {
        const sp = document.createElement("div"); sp.className = "sep"; sp.textContent = m.char; group.appendChild(sp); game.boxes.push(null); return;
      }
      const inp = document.createElement("input");
      inp.className = "letter-box"; inp.maxLength = 1; inp.dataset.i = i;
      inp.setAttribute("aria-label", "lettre " + (i + 1)); inp.autocapitalize = "characters"; inp.inputMode = "text";
      if (m.given) { inp.value = m.char; inp.classList.add("given"); inp.readOnly = true; inp.tabIndex = -1; }
      else { inp.addEventListener("input", onLetterInput); inp.addEventListener("keydown", onLetterKey); }
      group.appendChild(inp); game.boxes.push(inp);
    });
    wrap.appendChild(group);
  }
  function editableBoxes() { return game.boxes.filter(b => b && !b.readOnly); }
  function focusFirstEmpty() { const b = editableBoxes().find(x => !x.value) || editableBoxes()[0]; if (b) b.focus(); }

  /* Dimensionne les cases selon la largeur disponible (responsive, mots longs) */
  function sizeBoxes() {
    const wrap = $("#answerBoxes");
    let run = 0, maxRun = 1;
    game.mask.forEach(m => { if (m.isLetter) { run++; if (run > maxRun) maxRun = run; } else run = 0; });
    const avail = (wrap.clientWidth || 320) - 2;
    const gap = 6;
    let size = Math.floor((avail - (maxRun - 1) * gap) / maxRun);
    size = clamp(size, 18, 44);
    wrap.style.setProperty("--box", size + "px");
  }
  window.addEventListener("resize", () => {
    if ($("#screen-play").classList.contains("active") && game.answerMode !== "qcm" && game.mask && game.mask.length) sizeBoxes();
  });

  /* Génère des propositions plausibles pour le mode QCM */
  function pickDistractors(p, n) {
    const key = p.domain ? "domain" : "category";
    const pool = (game.optionPool || SAMSON_PUZZLES).filter(x => x.name && norm(x.name) !== norm(p.name));
    const same = shuffle(pool.filter(x => x[key] && p[key] && x[key] === p[key]));
    const rest = shuffle(pool.filter(x => !(x[key] && p[key] && x[key] === p[key])));
    const chosen = [], seen = new Set([norm(p.name)]);
    for (const x of same.concat(rest)) {
      const nm = norm(x.name);
      if (seen.has(nm)) continue;
      seen.add(nm); chosen.push(x.name);
      if (chosen.length >= n) break;
    }
    return chosen;
  }
  function renderChoices() {
    const wrap = $("#answerChoices"); wrap.innerHTML = ""; game.choiceBtns = [];
    const opts = shuffle([game.current.name].concat(pickDistractors(game.current, 3)));
    opts.forEach(name => {
      const b = document.createElement("button"); b.type = "button"; b.className = "choice"; b.textContent = name;
      b.addEventListener("click", () => handleChoice(b, name));
      wrap.appendChild(b); game.choiceBtns.push(b);
    });
  }
  function handleChoice(btn, name) {
    if (game.locked || game.ended) return;
    game.locked = true;
    if (!game.totalMode) stopTimer();
    game.choiceBtns.forEach(b => b.disabled = true);
    if (game.examMode) { examRecord(name); return; }
    game.attempts++;
    renderJokers();
    if (isCorrect(name)) { btn.classList.add("correct"); onCorrect(); }
    else {
      btn.classList.add("wrong");
      const good = game.choiceBtns.find(b => isCorrect(b.textContent));
      if (good) good.classList.add("correct");
      onWrong();
    }
  }
  function onLetterInput(e) {
    const box = e.target;
    box.value = box.value.replace(/[^a-zA-ZÀ-ÿ0-9]/g, "").slice(0, 1);
    if (box.value) { box.classList.add("filled"); audio.key(); nextBox(box); } else box.classList.remove("filled");
  }
  function onLetterKey(e) {
    const box = e.target;
    if (e.key === "Backspace" && !box.value) { e.preventDefault(); prevBox(box); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); prevBox(box); }
    else if (e.key === "ArrowRight") { e.preventDefault(); nextBox(box); }
    else if (e.key === "Enter") { e.preventDefault(); submit(); }
  }
  function nextBox(box) { const l = editableBoxes(), i = l.indexOf(box); for (let k = i + 1; k < l.length; k++) { l[k].focus(); return; } }
  function prevBox(box) { const l = editableBoxes(), i = l.indexOf(box); for (let k = i - 1; k >= 0; k--) { l[k].value = ""; l[k].classList.remove("filled"); l[k].focus(); return; } }

  /* ---------- Timers ---------- */
  function startQuestionTimer(time) {
    stopTimer(); game.timeMax = time; game.timeLeft = time; updateTimerBar();
    game.timer = setInterval(() => {
      game.timeLeft--; updateTimerBar();
      if (game.timeLeft <= 5 && game.timeLeft > 0) audio.tick();
      if (game.timeLeft <= 0) { stopTimer(); timeOut(); }
    }, 1000);
  }
  function startTotalTimer() {
    stopTimer();
    game.timer = setInterval(() => {
      if (game.ended) return;
      game.totalLeft--; updateTimerBar();
      if (game.totalLeft <= 5 && game.totalLeft > 0) audio.tick();
      if (game.totalLeft <= 0) { stopTimer(); endGame(true); }
    }, 1000);
  }
  function stopTimer() { if (game.timer) { clearInterval(game.timer); game.timer = null; } }
  function updateTimerBar() {
    const bar = $("#timerBar");
    const pct = game.totalMode ? clamp(game.totalLeft / game.totalMax * 100, 0, 100) : clamp(game.timeLeft / game.timeMax * 100, 0, 100);
    bar.style.width = pct + "%"; bar.classList.toggle("low", pct < 30);
  }

  /* ---------- Jokers ---------- */
  function renderJokers() {
    const disp = n => n >= 99 ? "∞" : n;
    const locked = !!game.locked;
    $("#cntHint").textContent = disp(game.jk.hint);
    $("#cntTime").textContent = disp(game.jk.time);
    $("#cntFifty").textContent = disp(game.jk.fifty);
    $("#jkHint").disabled = locked || game.jk.hint <= 0;
    $("#jkTime").disabled = locked || game.jk.time <= 0;
    $("#jkSkip").disabled = locked;
    let fiftyRoom;
    if (game.answerMode === "qcm") fiftyRoom = (game.choiceBtns || []).filter(b => !b.disabled && !isCorrect(b.textContent)).length > 1;
    else fiftyRoom = editableBoxes().filter(b => !b.value).length > 1;
    $("#jkFifty").disabled = locked || game.jk.fifty <= 0 || !fiftyRoom;
  }
  $("#jkHint").addEventListener("click", () => {
    if (game.jk.hint <= 0 || game.locked) return;
    const empty = editableBoxes().find(b => !b.value);
    if (game.jk.hint < 99) game.jk.hint--;
    game.hintsUsedGame++; game.revealedThisPuzzle++;
    if (empty) { empty.value = game.mask[+empty.dataset.i].char; empty.classList.add("filled"); toast("💡 Lettre révélée"); }
    else { $("#hintText").classList.add("show"); toast("💡 Indice affiché"); }
    audio.power(); renderJokers(); focusFirstEmpty();
  });
  $("#jkTime").addEventListener("click", () => {
    if (game.jk.time <= 0 || game.locked) return;
    game.jk.time--;
    if (game.totalMode) { game.totalLeft = Math.min(game.totalMax, game.totalLeft + 10); }
    else { game.timeLeft = game.timeLeft + 10; game.timeMax = Math.max(game.timeMax, game.timeLeft); }
    updateTimerBar(); toast("❄️ +10 secondes"); audio.power(); renderJokers();
  });
  $("#jkFifty").addEventListener("click", () => {
    if (game.jk.fifty <= 0 || game.locked) return;
    if (game.answerMode === "qcm") {
      const wrong = (game.choiceBtns || []).filter(b => !b.disabled && !isCorrect(b.textContent));
      if (wrong.length <= 1) return;
      if (game.jk.fifty < 99) game.jk.fifty--;
      shuffle(wrong).slice(0, Math.ceil(wrong.length / 2)).forEach(b => { b.disabled = true; b.classList.add("removed"); });
      toast("🎯 Options réduites !"); audio.power(); renderJokers();
      return;
    }
    const empties = editableBoxes().filter(b => !b.value);
    if (empties.length <= 1) return;
    if (game.jk.fifty < 99) game.jk.fifty--;
    const n = Math.ceil(empties.length / 2);
    shuffle(empties).slice(0, n).forEach(b => { b.value = game.mask[+b.dataset.i].char; b.classList.add("filled"); });
    game.revealedThisPuzzle += n;
    toast("🎯 Moitié révélée !"); audio.power(); renderJokers(); focusFirstEmpty();
  });
  $("#jkSkip").addEventListener("click", () => { if (game.locked) return; game.combo = 0; hideCombo(); toast("Énigme passée"); nextPuzzle(); });

  /* Bouton « Révéler la réponse » (mode Zen) */
  $("#revealBtn").addEventListener("click", () => {
    if (game.ended || !game.current || game.locked) return;
    game.locked = true; stopTimer(); game.combo = 0; hideCombo();
    if (game.answerMode === "qcm") {
      (game.choiceBtns || []).forEach(b => { b.disabled = true; if (isCorrect(b.textContent)) b.classList.add("correct"); });
    } else {
      game.mask.forEach((m, i) => { const b = game.boxes[i]; if (b) { b.value = m.char; b.classList.add("given"); } });
    }
    const fb = $("#feedback"); fb.textContent = `👁️ La réponse était « ${game.current.name} »`; fb.className = "feedback";
    setTimeout(nextPuzzle, 1300);
  });

  /* ---------- Clavier virtuel ---------- */
  function buildKeyboard() {
    const layouts = {
      azerty: ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"],
      qwerty: ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]
    };
    const rows = layouts[store.data.kbd] || layouts.azerty;
    const kb = $("#keyboard"); kb.innerHTML = "";
    rows.forEach(r => {
      const row = document.createElement("div"); row.className = "kbd-row";
      [...r].forEach(ch => { const k = document.createElement("button"); k.type = "button"; k.className = "key"; k.textContent = ch; k.addEventListener("click", () => typeChar(ch)); row.appendChild(k); });
      kb.appendChild(row);
    });
    const last = document.createElement("div"); last.className = "kbd-row";
    const back = document.createElement("button"); back.type = "button"; back.className = "key wide"; back.textContent = "⌫ Effacer";
    back.addEventListener("click", () => { const b = document.activeElement; if (b && b.classList && b.classList.contains("letter-box")) prevBox(b); else { const l = editableBoxes().filter(x => x.value).pop(); if (l) { l.value = ""; l.classList.remove("filled"); l.focus(); } } });
    const enter = document.createElement("button"); enter.type = "button"; enter.className = "key wide"; enter.textContent = "✔ Valider";
    enter.addEventListener("click", submit);
    last.appendChild(back); last.appendChild(enter); kb.appendChild(last);
  }
  function typeChar(ch) {
    let box = document.activeElement;
    if (!box || !box.classList || !box.classList.contains("letter-box") || box.readOnly || box.value) box = editableBoxes().find(b => !b.value);
    if (!box) return; box.value = ch; box.classList.add("filled"); audio.key(); nextBox(box);
  }
  $("#kbdToggle").addEventListener("click", () => {
    const kb = $("#keyboard"); const show = kb.style.display === "none";
    kb.style.display = show ? "grid" : "none"; $("#kbdToggle").textContent = show ? "⌨️ Masquer le clavier" : "⌨️ Afficher le clavier";
  });

  /* ---------- Validation ---------- */
  $("#answerForm").addEventListener("submit", e => { e.preventDefault(); submit(); });
  $("#submitBtn").addEventListener("click", submit);
  function currentGuess() { return game.mask.map((m, i) => { if (!m.isLetter) return m.char; const b = game.boxes[i]; return b ? (b.value || " ") : m.char; }).join(""); }
  function isCorrect(guess) { const ans = [game.current.name, ...(game.current.alias || [])].map(norm); return ans.includes(norm(guess)); }
  function submit() {
    if (!game.current || game.ended || game.answerMode === "qcm" || game.locked) return;
    if (game.examMode) {
      game.locked = true;
      const typed = editableBoxes().some(b => b.value);
      examRecord(typed ? currentGuess() : null);
      return;
    }
    const empty = editableBoxes().find(b => !b.value);
    if (empty) { toast("Complète toutes les cases !"); empty.focus(); shakeBoxes(); return; }
    game.attempts++;
    if (isCorrect(currentGuess())) onCorrect(); else onWrong();
  }
  function shakeBoxes() { editableBoxes().forEach(b => { b.classList.remove("wrong"); void b.offsetWidth; b.classList.add("wrong"); }); setTimeout(() => editableBoxes().forEach(b => b.classList.remove("wrong")), 450); }

  function onCorrect() {
    if (!game.totalMode) stopTimer();
    game.correct++; game.combo++; game.maxCombo = Math.max(game.maxCombo, game.combo);
    const cat = game.current.category || game.current.domain || "objet"; game.solvedCats[cat] = (game.solvedCats[cat] || 0) + 1;
    const timeBonus = game.noTimer ? 20 : game.totalMode ? 40 : Math.round(game.timeLeft * 4);
    const comboMult = 1 + (game.combo - 1) * 0.25;
    const gained = Math.max(20, Math.round((100 + timeBonus) * comboMult) - game.revealedThisPuzzle * 25);
    game.score += gained;
    if (game.totalMode) { game.totalLeft = Math.min(game.totalMax, game.totalLeft + 4); }
    updateHud(); if (game.duo) { game.duo.scores[game.duo.player - 1] = game.score; updateDuoBanner(); }
    if (game.answerMode !== "qcm") game.boxes.forEach(b => { if (b) b.classList.add("correct"); });
    const fb = $("#feedback"); fb.textContent = `✔ Bravo ! +${gained} points`; fb.className = "feedback good";
    showCombo(); audio.good();
    if (game.combo >= 3) popConfetti(28);
    checkLiveAchievements();
    setTimeout(nextPuzzle, 1000);
  }

  function onWrong() {
    const qcm = game.answerMode === "qcm";
    game.combo = 0; hideCombo(); audio.bad();
    const fb = $("#feedback");
    if (qcm) { fb.textContent = `✘ Non… c'était « ${game.current.name} »`; fb.className = "feedback bad"; }
    else { fb.textContent = "✘ Raté, réessaie !"; fb.className = "feedback bad"; shakeBoxes(); }
    if (game.totalMode) {
      game.totalLeft = Math.max(0, game.totalLeft - 3); updateTimerBar();
      if (qcm) setTimeout(nextPuzzle, 1100);
      return;
    }
    if (game.useLives) {
      game.lives--; updateHud();
      if (game.lives <= 0) { setTimeout(() => endGame(false), 900); return; }
    }
    if (qcm) setTimeout(nextPuzzle, 1100);
  }

  function timeOut() {
    if (game.totalMode) return;
    if (game.examMode) { game.locked = true; audio.bad(); examRecord(null); return; }
    game.combo = 0; hideCombo(); game.attempts++; audio.bad(); game.locked = true;
    const fb = $("#feedback"); fb.textContent = `⏱ Temps écoulé ! C'était « ${game.current.name} »`; fb.className = "feedback bad";
    if (game.answerMode === "qcm") {
      (game.choiceBtns || []).forEach(b => { b.disabled = true; if (isCorrect(b.textContent)) b.classList.add("correct"); });
    } else {
      game.mask.forEach((m, i) => { const b = game.boxes[i]; if (b) { b.value = m.char; b.classList.add("wrong"); } });
    }
    if (game.useLives) {
      game.lives--; updateHud();
      if (game.lives <= 0) { setTimeout(() => endGame(false), 1300); return; }
    }
    setTimeout(nextPuzzle, 1500);
  }

  function showCombo() { const f = $("#comboFlag"); if (game.combo >= 2) { f.textContent = `🔥 Combo x${game.combo}`; f.classList.add("show"); } else hideCombo(); }
  function hideCombo() { $("#comboFlag").classList.remove("show"); }

  /* ---------- Progression ---------- */
  function nextPuzzle() {
    if (game.ended) return;
    game.index++;
    // Fin de la file
    if (game.mode !== "survie" && game.mode !== "zen" && game.index >= game.queue.length) {
      if (game.duo && game.duo.player === 1) { endDuoRun(); return; }
      endGame(true); return;
    }
    loadPuzzle();
  }

  function endDuoRun() {
    game.duo.scores[0] = game.score;
    $("#handoverTitle").textContent = `Au tour de ${game.duo.names[1]} !`;
    $("#handoverMsg").textContent = `${game.duo.names[0]} a marqué ${game.score} points. Passe l'appareil 😉`;
    screens.show("handover");
  }
  $("#handoverGo").addEventListener("click", () => {
    game.duo.player = 2;
    resetRunStats();
    game.jk = Object.assign({}, game.jkBase);
    game.queue = game.duo.queue;
    screens.show("play"); setupHud(); loadPuzzle();
  });

  /* ---------- Succès ---------- */
  function unlock(id) {
    if (store.data.achievements[id]) return;
    store.data.achievements[id] = true; store.save();
    const a = SAMSON_ACHIEVEMENTS.find(x => x.id === id); if (!a) return;
    const el = $("#achToast");
    el.innerHTML = `<span class="at-ico">${a.icon}</span><div><b>Succès débloqué !</b><span>${a.name} — ${a.desc}</span></div>`;
    el.classList.add("show"); audio.win(); popConfetti(40);
    setTimeout(() => el.classList.remove("show"), 3200);
  }
  function checkLiveAchievements() {
    if (game.maxCombo >= 5) unlock("combo5");
    if (game.maxCombo >= 10) unlock("combo10");
    if (game.mode === "survie" && game.correct >= 15) unlock("survivor");
  }

  /* ---------- Fin de partie ---------- */
  function endGame(finished) {
    if (game.ended) return; game.ended = true; stopTimer();

    // DUO : comparaison des deux joueurs
    if (game.duo) { game.duo.scores[1] = game.score; return showDuoResult(); }

    const acc = game.attempts ? Math.round(game.correct / game.attempts * 100) : 0;
    let stars = 0;
    if (game.mode === "parcours" || game.mode === "daily") {
      if (finished) stars = acc >= 90 ? 3 : acc >= 65 ? 2 : 1;
      else stars = game.correct >= game.queue.length / 2 ? 1 : 0;
    } else {
      stars = game.score >= 2500 ? 3 : game.score >= 1200 ? 2 : game.score >= 400 ? 1 : 0;
    }

    // --- Statistiques ---
    const d = store.data;
    d.gamesPlayed++; d.totalCorrect += game.correct; d.totalAttempts += game.attempts;
    d.totalScore += game.score; d.bestCombo = Math.max(d.bestCombo, game.maxCombo);
    const isNewBest = game.score > (d.best || 0); d.best = Math.max(d.best, game.score);
    Object.keys(game.solvedCats).forEach(c => d.categories[c] = (d.categories[c] || 0) + game.solvedCats[c]);
    const modeWasBest = game.score > (d.modeBest[game.mode] || 0);
    d.modeBest[game.mode] = Math.max(d.modeBest[game.mode] || 0, game.score);

    if (game.mode === "parcours") {
      const prev = d.tiers[game.tier.id] || { stars: 0, best: 0 };
      d.tiers[game.tier.id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, game.score) };
      d.totalStars = Object.values(d.tiers).reduce((s, t) => s + (t.stars || 0), 0);
      if (finished && stars === 3) unlock("perfect");
      if (finished && game.tier.id === "expert") unlock("expert");
    }
    if (game.mode === "survie") d.survieBest = Math.max(d.survieBest, game.correct);
    if (game.mode === "chrono") d.chronoBest = Math.max(d.chronoBest, game.correct);
    if (game.mode === "category" && finished) unlock("themed");
    if (game.mode === "culture" && finished) {
      unlock("scholar");
      if (!d.finishedDomains.includes(game.domain)) d.finishedDomains.push(game.domain);
      if (d.finishedDomains.length >= 3) unlock("polyglot");
    }
    if (game.mode === "daily" && finished) {
      unlock("daily");
      if (d.dailyDone !== todayStr()) {
        const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        d.dailyStreak = (d.lastDailyDate === y) ? d.dailyStreak + 1 : 1;
        d.lastDailyDate = todayStr(); d.dailyDone = todayStr();
        if (d.dailyStreak >= 3) unlock("streak3");
      }
    }
    if (finished) { d.wins++; unlock("first_win"); if (game.hintsUsedGame === 0) unlock("nohint"); }
    if (game.score >= 1000) unlock("score1000");
    if (game.score >= 5000) unlock("score5000");
    if (d.gamesPlayed >= 10) unlock("played10");

    // Classement
    if (game.score > 0) {
      d.leaderboard.push({ name: d.name || "Joueur", score: game.score, mode: game.mode, date: todayStr() });
      d.leaderboard.sort((a, b) => b.score - a.score); d.leaderboard = d.leaderboard.slice(0, 10);
    }
    // Points d'expérience
    gainXp(game.score / 10 + game.correct * 3);
    store.save(); refreshHome();

    // --- Affichage ---
    $("#res-score").textContent = game.score;
    $("#res-correct").textContent = (game.mode === "survie" || game.mode === "chrono") ? game.correct : `${game.correct}/${game.queue.length}`;
    $("#res-combo").textContent = "x" + game.maxCombo;
    $("#res-acc").textContent = acc + "%";
    $("#resultStars").textContent = "⭐".repeat(stars) + "☆".repeat(3 - stars);
    $("#newRecord").style.display = (isNewBest || modeWasBest) ? "block" : "none";

    let icon = "🎉", title = "Partie terminée !", msg = "Belle partie, continue à progresser !";
    if (!finished && game.useLives) { icon = "💥"; title = "Plus de vies !"; msg = "Ce n'est que partie remise. Réessaie !"; }
    else if (game.mode === "chrono") { icon = "⏱️"; title = "Temps écoulé !"; msg = `${game.correct} bonne(s) réponse(s) en 90 secondes !`; }
    else if (game.mode === "survie") { icon = "♾️"; title = "Fin de la survie"; msg = `Tu as tenu ${game.correct} énigme(s) !`; }
    else if (stars === 3) { icon = "🏆"; title = "Sans faute !"; msg = "Incroyable, Samson est fier de toi ! 🎉"; }
    $("#resultIcon").textContent = icon; $("#resultTitle").textContent = title; $("#resultMsg").textContent = msg;
    (finished || game.score > 0) ? audio.win() : audio.lose();
    if (finished || stars >= 2) popConfetti(stars === 3 ? 160 : 90);
    screens.show("result");
  }

  function showDuoResult() {
    const d = game.duo; store.data.gamesPlayed++;
    gainXp(Math.max(d.scores[0], d.scores[1]) / 10);
    store.save(); refreshHome();
    const [s1, s2] = d.scores; const win = s1 === s2 ? null : (s1 > s2 ? 0 : 1);
    $("#resultIcon").textContent = win === null ? "🤝" : "🏆";
    $("#resultTitle").textContent = win === null ? "Égalité !" : `${d.names[win]} gagne !`;
    $("#resultStars").textContent = `${d.names[0]} ${s1} — ${s2} ${d.names[1]}`;
    $("#resultMsg").textContent = win === null ? "Superbe duel, à refaire !" : "Bien joué au vainqueur 🎉";
    $("#res-score").textContent = Math.max(s1, s2);
    $("#res-correct").textContent = `${s1} vs ${s2}`;
    $("#res-combo").textContent = "—"; $("#res-acc").textContent = "—";
    $("#newRecord").style.display = "none";
    audio.win(); popConfetti(120); screens.show("result");
  }

  /* ---------- Partage ---------- */
  $("#shareBtn").addEventListener("click", async () => {
    let text;
    if (game.duo) text = `🧩 Samson — Duo\n${game.duo.names[0]} ${game.duo.scores[0]} — ${game.duo.scores[1]} ${game.duo.names[1]}`;
    else {
      const modeLabel = (SAMSON_MODES.find(m => m.id === game.mode) || {}).label || "Samson";
      text = `🧩 Samson — ${modeLabel}\nScore : ${game.score} · Combo x${game.maxCombo}\n${$("#resultStars").textContent}\nÀ toi de battre mon score !`;
    }
    try {
      if (navigator.share) { await navigator.share({ title: "Samson", text }); }
      else { await navigator.clipboard.writeText(text); toast("📋 Résultat copié !"); }
    } catch (e) {
      try { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("📋 Résultat copié !"); }
      catch (_) { toast("Partage indisponible"); }
    }
  });

  /* ---------- Statistiques ---------- */
  function showStats() {
    const d = store.data;
    const winRate = d.gamesPlayed ? Math.round(d.wins / d.gamesPlayed * 100) : 0;
    const acc = d.totalAttempts ? Math.round(d.totalCorrect / d.totalAttempts * 100) : 0;
    let favCat = "—", favN = 0; Object.entries(d.categories).forEach(([c, n]) => { if (n > favN) { favN = n; favCat = c; } });
    const rk = currentRank(d.xp || 0);
    $("#statsHello").textContent = `Salut ${d.name || "Joueur"} ! Voici ton bilan.`;
    $("#statsGrid").innerHTML = [
      ["Rang", `${rk.rank.icon} ${rk.rank.name}`], ["XP total", d.xp || 0],
      ["Parties", d.gamesPlayed], ["Meilleur score", d.best],
      ["Précision", acc + "%"], ["Combo record", "x" + d.bestCombo],
      ["Bonnes réponses", d.totalCorrect], ["Catégorie favorite", favCat]
    ].map(([l, v]) => `<div class="result-cell"><b>${v}</b><span>${l}</span></div>`).join("");
    const tiersHtml = SAMSON_TIERS.map(t => {
      const s = (d.tiers[t.id] || {}).stars || 0;
      return `<div class="mini-row"><span>${t.icon} ${t.label}</span><span class="stars">${"★".repeat(s)}${"☆".repeat(3 - s)}</span></div>`;
    }).join("");
    const modeHtml = SAMSON_MODES.filter(m => d.modeBest[m.id]).map(m =>
      `<div class="mini-row"><span>${m.icon} ${m.label}</span><span>${d.modeBest[m.id]} pts</span></div>`).join("");
    $("#statsTiers").innerHTML = tiersHtml + modeHtml;
    screens.show("stats");
  }

  /* ---------- Succès ---------- */
  function showAch() {
    const done = SAMSON_ACHIEVEMENTS.filter(a => store.data.achievements[a.id]).length;
    $("#achCount").textContent = done; $("#achTotal").textContent = SAMSON_ACHIEVEMENTS.length;
    $("#achList").innerHTML = SAMSON_ACHIEVEMENTS.map(a => {
      const got = store.data.achievements[a.id];
      return `<div class="ach-item ${got ? "" : "locked"}"><span class="a-ico">${a.icon}</span>
        <span class="a-meta"><h4>${a.name}</h4><p>${a.desc}</p></span>
        <span class="a-check">${got ? "✅" : "🔒"}</span></div>`;
    }).join("");
    screens.show("ach");
  }

  /* ---------- Classement ---------- */
  function showBoard() {
    const lb = store.data.leaderboard || [];
    $("#boardList").innerHTML = lb.length ? lb.map((e, i) => {
      const m = SAMSON_MODES.find(x => x.id === e.mode);
      return `<div class="board-row ${i === 0 ? "top1" : ""}"><span class="rank">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1)}</span>
        <span><b>${e.name}</b><br><span class="b-mode">${m ? m.icon + " " + m.label : e.mode} · ${e.date}</span></span>
        <span></span><span class="b-score">${e.score}</span></div>`;
    }).join("") : `<div class="board-empty">Aucun score encore. À toi de jouer ! 🎮</div>`;
    screens.show("board");
  }

  /* ---------- Réglages ---------- */
  function initSettings() {
    $("#setName").value = store.data.name || "";
    setSeg("segKbd", store.data.kbd); setSeg("segSound", store.data.sound ? "on" : "off"); setSeg("segAnim", store.data.anim ? "on" : "off");
    setSeg("segAnswer", store.data.answerMode || "letters");
  }
  function setSeg(id, val) { $$("#" + id + " button").forEach(b => b.classList.toggle("active", b.dataset.v === val)); }
  $("#setName").addEventListener("input", e => { store.data.name = e.target.value.trim() || "Joueur"; store.save(); });
  $("#segKbd").addEventListener("click", e => { if (e.target.dataset.v) { store.data.kbd = e.target.dataset.v; store.save(); setSeg("segKbd", e.target.dataset.v); buildKeyboard(); } });
  $("#segSound").addEventListener("click", e => { if (e.target.dataset.v) { store.data.sound = e.target.dataset.v === "on"; store.save(); applySound(); setSeg("segSound", e.target.dataset.v); } });
  $("#segAnim").addEventListener("click", e => { if (e.target.dataset.v) { store.data.anim = e.target.dataset.v === "on"; store.save(); applyAnim(); setSeg("segAnim", e.target.dataset.v); } });
  $("#segAnswer").addEventListener("click", e => { if (e.target.dataset.v) { store.data.answerMode = e.target.dataset.v; store.save(); setSeg("segAnswer", e.target.dataset.v); } });
  $("#resetBtn").addEventListener("click", async () => {
    const ok = await confirmAsk("Effacer toute ta progression (scores, succès, réglages) ?", "Effacer");
    if (ok) { store.reset(); location.reload(); }
  });

  /* ---------- Éditeur d'énigmes personnalisées ---------- */
  const QUICK_EMOJIS = ["🐉", "🍕", "🚀", "🎸", "🦄", "🍎", "⚽", "🌵", "🐧", "🎈", "🚗", "🌈", "🐱", "🍔", "🎃", "⚡", "🐢", "🌻", "🎁", "🔑"];
  function buildEmojiQuick() {
    const wrap = $("#emojiQuick"); wrap.innerHTML = "";
    QUICK_EMOJIS.forEach(e => { const b = document.createElement("button"); b.type = "button"; b.textContent = e; b.addEventListener("click", () => { $("#edEmoji").value = e; }); wrap.appendChild(b); });
  }
  function showEditor() { buildEmojiQuick(); renderCustomList(); screens.show("editor"); }
  function editorCat() { const a = $("#edCat button.active"); return a ? a.dataset.v : "objet"; }
  $("#edCat").addEventListener("click", e => { if (e.target.dataset.v) { $$("#edCat button").forEach(b => b.classList.toggle("active", b === e.target)); } });
  function renderCustomList() {
    const list = store.data.custom || [];
    $("#edCount").textContent = list.length;
    $("#edPlay").disabled = list.length === 0;
    $("#edList").innerHTML = list.length ? list.map(c =>
      `<div class="mini-row"><span>${c.emoji || "❓"} <b>${c.name}</b></span><button class="del-btn" data-del="${c.id}" title="Supprimer">🗑️</button></div>`
    ).join("") : `<div class="mini-empty">Aucune énigme pour l'instant. Ajoute-en une ci-dessus ! 🎨</div>`;
    $$("#edList .del-btn").forEach(b => b.addEventListener("click", () => {
      store.data.custom = store.data.custom.filter(x => x.id !== b.dataset.del); store.save(); renderCustomList();
    }));
  }
  $("#edAdd").addEventListener("click", () => {
    const name = $("#edName").value.trim();
    if (!/[a-zA-ZÀ-ÿ0-9]/.test(name)) { toast("Entre un mot valide 🙂"); $("#edName").focus(); return; }
    const puzzle = { id: "c" + Date.now(), name, hint: $("#edHint").value.trim(), category: editorCat(), emoji: ($("#edEmoji").value.trim() || "🖼️") };
    store.data.custom = store.data.custom || []; store.data.custom.push(puzzle); store.save();
    unlock("creator"); checkCollector(); audio.good();
    $("#edName").value = ""; $("#edHint").value = ""; $("#edEmoji").value = "🖼️";
    renderCustomList(); toast("✅ Énigme ajoutée !");
  });
  $("#edPlay").addEventListener("click", () => { audio.ensure(); startMode("custom"); });
  function checkCollector() { if ((store.data.custom || []).length >= 5) unlock("collector"); }

  /* Import / Export des packs d'énigmes */
  function copyText(text) {
    if (navigator.clipboard) return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) { try { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); return true; } catch (e) { return false; } }
  $("#edExport").addEventListener("click", () => {
    const list = store.data.custom || [];
    if (!list.length) { toast("Aucune énigme à exporter"); return; }
    const slim = list.map(c => ({ name: c.name, hint: c.hint, category: c.category, emoji: c.emoji }));
    const code = "SAMSON1:" + btoa(unescape(encodeURIComponent(JSON.stringify(slim))));
    copyText(code).then(() => toast("📤 Code copié dans le presse-papiers !"));
    modalAsk({ message: "Ton code de partage (copie-le pour l'envoyer à un ami) :", input: true, value: code, okText: "Fermer", hideCancel: true });
  });
  $("#edImport").addEventListener("click", async () => {
    const code = await modalAsk({ message: "Colle un code d'énigmes Samson :", input: true, placeholder: "SAMSON1:…", okText: "Importer" });
    if (!code) return;
    try {
      const raw = code.trim().replace(/^SAMSON1:/, "");
      const arr = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (!Array.isArray(arr)) throw new Error("format");
      let added = 0;
      arr.forEach(p => {
        if (p && p.name && /[a-zA-ZÀ-ÿ0-9]/.test(String(p.name))) {
          store.data.custom.push({
            id: "c" + Date.now() + Math.random().toString(36).slice(2, 6),
            name: String(p.name).slice(0, 20), hint: String(p.hint || "").slice(0, 60),
            category: ["objet", "animal", "nature"].includes(p.category) ? p.category : "objet",
            emoji: String(p.emoji || "🖼️").slice(0, 4)
          }); added++;
        }
      });
      store.save(); renderCustomList(); checkCollector();
      toast(added ? `📥 ${added} énigme(s) importée(s) !` : "Aucune énigme valide dans ce code");
      if (added) audio.good();
    } catch (e) { toast("Code invalide 😕"); }
  });

  /* ---------- Confetti ---------- */
  const confetti = (() => {
    const cv = $("#confetti"); const ctx = cv.getContext("2d"); let parts = [], raf = null;
    function resize() { cv.width = innerWidth; cv.height = innerHeight; }
    addEventListener("resize", resize); resize();
    const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#22c55e", "#38bdf8", "#f43f5e"];
    function burst(n) {
      if (!store.data.anim) return;
      for (let i = 0; i < n; i++) parts.push({ x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight / 3, vx: (Math.random() - .5) * 9, vy: Math.random() * -10 - 3, g: .28 + Math.random() * .1, s: 5 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, c: COLORS[Math.floor(Math.random() * COLORS.length)], life: 120 });
      if (!raf) loop();
    }
    function loop() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach(p => { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); ctx.restore(); });
      parts = parts.filter(p => p.life > 0 && p.y < cv.height + 30);
      if (parts.length) raf = requestAnimationFrame(loop); else { raf = null; ctx.clearRect(0, 0, cv.width, cv.height); }
    }
    return { burst };
  })();
  function popConfetti(n) { confetti.burst(n); }

  /* ---------- Navigation ---------- */
  $("#howBtn").addEventListener("click", () => screens.show("help"));
  $("#helpBack").addEventListener("click", () => { refreshHome(); screens.show("home"); });
  $("#backHome").addEventListener("click", () => { refreshHome(); screens.show("home"); });
  $("#statsBtn").addEventListener("click", showStats);
  $("#statsBack").addEventListener("click", () => screens.show("home"));
  $("#achBtn").addEventListener("click", showAch);
  $("#achBack").addEventListener("click", () => screens.show("home"));
  $("#boardBtn").addEventListener("click", showBoard);
  $("#boardBack").addEventListener("click", () => screens.show("home"));
  $("#setBtn").addEventListener("click", () => { initSettings(); screens.show("settings"); });
  $("#setBack").addEventListener("click", () => screens.show("home"));
  $("#catBack").addEventListener("click", () => screens.show("home"));
  $("#domainsBack").addEventListener("click", () => screens.show("home"));
  $("#examSetupBack").addEventListener("click", () => screens.show("home"));
  $("#examRetry").addEventListener("click", () => startExam(game.examDomain));
  $("#examOther").addEventListener("click", () => { buildExamGrid(); screens.show("exam"); });
  $("#examHome").addEventListener("click", () => { refreshHome(); buildModeGrid(); screens.show("home"); });
  $("#examShare").addEventListener("click", async () => {
    const text = `📝 Samson — Examen « ${examDomainLabel()} »\nMa note : ${$("#gradeNote").textContent}/20 — ${$("#bulletinTitle").textContent}\nÀ toi de faire mieux ! 🎓`;
    try { if (navigator.share) await navigator.share({ title: "Samson", text }); else { await copyText(text); toast("📋 Note copiée !"); } }
    catch (e) { try { await copyText(text); toast("📋 Note copiée !"); } catch (_) { toast("Partage indisponible"); } }
  });
  $("#edBack").addEventListener("click", () => { refreshHome(); buildModeGrid(); screens.show("home"); });
  $("#replayBtn").addEventListener("click", () => {
    if (game.duo) startMode("duo");
    else if (game.mode === "parcours") startMode("parcours", { tier: game.tier });
    else if (game.mode === "category") startMode("category", { category: game.catFilter });
    else if (game.mode === "culture") startMode("culture", { domain: game.domain });
    else startMode(game.mode);
  });
  $("#homeBtn").addEventListener("click", () => { refreshHome(); buildModeGrid(); screens.show("home"); });
  $("#quitBtn").addEventListener("click", async () => {
    const ok = await confirmAsk("Quitter la partie en cours ?", "Quitter");
    if (!ok) return;
    if (game.mode === "zen" && !game.ended && game.correct > 0) { endGame(true); return; }
    game.ended = true; stopTimer(); refreshHome(); buildModeGrid(); screens.show("home");
  });

  /* ---------- PWA (installation / hors-ligne) ---------- */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.protocol === "http:")) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  /* ---------- Debug (tests automatisés) ---------- */
  window.SAMSON_DEBUG = { answer: () => (game.current ? game.current.name : null), state: () => ({ score: game.score, index: game.index, lives: game.lives, correct: game.correct, mode: game.mode }), start: (m, o) => startMode(m, o), exam: (d) => startExam(d) };

  /* ---------- Init ---------- */
  buildKeyboard(); buildModeGrid(); refreshHome();
  console.log("%c🧩 Samson prêt à jouer !", "color:#6366f1;font-weight:bold;font-size:14px");
})();
