'use strict';

/**
 * extractor.js
 * -----------------------------------------------------------------------------
 * Wrapper autour de yt-dlp (via youtube-dl-exec).
 *
 * Ce service est le SEUL point du back-end qui parle à yt-dlp. Il expose deux
 * fonctions :
 *   - getInfo(url)                -> métadonnées + formats normalisés
 *   - streamDownload(url, format) -> flux (stdout process) prêt à être relayé
 *
 * Aucune donnée n'est écrite sur le disque : yt-dlp envoie le média sur sa
 * sortie standard (`-o -`) et le serveur relaie ce flux directement au client.
 */

const { create: createYoutubeDl } = require('youtube-dl-exec');
const { spawn } = require('child_process');

// Permet de pointer vers un binaire yt-dlp personnalisé (utile en prod / Docker).
// Par défaut, on laisse youtube-dl-exec utiliser le binaire fourni.
const YTDLP_PATH = process.env.YTDLP_PATH || null;
const ytdlp = YTDLP_PATH ? createYoutubeDl(YTDLP_PATH) : require('youtube-dl-exec');

// Délai maximum autorisé pour une extraction de métadonnées (ms).
const INFO_TIMEOUT = Number(process.env.EXTRACT_TIMEOUT || 25000);

/**
 * Détecte la plateforme à partir de l'URL (pour l'affichage / le logo côté UI).
 * @param {string} url
 * @returns {string} identifiant de plateforme normalisé
 */
function detectPlatform(url) {
  const u = url.toLowerCase();
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/tiktok\.com/.test(u)) return 'tiktok';
  if (/instagram\.com/.test(u)) return 'instagram';
  if (/facebook\.com|fb\.watch/.test(u)) return 'facebook';
  if (/twitter\.com|x\.com/.test(u)) return 'twitter';
  if (/vimeo\.com/.test(u)) return 'vimeo';
  if (/dailymotion\.com|dai\.ly/.test(u)) return 'dailymotion';
  return 'autre';
}

/**
 * Convertit une taille en octets en libellé lisible (Mo / Go).
 * @param {number|null} bytes
 * @returns {string|null}
 */
function humanFileSize(bytes) {
  if (!bytes || bytes <= 0) return null;
  const mo = bytes / (1024 * 1024);
  if (mo >= 1024) return `${(mo / 1024).toFixed(2)} Go`;
  return `${mo.toFixed(1)} Mo`;
}

/**
 * Convertit une durée en secondes vers un format mm:ss / hh:mm:ss.
 * @param {number|null} seconds
 * @returns {string|null}
 */
function humanDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Normalise la liste brute des formats yt-dlp vers une structure simple et
 * pertinente pour l'UI : on ne garde que les formats vidéo MP4 (par hauteur)
 * et les meilleurs formats audio.
 *
 * @param {Array} formats formats bruts yt-dlp
 * @returns {{ video: Array, audio: Array }}
 */
function normalizeFormats(formats = []) {
  const videoByHeight = new Map();
  const audioCandidates = [];

  for (const f of formats) {
    if (!f || f.format_id === undefined) continue;

    const hasVideo = f.vcodec && f.vcodec !== 'none';
    const hasAudio = f.acodec && f.acodec !== 'none';
    const size = f.filesize || f.filesize_approx || null;

    // --- Formats vidéo (on privilégie les hauteurs standard, MP4 de préférence) ---
    if (hasVideo && f.height) {
      const height = f.height;
      // On ne retient que les paliers courants demandés dans la spec.
      if (![360, 480, 720, 1080, 1440, 2160].includes(height)) continue;

      const ext = f.ext || 'mp4';
      const entry = {
        formatId: f.format_id,
        type: 'video',
        label: `${height}p`,
        height,
        ext,
        hasAudio,
        // yt-dlp choisira la meilleure piste audio si le format est muet (merge).
        mergedFormatId: hasAudio ? f.format_id : `${f.format_id}+bestaudio`,
        filesize: size,
        filesizeLabel: humanFileSize(size),
        note: f.format_note || '',
      };

      const existing = videoByHeight.get(height);
      // Préférence : mp4 + piste audio incluse + taille connue.
      const score = (ext === 'mp4' ? 2 : 0) + (hasAudio ? 1 : 0) + (size ? 1 : 0);
      const existingScore = existing
        ? (existing.ext === 'mp4' ? 2 : 0) + (existing.hasAudio ? 1 : 0) + (existing.filesize ? 1 : 0)
        : -1;
      if (!existing || score > existingScore) {
        videoByHeight.set(height, entry);
      }
    }

    // --- Formats audio seuls ---
    if (hasAudio && !hasVideo) {
      audioCandidates.push({
        formatId: f.format_id,
        type: 'audio',
        ext: f.ext || 'm4a',
        abr: f.abr || 0,
        filesize: size,
        filesizeLabel: humanFileSize(size),
      });
    }
  }

  // Vidéo triée par hauteur décroissante.
  const video = Array.from(videoByHeight.values()).sort((a, b) => b.height - a.height);

  // On garde le meilleur format audio "brut" (m4a) et on propose aussi un MP3
  // reconverti côté serveur (voir download.js). On expose deux entrées logiques.
  let bestAudio = audioCandidates.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0] || null;
  const audio = [];
  if (bestAudio) {
    audio.push({
      formatId: 'audio-m4a',
      type: 'audio',
      label: 'Audio M4A',
      ext: 'm4a',
      sourceFormatId: bestAudio.formatId,
      filesize: bestAudio.filesize,
      filesizeLabel: bestAudio.filesizeLabel,
    });
    audio.push({
      formatId: 'audio-mp3',
      type: 'audio',
      label: 'Audio MP3',
      ext: 'mp3',
      sourceFormatId: bestAudio.formatId,
      // La taille MP3 finale diffère de la source ; on l'indique comme estimée.
      filesize: bestAudio.filesize,
      filesizeLabel: bestAudio.filesizeLabel ? `~${bestAudio.filesizeLabel}` : null,
    });
  }

  return { video, audio };
}

/**
 * Récupère les métadonnées et la liste des formats normalisés d'une URL.
 * @param {string} url
 * @returns {Promise<object>}
 */
async function getInfo(url) {
  const raw = await ytdlp(url, {
    dumpSingleJson: true,
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: false,
    // On évite les playlists : une seule vidéo à la fois.
    noPlaylist: true,
  }, {
    timeout: INFO_TIMEOUT,
  });

  const formats = normalizeFormats(raw.formats || []);

  return {
    id: raw.id,
    title: raw.title || 'Sans titre',
    author: raw.uploader || raw.channel || raw.uploader_id || 'Inconnu',
    thumbnail: raw.thumbnail || (Array.isArray(raw.thumbnails) && raw.thumbnails.length
      ? raw.thumbnails[raw.thumbnails.length - 1].url
      : null),
    duration: raw.duration || null,
    durationLabel: humanDuration(raw.duration),
    platform: detectPlatform(url),
    extractor: raw.extractor_key || raw.extractor || null,
    webpageUrl: raw.webpage_url || url,
    formats,
  };
}

/**
 * Construit et lance le process yt-dlp qui écrit le média sur stdout.
 * Le flux renvoyé est relayé tel quel au client par la route /api/download.
 *
 * @param {string} url        URL source (déjà validée en amont)
 * @param {object} opts
 * @param {string} opts.formatId  identifiant de format demandé
 * @param {boolean} opts.audioOnly  true pour l'audio seul
 * @param {string} [opts.audioExt]  'mp3' ou 'm4a' (si audioOnly)
 * @param {string} [opts.sourceFormatId]  format audio source (si audioOnly)
 * @returns {import('child_process').ChildProcessWithoutNullStreams}
 */
function streamDownload(url, opts) {
  const bin = YTDLP_PATH || require('youtube-dl-exec').getBinaryPath?.() || 'yt-dlp';
  const args = [
    url,
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificates',
    '-o', '-', // sortie standard : rien n'est écrit sur le disque
  ];

  if (opts.audioOnly) {
    // Extraction audio : yt-dlp gère la conversion via ffmpeg.
    args.push('-x');
    args.push('--audio-format', opts.audioExt === 'mp3' ? 'mp3' : 'm4a');
    args.push('--audio-quality', '0');
    if (opts.sourceFormatId) {
      args.push('-f', opts.sourceFormatId);
    } else {
      args.push('-f', 'bestaudio');
    }
  } else {
    // Vidéo : on demande le format choisi + merge éventuel de la meilleure piste audio.
    args.push('-f', opts.formatId);
    args.push('--merge-output-format', 'mp4');
  }

  // spawn direct pour garder l'accès au stdout en streaming.
  return spawn(bin, args, { windowsHide: true });
}

module.exports = {
  getInfo,
  streamDownload,
  detectPlatform,
  humanFileSize,
  humanDuration,
  normalizeFormats,
};
