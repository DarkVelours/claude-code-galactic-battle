# Galactic Battle pour Claude Code

[English](README.md) · **Français**

Pendant que Claude bosse, une bataille spatiale occupe la bande juste au-dessus de la saisie : chasseurs qui s'échangent des lasers sur fond étoilé, explosions, score en direct, et de temps en temps un cargo très rapide. Il y a aussi des bruits de blaster, et tu peux ajouter de la musique.

![Démo Galactic Battle](docs/demo.svg)

- Un fond étoilé sur deux couches qui défilent, une planète désertique et ses deux soleils, une station de combat qui dérive.
- **Le combat suit ta session.** Chaque outil que Claude lance avec succès est un tir rebelle qui abat un chasseur impérial ; chaque outil qui échoue est un tir impérial qui abat un chasseur rebelle. Le score est le vrai décompte **du tour en cours**, et repart à 0 au tour suivant : `REBELLES 24 vs 1 EMPIRE` veut dire que 24 appels d'outils ont marché et 1 a échoué. Seul ce que lance le fil principal compte. Les appels d'outils d'un sous-agent ne comptent pas, ni un appel que tu refuses à une demande de permission.
- **Chaque sous-agent est un chasseur rebelle de plus**, listé avec son modèle et son temps d'exécution.
- **Une jauge en sabre laser à double lame.** La lame de gauche est ta fenêtre de contexte. La lame de droite est ta limite d'usage sur 5 h, avec ce que le tour en cours a déjà coûté (`+0.4`). Bleue quand tout va bien, violette dès 50 %, rouge instable qui vacille quand ça devient serré (70 % du contexte, 80 % du quota).
- **Une ligne en direct** avec l'outil que Claude est en train de lancer, et le nombre d'outils et de fichiers utilisés jusque-là.
- Le spinner garde sa ligne, et ses mots deviennent *Passage en hyperespace*, *Négociation avec les Hutts*… Le temps écoulé et les tokens restent affichés.
- Un bruit de blaster sur les explosions, un toutes les 2,5 s au maximum, et une musique en option, en boucle pendant le tour.
- En anglais et en français.
- Aucun appel au modèle, aucun token consommé. L'animation tourne sur l'horloge d'images du terminal, environ 14 images/s.

### Ce qu'il ne peut pas montrer

Claude Code ne donne pas aux mods les tokens ni le coût de chaque sous-agent, donc pas de chiffres par sous-agent : seulement son modèle et sa durée. La lame du quota demande un compte qui expose une limite sur 5 h ; sinon elle reste rentrée et affiche `?`.

## Installation

Dans une session Claude Code en terminal :

```
/plugin marketplace add DarkVelours/claude-code-galactic-battle
/plugin install galactic-battle@galactic-battle
```

Choisis la portée utilisateur, puis réponds aux quatre options (langue, fichier de musique, volume, infos affichées). Tu pourras les changer plus tard dans `/config`. Lance `/reload-plugins` si la bataille n'apparaît pas au prompt suivant.

Il faut une version de Claude Code qui gère les mods (function hooks). Testé sur **Claude Code 2.1.296**. Les mods sont en accès anticipé, leur API peut changer d'une version à l'autre. Si la bataille disparaît après une mise à jour, ouvre une issue.

## Commandes

Une seule commande, avec des mots-clés :

| Commande | Effet |
|---|---|
| `/battle` | Active ou coupe la bataille |
| `/battle on` · `/battle off` | Force l'état |
| `/battle son [on\|off]` | Bruit de blaster sur les explosions |
| `/battle musique [on\|off]` | Musique pendant le tour (il faut un fichier, voir plus bas) |
| `/battle langue [auto\|en\|fr]` | Langue (même réglage que `/config`) |
| `/battle info [tool\|full]` | Ce que montre la ligne en direct : noms d'outils seulement, ou aussi noms de fichiers et commandes |
| `/battle statut` | Affiche les réglages en cours |

Un mot-clé sans `on`/`off` bascule. Les mots-clés anglais marchent aussi (`sound`, `music`, `lang`, `status`). La commande fonctionne aussi en plein tour : `/battle musique off` coupe la musique tout de suite. Tes réglages sont gardés d'une session à l'autre.

## Réglages (`/config`)

| Option | Défaut | |
|---|---|---|
| Language | `auto` | `auto` suit `LC_ALL`/`LANG` ; sinon `en` ou `fr` |
| Music file | *(vide)* | Chemin absolu ou `~/…`. Vide = `~/.claude/galactic-battle/music.mp3` |
| Volume | `40` | 0–100, pour le blaster et la musique |
| Info shown | `tool` | `tool` montre seulement les noms d'outils. `full` montre aussi noms de fichiers et commandes shell : repasse en `tool` avant de filmer ton écran |

## Sons

- **Blaster** : un son synthétisé est fourni avec le plugin, sous licence MIT comme le code. Pour utiliser le tien, dépose un `blaster.wav` dans `~/.claude/galactic-battle/`.
- **Musique** : aucune n'est fournie, parce qu'une bonne musique de bataille spatiale est rarement libre de redistribution. Dépose un mp3 à `~/.claude/galactic-battle/music.mp3` (ou règle *Music file*), puis lance `/battle musique on`. Les sites libres de droits comme Pixabay Music ou Freesound proposent plein de morceaux « space battle ». Vérifie la licence du morceau que tu choisis.

La musique démarre avec le tour, tourne en boucle, et s'arrête à la fin du tour, quand tu interromps (Échap), quand tu lances `/battle musique off`, ou à la fermeture de la session. Au cas où un arrêt serait raté, le lecteur a aussi une limite dure de 30 minutes.

## Plateformes

| | Bataille | Blaster | Musique |
|---|---|---|---|
| Linux / WSL2 (WSLg) | ✅ testé | ✅ `paplay` (ou `ffplay`) | ✅ `ffplay` |
| macOS | ⚠️ non testé | ⚠️ `afplay` (non testé) | ⚠️ `ffplay` ou une boucle `afplay` (non testé) |
| Windows (terminal natif) | ⚠️ non testé | ❌ | ❌ |
| Claude desktop / IDE | spinner normal, pas de bataille | – | – |

Le lecteur audio intégré au moteur (`$.audio.play`) ne joue que sur macOS, donc le plugin appelle lui-même des lecteurs en ligne de commande. Sous Linux, installe `pulseaudio-utils` (`paplay`) et/ou `ffmpeg` (`ffplay`). Si tu as testé sur macOS, un retour est bienvenu.

## Fonctionnement

- `hooks/register.tsx` se branche deux fois sur `ui.render`. Sur `Spinner`, il réécrit les mots. Sur `AbovePrompt`, il dessine le `Client` sous les autres bandes : la bataille est collée à la zone de saisie, et seulement quand Claude bosse. Il surveille aussi `tool.call` pour compter les réussites, les erreurs et les sous-agents en cours, lit `$.session.usage()` pour les deux jauges, répond à `/battle`, et lance ou coupe les sons sur `turn.start`, `turn.complete` et `ui.message`.
- `hooks/battle.tsx` est le module de surface du `Client`. Le combat et le dessin tournent sur l'horloge d'images du terminal (`surface.every`), donc aucun hook n'est appelé à chaque image. Il lit les chiffres que le module de hooks lui envoie en props, et renvoie `{ boom: true }` pour déclencher le blaster.
- `locales/*.ts` contiennent tous les textes, un fichier par langue.

## Ce qu'il touche

Un mod n'est pas isolé, voici donc ce que fait celui-ci. `claude plugin validate .` liste les mêmes appels.

- Il se branche sur **chaque appel d'outil**, mais seulement pour le compter : il ne modifie jamais un appel ni son résultat, et si le hook plante l'appel passe quand même. Il ne lit le contenu d'aucun fichier et ne fait aucune requête réseau.
- Il lit tes chiffres de contexte et d'usage, `HOME`, `LANG` et `LC_ALL`, et regarde si les fichiers de musique et de blaster existent.
- Il lance `sh` pour jouer un son (`paplay`, `afplay` ou `ffplay`) et pour arrêter la musique qu'il a démarrée, rien d'autre.
- Avec `info full`, noms de fichiers et commandes shell s'affichent à l'écran. Ils ne sont ni stockés ni envoyés nulle part.

## Développer

```bash
claude plugin validate .        # manifeste, marketplace, module de hooks
claude plugin test .            # tests/*.test.ts
npx tsx docs/make-demo.tsx docs/demo.svg   # redessine la démo depuis le vrai code
claude --plugin-dir .           # une session qui lance ce dossier, rechargée à chaque modification
npx -p typescript tsc -p .      # typage (après un premier chargement qui écrit .claude-plugin/types/)
```

Pour ajouter une langue, voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Désinstaller

```
/plugin uninstall galactic-battle
```

## Avertissement

Parodie non commerciale faite par un fan, inspirée d'une certaine galaxie lointaine, très lointaine. Ce projet n'est ni affilié, ni approuvé, ni sponsorisé par Lucasfilm Ltd. ou The Walt Disney Company. Toutes les marques appartiennent à leurs propriétaires. Aucun extrait de film, logo, son ou musique n'est inclus.

## Licence

[MIT](LICENSE) © 2026 Dark Velours
