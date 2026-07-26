/* =============================================================================
   Amoura — messagerie temps réel (chat, frappe, accusés, vocal, images)
   ========================================================================== */
(function () {
  "use strict";
  const pane = document.getElementById("chatPane");
  if (!pane) return;

  const conversationId = Number(pane.dataset.conversationId);
  const otherId = Number(pane.dataset.otherId);
  const meId = Number(pane.dataset.meId);
  const scroll = document.getElementById("chatScroll");
  const input = document.getElementById("chatInput");
  const typing = document.getElementById("typingIndicator");
  let lastSeenId = 0, typingTimer = null;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtTime = (dt) => new Date((dt || "").replace(" ", "T")).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  /* ---- Rendu d'un message ---- */
  function bubble(m) {
    const mine = Number(m.sender_id) === meId;
    const el = document.createElement("div");
    el.className = "bubble " + (mine ? "me" : "them");
    el.dataset.id = m.id;

    if (m.type === "voice") {
      el.appendChild(voiceWidget(m));
    } else if (m.type === "image") {
      const src = m.media_path.startsWith("/") ? m.media_path : "/uploads/" + m.media_path;
      const thumb = (m.media_meta && m.media_meta.thumb) || src;
      el.innerHTML = `<img src="${esc(thumb)}" data-lightbox data-full="${esc(src)}" alt="image" style="max-width:220px">`;
    } else {
      el.innerHTML = esc(m.body).replace(/\n/g, "<br>");
    }
    const ticks = mine ? `<span class="ticks${m.read_at ? " read" : ""}">${m.read_at ? "✓✓" : (m.delivered_at ? "✓✓" : "✓")}</span>` : "";
    const time = document.createElement("span");
    time.className = "time";
    time.innerHTML = fmtTime(m.created_at) + ticks;
    el.appendChild(time);
    return el;
  }

  /* ---- Widget vocal avec waveform ---- */
  function voiceWidget(m) {
    const wrap = document.createElement("div");
    wrap.className = "voice-msg";
    const meta = m.media_meta || {};
    const src = m.media_path.startsWith("/") ? m.media_path : "/uploads/" + m.media_path;
    const audio = new Audio(src);
    const btn = document.createElement("button");
    btn.className = "play"; btn.innerHTML = "▶";
    const wf = document.createElement("div");
    wf.className = "waveform";
    const bars = (meta.waveform && meta.waveform.length ? meta.waveform : Array.from({ length: 30 }, () => Math.random()));
    bars.forEach((v) => {
      const b = document.createElement("span");
      b.className = "wf-bar";
      b.style.height = Math.max(4, Math.min(30, v * 30)) + "px";
      wf.appendChild(b);
    });
    const dur = document.createElement("span");
    dur.className = "time"; dur.textContent = meta.duration ? Math.round(meta.duration) + "s" : "";
    btn.addEventListener("click", () => {
      if (audio.paused) { audio.play(); btn.innerHTML = "❚❚"; } else { audio.pause(); btn.innerHTML = "▶"; }
    });
    audio.addEventListener("timeupdate", () => {
      const ratio = audio.currentTime / (audio.duration || 1);
      const played = Math.floor(ratio * wf.children.length);
      [...wf.children].forEach((b, i) => b.classList.toggle("played", i <= played));
    });
    audio.addEventListener("ended", () => { btn.innerHTML = "▶"; });
    wrap.append(btn, wf, dur);
    return wrap;
  }

  function append(m, scrollDown = true) {
    scroll.appendChild(bubble(m));
    if (Number(m.id) > lastSeenId) lastSeenId = Number(m.id);
    if (scrollDown) scroll.scrollTop = scroll.scrollHeight;
  }

  /* ---- Chargement de l'historique initial ---- */
  [...scroll.querySelectorAll("[data-id]")].forEach((el) => {
    const id = Number(el.dataset.id); if (id > lastSeenId) lastSeenId = id;
  });
  scroll.scrollTop = scroll.scrollHeight;
  markRead();

  /* ---- Envoi texte ---- */
  const form = document.getElementById("chatForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) return;
    input.value = "";
    try {
      const res = await Api.post(`/api/conversations/${conversationId}/messages`, { body });
      append(res.message);
      Amoura.Realtime.emit("message", { to: otherId, conversation_id: conversationId, message: res.message });
    } catch (err) { Amoura.toast(err.message); }
  });

  /* ---- Indicateur de frappe ---- */
  input.addEventListener("input", () => {
    Amoura.Realtime.emit("typing", { to: otherId, conversation_id: conversationId, state: "start" });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() =>
      Amoura.Realtime.emit("typing", { to: otherId, conversation_id: conversationId, state: "stop" }), 1500);
  });

  /* ---- Réception temps réel ---- */
  Amoura.Realtime.on("message", (d) => {
    if (Number(d.conversation_id) !== conversationId) return;
    append(d.message);
    markRead();
    Amoura.Realtime.emit("read", { to: otherId, conversation_id: conversationId, last_message_id: lastSeenId });
  });
  Amoura.Realtime.on("typing", (d) => {
    if (Number(d.conversation_id) !== conversationId) return;
    typing.classList.toggle("show", d.state === "start");
    if (d.state === "start") scroll.scrollTop = scroll.scrollHeight;
  });
  Amoura.Realtime.on("read", (d) => {
    if (Number(d.conversation_id) !== conversationId) return;
    scroll.querySelectorAll(".bubble.me .ticks").forEach((t) => t.classList.add("read"));
  });

  async function markRead() {
    if (!lastSeenId) return;
    try { await Api.post(`/api/conversations/${conversationId}/read`, { last_message_id: lastSeenId }); } catch (_) {}
    Amoura.Realtime.emit("read", { to: otherId, conversation_id: conversationId, last_message_id: lastSeenId });
  }

  /* ---- Envoi d'image ---- */
  const imageInput = document.getElementById("chatImage");
  if (imageInput) {
    imageInput.addEventListener("change", async () => {
      if (!imageInput.files[0]) return;
      const fd = new FormData(); fd.append("image", imageInput.files[0]);
      try {
        const res = await Api.upload(`/api/conversations/${conversationId}/image`, fd);
        append(res.message);
        Amoura.Realtime.emit("message", { to: otherId, conversation_id: conversationId, message: res.message });
      } catch (e) { Amoura.toast(e.message); }
      imageInput.value = "";
    });
  }

  /* ---- Enregistrement d'un message vocal (MediaRecorder + waveform) ---- */
  const recordBtn = document.getElementById("recordBtn");
  if (recordBtn && navigator.mediaDevices) {
    let recorder = null, chunks = [], stream = null, amplitudes = [], audioCtx = null, raf = null;

    async function startRec() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      chunks = []; amplitudes = [];
      // Analyse d'amplitude pour la waveform.
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser(); analyser.fftSize = 256;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const sample = () => {
        analyser.getByteFrequencyData(buf);
        amplitudes.push(buf.reduce((a, b) => a + b, 0) / buf.length / 255);
        raf = requestAnimationFrame(sample);
      };
      sample();
      const started = Date.now();
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        cancelAnimationFrame(raf); audioCtx.close(); stream.getTracks().forEach((t) => t.stop());
        const duration = (Date.now() - started) / 1000;
        const blob = new Blob(chunks, { type: "audio/webm" });
        // Réduit la waveform à ~40 barres.
        const step = Math.max(1, Math.floor(amplitudes.length / 40));
        const wf = []; for (let i = 0; i < amplitudes.length; i += step) wf.push(Number(amplitudes[i].toFixed(2)));
        const fd = new FormData();
        fd.append("audio", blob, "voice.webm");
        fd.append("meta", JSON.stringify({ duration, waveform: wf }));
        try {
          const res = await Api.upload(`/api/conversations/${conversationId}/voice`, fd);
          append(res.message);
          Amoura.Realtime.emit("message", { to: otherId, conversation_id: conversationId, message: res.message });
        } catch (e) { Amoura.toast(e.message); }
      };
      recorder.start();
      recordBtn.classList.add("recording"); recordBtn.textContent = "⏺";
    }
    function stopRec() {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recordBtn.classList.remove("recording"); recordBtn.textContent = "🎤";
    }
    recordBtn.addEventListener("click", () => {
      if (recorder && recorder.state === "recording") stopRec();
      else startRec().catch(() => Amoura.toast("Micro indisponible."));
    });
  }
})();
