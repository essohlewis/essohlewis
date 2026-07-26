<!-- Superposition d'appel WebRTC (audio/vidéo) -->
<div class="call-overlay" id="callOverlay">
  <div class="call-videos">
    <video id="remoteVideo" autoplay playsinline></video>
    <video id="localVideo" autoplay playsinline muted></video>
    <div class="call-info">
      <h2 data-call-status>Appel…</h2>
    </div>
  </div>
  <div class="call-controls">
    <button class="call-btn" data-call-mute title="Micro">🎙️</button>
    <button class="call-btn hangup" data-call-hangup title="Raccrocher">📞</button>
    <button class="call-btn" data-call-cam title="Caméra">📷</button>
  </div>
</div>

<!-- Bandeau d'appel entrant -->
<div class="incoming-call card" id="incomingCall">
  <div class="row">
    <span style="font-size:1.5rem">📞</span>
    <div class="grow"><b>Appel <span data-call-kind>audio</span> entrant</b></div>
    <button class="call-btn accept" data-call-accept style="width:44px;height:44px">✓</button>
    <button class="call-btn hangup" data-call-reject style="width:44px;height:44px">✕</button>
  </div>
</div>
