# Architecture

- `src/` : interface React/Vite.
- `server.mjs` : API locale, SQLite et création des dossiers.
- `lib/folders.mjs` : convention de nommage et création récursive de l'arborescence.
- `data/` : base locale ignorée par Git.

## Tables SQLite

- `destinations` : noms et chemins configurés localement ;
- `offers` : appels d'offres créés et métadonnées ;
- `followups` : relances ;
- `settings` : configuration, dont l'arborescence JSON.

Le serveur écoute uniquement sur `127.0.0.1`.
