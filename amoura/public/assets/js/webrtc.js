/* =============================================================================
   Amoura — appels audio/vidéo WebRTC (P2P) via signaling WebSocket
   ========================================================================== */
(function () {
  "use strict";

  const overlay = document.getElementById("callOverlay");
  if (!overlay) return; // gabarit d'appel absent de cette page

  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const incoming = document.getElementById("incomingCall");

  let pc = null, localStream = null, iceServers = [];
  let callId = null, peerId = null, kind = "audio", pendingOffer = null;

  async function loadIce() {
    if (iceServers.length) return iceServers;
    try { const c = await Api.get("/api/webrtc/config"); iceServers = c.iceServers || []; } catch (_) {}
    return iceServers;
  }

  async function getMedia(withVideo) {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
    if (withVideo && localVideo) { localVideo.srcObject = localStream; localVideo.muted = true; localVideo.play().catch(() => {}); }
    return localStream;
  }

  function createPeer() {
    pc = new RTCPeerConnection({ iceServers });
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    pc.onicecandidate = (e) => {
      if (e.candidate) Amoura.Realtime.emit("call:ice", { to: peerId, call_id: callId, candidate: e.candidate });
    };
    pc.ontrack = (e) => { if (remoteVideo) { remoteVideo.srcObject = e.streams[0]; remoteVideo.play().catch(() => {}); } };
    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) endCall(false);
    };
  }

  /* ---- Passer un appel ---- */
  async function startCall(targetId, callKind) {
    peerId = targetId; kind = callKind;
    await loadIce();
    try { await getMedia(kind === "video"); }
    catch (_) { Amoura.toast("Caméra/micro indisponible."); return; }

    try {
      const res = await Api.post("/api/calls", { callee_id: targetId, kind });
      callId = res.call_id;
    } catch (e) { Amoura.toast(e.message); return; }

    openOverlay("Appel en cours…");
    createPeer();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    Amoura.Realtime.emit("call:offer", { to: targetId, call_id: callId, kind, sdp: offer });
  }

  /* ---- Recevoir un appel ---- */
  Amoura.Realtime.on("call:offer", async (d) => {
    pendingOffer = d; peerId = d.from; callId = d.call_id; kind = d.kind || "audio";
    if (incoming) {
      incoming.querySelector("[data-call-kind]").textContent = kind === "video" ? "vidéo" : "audio";
      incoming.classList.add("show");
    }
  });

  async function acceptCall() {
    if (!pendingOffer) return;
    if (incoming) incoming.classList.remove("show");
    await loadIce();
    try { await getMedia(kind === "video"); } catch (_) { Amoura.toast("Micro/caméra refusé."); return; }
    openOverlay("Connecté");
    createPeer();
    await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    Amoura.Realtime.emit("call:answer", { to: peerId, call_id: callId, sdp: answer });
    Api.post(`/api/calls/${callId}/status`, { status: "ongoing" }).catch(() => {});
    pendingOffer = null;
  }

  Amoura.Realtime.on("call:answer", async (d) => {
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(d.sdp));
    Api.post(`/api/calls/${callId}/status`, { status: "ongoing" }).catch(() => {});
  });
  Amoura.Realtime.on("call:ice", async (d) => {
    if (pc && d.candidate) { try { await pc.addIceCandidate(new RTCIceCandidate(d.candidate)); } catch (_) {} }
  });
  Amoura.Realtime.on("call:hangup", () => endCall(false));
  Amoura.Realtime.on("call:reject", () => { Amoura.toast("Appel refusé."); endCall(false); });

  function rejectCall() {
    if (incoming) incoming.classList.remove("show");
    Amoura.Realtime.emit("call:reject", { to: peerId, call_id: callId });
    Api.post(`/api/calls/${callId}/status`, { status: "declined" }).catch(() => {});
    pendingOffer = null;
  }

  function endCall(notify = true) {
    if (notify && peerId) Amoura.Realtime.emit("call:hangup", { to: peerId, call_id: callId });
    if (callId) Api.post(`/api/calls/${callId}/status`, { status: "ended" }).catch(() => {});
    if (pc) { pc.close(); pc = null; }
    if (localStream) { localStream.getTracks().forEach((t) => t.stop()); localStream = null; }
    overlay.classList.remove("open");
    callId = peerId = null; pendingOffer = null;
  }

  function openOverlay(status) {
    overlay.classList.add("open");
    const s = overlay.querySelector("[data-call-status]"); if (s) s.textContent = status;
    overlay.querySelector("#localVideo").style.display = kind === "video" ? "block" : "none";
    overlay.querySelector("#remoteVideo").style.display = kind === "video" ? "block" : "none";
  }

  /* ---- Contrôles UI ---- */
  document.querySelectorAll("[data-call-start]").forEach((btn) =>
    btn.addEventListener("click", () => startCall(Number(btn.dataset.peer), btn.dataset.callStart))
  );
  overlay.querySelector("[data-call-hangup]")?.addEventListener("click", () => endCall(true));
  overlay.querySelector("[data-call-mute]")?.addEventListener("click", (e) => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; e.currentTarget.classList.toggle("off", !track.enabled); }
  });
  overlay.querySelector("[data-call-cam]")?.addEventListener("click", (e) => {
    if (!localStream) return;
    const track = localStream.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; e.currentTarget.classList.toggle("off", !track.enabled); }
  });
  incoming?.querySelector("[data-call-accept]")?.addEventListener("click", acceptCall);
  incoming?.querySelector("[data-call-reject]")?.addEventListener("click", rejectCall);

  window.AmouraCall = { startCall };
})();
