# Changelog

## v0.4.0

- ajout du champ Client après le BE dans le nom `AAAA_MM_JJ_CA_BE_CLIENT_INTITULE_COM_DEVIS` ;
- BE ou Client obligatoire, avec possibilité de renseigner les deux ;
- valeurs inconnues normalisées avec `XX` ;
- Commercial et N° devis Onaya restent réellement facultatifs, tout en conservant leurs emplacements par underscores dans le nom ;
- nouvel onglet Transférer : sélection native Windows, préremplissage depuis le dossier, renommage et déplacement ;
- séparation des destinations de création et des destinations de transfert dans Réglages ;
- une destination de transfert pointe vers la racine du service ; l’application place l’AO dans le sous-dossier commençant par `2 ` ;
- suivi automatique du statut d’après le chemin du dossier : `2 ` = En cours, `3 ` = Envoyé / attente de décision, `4 ` = Gagné, `5 ` = Perdu ; le texte après le numéro n’est pas imposé, ce qui accepte notamment `2 Offre en cours` et `2 Offres en cours` ;
- l’échéance affichée est automatiquement la date de l’AO ; aucun second champ de date limite n’est à saisir ;
- suppression du département comme donnée à renseigner dans l’interface : la destination de transfert représente directement le lieu/service ;
- interface v0.4 rendue plus compacte : titres, marges, champs, cartes et lignes de suivi réduits pour limiter le défilement ;
- nouvel onglet Suivi AO avec statuts À attribuer, En cours, Envoyé, Gagné et Perdu ;
- historique partagé sous forme de journal d’actions ;
- filtres par personne, destination, statut et recherche ;
- identification automatique par nom de PC et correspondance PC → personne modifiable ;
- une même personne peut créer et transférer des AO vers toutes les destinations ;
- base maître sans service applicatif : journal partagé sur un dossier réseau et SQLite local par poste, synchronisés toutes les 5 secondes ;
- au premier rattachement à la base maître, l’historique local existant est partagé ; les anciens AO utilisent un identifiant déterministe basé sur leur nom afin d’éviter les doublons entre postes ;
- verrou temporaire lors du transfert d’un même AO depuis plusieurs postes, avec récupération automatique d’un verrou abandonné ;
- migration des bases v0.3 durcie afin de conserver les données locales et les relances existantes lors du passage à la v0.4.

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
