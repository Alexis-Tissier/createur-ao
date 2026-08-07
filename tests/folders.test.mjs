import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildFolderName, createFolderTree, sanitizeSegment } from '../lib/folders.mjs';

test('construit le nom sans underscore devant l’année', () => {
  assert.equal(
    buildFolderName({
      date: '2026-08-07',
      ca: 'ca1',
      be: 'be1',
      title: 'Collège Victor Hugo',
      commercial: 'com1',
      quoteNumber: 'DEV-4582'
    }),
    '2026_08_07_CA1_BE1_Collège Victor Hugo_COM1_DEV-4582'
  );
});

test('conserve le segment commercial vide', () => {
  assert.equal(
    buildFolderName({ date: '2026-08-07', ca: 'AT', be: 'BE', title: 'AO', commercial: '', quoteNumber: '1234' }),
    '2026_08_07_AT_BE_AO__1234'
  );
});

test('le numéro de devis est facultatif et conserve son séparateur', () => {
  assert.equal(
    buildFolderName({ date: '2026-08-07', ca: 'AT', be: 'BE', title: 'AO', commercial: 'COM', quoteNumber: '' }),
    '2026_08_07_AT_BE_AO_COM_'
  );
});

test('les deux champs facultatifs peuvent rester vides', () => {
  assert.equal(
    buildFolderName({ date: '2026-08-07', ca: 'AT', be: 'BE', title: 'AO', commercial: '', quoteNumber: '' }),
    '2026_08_07_AT_BE_AO___'
  );
});

test('nettoie les caractères interdits Windows', () => {
  assert.equal(sanitizeSegment('A/B:C*D?'), 'A-B-C-D-');
});

test('crée toute l’arborescence', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'createur-ao-'));
  try {
    const root = await createFolderTree({
      fs,
      basePath: base,
      folderName: '2026_08_07_AT_BE_TEST__123',
      tree: [{ id: '1', name: 'A', children: [{ id: '2', name: 'B', children: [] }] }]
    });
    const stat = await fs.stat(path.join(root, 'A', 'B'));
    assert.equal(stat.isDirectory(), true);
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
});
