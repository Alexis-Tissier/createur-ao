import path from 'node:path';

export function sanitizeSegment(value, { upper = false } = {}) {
  let text = String(value ?? '').trim();
  text = text.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
  text = text.replace(/_+/g, '-');
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/[. ]+$/g, '');
  if (upper) text = text.toUpperCase();
  return text;
}

export function buildFolderName(input) {
  const date = String(input.date ?? '').trim();
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Date invalide.');

  const required = [
    ['CA', sanitizeSegment(input.ca, { upper: true })],
    ['BE', sanitizeSegment(input.be, { upper: true })],
    ['Intitulé', sanitizeSegment(input.title)]
  ];
  for (const [label, value] of required) {
    if (!value) throw new Error(`${label} obligatoire.`);
  }

  const commercial = sanitizeSegment(input.commercial, { upper: true });
  const quoteNumber = sanitizeSegment(input.quoteNumber, { upper: true });

  const name = [
    match[1],
    match[2],
    match[3],
    required[0][1],
    required[1][1],
    required[2][1],
    commercial,
    quoteNumber
  ].join('_');

  return !commercial && !quoteNumber ? `${name}_` : name;
}

export function normalizeTree(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .map((node) => ({
      id: String(node?.id || cryptoRandomId()),
      name: sanitizeSegment(node?.name),
      children: normalizeTree(node?.children)
    }))
    .filter((node) => node.name);
}

function cryptoRandomId() {
  return `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function createFolderTree({ fs, basePath, folderName, tree }) {
  const root = path.resolve(basePath, folderName);
  await fs.mkdir(root, { recursive: false });

  async function createChildren(parent, nodes) {
    for (const node of normalizeTree(nodes)) {
      const child = path.join(parent, node.name);
      await fs.mkdir(child, { recursive: false });
      await createChildren(child, node.children);
    }
  }

  try {
    await createChildren(root, tree);
    return root;
  } catch (error) {
    await fs.rm(root, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export async function writeContactsFile({ fs, rootPath, contact }) {
  const filePath = path.join(rootPath, 'CONTACTS.txt');
  await fs.writeFile(filePath, String(contact ?? ''), 'utf8');
  return filePath;
}
