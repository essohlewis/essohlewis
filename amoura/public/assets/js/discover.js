/* =============================================================================
   Amoura — file de découverte façon « swipe » (glisser pour liker/passer)
   ========================================================================== */
(function () {
  "use strict";
  const stage = document.getElementById("discoverStage");
  if (!stage) return;

  let queue = [];
  let filters = {};

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function load() {
    const params = new URLSearchParams(filters).toString();
    try {
      const res = await Api.get("/api/discover" + (params ? "?" + params : ""));
      queue = res.profiles || [];
      render();
    } catch (e) { Amoura.toast(e.message); }
  }

  function render() {
    stage.innerHTML = "";
    if (!queue.length) {
      stage.innerHTML = '<div class="card text-center" style="display:grid;place-items:center;height:100%">'
        + '<div><h3>Plus de profils pour l\'instant</h3><p class="muted">Revenez plus tard ou élargissez vos filtres.</p></div></div>';
      return;
    }
    // On empile jusqu'à 3 cartes ; celle du dessus est interactive.
    queue.slice(0, 3).reverse().forEach((p, idx, arr) => {
      const isTop = idx === arr.length - 1;
      const card = document.createElement("div");
      card.className = "swipe-card";
      card.style.transform = `scale(${1 - (arr.length - 1 - idx) * 0.04}) translateY(${(arr.length - 1 - idx) * 10}px)`;
      card.style.zIndex = idx;
      const tags = (p.interests || []).slice(0, 4).map((t) => `<span class="chip">${esc(t)}</span>`).join("");
      card.innerHTML = `
        <img src="${esc(p.avatar)}" alt="${esc(p.display_name)}" loading="lazy">
        <div class="swipe-stamp like">Like</div>
        <div class="swipe-stamp nope">Nope</div>
        <div class="overlay">
          <h2>${esc(p.display_name)}${p.age ? ", " + p.age : ""}
            ${Number(p.is_verified) ? '<span class="badge badge-verified" title="Vérifié">✓</span>' : ""}
            ${Number(p.is_online) ? '<span class="dot online"></span>' : ""}
          </h2>
          <div class="meta">${esc(p.city || "")}${p.city && p.country ? " · " : ""}${esc(p.country || "")}
            ${p.distance_km != null ? " · " + Math.round(p.distance_km) + " km" : ""}</div>
          ${p.bio ? `<p class="meta">${esc(p.bio).slice(0, 120)}</p>` : ""}
          <div class="tags">${tags}</div>
        </div>`;
      if (isTop) attachDrag(card, p);
      stage.appendChild(card);
    });
  }

  function attachDrag(card, profile) {
    let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;
    const like = card.querySelector(".swipe-stamp.like");
    const nope = card.querySelector(".swipe-stamp.nope");

    const down = (x, y) => { dragging = true; startX = x; startY = y; card.style.transition = "none"; };
    const move = (x, y) => {
      if (!dragging) return;
      dx = x - startX; dy = y - startY;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
      like.style.opacity = dx > 0 ? Math.min(dx / 120, 1) : 0;
      nope.style.opacity = dx < 0 ? Math.min(-dx / 120, 1) : 0;
    };
    const up = () => {
      if (!dragging) return; dragging = false;
      card.style.transition = "";
      if (Math.abs(dx) > 110) {
        decide(dx > 0 ? "like" : "pass", card, profile, dx > 0 ? 1 : -1);
      } else {
        card.style.transform = ""; like.style.opacity = 0; nope.style.opacity = 0;
      }
      dx = dy = 0;
    };

    card.addEventListener("mousedown", (e) => down(e.clientX, e.clientY));
    window.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
    window.addEventListener("mouseup", up);
    card.addEventListener("touchstart", (e) => down(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    card.addEventListener("touchmove", (e) => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    card.addEventListener("touchend", up);
  }

  async function decide(action, card, profile, dir) {
    // Anime la sortie de carte.
    if (card) {
      card.style.transform = `translate(${dir * 600}px, -40px) rotate(${dir * 30}deg)`;
      card.style.opacity = "0";
    }
    queue = queue.filter((p) => p.id !== profile.id);
    setTimeout(render, 180);

    try {
      const res = await Api.post("/api/swipe", { target_id: profile.id, action });
      if (res.matched) {
        Amoura.toast("✨ C'est un match avec " + profile.display_name + " !", "match");
        Amoura.Realtime.emit("notify", { to: profile.id, payload: { type: "match" } });
      } else if (action === "like") {
        Amoura.Realtime.emit("notify", { to: profile.id, payload: { type: "like" } });
      }
    } catch (e) {
      if (e.status === 402) {
        Amoura.toast("Limite de likes atteinte — passez Premium !");
        setTimeout(() => (location.href = "/premium"), 1200);
      } else { Amoura.toast(e.message); }
    }
    if (queue.length < 3) load();
  }

  // Boutons d'action.
  document.querySelectorAll("[data-swipe]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (!queue.length) return;
      const action = btn.dataset.swipe;
      const top = stage.querySelector(".swipe-card:last-child");
      decide(action, top, queue[0], action === "pass" ? -1 : 1);
    })
  );

  // Filtres.
  const filterForm = document.getElementById("discoverFilters");
  if (filterForm) {
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      filters = {};
      new FormData(filterForm).forEach((v, k) => { if (v) filters[k] = v; });
      load();
    });
  }

  load();
})();
