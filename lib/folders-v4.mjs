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

  const ca = sanitizeSegment(input.ca, { upper: true });
  const be = sanitizeSegment(input.be, { upper: true });
  const client = sanitizeSegment(input.client, { upper: true });
  const title = sanitizeSegment(input.title);
  const commercial = sanitizeSegment(input.commercial, { upper: true });
  const quoteNumber = sanitizeSegment(input.quoteNumber, { upper: true });

  if (!ca) throw new Error('CA obligatoire. Utilisez XX si le chargé d’affaires n’est pas encore connu.');
  if (!be && !client) throw new Error('Renseignez au moins le bureau d’étude ou le client.');
  if (!title) throw new Error('Intitulé obligatoire.');

  return [
    match[1], match[2], match[3],
    ca,
    be || 'XX',
    client || 'XX',
    title,
    commercial || 'XX',
    quoteNumber || 'XX'
  ].join('_');
}

export function parseFolderName(folderName) {
  const name = path.basename(String(folderName || '').trim());
  const parts = name.split('_');
  if (parts.length < 8) return null;
  const [year, month, day] = parts;
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return null;

  if (parts.length >= 9) {
    const [y, m, d, ca, be, client, ...rest] = parts;
    const quoteNumber = rest.pop() || 'XX';
    const commercial = rest.pop() || 'XX';
    const title = rest.join('_');
    return {
      date: `${y}-${m}-${d}`,
      ca,
      be: be === 'XX' ? '' : be,
      client: client === 'XX' ? '' : client,
      title,
      commercial: commercial === 'XX' ? '' : commercial,
      quoteNumber: quoteNumber === 'XX' ? '' : quoteNumber
    };
  }

  const [y, m, d, ca, be, ...rest] = parts;
  const quoteNumber = rest.pop() || '';
  const commercial = rest.pop() || '';
  const title = rest.join('_');
  return {
    date: `${y}-${m}-${d}`,
    ca,
    be,
    client: '',
    title,
    commercial,
    quoteNumber
  };
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
