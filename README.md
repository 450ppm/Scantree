# ScanTree — Aide au choix des techniques de scan (LGS, PHO, SLAM, SLS, GS)

Outil web statique, didactique et responsive, pour comparer 5 techniques de capture en patrimoine via une matrice multicritère pondérée. Visualisation en radar (proximité globale par technique), curseurs de pondération (1–5), profils de pondération pré-définis, et classement dynamique.

## Utilisation

1) Ouvrez directement `index.html` dans votre navigateur.
   - Optionnel: servez le dossier via un petit serveur statique (recommandé pour un meilleur comportement des modules):
     - Python: `python -m http.server 8080`
     - Node (serve): `npx serve .`
     - VS Code: extension Live Server

2) Ajustez les curseurs (pondération 1–5) et (dés)activez des critères.

3) Le radar (axes = LGS/PHO/SLAM/SLS/GS) et le classement se mettent à jour instantanément.

4) Essayez les profils: Plans & relevés, Médiation VR, Détails fins, Site occupé.

## Données et hypothèses

- Grille de scores issue du prompt, normalisée:
  - `1–2` est interprété comme `1.5`.
  - `3*` et `3**` traités comme `3` (les notes GS héritent des données d'entrée et de la logistique).
- Normalisation: score total d'une technique rapporté au maximum théorique (pondération × 3 par critère), pour obtenir un pourcentage de proximité.
- L’objectif est l’aide à la décision (tendance globale). Pour un usage opérationnel, combinez la recommandation avec la réalité du site, de l’équipe et des objectifs finaux.

## Déploiement

Comme c’est une app statique:
- GitHub Pages / GitLab Pages
- Netlify / Vercel (drag & drop du dossier)
- Nginx/Apache: pointer la racine sur ce dossier

## Licence

Code sous licence MIT. Données et texte: à adapter selon vos sources.

## Personnalisation

- Ajoutez/retirez des critères dans `app.js` (`CRITERIA`).
- Changez les styles dans `styles.css` (variables CSS, couleurs, effets).
- Affinez les profils dans `app.js` (`PRESETS`).


