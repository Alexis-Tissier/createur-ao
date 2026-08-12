import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFolderName, parseFolderName } from '../lib/folders-v4.mjs';

test('client vient après le BE dans le nom', () => {
  assert.equal(buildFolderName({
    date: '2026-08-12', ca: 'XX', be: 'BET', client: 'CLIENT', title: 'Travaux', commercial: 'XX', quoteNumber: 'XX'
  }), '2026_08_12_XX_BET_CLIENT_Travaux_XX_XX');
});

test('BE seul est accepté et client devient XX', () => {
  assert.equal(buildFolderName({
    date: '2026-08-12', ca: 'XX', be: 'BET', client: '', title: 'Travaux', commercial: '', quoteNumber: ''
  }), '2026_08_12_XX_BET_XX_Travaux_XX_XX');
});

test('client seul est accepté et BE devient XX', () => {
  assert.equal(buildFolderName({
    date: '2026-08-12', ca: 'XX', be: '', client: 'VILLE', title: 'Travaux', commercial: '', quoteNumber: ''
  }), '2026_08_12_XX_XX_VILLE_Travaux_XX_XX');
});

test('BE ou client est obligatoire', () => {
  assert.throws(() => buildFolderName({ date:'2026-08-12', ca:'XX', be:'', client:'', title:'Travaux' }), /bureau d’étude ou le client/i);
});

test('parse le nouveau format', () => {
  assert.deepEqual(parseFolderName('2026_08_12_XX_BET_CLIENT_Travaux_XX_XX'), {
    date:'2026-08-12', ca:'XX', be:'BET', client:'CLIENT', title:'Travaux', commercial:'', quoteNumber:''
  });
});
