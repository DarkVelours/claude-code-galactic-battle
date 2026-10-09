import type { Locale } from '../types'

const flag = (on: boolean) => (on ? 'ON' : 'OFF')

export const fr: Locale = {
  spinnerWords: [
    'Passage en hyperespace',
    'Calibrage du sabre laser',
    'Négociation avec les Hutts',
    'Réparation de l’hyperpropulseur',
    'Consultation du vieux maître',
    'Ciblage du conduit d’aération',
    'Contournement du blocus',
    'Vol des plans de la station',
    'Méditation avec la Force',
    'Course de modules',
    'Fuite du champ d’astéroïdes',
    'Interrogation de l’astromech',
  ],
  quotes: [
    'Que la Force soit avec ton build.',
    'Fais-le, ou ne le fais pas. Il n’y a pas de try/catch.',
    'J’ai un mauvais pressentiment sur ce diff...',
    'Ce ne sont pas les bugs que vous recherchez.',
    'C’est un conflit de merge !',
    'Je ressens une perturbation dans la CI.',
    'Le côté obscur de la regex est puissant.',
    'Je suis ton process parent.',
    'Trois chasseurs sur ma queue !',
    'Ne me dis jamais les chances de passer la CI.',
  ],
  modes: {
    thinking: 'Méditation',
    requesting: 'Appel à la Rébellion',
    responding: 'Transmission holo',
    'tool-input': 'Calcul de trajectoire',
    'tool-use': 'Escadron en attaque',
  },
  modeDefault: 'Hyperespace',
  rebels: 'REBELLES',
  empire: 'EMPIRE',
  collision: 'Collision frontale ! Kamikaze rebelle.',
  freighter: 'Un certain cargo passe... en moins de 12 parsecs !',
  labels: {
    context: 'ctx',
    quota: '5h',
    tools: ['{n} outil', '{n} outils'],
    files: ['{n} fichier', '{n} fichiers'],
    helpers: ['{n} sous-agent', '{n} sous-agents'],
  },

  usage: '/battle [on|off] · /battle son [on|off] · /battle musique [on|off] · /battle langue [auto|en|fr] · /battle info [tool|full] · /battle statut',
  battleOn: 'Que la Force soit avec toi : bataille activée.',
  battleOff: 'Retraite vers la planète de glace : bataille coupée.',
  soundOn: '🔫 Blasters armés.',
  soundOff: '🔇 Silence radio : blasters coupés.',
  musicOn: '🎵 Musique ON : elle joue pendant que Claude bosse.',
  musicOff: '🎵 Musique coupée.',
  noMusicFile: path => `🎵 Pas de fichier musique à ${path}. Dépose un mp3 là, ou règle « Music file » dans /config.`,
  unknownOption: word => `Option inconnue « ${word} ».`,
  status: (battle, sound, music, language, details) =>
    `⚔ Bataille ${flag(battle)} · 🔫 Son ${flag(sound)} · 🎵 Musique ${flag(music)} · 🌐 ${language} · 👁 info ${details}`,
  languageSet: language => `🌐 Langue : ${language}.`,
  languageRefused: reason => `🌐 Langue inchangée : ${reason}`,
  detailsSet: details =>
    details === 'full'
      ? '👁 Info : complète. La bataille montre noms de fichiers et commandes (masque-la quand tu filmes ton écran).'
      : '👁 Info : noms d’outils seulement.',
}
