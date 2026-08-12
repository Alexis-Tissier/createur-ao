# Architecture v0.4

## Poste utilisateur

- React/Vite + Electron ;
- API locale sur `127.0.0.1` ;
- SQLite local dans `%LOCALAPPDATA%\CreateurAO\data` pour garder une interface rapide.

## Base maître sans serveur applicatif

Le dossier maître est choisi dans Réglages et reste hors du dépôt Git. L'application y crée `Createur-AO-Base`.

Chaque PC possède son propre journal sous `peers/<PC_ID>/events`. Il est le seul à écrire dans ce dossier ; les autres postes ne font que le lire. Les événements ont un numéro de séquence et un UUID, ce qui rend leur import idempotent. La synchronisation tourne toutes les 5 secondes.

Le SQLite n'est donc jamais ouvert directement à travers SMB : le partage réseau transporte uniquement de petits événements JSON atomiques, tandis que chaque poste matérialise l'état dans son SQLite local.

## Métier

- nom de dossier : `AAAA_MM_JJ_CA_BE_CLIENT_INTITULE_COM_DEVIS` ;
- BE ou Client obligatoire, les deux possibles ;
- Transfert : sélection native d'un dossier, relecture du nom, renommage puis déplacement ;
- statuts : À attribuer, En cours, Envoyé, Gagné, Perdu ;
- historique partagé des actions avec identification automatique par nom du PC ;
- table de correspondance PC → personne modifiable dans Réglages ;
- aucune restriction de département par personne ;
- scan optionnel de dossiers Gagnés et Perdus.
