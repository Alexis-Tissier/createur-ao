# Déploiement

Ce document décrit les méthodes recommandées pour installer et distribuer Créateur d’AO sur des postes Windows.

## Prérequis

- Windows 10 ou Windows 11 en 64 bits ;
- accès en lecture/écriture aux dossiers métier nécessaires ;
- accès au dossier maître partagé si la synchronisation multi-postes est utilisée ;
- droits suffisants pour écrire dans le profil local de l’utilisateur.

L’application est conçue pour fonctionner sans installation système globale ni élévation administrateur dans son mode standard.

---

## Méthode 1 — Installation classique

Le paquet Windows fournit un installateur :

```text
Createur-AO-Setup.exe
```

L’utilisateur lance l’installateur, choisit éventuellement son emplacement puis démarre l’application depuis le menu Démarrer ou le raccourci Bureau.

### Avantages

- installation familière pour l’utilisateur ;
- raccourcis Windows créés automatiquement ;
- application stockée localement ;
- aucune dépendance au partage réseau pour lancer l’exécutable lui-même.

### Limite

Lorsqu’une nouvelle build doit être distribuée, chaque utilisateur doit recevoir ou relancer le nouvel installateur.

---

## Méthode 2 — Distribution centralisée depuis un partage réseau

Cette méthode est recommandée lorsqu’une équipe utilise la même application depuis plusieurs postes.

Le paquet serveur contient une structure similaire à :

```text
Createur-AO-Serveur/
├── Lancer-Createur-AO.cmd
└── Createur-AO-win-x64/
    ├── Createur-AO.exe
    └── ...
```

Déposer ces éléments dans un dossier réseau accessible aux utilisateurs.

Exemple générique :

```text
\\fileserver\applications\Createur-AO
```

Ne pas utiliser dans la documentation publique un vrai nom de serveur ou un chemin interne d’entreprise.

---

## Fonctionnement du lanceur serveur

`Lancer-Createur-AO.cmd` ne lance pas directement Electron depuis le réseau.

Il utilise la logique suivante :

```text
Partage réseau
     │
     │ xcopy /D
     ▼
%LOCALAPPDATA%\CreateurAO\app
     │
     ▼
Createur-AO.exe
```

Le dossier de référence sur le serveur est comparé à la copie locale. Les fichiers plus récents sont copiés, puis l’exécutable local est lancé.

Cette approche offre deux avantages :

- lancement et utilisation plus rapides qu’une exécution directe sur SMB ;
- mise à jour centralisée : remplacer la copie serveur suffit pour que les postes récupèrent les fichiers plus récents au prochain lancement.

---

## Préparer le partage

### 1. Créer un dossier applicatif

Exemple :

```text
\\fileserver\applications\Createur-AO
```

### 2. Extraire le paquet serveur

Le dossier doit contenir directement :

```text
Lancer-Createur-AO.cmd
Createur-AO-win-x64\
```

### 3. Régler les permissions

Les utilisateurs ont seulement besoin de lire les fichiers applicatifs de référence.

Il est préférable que seuls les administrateurs ou responsables du déploiement puissent modifier le dossier contenant la build de référence.

### 4. Créer un raccourci

Créer pour les utilisateurs un raccourci Windows pointant vers :

```text
\\fileserver\applications\Createur-AO\Lancer-Createur-AO.cmd
```

Le raccourci peut être placé sur le Bureau, dans le menu Démarrer ou distribué par les outils habituels de l’organisation.

---

## Mettre à jour l’application centralisée

La procédure recommandée :

1. tester la nouvelle build sur un poste pilote ;
2. conserver une copie de la build actuellement déployée ;
3. fermer l’application sur les postes concernés si nécessaire ;
4. remplacer `Createur-AO-win-x64` sur le partage par la nouvelle build ;
5. lancer le raccourci sur un poste pilote ;
6. vérifier que la copie locale est bien rafraîchie ;
7. généraliser le lancement aux autres postes.

Les données utilisateur n’étant pas stockées dans le dossier applicatif copié, le remplacement de l’application ne doit pas supprimer la base locale du profil Windows.

---

## Retour arrière

En cas de problème avec une nouvelle build :

1. remettre sur le partage la copie applicative précédente ;
2. supprimer, si nécessaire, le dossier applicatif local `%LOCALAPPDATA%\CreateurAO\app` sur le poste pilote ;
3. relancer `Lancer-Createur-AO.cmd` ;
4. vérifier le fonctionnement avant de demander aux autres utilisateurs de relancer.

Ne pas supprimer le dossier contenant les données locales sans avoir identifié précisément son rôle et réalisé une sauvegarde.

---

## Données locales et application

Il faut distinguer :

```text
Application locale copiée
%LOCALAPPDATA%\CreateurAO\app
```

et les données SQLite stockées dans le profil utilisateur.

Cette séparation permet de remplacer les fichiers applicatifs sans perdre le suivi local.

---

## Dossier maître de synchronisation

Le dossier maître est indépendant du dossier de distribution de l’application.

Une organisation peut donc avoir :

```text
\\fileserver\applications\Createur-AO
```

pour les fichiers applicatifs et :

```text
\\fileserver\shared\Createur-AO-Data
```

pour la synchronisation.

Il est recommandé de les séparer afin de pouvoir attribuer des permissions différentes.

---

## Permissions recommandées

### Dossier applicatif de référence

Utilisateurs :

- lecture ;
- parcours des dossiers.

Responsables du déploiement :

- lecture ;
- écriture ;
- modification.

### Dossier maître

Les postes utilisant la synchronisation doivent pouvoir créer et lire les fichiers nécessaires dans la structure gérée par l’application.

Les permissions exactes dépendent de la politique de sécurité de l’organisation.

---

## Antivirus, SmartScreen et EDR

Un exécutable Electron non signé peut être considéré comme peu connu par Windows SmartScreen ou certains EDR, même lorsqu’il ne réalise aucune action malveillante.

Pour un déploiement professionnel large, la meilleure solution est de signer les exécutables avec un certificat Authenticode adapté à l’organisation.

Avant un déploiement général :

- tester l’installateur et l’exécutable sur un poste géré ;
- vérifier les journaux de l’EDR ;
- faire valider l’application par l’équipe informatique si nécessaire ;
- éviter de contourner ou désactiver les protections de sécurité pour installer l’application.

---

## Validation multi-postes avant déploiement

Avant de considérer l’installation comme prête, tester au minimum :

- premier lancement sur un poste vierge ;
- création d’un AO ;
- transfert d’un AO ;
- synchronisation entre deux postes ;
- modification sur le poste A visible sur le poste B ;
- modification sur le poste B visible sur le poste A ;
- coupure temporaire du partage puis reconnexion ;
- scan des statuts ;
- création et restauration d’une sauvegarde de test ;
- mise à jour de la copie applicative depuis le serveur ;
- lancement via le raccourci réseau sans droits administrateur.

---

## Build du paquet Windows

Pour générer localement les artefacts Windows :

```bash
npm install
npm run dist:win
```

Le workflow GitHub Windows construit également :

- l’installateur ;
- l’exécutable portable ;
- le paquet serveur ;
- les empreintes SHA-256.

---

## Vérification d’intégrité

Lorsqu’un fichier `SHA256SUMS.txt` accompagne les artefacts, il peut être utilisé pour vérifier qu’un paquet n’a pas été altéré pendant son transfert.

Sous PowerShell, par exemple :

```powershell
Get-FileHash .\Createur-AO-Setup.exe -Algorithm SHA256
```

Comparer ensuite la valeur avec l’empreinte attendue.
