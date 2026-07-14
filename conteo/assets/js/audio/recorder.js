/* Conteo — Enregistrement vocal (MediaRecorder).
 * Le Blob est stocké UNIQUEMENT en local (IndexedDB). Jamais transmis. */

import { add, getAllByIndex, del } from '../core/db.js';

export function isSupported() {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export class VoiceRecorder {
  constructor() {
    this.stream = null;
    this.rec = null;
    this.chunks = [];
    this.startedAt = 0;
  }

  async start() {
    if (!isSupported()) throw new Error('Enregistrement non pris en charge sur cet appareil.');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickMime();
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start();
    this.startedAt = Date.now();
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.rec) return resolve(null);
      this.rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.rec.mimeType || 'audio/webm' });
        const duration_sec = Math.round((Date.now() - this.startedAt) / 1000);
        this._release();
        resolve({ blob, duration_sec });
      };
      this.rec.stop();
    });
  }

  cancel() { try { this.rec?.stop(); } catch {} this._release(); }
  _release() { this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null; this.rec = null; }
}

function pickMime() {
  const prefs = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return prefs.find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
}

/* Persistance IndexedDB */
export function saveRecording({ profile_id, tale_slug, blob, duration_sec }) {
  return add('recordings', {
    profile_id, tale_slug, blob, duration_sec, created_at: Date.now()
  });
}
export function listRecordings(profileId) { return getAllByIndex('recordings', 'by_profile', profileId); }
export function deleteRecording(id) { return del('recordings', id); }
