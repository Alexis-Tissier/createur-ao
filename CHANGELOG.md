# Changelog

## v0.4.0

- ajout du champ Client après le BE dans le nom `AAAA_MM_JJ_CA_BE_CLIENT_INTITULE_COM_DEVIS` ;
- BE ou Client obligatoire, avec possibilité de renseigner les deux ;
- valeurs inconnues normalisées avec `XX` ;
- nouvel onglet Transférer : sélection native Windows, préremplissage depuis le dossier, renommage et déplacement ;
- nouvel onglet Suivi AO avec statuts À attribuer, En cours, Envoyé, Gagné et Perdu ;
- date limite de remise et département suivis par AO ;
- historique partagé sous forme de journal d’actions ;
- filtres par personne, département, statut et recherche ;
- identification automatique par nom de PC et correspondance PC → personne modifiable ;
- aucune restriction de département liée à une personne ;
- base maître sans service applicatif : journal partagé sur un dossier réseau et SQLite local par poste, synchronisés toutes les 5 secondes ;
- scan configurable des dossiers Gagnés et Perdus ;
- verrou temporaire lors du transfert d’un même AO depuis plusieurs postes.

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
