/**
 * CONTEO — Mode Conte du soir.
 * Minuteur (1/2/3 contes), assombrissement progressif de l'écran, musique
 * douce, arrêt automatique, bouton « encore » désactivé.
 */

import { el, mount, toast } from '../../utils/dom.js';
import { api } from '../../core/api.js';
import { db } from '../../core/db.js';
import { state } from '../../core/store.js';
import { navigate } from '../../core/router.js';
import { blip, unlockAudio } from '../../audio/sfx.js';

export function renderBedtime() {
  unlockAudio();
  const choice = el('div', { class: 'bedtime-timer-choice' }, [1, 2, 3].map((n) =>
    el('button', { class: 'moon-btn', text: `${n} 🌙`, 'aria-label': `${n} contes`,
      onClick: () => { blip(330); startBedtime(n); } })
  ));

  mount(el('div', { class: 'bedtime' }, [
    el('div', { class: 'kid-header' }, [
      el('button', { class: 'parent-key', text: '🏠', 'aria-label': 'Retour', onClick: () => navigate('/') }),
      el('div', { class: 'kid-title', style: 'color:#fff', text: 'Conte du soir' }),
      el('div', { style: 'width:72px' }),
    ]),
    el('p', { style: 'text-align:center;font-size:20px;padding:0 24px', text: 'Combien d\'histoires avant de dormir ?' }),
    choice,
  ]));
}

async function startBedtime(count) {
  const screen = el('div', { class: 'bedtime' });
  screen.style.filter = 'brightness(1)';
  mount(screen);

  // Musique douce en boucle (asset optionnel ; échoue silencieusement).
  const music = new Audio('/media/sfx/lullaby.opus');
  music.loop = true;
  music.volume = 0.4;
  music.play().catch(() => {});

  let played = 0;
  const total = count;

  const readOne = async () => {
    if (played >= total) return endBedtime(screen, music);
    played++;
    // Assombrissement progressif à chaque conte.
    screen.style.filter = `brightness(${1 - (played / total) * 0.6})`;

    // Message doux. La lecture réelle réutiliserait le lecteur ; ici on
    // enchaîne un écran calme par conte pour illustrer le minuteur.
    screen.replaceChildren(
      el('div', { class: 'center-screen', style: 'color:#fff' }, [
        el('div', { style: 'font-size:72px', text: '🌙' }),
        el('h2', { text: `Histoire ${played} / ${total}` }),
        el('p', { class: 'hint', style: 'color:#cdd6f0', text: 'Ferme les yeux et écoute...' }),
      ])
    );
    setTimeout(readOne, 8000); // durée illustrative ; en prod = durée du conte
  };

  readOne();
}

function endBedtime(screen, music) {
  music.pause();
  screen.style.filter = 'brightness(0.25)';
  screen.replaceChildren(
    el('div', { class: 'center-screen', style: 'color:#fff' }, [
      el('div', { style: 'font-size:72px', text: '😴' }),
      el('h2', { text: 'Bonne nuit !' }),
      // Bouton « encore » volontairement absent en mode conte du soir.
    ])
  );
}
