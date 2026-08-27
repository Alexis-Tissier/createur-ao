# Contribuer à Créateur d’AO

Les retours, rapports de bugs et propositions d’amélioration sont bienvenus.

Créateur d’AO reste toutefois un **logiciel propriétaire**. La publication du code source permet son évaluation, son audit et la préparation de contributions, mais elle n’accorde pas un droit général de réutilisation, modification, redistribution ou commercialisation.

Avant de contribuer, consulter également [LICENSE](LICENSE).

---

## Signaler un bug

Utiliser le modèle d’Issue prévu à cet effet et fournir autant que possible :

- le comportement observé ;
- le comportement attendu ;
- les étapes permettant de reproduire le problème ;
- la version de Windows ;
- le contexte utile : installation locale ou déploiement serveur, poste unique ou multi-postes ;
- les messages d’erreur pertinents.

Ne jamais joindre :

- données métier confidentielles ;
- vrais chemins réseau internes ;
- noms de serveurs privés ;
- identifiants, mots de passe ou secrets ;
- bases SQLite contenant des données réelles.

Créer au besoin un exemple minimal et anonymisé.

---

## Proposer une amélioration

Une bonne proposition explique d’abord le problème à résoudre avant de décrire l’interface souhaitée.

Préciser :

1. le besoin utilisateur ;
2. le comportement actuel ;
3. le comportement proposé ;
4. les éventuels impacts sur le workflow existant ;
5. si la modification concerne l’interface, le backend, la synchronisation ou le déploiement.

---

## Environnement de développement

Prérequis :

- Node.js compatible avec le projet ;
- npm ;
- Windows recommandé pour tester les fonctions Electron et les chemins natifs.

Installation :

```bash
npm install
```

Démarrage en développement :

```bash
npm run dev
```

---

## Tests

Avant toute proposition de modification :

```bash
npm run check
```

Cette commande exécute les tests, construit l’interface et vérifie la syntaxe des fichiers principaux.

Les tests peuvent également être lancés seuls :

```bash
npm test
```

Les changements touchant la synchronisation doivent conserver le scénario de convergence entre deux postes.

---

## Principes à respecter

### Ne pas introduire de données privées

Le dépôt doit rester générique et réutilisable comme base technique sans exposer l’environnement dans lequel il est déployé.

Utiliser des exemples tels que :

```text
\\fileserver\shared\calls-for-tender
```

et non un vrai chemin d’entreprise.

### Préserver l’approche local-first

Une nouvelle fonctionnalité ne doit pas introduire une dépendance cloud ou serveur permanent sans justification architecturale forte.

### Préserver la compatibilité Windows

Les chemins, dialogues natifs et scripts de distribution doivent rester compatibles avec l’usage Windows visé.

### Éviter les opérations système inutiles

Le produit cherche à fonctionner sans élévation administrateur et avec un comportement lisible pour les outils EDR.

### Maintenir la séparation données / application

Les mises à jour applicatives ne doivent pas supprimer ou écraser les données locales utilisateur.

---

## Pull Requests

Une Pull Request doit idéalement :

- avoir un objectif unique ;
- expliquer clairement le problème résolu ;
- inclure ou adapter les tests lorsque cela est pertinent ;
- passer `npm run check` ;
- ne contenir aucune donnée personnelle ou métier ;
- ne modifier la documentation que si le nouveau comportement le nécessite.

---

## Contributions et droits

En soumettant volontairement une contribution au dépôt, le contributeur déclare disposer des droits nécessaires sur le contenu proposé et accorde au titulaire du projet une licence mondiale, permanente, irrévocable, transférable, sous-licenciable et libre de redevance permettant d’utiliser, reproduire, modifier, intégrer, distribuer et exploiter cette contribution dans Créateur d’AO, y compris dans des distributions propriétaires ou commerciales.

Cette autorisation sur une contribution n’accorde en retour aucun droit général sur le reste du logiciel au-delà de ce qui est explicitement prévu dans [LICENSE](LICENSE).

---

## Sécurité

Une vulnérabilité ne doit pas être décrite publiquement avec des détails permettant son exploitation.

Consulter [SECURITY.md](SECURITY.md) pour la procédure recommandée.
