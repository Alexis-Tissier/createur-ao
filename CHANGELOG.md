# Changelog

## v0.3.0

- distribution Windows activée avec Electron Builder ;
- build GitHub Actions automatique sur `main` ;
- génération d’un installateur utilisateur `.exe`, d’un portable `.exe` et d’une archive serveur prête à déployer ;
- backend local démarré automatiquement dans l’application packagée ;
- base SQLite stockée dans le profil local Windows de l’utilisateur ;
- logo orange « C » appliqué à l’exécutable, à la barre des tâches, à la barre de titre, aux raccourcis et au favicon ;
- identifiant Windows d’application stable pour le regroupement correct dans la barre des tâches ;
- lanceur serveur sans PowerShell utilisant une copie locale via `xcopy /D` ;
- conservation des fonctions v0.2.3 : modèle de premier lancement, destination non présélectionnée et suppression d’une ligne d’historique.

## v0.2.3

- modèle de démarrage exportable/importable pour préremplir destinations et arborescence au premier lancement ;
- destination volontairement vide au démarrage et après création ;
- suppression d’une ligne de l’historique sans suppression du dossier physique.
