/* =============================================================================
   Amoura — social : fil de publications + statuts (stories)
   ========================================================================== */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ======================= FIL DE PUBLICATIONS ======================= */
  const feedEl = document.getElementById("feed");
  if (feedEl) {
    const meId = Number(document.body.dataset.userId || 0);
    let loading = false, done = false, before = 0;

    function heartIcon(filled) {
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`;
    }

    function postCard(p) {
      const media = (p.media || []);
      const mediaHtml = media.length
        ? `<div class="post-media n${media.length}">` + media.map((m) =>
            `<img src="${esc(m.thumb_url)}" data-lightbox data-full="${esc(m.url)}" loading="lazy" alt="">`).join("") + "</div>"
        : "";
      const el = document.createElement("article");
      el.className = "card post-card";
      el.dataset.id = p.id;
      el.innerHTML = `
        <div class="post-head">
          <img class="avatar avatar-md" src="${esc(p.avatar)}" alt="">
          <div><div style="font-weight:700">${esc(p.display_name)}
            ${Number(p.is_verified) ? '<span class="badge badge-verified">✓</span>' : ""}</div>
            <div class="subtle" style="font-size:.8rem">${esc(p.ago)}</div></div>
          ${Number(p.user_id) === meId ? '<button class="btn btn-sm btn-ghost" data-del style="margin-left:auto">Supprimer</button>' : ""}
        </div>
        <div class="post-body">${p.body || ""}</div>
        ${mediaHtml}
        <div class="post-actions">
          <span class="post-action like-btn ${p.liked ? "liked" : ""}" data-like>${heartIcon(p.liked)} <span data-like-count>${p.like_count}</span></span>
          <span class="post-action" data-comment-toggle>💬 <span>${p.comment_count}</span></span>
        </div>
        <div class="comments" hidden></div>`;

      el.querySelector("[data-like]").addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        try {
          const res = await Api.post(`/api/posts/${p.id}/like`);
          btn.classList.toggle("liked", res.liked);
          btn.querySelector("[data-like-count]").textContent = res.like_count;
          btn.querySelector("svg").setAttribute("fill", res.liked ? "currentColor" : "none");
          if (res.liked) btn.classList.add("heart-pop");
          setTimeout(() => btn.classList.remove("heart-pop"), 300);
        } catch (err) { Amoura.toast(err.message); }
      });
      el.querySelector("[data-comment-toggle]").addEventListener("click", () => toggleComments(el, p.id));
      const del = el.querySelector("[data-del]");
      if (del) del.addEventListener("click", async () => {
        if (!confirm("Supprimer cette publication ?")) return;
        await Api.del(`/api/posts/${p.id}`); el.remove();
      });
      return el;
    }

    async function toggleComments(el, postId) {
      const box = el.querySelector(".comments");
      box.hidden = !box.hidden;
      if (box.hidden || box.dataset.loaded) return;
      const res = await Api.get(`/api/posts/${postId}/comments`);
      box.innerHTML = res.comments.map((c) => `
        <div class="row" style="align-items:flex-start;margin-top:10px">
          <img class="avatar avatar-sm" src="${esc(c.avatar)}" alt="">
          <div class="grow"><b>${esc(c.display_name)}</b> ${esc(c.body)}
            <div class="subtle" style="font-size:.75rem">${esc(c.ago)}</div></div>
        </div>`).join("") +
        `<form class="row" style="margin-top:12px" data-comment-form>
           <input class="input" name="body" placeholder="Écrire un commentaire…" maxlength="1500" required>
           <button class="btn btn-primary btn-sm">Envoyer</button></form>`;
      box.dataset.loaded = "1";
      box.querySelector("[data-comment-form]").addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = e.target.body.value.trim(); if (!body) return;
        await Api.post(`/api/posts/${postId}/comments`, { body });
        box.dataset.loaded = ""; box.hidden = true; toggleComments(el, postId);
      });
    }

    async function loadMore() {
      if (loading || done) return; loading = true;
      try {
        const res = await Api.get("/api/feed" + (before ? "?before=" + before : ""));
        if (!res.posts.length) { done = true; }
        res.posts.forEach((p) => { feedEl.appendChild(postCard(p)); before = p.id; });
      } catch (e) { Amoura.toast(e.message); }
      loading = false;
    }

    // Composer.
    const composer = document.getElementById("postComposer");
    if (composer) composer.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(composer);
      try {
        await Api.upload("/api/posts", fd);
        composer.reset();
        const preview = document.getElementById("composerPreview"); if (preview) preview.innerHTML = "";
        feedEl.innerHTML = ""; before = 0; done = false; loadMore();
        Amoura.toast("Publié !");
      } catch (err) { Amoura.toast(err.message); }
    });

    // Scroll infini.
    window.addEventListener("scroll", () => {
      if (window.innerHeight + window.scrollY > document.body.offsetHeight - 400) loadMore();
    });
    loadMore();
  }

  /* ============================== STORIES ============================== */
  const storiesBar = document.getElementById("storiesBar");
  if (storiesBar) {
    let groups = [];

    async function loadStories() {
      try {
        const res = await Api.get("/api/stories");
        groups = res.groups || [];
        renderBar();
      } catch (_) {}
    }
    function renderBar() {
      const add = storiesBar.querySelector(".story-add-item");
      storiesBar.querySelectorAll(".story-item.group").forEach((n) => n.remove());
      groups.forEach((g, gi) => {
        const item = document.createElement("div");
        item.className = "story-item group";
        item.innerHTML = `<div class="avatar-ring ${g.all_seen ? "seen" : ""}">
          <img class="avatar" src="${esc(g.user.avatar)}" alt=""></div><span>${esc(g.user.name)}</span>`;
        item.addEventListener("click", () => openViewer(gi));
        storiesBar.appendChild(item);
      });
    }

    /* Visionneuse de stories */
    const viewer = document.getElementById("storyViewer");
    let vGroup = 0, vIndex = 0, timer = null;
    function openViewer(gi) { vGroup = gi; vIndex = 0; viewer.classList.add("open"); showStory(); }
    function closeViewer() { viewer.classList.remove("open"); clearTimeout(timer); }
    function showStory() {
      const group = groups[vGroup]; if (!group) return closeViewer();
      const story = group.stories[vIndex];
      const content = viewer.querySelector(".content");
      if (story.type === "text") {
        content.innerHTML = `<div class="story-text" style="background:${esc(story.background || "var(--gradient-brand)")}">${esc(story.caption)}</div>`;
      } else {
        content.innerHTML = `<img src="${esc(story.media_url)}" alt="">` +
          (story.caption ? `<div style="position:absolute;bottom:40px;color:#fff;padding:0 20px;text-align:center;width:100%">${esc(story.caption)}</div>` : "");
      }
      // Barres de progression.
      const track = viewer.querySelector(".progress-track");
      track.innerHTML = group.stories.map((_, i) =>
        `<div class="bar"><i style="width:${i < vIndex ? 100 : 0}%"></i></div>`).join("");
      const activeBar = track.children[vIndex]?.querySelector("i");
      if (activeBar) { activeBar.style.transition = "width 5s linear"; requestAnimationFrame(() => activeBar.style.width = "100%"); }
      Api.post(`/api/stories/${story.id}/view`).catch(() => {});
      clearTimeout(timer); timer = setTimeout(nextStory, 5000);
    }
    function nextStory() {
      const group = groups[vGroup];
      if (vIndex + 1 < group.stories.length) { vIndex++; showStory(); }
      else if (vGroup + 1 < groups.length) { vGroup++; vIndex = 0; showStory(); }
      else closeViewer();
    }
    function prevStory() { if (vIndex > 0) { vIndex--; showStory(); } else if (vGroup > 0) { vGroup--; vIndex = 0; showStory(); } }
    if (viewer) {
      viewer.addEventListener("click", (e) => {
        const r = viewer.getBoundingClientRect();
        if (e.clientX < r.width * 0.3) prevStory();
        else if (e.clientX > r.width * 0.7) nextStory();
        else closeViewer();
      });
    }

    // Création de statut.
    const storyForm = document.getElementById("storyForm");
    if (storyForm) storyForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await Api.upload("/api/stories", new FormData(storyForm)); storyForm.reset(); loadStories(); Amoura.toast("Statut publié !"); }
      catch (err) { Amoura.toast(err.message); }
    });

    loadStories();
  }
})();
