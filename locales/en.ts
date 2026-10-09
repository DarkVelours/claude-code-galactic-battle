import type { Locale } from '../types'

const flag = (on: boolean) => (on ? 'ON' : 'OFF')

export const en: Locale = {
  spinnerWords: [
    'Jumping to hyperspace',
    'Calibrating the lightsaber',
    'Negotiating with the Hutts',
    'Fixing the hyperdrive',
    'Consulting the old master',
    'Targeting the exhaust port',
    'Running the blockade',
    'Stealing the station plans',
    'Meditating with the Force',
    'Podracing',
    'Escaping the asteroid field',
    'Interrogating the astromech',
  ],
  quotes: [
    'May the Force be with your build.',
    'Do or do not. There is no try/catch.',
    'I have a bad feeling about this diff...',
    'These aren’t the bugs you’re looking for.',
    'It’s a merge conflict!',
    'I sense a disturbance in the CI.',
    'The dark side of the regex is strong.',
    'I am your parent process.',
    'Three bogeys on my tail!',
    'Never tell me the test coverage odds.',
  ],
  modes: {
    thinking: 'Meditating',
    requesting: 'Calling the Rebellion',
    responding: 'Holo transmission',
    'tool-input': 'Plotting the jump',
    'tool-use': 'Squadron attacking',
  },
  modeDefault: 'Hyperspace',
  rebels: 'REBELS',
  empire: 'EMPIRE',
  collision: 'Head-on collision! A rebel kamikaze.',
  freighter: 'A certain freighter flies by... in under 12 parsecs!',
  labels: {
    context: 'ctx',
    quota: '5h',
    tools: ['{n} tool', '{n} tools'],
    files: ['{n} file', '{n} files'],
    helpers: ['{n} helper', '{n} helpers'],
  },

  usage: '/battle [on|off] · /battle sound [on|off] · /battle music [on|off] · /battle lang [auto|en|fr] · /battle info [tool|full] · /battle status',
  battleOn: 'May the Force be with you: battle on.',
  battleOff: 'Retreat to the ice planet: battle off.',
  soundOn: '🔫 Blasters armed.',
  soundOff: '🔇 Radio silence: blasters off.',
  musicOn: '🎵 Music ON: it plays while Claude works.',
  musicOff: '🎵 Music off.',
  noMusicFile: path => `🎵 No music file at ${path}. Drop an mp3 there, or set "Music file" in /config.`,
  unknownOption: word => `Unknown option “${word}”.`,
  status: (battle, sound, music, language, details) =>
    `⚔ Battle ${flag(battle)} · 🔫 Sound ${flag(sound)} · 🎵 Music ${flag(music)} · 🌐 ${language} · 👁 info ${details}`,
  languageSet: language => `🌐 Language: ${language}.`,
  languageRefused: reason => `🌐 Language not changed: ${reason}`,
  detailsSet: details =>
    details === 'full'
      ? '👁 Info: full. The battle shows file names and commands (hide it when you record your screen).'
      : '👁 Info: tool names only.',
}
