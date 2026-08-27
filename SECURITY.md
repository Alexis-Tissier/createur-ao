# Sécurité

Ce document décrit le modèle de sécurité de Créateur d’AO et les précautions recommandées lors d’un déploiement en entreprise.

## Périmètre

Créateur d’AO est une application desktop Windows local-first.

Elle s’appuie principalement sur :

- une interface Electron/React ;
- une API locale liée au poste ;
- une base SQLite locale ;
- des emplacements de fichiers choisis par l’utilisateur ;
- éventuellement un partage réseau pour synchroniser plusieurs postes.

L’application n’a pas besoin d’un service cloud pour fonctionner normalement.

---

## API locale

L’API applicative écoute sur l’interface locale `127.0.0.1`.

Elle n’a pas vocation à être exposée directement sur le réseau local ou sur Internet.

Lors d’une modification du projet, conserver cette propriété sauf besoin explicitement documenté et sécurisé.

---

## Données

Les données de suivi sont stockées localement dans le profil Windows de l’utilisateur.

Les documents métier restent dans les emplacements configurés par l’organisation.

Lorsque la synchronisation est activée, le partage réseau transporte des événements légers servant à faire converger les bases locales.

Aucune donnée métier réelle, base SQLite de production, liste de personnes ou chemin réseau privé ne doit être ajouté au dépôt Git.

---

## Télémétrie

Le fonctionnement normal de l’application ne dépend pas d’une télémétrie externe.

Toute future fonctionnalité envoyant des données vers un service externe devrait être clairement documentée, configurable et soumise aux exigences de sécurité et de confidentialité de l’organisation concernée.

---

## Partage réseau

La sécurité du dossier maître et des dossiers métier dépend des contrôles fournis par l’environnement Windows :

- authentification ;
- autorisations SMB ;
- ACL NTFS ;
- segmentation réseau ;
- sauvegardes ;
- antivirus / EDR.

Créateur d’AO ne remplace pas ces mécanismes.

Il est recommandé d’appliquer le principe du moindre privilège : les utilisateurs doivent disposer uniquement des droits nécessaires à leur activité.

---

## Distribution de l’application

Le paquet serveur peut être placé sur un partage accessible en lecture par les utilisateurs.

La copie applicative de référence devrait être modifiable uniquement par les personnes chargées du déploiement afin d’éviter qu’un utilisateur standard puisse remplacer l’exécutable distribué à l’ensemble de l’équipe.

---

## Signature de code

Les exécutables générés peuvent être non signés si aucun certificat Authenticode n’est configuré.

Dans un contexte professionnel, une signature de code est recommandée pour :

- améliorer l’identification de l’éditeur ;
- réduire les alertes liées à la réputation SmartScreen ;
- faciliter la validation par les solutions EDR ;
- garantir l’intégrité de l’exécutable signé.

La signature ne remplace pas les tests de sécurité ni les contrôles antivirus.

---

## Intégrité des artefacts

Les builds peuvent être accompagnées d’empreintes SHA-256.

Avant un déploiement sensible, comparer l’empreinte du fichier reçu avec celle produite par le pipeline de build.

Exemple PowerShell :

```powershell
Get-FileHash .\Createur-AO-Setup.exe -Algorithm SHA256
```

---

## Sauvegardes

Les sauvegardes applicatives protègent les données de suivi, mais elles ne remplacent pas une politique de sauvegarde du serveur de fichiers.

L’organisation doit sauvegarder séparément les documents métier contenus dans les appels d’offres.

Tester périodiquement la restauration d’une sauvegarde est aussi important que sa création.

---

## Secrets

Aucun secret ne doit être commité dans le dépôt.

Cela inclut notamment :

- mots de passe ;
- jetons API ;
- identifiants de service ;
- certificats privés ;
- clés privées ;
- informations d’authentification réseau.

Les fichiers `.env` réels et les configurations spécifiques à un environnement doivent rester hors du contrôle de version.

---

## Signaler une vulnérabilité

Ne pas publier immédiatement une vulnérabilité exploitable dans une Issue publique.

Utiliser de préférence le mécanisme de signalement privé de vulnérabilité de GitHub lorsqu’il est disponible pour le dépôt.

Si aucun canal privé n’est disponible, ouvrir une Issue minimale indiquant qu’un problème de sécurité doit être discuté sans fournir de détail exploitable, afin qu’un canal adapté puisse être établi.

Un bon signalement contient :

- le composant concerné ;
- les conditions nécessaires à l’exploitation ;
- l’impact potentiel ;
- des étapes de reproduction minimales ;
- une proposition de correction si elle existe.

Ne jamais inclure de données réelles provenant d’un environnement de production.

---

## Modèle de menace simplifié

Les principaux risques à considérer sont :

1. **remplacement de la copie applicative sur le partage** — limiter les droits d’écriture ;
2. **accès non autorisé aux dossiers métier** — gérer les ACL au niveau du serveur ;
3. **altération des événements de synchronisation** — protéger le dossier maître par les permissions réseau ;
4. **perte de données locales** — conserver des sauvegardes ;
5. **exécutable non approuvé par l’EDR** — tester et, idéalement, signer le code ;
6. **publication accidentelle d’informations internes** — anonymiser les exemples et vérifier les commits avant publication.

---

## Dépendances

Les dépendances Node/Electron doivent être mises à jour de manière contrôlée.

Avant toute mise à jour importante :

- consulter les notes de sécurité ;
- exécuter les tests ;
- reconstruire l’application ;
- effectuer une recette Windows ;
- vérifier l’impact sur `better-sqlite3` et le packaging natif.
