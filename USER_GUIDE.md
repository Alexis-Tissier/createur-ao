# Guide utilisateur

Ce guide explique le fonctionnement de Créateur d’AO depuis le premier lancement jusqu’au suivi quotidien des dossiers.

## 1. Installer et lancer l’application

Créateur d’AO fonctionne sous Windows.

Deux modes de distribution sont possibles :

- installation classique avec `Createur-AO-Setup.exe` ;
- lancement depuis un partage réseau à l’aide du paquet serveur décrit dans [DEPLOYMENT.md](DEPLOYMENT.md).

L’installation standard est prévue pour le profil utilisateur et ne nécessite pas de droits administrateur dans sa configuration habituelle.

---

## 2. Premier lancement

Au premier démarrage, il est recommandé de configurer l’application avant de créer un premier AO.

### Destinations de création

Une destination de création correspond à un emplacement dans lequel un nouvel appel d’offres peut être généré.

Exemple générique :

```text
D:\Appels-Offres\Nouveaux
```

ou sur un partage réseau :

```text
\\fileserver\shared\calls-for-tender\incoming
```

### Destinations de transfert

Une destination de transfert correspond généralement à la racine d’un service ou d’une zone métier contenant les dossiers de workflow.

Exemple :

```text
Service-A\
├── 2 Offres en cours
├── 3 Offre en attente de décision
├── 4 Offre gagnée à sauvegarder
└── 5 Offre perdue
```

Le texte situé après `2`, `3`, `4` ou `5` peut varier. Le préfixe numérique est l’élément utilisé pour reconnaître l’état.

### Arborescence

L’arborescence définit les sous-dossiers automatiquement créés dans chaque nouvel AO.

Elle peut être modifiée dans les réglages afin de correspondre au fonctionnement de l’organisation.

### Base maître

Pour partager le suivi entre plusieurs postes, choisir un dossier commun accessible en lecture/écriture par les utilisateurs concernés.

L’application y crée sa propre structure de synchronisation. Il n’est pas nécessaire d’y placer manuellement une base SQLite.

### Correspondance PC → personne

Créateur d’AO identifie automatiquement le nom du poste Windows. Une correspondance peut ensuite associer ce poste à un nom d’utilisateur lisible dans l’historique.

Cette correspondance reste configurable dans les réglages.

---

## 3. Modèle de démarrage

Une configuration prête à l’emploi peut être enregistrée dans un fichier JSON.

Ce modèle peut contenir notamment :

- les destinations ;
- l’arborescence ;
- certains réglages utiles au premier démarrage.

Sur un nouveau poste, sélectionner ce fichier permet d’initialiser rapidement l’application.

Le modèle est copié dans la configuration locale : le poste n’a pas besoin de relire constamment le fichier source pour fonctionner.

Éviter de publier un modèle contenant des chemins privés dans un dépôt public.

---

## 4. Créer un appel d’offres

Ouvrir l’onglet de création puis renseigner les informations nécessaires.

Selon la configuration actuelle, les principaux champs peuvent inclure :

- date ;
- CA ;
- BE ;
- Client ;
- intitulé ;
- commercial ;
- numéro de devis ;
- contact ;
- prix ;
- destination.

Le BE ou le Client doit être renseigné. Les champs réellement facultatifs peuvent rester vides.

### Convention de nommage

Le dossier final suit la structure :

```text
AAAA_MM_JJ_CA_BE_CLIENT_INTITULE_COM_DEVIS
```

L’objectif n’est pas seulement esthétique : cette convention rend les dossiers lisibles, triables et interprétables par l’application.

### Création physique

Après validation, l’application :

1. normalise le nom ;
2. crée le dossier dans la destination choisie ;
3. génère l’arborescence configurée ;
4. crée les fichiers auxiliaires nécessaires, par exemple `PRIX.txt` ;
5. ajoute l’AO dans le suivi ;
6. journalise l’action.

---

## 5. Transférer un AO

L’onglet **Transférer** sert à reprendre un dossier déjà créé et à l’envoyer vers une destination métier.

### Étapes

1. sélectionner le dossier avec le sélecteur Windows ;
2. vérifier les informations relues depuis le nom ou le suivi ;
3. compléter ou corriger les champs si nécessaire ;
4. choisir la destination de transfert ;
5. valider.

L’application renomme le dossier si nécessaire puis le déplace vers le sous-dossier correspondant au workflow.

Un transfert réussi met également à jour le suivi.

---

## 6. Comprendre les statuts

### À attribuer

L’AO existe dans le suivi mais n’est pas encore placé dans un emplacement correspondant au workflow actif.

### En cours

Le dossier se trouve dans un emplacement commençant par :

```text
2 ...
```

### Envoyé

Le dossier se trouve dans un emplacement commençant par :

```text
3 ...
```

### Gagné

Le dossier se trouve dans un emplacement commençant par :

```text
4 ...
```

### Perdu

Le dossier se trouve dans un emplacement commençant par :

```text
5 ...
```

### Introuvable

Le dossier précédemment suivi n’est plus présent à son emplacement attendu alors que l’emplacement de référence est accessible.

Ce statut peut apparaître si le dossier a été supprimé ou déplacé manuellement hors des emplacements connus.

---

## 7. Suivre les AO

La vue de suivi permet de retrouver les dossiers sans parcourir manuellement le serveur de fichiers.

Les informations disponibles peuvent inclure :

- nom du dossier ;
- contact ;
- prix ;
- statut ;
- emplacement ;
- personne ayant effectué la dernière action ;
- remarque ;
- relance.

Les filtres permettent de réduire la liste par personne, destination, statut ou recherche textuelle.

---

## 8. Modifier le prix

Le prix peut être modifié depuis le suivi.

Lorsqu’un dossier possède un fichier `PRIX.txt`, l’application maintient cette information avec le dossier afin qu’elle reste accessible même en dehors de l’interface.

Le contenu attendu est une valeur simple, par exemple :

```text
12500
```

Éviter d’ajouter du texte libre dans `PRIX.txt`.

---

## 9. Contacts et remarques

Le champ contact peut contenir une information utile à l’ouverture rapide d’un e-mail ou d’une ressource associée selon le format utilisé.

Les remarques permettent de conserver une information courte liée au suivi sans modifier le contenu métier du dossier.

---

## 10. Historique

Les principales opérations sont journalisées afin de pouvoir retracer la vie d’un AO.

L’historique permet notamment d’identifier :

- le type d’action ;
- le poste à l’origine de l’action ;
- la personne associée au poste lorsque cette correspondance est configurée ;
- le dossier concerné.

La suppression d’une ligne de suivi créée par erreur ne signifie pas nécessairement la suppression du dossier physique : toujours vérifier l’action affichée avant validation.

---

## 11. Synchronisation entre plusieurs postes

Lorsque plusieurs ordinateurs utilisent le même dossier maître, les modifications sont échangées automatiquement.

Exemple :

1. le poste A crée un AO ;
2. son événement est écrit dans le dossier maître ;
3. le poste B lit cet événement ;
4. sa base locale est mise à jour ;
5. l’AO apparaît dans son suivi.

Le même principe s’applique aux modifications effectuées ensuite.

Une courte latence est normale : la synchronisation est périodique et n’est pas un système de messagerie temps réel.

---

## 12. Scanner les statuts

Le scan permet de réconcilier le suivi avec les emplacements physiques.

Il est utile lorsqu’un utilisateur a déplacé un dossier directement dans l’Explorateur Windows ou lorsqu’un statut doit être recalculé à partir de son emplacement réel.

Le scanner se concentre sur les dossiers de workflow connus et évite de parcourir inutilement tout le contenu interne des AO.

---

## 13. Sauvegarder

Les réglages prévoient la création de sauvegardes de la base locale.

Avant une opération importante ou une restauration, il est recommandé de créer une sauvegarde manuelle.

Les sauvegardes de l’application ne remplacent pas la sauvegarde du serveur de fichiers : les documents contenus dans les AO doivent être protégés par la stratégie habituelle de l’organisation.

---

## 14. Restaurer

Une restauration remplace l’état local par une sauvegarde antérieure.

Avant de restaurer :

1. fermer les opérations en cours ;
2. vérifier la date de la sauvegarde choisie ;
3. créer une sauvegarde de sécurité de l’état actuel ;
4. restaurer ;
5. relancer l’application et vérifier le suivi.

Dans un environnement multi-postes, tenir compte du fait que certains événements plus récents peuvent encore exister dans le dossier maître.

---

## 15. En cas de problème réseau

Si le partage est inaccessible :

- vérifier d’abord l’accès au dossier dans l’Explorateur Windows ;
- ne pas supprimer ou recréer immédiatement la configuration ;
- attendre le retour du réseau puis relancer une synchronisation ;
- vérifier que le lecteur mappé ou le chemin UNC utilisé est toujours valide.

Une indisponibilité réseau n’implique pas que les AO aient été supprimés.

---

## 16. Bonnes pratiques

- utiliser des destinations clairement nommées ;
- éviter de renommer manuellement un AO après son intégration au suivi ;
- privilégier le transfert depuis l’application ;
- conserver une arborescence commune à l’équipe ;
- associer chaque poste à la bonne personne ;
- vérifier régulièrement les sauvegardes ;
- tester toute nouvelle configuration sur un dossier non critique avant généralisation.

---

## Aller plus loin

- [Architecture technique](ARCHITECTURE.md)
- [Déploiement](DEPLOYMENT.md)
- [Sécurité](SECURITY.md)
