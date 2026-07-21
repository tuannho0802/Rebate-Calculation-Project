const fs = require('fs');
const path = require('path');

function readCsv(file) {
  const s = fs.readFileSync(file, 'utf8');
  const lines = s.split('\n').filter(Boolean);
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    // naive CSV split for this dataset (no commas inside fields except rows which use JSON with commas but wrapped in quotes)
    // We'll parse using a simple approach: split by , but respecting quotes
    const parts = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        cur += ch;
      } else if (ch === ',' && !inQuotes) {
        parts.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    parts.push(cur);
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = parts[i] === undefined ? '' : parts[i];
    }
    return obj;
  });
}

function buildIbMap(ibs) {
  const map = new Map();
  ibs.forEach(r => {
    map.set(r.id, { id: r.id, parentId: r.parentId || null, email: r.email });
  });
  return map;
}

function findRoot(ibId, ibMap) {
  let cur = ibId;
  const visited = new Set();
  while (cur) {
    if (visited.has(cur)) break;
    visited.add(cur);
    const node = ibMap.get(cur);
    if (!node) break;
    if (!node.parentId) return node.id;
    cur = node.parentId;
  }
  return ibId;
}

function inspect(ibId) {
  const dataDir = path.join(__dirname, '..', '..', 'db_new');
  const ibs = readCsv(path.join(dataDir, 'ib_nodes.csv'));
  // show first parsed rows
  // eslint-disable-next-line no-console
  console.log('first 3 parsed ib rows:', ibs.slice(0,3));
    // debug: show parsed entry for requested ibId
    const sample = ibs.find(r => r.id === ibId);
    // eslint-disable-next-line no-console
    console.log('parsed ib row for id', ibId, sample);
      // debug: show index and equality check
      // eslint-disable-next-line no-console
      console.log('indexOf id in parsed ids:', ibs.map(r => r.id).indexOf(ibId));
      // eslint-disable-next-line no-console
      console.log('ids slice:', ibs.map(r => r.id).slice(0,10));
  const accTemplates = readCsv(path.join(dataDir, 'account_type_templates.csv'));
  const markupTemplates = readCsv(path.join(dataDir, 'markup_link_templates.csv'));

  const ibMap = buildIbMap(ibs);
  const root = findRoot(ibId, ibMap);
  const accountTemplates = accTemplates.filter(t => t.ownerId === root).map(t => ({ id: t.id, name: t.name, rows: (() => {
    try { return JSON.parse(t.rows.replace(/""/g, '"')); } catch (e) { return t.rows; }
  })() }));
  const markup = markupTemplates.filter(m => m.ownerId === root).map(m => ({ id: m.id, name: m.name, share: Number(m.share) }));

  console.log('For ibId:', ibId);
  console.log('Resolved root ownerId:', root);
  console.log('Account templates:', accountTemplates);
  console.log('Markup templates:', markup);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node inspectTemplates.js <ibId>');
    process.exit(1);
  }
  inspect(String(args[0]).trim());
}
