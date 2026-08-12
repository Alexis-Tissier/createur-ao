# Créateur d’AO

Application Windows React/Electron de création, transfert et suivi partagé des appels d'offres.

## v0.4

- ajout du Client après le BE dans le nom ;
- BE ou Client obligatoire, les deux possibles ;
- onglet Transférer avec sélecteur natif Windows, renommage et déplacement ;
- suivi À attribuer / En cours / Envoyé / Gagné / Perdu ;
- échéances de remise ;
- historique partagé et filtres par personne, département et statut ;
- identification par nom du PC et mapping PC → personne ;
- base maître sans service : journaux d'événements sur un partage réseau, SQLite local sur chaque poste, synchronisation toutes les 5 secondes ;
- scan configurable des dossiers Gagnés et Perdus.

Le chemin réel du partage d'entreprise n'est jamais versionné : il est sélectionné dans Réglages sur chaque poste.

## Historique du projet

Application locale React + Node/Electron destinée à créer des dossiers d'appels d'offres selon une convention de nommage fixe, générer leur arborescence et conserver un historique de suivi.

## Fonctions

- nommage : `AAAA_MM_JJ_CA_BE_INTITULE_COM_DEVIS` ;
- commercial et numéro de devis facultatifs sans suppression de leur emplacement dans le nom ;
- aucune destination présélectionnée lors de la création d’un AO ;
- destinations configurables et sélecteur de dossier natif Windows ;
- conversion des lecteurs réseau mappés vers un chemin UNC quand Windows expose le partage ;
- arborescence récursive modifiable ;
- création réelle des dossiers ;
- historique, contacts, remarques, relances et suppression d’une ligne créée par erreur ;
- base SQLite locale ;
- modèle de démarrage JSON utilisé une seule fois pour initialiser destinations + arborescence sur un nouveau poste ;
- aucune donnée métier ou chemin réseau réel versionné.

## Développement local sans droits administrateur

Node portable peut rester dans :

```text
%USERPROFILE%\Downloads\node-vXX-win-x64
```

Puis lancer :

```cmd
lancer-local.bat
```

Le premier lancement installe les dépendances dans le dossier du projet, puis ouvre Créateur d'AO dans une fenêtre Electron.

## Construction Windows

La v0.3.0 active la distribution Windows Electron. Le workflow GitHub Actions `.github/workflows/windows-build.yml` produit :

- `Createur-AO-Setup.exe` : installateur utilisateur, sans élévation administrateur ;
- `Createur-AO-portable.exe` : exécutable portable mono-fichier ;
- `Createur-AO-Serveur.zip` : paquet prêt à extraire sur le serveur, avec l’application Windows décompressée et son lanceur local ;
- `SHA256SUMS.txt` : empreintes SHA-256 des fichiers distribués.

Construction locale éventuelle :

```cmd
npm install
npm run dist:win
```

Les fichiers sont générés dans `release/`.

## Logo Windows

Le même logo orange « C » est utilisé :

- dans l’interface ;
- comme icône de l’exécutable ;
- dans la barre des tâches Windows ;
- dans la barre de titre de la fenêtre ;
- sur les raccourcis Bureau / menu Démarrer ;
- comme favicon de l’interface.

L’icône `.ico` est reconstruite depuis `build/icon.ico.b64` avant chaque build afin de rester versionnable via GitHub.

## Données locales

Dans l’application packagée, SQLite est stocké dans le profil utilisateur Windows d’Electron, pas à côté de l’exécutable. Chaque poste conserve donc sa base indépendamment de l’emplacement serveur de l’application.

Les données locales, chemins réseau, bases SQLite et modèles d’entreprise réels ne doivent jamais être ajoutés au dépôt Git.

## Modèle de démarrage

Depuis **Réglages > Modèle de démarrage**, la configuration courante (destinations + arborescence) peut être enregistrée dans un fichier JSON sur le serveur.

Au premier lancement sur un nouveau poste, l’utilisateur sélectionne ce fichier : son contenu est copié dans la base SQLite locale. Le fichier source n’est ensuite plus utilisé par ce poste.

## Distribution depuis un serveur

Pour limiter les accès réseau et garder un lancement rapide, la méthode recommandée en entreprise est `Createur-AO-Serveur.zip` :

1. extraire le ZIP directement sur le partage serveur ;
2. il contient déjà `Createur-AO-win-x64` et `Lancer-Createur-AO.cmd` côte à côte ;
3. l’utilisateur lance uniquement `Lancer-Createur-AO.cmd` ;
4. le script synchronise l’application vers `%LOCALAPPDATA%\CreateurAO\app` avec `xcopy /D`, puis exécute la copie locale.

Aucun droit administrateur n’est requis et le lanceur n’utilise pas PowerShell.

## Antivirus / EDR

Le projet évite les comportements inutiles pouvant augmenter les alertes EDR : pas de PowerShell au lancement, pas de modification système, installation utilisateur et exécution locale. Un exécutable Electron non signé peut néanmoins provoquer un faux positif selon la politique de sécurité de l’entreprise. Une signature Authenticode reste la meilleure façon de réduire ce risque si l’entreprise dispose d’un certificat de signature de code.
