import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.version = '0.4.0';
pkg.description = "Création, transfert et suivi partagé des appels d'offres.";
pkg.scripts.check = 'npm test && npm run build && node --check server.mjs && node --check server-v4.mjs && node --check desktop/main.cjs && node --check desktop/preload.cjs';
if (!pkg.build.files.includes('server-v4.mjs')) pkg.build.files.splice(pkg.build.files.indexOf('server.mjs') + 1, 0, 'server-v4.mjs');
fs.writeFileSync('package.json', `${JSON.stringify(pkg,null,2)}\n`);

fs.writeFileSync('server.mjs', "import './server-v4.mjs';\n");
fs.writeFileSync('src/main.jsx', `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './AppV4.jsx';\nimport './styles.css';\nimport './styles-v4.css';\n\ncreateRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`);

const architecture = `# Architecture v0.4\n\n## Poste utilisateur\n\n- React/Vite + Electron ;\n- API locale sur \`127.0.0.1\` ;\n- SQLite local dans \`%LOCALAPPDATA%\\CreateurAO\\data\` pour garder une interface rapide.\n\n## Base maître sans serveur applicatif\n\nLe dossier maître est choisi dans Réglages et reste hors du dépôt Git. L'application y crée \`Createur-AO-Base\`.\n\nChaque PC possède son propre journal sous \`peers/<PC_ID>/events\`. Il est le seul à écrire dans ce dossier ; les autres postes ne font que le lire. Les événements ont un numéro de séquence et un UUID, ce qui rend leur import idempotent. La synchronisation tourne toutes les 5 secondes.\n\nLe SQLite n'est donc jamais ouvert directement à travers SMB : le partage réseau transporte uniquement de petits événements JSON atomiques, tandis que chaque poste matérialise l'état dans son SQLite local.\n\n## Métier\n\n- nom de dossier : \`AAAA_MM_JJ_CA_BE_CLIENT_INTITULE_COM_DEVIS\` ;\n- BE ou Client obligatoire, les deux possibles ;\n- Transfert : sélection native d'un dossier, relecture du nom, renommage puis déplacement ;\n- statuts : À attribuer, En cours, Envoyé, Gagné, Perdu ;\n- historique partagé des actions avec identification automatique par nom du PC ;\n- table de correspondance PC → personne modifiable dans Réglages ;\n- aucune restriction de département par personne ;\n- scan optionnel de dossiers Gagnés et Perdus.\n`;
fs.writeFileSync('ARCHITECTURE.md', architecture);

const readme = fs.readFileSync('README.md','utf8');
const intro = `# Créateur d’AO\n\nApplication Windows React/Electron de création, transfert et suivi partagé des appels d'offres.\n\n## v0.4\n\n- ajout du Client après le BE dans le nom ;\n- BE ou Client obligatoire, les deux possibles ;\n- onglet Transférer avec sélecteur natif Windows, renommage et déplacement ;\n- suivi À attribuer / En cours / Envoyé / Gagné / Perdu ;\n- échéances de remise ;\n- historique partagé et filtres par personne, département et statut ;\n- identification par nom du PC et mapping PC → personne ;\n- base maître sans service : journaux d'événements sur un partage réseau, SQLite local sur chaque poste, synchronisation toutes les 5 secondes ;\n- scan configurable des dossiers Gagnés et Perdus.\n\nLe chemin réel du partage d'entreprise n'est jamais versionné : il est sélectionné dans Réglages sur chaque poste.\n\n`;
const oldBody = readme.replace(/^# Créateur d’AO\s*/,'');
fs.writeFileSync('README.md', intro + '## Historique du projet\n\n' + oldBody);
