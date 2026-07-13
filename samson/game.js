/* =============================================================
   SAMSON — Logique du jeu
   ============================================================= */
(function () {
  "use strict";

  /* ---------- Utilitaires ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Normalise pour comparer : minuscules, sans accents, sans espaces superflus
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  /* ---------- Stockage local ---------- */
  const STORE_KEY = "samson.save.v1";
  const store = {
    data: { best: 0, totalStars: 0, bestStreak: 0, tiers: {}, sound: true, theme: "light" },
    load() { try { const r = JSON.parse(localStorage.getItem(STORE_KEY)); if (r) this.data = Object.assign(this.data, r); } catch (e) {} },
    save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); } catch (e) {} }
  };
  store.load();

  /* ---------- Audio (Web Audio API, sons générés) ---------- */
  const audio = {
    ctx: null, on: store.data.sound,
    ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } },
    beep(freq, dur = 0.12, type = "sine", vol = 0.15) {
      if (!this.on) return; this.ensure(); if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
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
    key() { this.beep(520, .03, "square", .04); }
  };

  /* ---------- Écrans ---------- */
  const screens = {
    show(id) {
      $$(".screen").forEach(s => s.classList.remove("active"));
      $("#screen-" + id).classList.add("active");
    }
  };

  /* ---------- Toast ---------- */
  let toastT;
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1900);
  }

  /* ---------- Thème & son ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    $("#themeBtn").textContent = t === "dark" ? "☀️" : "🌙";
    store.data.theme = t; store.save();
  }
  applyTheme(store.data.theme || "light");
  $("#themeBtn").addEventListener("click", () => applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));

  function applySound() { audio.on = store.data.sound; $("#soundBtn").textContent = audio.on ? "🔊" : "🔇"; }
  applySound();
  $("#soundBtn").addEventListener("click", () => { store.data.sound = !store.data.sound; store.save(); applySound(); if (audio.on) audio.key(); });

  /* ---------- État de la partie ---------- */
  const game = {
    tier: null, queue: [], index: 0, score: 0, lives: 3,
    combo: 0, maxCombo: 0, correct: 0, attempts: 0, revealed: 0,
    hintsLeft: 0, timer: null, timeLeft: 0, timeMax: 0, current: null, mask: [], boxes: []
  };

  /* ---------- Accueil : stats ---------- */
  function refreshHome() {
    $("#home-best").textContent = store.data.best;
    $("#home-stars").textContent = store.data.totalStars;
    $("#home-streak").textContent = store.data.bestStreak;
  }
  refreshHome();

  /* ---------- Choix de niveau ---------- */
  function buildTierGrid() {
    const grid = $("#tierGrid"); grid.innerHTML = "";
    SAMSON_TIERS.forEach(tier => {
      const saved = store.data.tiers[tier.id] || {};
      const stars = saved.stars || 0;
      const card = document.createElement("button");
      card.className = "tier-card"; card.type = "button";
      card.innerHTML = `
        <span class="bar" style="background:${tier.color}"></span>
        <span class="tier-icon">${tier.icon}</span>
        <span class="tier-meta">
          <h3>${tier.label}</h3>
          <p>${tier.time}s · ${tier.hints} indice(s) · ${Math.round(tier.revealRatio * 100)}% offert</p>
          <span class="tier-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)} ${saved.best ? "· record " + saved.best : ""}</span>
        </span>`;
      card.addEventListener("click", () => startGame(tier));
      grid.appendChild(card);
    });
  }

  /* ---------- Démarrage d'une partie ---------- */
  function startGame(tier) {
    game.tier = tier;
    let pool = SAMSON_PUZZLES.slice(tier.range[0], tier.range[1]);
    if (tier.shuffleAll) pool = SAMSON_PUZZLES.slice();
    game.queue = shuffle(pool);
    game.index = 0; game.score = 0; game.lives = 3; game.combo = 0; game.maxCombo = 0;
    game.correct = 0; game.attempts = 0; game.hintsLeft = tier.hints;
    screens.show("play");
    loadPuzzle();
  }

  /* ---------- Construction du masque de lettres ---------- */
  function buildMask(name, ratio) {
    // positions des lettres alphanumériques
    const chars = [...name];
    const letterIdx = chars.map((c, i) => /[a-zA-ZÀ-ÿ0-9]/.test(c) ? i : -1).filter(i => i >= 0);
    const revealCount = Math.floor(letterIdx.length * ratio);
    const toReveal = new Set(shuffle(letterIdx).slice(0, revealCount));
    return chars.map((c, i) => ({
      char: c,
      isLetter: /[a-zA-ZÀ-ÿ0-9]/.test(c),
      given: /[a-zA-ZÀ-ÿ0-9]/.test(c) ? toReveal.has(i) : true // séparateurs = donnés
    }));
  }

  /* ---------- Chargement d'une énigme ---------- */
  function loadPuzzle() {
    const p = game.queue[game.index];
    game.current = p;
    game.revealed = 0;

    $("#hud-level").textContent = `${game.index + 1}/${game.queue.length}`;
    $("#hud-score").textContent = game.score;
    $("#hud-lives").textContent = "❤️".repeat(game.lives) + "🖤".repeat(3 - game.lives);
    $("#hintCount").textContent = game.hintsLeft;
    $("#hintBtn").disabled = game.hintsLeft <= 0;
    $("#catTag").textContent = p.category || "objet";
    $("#imgHolder").innerHTML = p.svg;
    const ht = $("#hintText"); ht.textContent = "💡 " + (p.hint || ""); ht.classList.remove("show");
    $("#feedback").textContent = ""; $("#feedback").className = "feedback";

    game.mask = buildMask(p.name, game.tier.revealRatio);
    renderBoxes();
    startTimer();
    focusFirstEmpty();
  }

  /* ---------- Rendu des cases lettres ---------- */
  function renderBoxes() {
    const wrap = $("#answerBoxes"); wrap.innerHTML = ""; game.boxes = [];
    let group = document.createElement("div"); group.className = "word-group";

    game.mask.forEach((m, i) => {
      if (!m.isLetter && (m.char === " ")) {
        // espace = fin de groupe visuel
        wrap.appendChild(group);
        const sp = document.createElement("div"); sp.className = "sep"; sp.textContent = "·"; wrap.appendChild(sp);
        group = document.createElement("div"); group.className = "word-group";
        game.boxes.push(null);
        return;
      }
      if (!m.isLetter) {
        // séparateur type tiret / apostrophe
        const sp = document.createElement("div"); sp.className = "sep"; sp.textContent = m.char; group.appendChild(sp);
        game.boxes.push(null);
        return;
      }
      const inp = document.createElement("input");
      inp.className = "letter-box"; inp.maxLength = 1; inp.dataset.i = i;
      inp.setAttribute("aria-label", "lettre " + (i + 1));
      inp.autocapitalize = "characters"; inp.inputMode = "text";
      if (m.given) { inp.value = m.char; inp.classList.add("given"); inp.readOnly = true; inp.tabIndex = -1; }
      else { inp.addEventListener("input", onLetterInput); inp.addEventListener("keydown", onLetterKey); }
      group.appendChild(inp);
      game.boxes.push(inp);
    });
    wrap.appendChild(group);
  }

  function editableBoxes() { return game.boxes.filter(b => b && !b.readOnly); }

  function focusFirstEmpty() {
    const b = editableBoxes().find(x => !x.value) || editableBoxes()[0];
    if (b) b.focus();
  }

  function onLetterInput(e) {
    const box = e.target;
    box.value = box.value.replace(/[^a-zA-ZÀ-ÿ0-9]/g, "").slice(0, 1);
    if (box.value) { box.classList.add("filled"); audio.key(); nextBox(box); }
    else box.classList.remove("filled");
  }
  function onLetterKey(e) {
    const box = e.target;
    if (e.key === "Backspace" && !box.value) { e.preventDefault(); prevBox(box); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); prevBox(box); }
    else if (e.key === "ArrowRight") { e.preventDefault(); nextBox(box); }
    else if (e.key === "Enter") { e.preventDefault(); submit(); }
  }
  function nextBox(box) {
    const list = editableBoxes(); const idx = list.indexOf(box);
    for (let i = idx + 1; i < list.length; i++) { list[i].focus(); return; }
  }
  function prevBox(box) {
    const list = editableBoxes(); const idx = list.indexOf(box);
    for (let i = idx - 1; i >= 0; i--) { list[i].value = ""; list[i].classList.remove("filled"); list[i].focus(); return; }
  }

  /* ---------- Timer ---------- */
  function startTimer() {
    stopTimer();
    game.timeMax = game.tier.time; game.timeLeft = game.tier.time;
    updateTimerBar();
    game.timer = setInterval(() => {
      game.timeLeft--;
      updateTimerBar();
      if (game.timeLeft <= 5 && game.timeLeft > 0) audio.tick();
      if (game.timeLeft <= 0) { stopTimer(); timeOut(); }
    }, 1000);
  }
  function stopTimer() { if (game.timer) { clearInterval(game.timer); game.timer = null; } }
  function updateTimerBar() {
    const bar = $("#timerBar");
    const pct = clamp(game.timeLeft / game.timeMax * 100, 0, 100);
    bar.style.width = pct + "%";
    bar.classList.toggle("low", pct < 30);
  }

  /* ---------- Indice ---------- */
  $("#hintBtn").addEventListener("click", () => {
    if (game.hintsLeft <= 0) return;
    // révèle la première case éditable vide, sinon montre l'indice texte
    const empty = editableBoxes().find(b => !b.value);
    game.hintsLeft--; $("#hintCount").textContent = game.hintsLeft; $("#hintBtn").disabled = game.hintsLeft <= 0;
    game.revealed++;
    if (empty) {
      const i = +empty.dataset.i;
      empty.value = game.mask[i].char; empty.classList.add("filled");
      empty.style.animation = "pop .3s";
      toast("💡 Une lettre révélée !");
    } else {
      $("#hintText").classList.add("show");
      toast("💡 Voici un indice");
    }
    audio.beep(500, .1, "sine");
  });

  /* ---------- Clavier virtuel ---------- */
  function buildKeyboard() {
    const rows = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];
    const kb = $("#keyboard"); kb.innerHTML = "";
    rows.forEach(r => {
      const row = document.createElement("div"); row.className = "kbd-row";
      [...r].forEach(ch => {
        const k = document.createElement("button"); k.type = "button"; k.className = "key"; k.textContent = ch;
        k.addEventListener("click", () => typeChar(ch));
        row.appendChild(k);
      });
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
    if (!box || !box.classList || !box.classList.contains("letter-box") || box.readOnly || box.value)
      box = editableBoxes().find(b => !b.value);
    if (!box) return;
    box.value = ch; box.classList.add("filled"); audio.key(); nextBox(box);
  }
  $("#kbdToggle").addEventListener("click", () => {
    const kb = $("#keyboard"); const show = kb.style.display === "none";
    kb.style.display = show ? "grid" : "none";
    $("#kbdToggle").textContent = show ? "⌨️ Masquer le clavier" : "⌨️ Afficher le clavier";
  });
  buildKeyboard();

  /* ---------- Validation ---------- */
  $("#answerForm").addEventListener("submit", e => { e.preventDefault(); submit(); });
  $("#submitBtn").addEventListener("click", submit);

  function currentGuess() {
    return game.mask.map((m, i) => {
      if (!m.isLetter) return m.char;
      const box = game.boxes[i];
      return box ? (box.value || " ") : m.char;
    }).join("");
  }

  function isCorrect(guess) {
    const answers = [game.current.name, ...(game.current.alias || [])].map(norm);
    return answers.includes(norm(guess));
  }

  function submit() {
    if (!game.current) return;
    const empty = editableBoxes().find(b => !b.value);
    if (empty) { toast("Complète toutes les cases !"); empty.focus(); shakeBoxes(); return; }
    game.attempts++;
    const guess = currentGuess();
    if (isCorrect(guess)) onCorrect();
    else onWrong();
  }

  function shakeBoxes() {
    editableBoxes().forEach(b => { b.classList.remove("wrong"); void b.offsetWidth; b.classList.add("wrong"); });
    setTimeout(() => editableBoxes().forEach(b => b.classList.remove("wrong")), 450);
  }

  function onCorrect() {
    stopTimer();
    game.correct++;
    game.combo++;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    // Calcul du score : base + bonus temps + bonus combo - coût indices
    const timeBonus = Math.round(game.timeLeft * 4);
    const comboMult = 1 + (game.combo - 1) * 0.25;
    const hintPenalty = game.revealed * 25;
    const gained = Math.max(20, Math.round((100 + timeBonus) * comboMult) - hintPenalty);
    game.score += gained;

    $("#hud-score").textContent = game.score;
    game.boxes.forEach(b => { if (b) b.classList.add("correct"); });
    const fb = $("#feedback"); fb.textContent = `✔ Bravo ! +${gained} points`; fb.className = "feedback good";
    showCombo();
    audio.good();
    if (game.combo >= 3) popConfetti(28);

    setTimeout(nextPuzzle, 1100);
  }

  function onWrong() {
    game.combo = 0; hideCombo();
    game.lives--;
    $("#hud-lives").textContent = "❤️".repeat(Math.max(0, game.lives)) + "🖤".repeat(3 - Math.max(0, game.lives));
    shakeBoxes(); audio.bad();
    const fb = $("#feedback"); fb.textContent = "✘ Raté, réessaie !"; fb.className = "feedback bad";
    if (game.lives <= 0) { setTimeout(() => endGame(false), 700); }
  }

  function timeOut() {
    game.combo = 0; hideCombo(); game.lives--; game.attempts++;
    $("#hud-lives").textContent = "❤️".repeat(Math.max(0, game.lives)) + "🖤".repeat(3 - Math.max(0, game.lives));
    audio.bad();
    const fb = $("#feedback"); fb.textContent = `⏱ Temps écoulé ! C'était « ${game.current.name} »`; fb.className = "feedback bad";
    // révèle la réponse
    game.mask.forEach((m, i) => { const b = game.boxes[i]; if (b) { b.value = m.char; b.classList.add("wrong"); } });
    if (game.lives <= 0) setTimeout(() => endGame(false), 1300);
    else setTimeout(nextPuzzle, 1500);
  }

  /* ---------- Combo UI ---------- */
  function showCombo() {
    const f = $("#comboFlag");
    if (game.combo >= 2) { f.textContent = `🔥 Combo x${game.combo}`; f.classList.add("show"); }
    else hideCombo();
  }
  function hideCombo() { $("#comboFlag").classList.remove("show"); }

  /* ---------- Progression ---------- */
  $("#skipBtn").addEventListener("click", () => {
    game.combo = 0; hideCombo();
    toast("Question passée");
    nextPuzzle();
  });

  function nextPuzzle() {
    game.index++;
    if (game.index >= game.queue.length) { endGame(true); return; }
    loadPuzzle();
  }

  /* ---------- Fin de partie ---------- */
  function endGame(finished) {
    stopTimer();
    const acc = game.attempts ? Math.round(game.correct / game.attempts * 100) : 0;
    // Étoiles : basé sur précision + complétion
    let stars = 0;
    if (finished) {
      if (acc >= 90) stars = 3; else if (acc >= 65) stars = 2; else stars = 1;
    } else {
      stars = game.correct >= game.queue.length / 2 ? 1 : 0;
    }

    // Sauvegarde
    const tid = game.tier.id;
    const prev = store.data.tiers[tid] || { stars: 0, best: 0 };
    store.data.tiers[tid] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, game.score) };
    store.data.best = Math.max(store.data.best, game.score);
    store.data.bestStreak = Math.max(store.data.bestStreak, game.maxCombo);
    store.data.totalStars = Object.values(store.data.tiers).reduce((s, t) => s + (t.stars || 0), 0);
    store.save();
    refreshHome();

    // UI résultats
    $("#res-score").textContent = game.score;
    $("#res-correct").textContent = `${game.correct}/${game.queue.length}`;
    $("#res-combo").textContent = "x" + game.maxCombo;
    $("#res-acc").textContent = acc + "%";
    $("#resultStars").textContent = "⭐".repeat(stars) + "☆".repeat(3 - stars);

    if (finished && stars === 3) {
      $("#resultIcon").textContent = "🏆"; $("#resultTitle").textContent = "Parcours parfait !";
      $("#resultMsg").textContent = "Incroyable, Samson est fier de toi ! 🎉"; audio.win(); popConfetti(160);
    } else if (finished) {
      $("#resultIcon").textContent = "🎉"; $("#resultTitle").textContent = "Parcours terminé !";
      $("#resultMsg").textContent = "Belle partie, continue à progresser !"; audio.win(); popConfetti(90);
    } else {
      $("#resultIcon").textContent = "💥"; $("#resultTitle").textContent = "Plus de vies !";
      $("#resultMsg").textContent = "Ce n'est que partie remise. Réessaie !"; audio.lose();
    }
    screens.show("result");
  }

  /* ---------- Confetti ---------- */
  const confetti = (() => {
    const cv = $("#confetti"); const ctx = cv.getContext("2d");
    let parts = [], raf = null;
    function resize() { cv.width = innerWidth; cv.height = innerHeight; }
    addEventListener("resize", resize); resize();
    const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#22c55e", "#38bdf8", "#f43f5e"];
    function burst(n) {
      for (let i = 0; i < n; i++) parts.push({
        x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight / 3,
        vx: (Math.random() - .5) * 9, vy: Math.random() * -10 - 3,
        g: .28 + Math.random() * .1, s: 5 + Math.random() * 7,
        rot: Math.random() * 6, vr: (Math.random() - .5) * .3,
        c: COLORS[Math.floor(Math.random() * COLORS.length)], life: 120
      });
      if (!raf) loop();
    }
    function loop() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach(p => {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); ctx.restore();
      });
      parts = parts.filter(p => p.life > 0 && p.y < cv.height + 30);
      if (parts.length) raf = requestAnimationFrame(loop); else { raf = null; ctx.clearRect(0, 0, cv.width, cv.height); }
    }
    return { burst };
  })();
  function popConfetti(n) { confetti.burst(n); }

  /* ---------- Navigation ---------- */
  $("#playBtn").addEventListener("click", () => { audio.ensure(); buildTierGrid(); screens.show("levels"); });
  $("#howBtn").addEventListener("click", () => screens.show("help"));
  $("#helpBack").addEventListener("click", () => { buildTierGrid(); screens.show("levels"); });
  $("#backHome").addEventListener("click", () => { refreshHome(); screens.show("home"); });
  $("#replayBtn").addEventListener("click", () => startGame(game.tier));
  $("#otherBtn").addEventListener("click", () => { buildTierGrid(); screens.show("levels"); });
  $("#homeBtn").addEventListener("click", () => { refreshHome(); screens.show("home"); });
  $("#quitBtn").addEventListener("click", () => {
    if (confirm("Quitter la partie en cours ?")) { stopTimer(); refreshHome(); screens.show("home"); }
  });

  // Empêche le zoom involontaire sur double-tap des boutons mobiles / focus initial
  window.addEventListener("keydown", e => { if (e.key === "Enter" && $("#screen-play").classList.contains("active")) { /* géré par les cases */ } });

  // Petit accesseur de debug (utile pour les tests automatisés, sans effet sur le jeu)
  window.SAMSON_DEBUG = { answer: () => (game.current ? game.current.name : null), state: () => ({ score: game.score, index: game.index, lives: game.lives }) };

  console.log("%c🧩 Samson prêt à jouer !", "color:#6366f1;font-weight:bold;font-size:14px");
})();
