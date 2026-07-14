/* Conteo — « Mes histoires » : enregistrements vocaux de l'enfant (N3).
 * Stockage local exclusif (IndexedDB) — jamais transmis. */

import { el, mount, toast } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { store } from '../../core/store.js';
import { VoiceRecorder, isSupported, listRecordings, saveRecording, deleteRecording } from '../../audio/recorder.js';
import { kidNav } from './nav.js';
import { uiTone } from '../../audio/sfx.js';
import { duration, frDate } from '../../utils/format.js';

export async function myStoriesView() {
  const profile = store.activeProfile;
  if (!profile) return navigate('/pick', { replace: true });

  const list = el('div', { class: 'recording-list' });
  const recorder = new VoiceRecorder();
  let recording = false;

  const recBtn = el('button', { class: 'btn-kid', style: { width: '96px', height: '96px', background: 'var(--c-earth)', color: '#fff' },
    'aria-label': 'Enregistrer', text: '🎙️' });

  async function refresh() {
    const recs = await listRecordings(profile.id);
    list.replaceChildren();
    if (!recs.length) {
      list.append(el('p', { class: 'text-muted center', text: 'Aucun enregistrement. Appuie sur le micro pour raconter une histoire !' }));
    }
    recs.reverse().forEach((r) => {
      const url = URL.createObjectURL(r.blob);
      const audio = el('audio', { src: url, controls: true, style: { flex: '1' } });
      list.append(el('div', { class: 'recording-item' }, [
        el('span', { 'aria-hidden': 'true', style: { fontSize: '28px' }, text: '🎧' }),
        el('div', { class: 'meta' }, [
          el('strong', { text: r.tale_slug || 'Mon histoire' }),
          el('div', { class: 'text-muted', style: { fontSize: '13px' }, text: `${duration(r.duration_sec)} · ${frDate(r.created_at)}` })
        ]),
        audio,
        el('button', { class: 'icon-btn', 'aria-label': 'Supprimer', text: '🗑️',
          onpointerup: async () => { await deleteRecording(r.id); URL.revokeObjectURL(url); refresh(); } })
      ]));
    });
  }

  recBtn.addEventListener('pointerup', async () => {
    if (!isSupported()) { toast('Micro non disponible ici', 'err'); return; }
    if (!recording) {
      try {
        await recorder.start();
        recording = true;
        recBtn.textContent = '⏹️';
        recBtn.style.background = 'var(--c-danger)';
        toast('Enregistrement…', '');
      } catch { toast('Autorise le micro pour enregistrer', 'err'); }
    } else {
      const res = await recorder.stop();
      recording = false;
      recBtn.textContent = '🎙️';
      recBtn.style.background = 'var(--c-earth)';
      if (res?.blob) {
        await saveRecording({ profile_id: profile.id, tale_slug: 'Mon histoire', blob: res.blob, duration_sec: res.duration_sec });
        uiTone('star');
        refresh();
      }
    }
  });

  const root = el('section', { class: 'kid', style: { flex: '1', display: 'flex', flexDirection: 'column' } }, [
    el('div', { class: 'view', style: { flex: '1', overflowY: 'auto' } }, [
      el('h1', { class: 'section-title', text: '🎙️ Mes histoires' }),
      el('div', { class: 'center', style: { margin: '16px 0' } }, [recBtn]),
      el('p', { class: 'note', text: '🔒 Tes enregistrements restent sur cet appareil. Personne d’autre ne peut les écouter.' }),
      list
    ]),
    kidNav('stories')
  ]);
  mount(root);
  refresh();
  return () => { if (recording) recorder.cancel(); };
}
