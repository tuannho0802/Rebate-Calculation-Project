const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function redactRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = Array.isArray(row) ? [...row] : { ...row };
  for (const k of Object.keys(out)) {
    if (/(password|token|secret)/i.test(k)) {
      out[k] = '[REDACTED]';
    }
  }
  return out;
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml'].includes(ext);
}

function shouldSkipDir(dirName) {
  return (
    dirName === 'node_modules' ||
    dirName === '.git' ||
    dirName === '.next' ||
    dirName === 'dist' ||
    dirName === 'build' ||
    dirName === 'coverage' ||
    dirName === '.turbo' ||
    dirName === '.vercel'
  );
}

function walkFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        if (!shouldSkipDir(ent.name)) stack.push(full);
      } else if (ent.isFile()) {
        if (isTextFile(full)) out.push(full);
      }
    }
  }
  return out;
}

function lowerFirst(s) {
  return s.length === 0 ? s : s[0].toLowerCase() + s.slice(1);
}

function toPrismaClientField(modelName) {
  return lowerFirst(modelName);
}

function escapeMd(s) {
  return String(s).replace(/\r\n/g, '\n');
}

async function main() {
  const backendDir = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(backendDir, '..');

  require('dotenv').config({ path: path.join(backendDir, '.env') });

  const prisma = new PrismaClient();

  const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
  const schemaText = fs.readFileSync(schemaPath, 'utf8');

  const keywordRe = /(rebateConfig|RebateConfig|markupPips|rebatePips|getConfig|updateConfig|bulkUpdateConfig)/;

  const allTextFiles = walkFiles(repoRoot);
  const hitsByFile = {};
  for (const f of allTextFiles) {
    const rel = path.relative(repoRoot, f).replace(/\\/g, '/');
    let content;
    try {
      content = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    const hits = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (keywordRe.test(line)) {
        hits.push({ line: i + 1, text: line });
      }
    }
    if (hits.length > 0) hitsByFile[rel] = hits;
  }

  const pageFiles = allTextFiles
    .filter((p) => p.replace(/\\/g, '/').includes('rebate-frontend/src/app/') && p.endsWith('/page.tsx'));
  const rebatePages = [];
  for (const p of pageFiles) {
    const rel = path.relative(repoRoot, p).replace(/\\/g, '/');
    let content;
    try {
      content = fs.readFileSync(p, 'utf8');
    } catch {
      continue;
    }
    if (!keywordRe.test(content) && !/rebateApi\./.test(content)) continue;
    const lines = content.split(/\r?\n/);
    const apiLines = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (/rebateApi\./.test(line) || /\/rebate\//.test(line) || /\/rebate\/config/.test(line)) {
        apiLines.push({ line: i + 1, text: line });
      }
    }
    rebatePages.push({ file: rel, apiLines });
  }

  const modelRe = /^\s*model\s+(\w+)\s+\{/gm;
  const models = [];
  for (;;) {
    const m = modelRe.exec(schemaText);
    if (!m) break;
    models.push(m[1]);
  }
  const backendSrcDir = path.join(backendDir, 'src');
  const backendFiles = walkFiles(backendSrcDir).filter((p) => p.endsWith('.ts'));
  const backendText = backendFiles
    .map((p) => {
      try {
        return fs.readFileSync(p, 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');
  const orphanModels = [];
  for (const modelName of models) {
    const field = toPrismaClientField(modelName);
    const re = new RegExp(`\\bprisma\\.${field}\\b`, 'g');
    if (!re.test(backendText)) orphanModels.push({ model: modelName, prismaField: field });
  }

  let tables;
  try {
    tables = await prisma.$queryRawUnsafe(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    );
  } catch (e) {
    tables = { error: String(e) };
  }

  const tableDump = [];
  if (Array.isArray(tables)) {
    for (const t of tables) {
      const tablename = t.tablename;
      const qi = quoteIdent(tablename);
      let countRes;
      let sampleRes;
      try {
        countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM ${qi}`);
      } catch (e) {
        countRes = { error: String(e) };
      }
      try {
        sampleRes = await prisma.$queryRawUnsafe(`SELECT * FROM ${qi} LIMIT 3`);
        if (Array.isArray(sampleRes)) sampleRes = sampleRes.map(redactRow);
      } catch (e) {
        sampleRes = { error: String(e) };
      }
      tableDump.push({
        table: tablename,
        sql_count: `SELECT COUNT(*) FROM ${tablename};`,
        result_count: countRes,
        sql_sample: `SELECT * FROM ${tablename} LIMIT 3;`,
        result_sample: sampleRes,
      });
    }
  }

  const mibEmail = 'mib@test.com';
  let mibRow;
  let mibSubtree;
  let mibRebateConfigs;
  try {
    const rows = await prisma.$queryRaw`SELECT id, email, level, "parentId" FROM ib_nodes WHERE email = ${mibEmail} LIMIT 1`;
    mibRow = rows[0] ?? null;
  } catch (e) {
    mibRow = { error: String(e) };
  }
  try {
    mibSubtree = await prisma.$queryRaw`
      WITH RECURSIVE subtree AS (
        SELECT id, email, level, "parentId"
        FROM ib_nodes
        WHERE email = ${mibEmail}
        UNION ALL
        SELECT n.id, n.email, n.level, n."parentId"
        FROM ib_nodes n
        INNER JOIN subtree s ON n."parentId" = s.id
      )
      SELECT * FROM subtree ORDER BY level ASC, email ASC
    `;
    if (Array.isArray(mibSubtree)) mibSubtree = mibSubtree.map(redactRow);
  } catch (e) {
    mibSubtree = { error: String(e) };
  }
  try {
    mibRebateConfigs = await prisma.$queryRaw`
      WITH RECURSIVE subtree AS (
        SELECT id
        FROM ib_nodes
        WHERE email = ${mibEmail}
        UNION ALL
        SELECT n.id
        FROM ib_nodes n
        INNER JOIN subtree s ON n."parentId" = s.id
      )
      SELECT *
      FROM rebate_configs
      WHERE "ibId" IN (SELECT id FROM subtree)
      ORDER BY "ibId" ASC, "assetType" ASC, "rebateType" ASC
    `;
    if (Array.isArray(mibRebateConfigs)) mibRebateConfigs = mibRebateConfigs.map(redactRow);
  } catch (e) {
    mibRebateConfigs = { error: String(e) };
  }

  const outPath = path.join(backendDir, 'SYSTEM_SNAPSHOT.md');
  const nowIso = new Date().toISOString();

  let md = '';
  md += `# SYSTEM_SNAPSHOT\\n\\n`;
  md += `GeneratedAt: ${nowIso}\\n\\n`;
  md += `RepoRoot: ${repoRoot.replace(/\\\\/g, '/')}\\n\\n`;

  md += `## PHẦN 1 — SCHEMA THẬT (nguyên văn)\\n\\n`;
  md += `File: rebate-backend/prisma/schema.prisma\\n\\n`;
  md += '```prisma\\n';
  md += escapeMd(schemaText);
  if (!schemaText.endsWith('\\n')) md += '\\n';
  md += '```\\n\\n';

  md += `## PHẦN 2 — DỮ LIỆU THẬT\\n\\n`;
  md += `### 2.1 — Danh sách bảng + COUNT(*) + 3 row mẫu\\n\\n`;
  md += `Datasource: PostgreSQL (DATABASE_URL được load từ rebate-backend/.env; không in ra để tránh lộ credential)\\n\\n`;
  md += '```json\\n';
  md += escapeMd(JSON.stringify(tableDump, null, 2));
  md += '\\n```\\n\\n';

  md += `### 2.2 — rebate_configs cho nhánh mib@test.com\\n\\n`;
  md += `mib@test.com row (ib_nodes):\\n\\n`;
  md += '```json\\n';
  md += escapeMd(JSON.stringify(mibRow, null, 2));
  md += '\\n```\\n\\n';

  md += `Subtree ib_nodes (recursive):\\n\\n`;
  md += '```json\\n';
  md += escapeMd(JSON.stringify(mibSubtree, null, 2));
  md += '\\n```\\n\\n';

  md += `All rows in rebate_configs where ibId in subtree:\\n\\n`;
  md += '```json\\n';
  md += escapeMd(JSON.stringify(mibRebateConfigs, null, 2));
  md += '\\n```\\n\\n';

  md += `## PHẦN 3 — MỌI NƠI LOGIC \"REBATE CONFIG\" ĐANG ĐƯỢC ĐỌC/GHI\\n\\n`;
  md += `### 3.1 — Full keyword occurrences (group by file)\\n\\n`;
  md += `Keywords: rebateConfig | RebateConfig | markupPips | rebatePips | getConfig | updateConfig | bulkUpdateConfig\\n\\n`;
  for (const file of Object.keys(hitsByFile).sort()) {
    md += `<details>\\n<summary>${file}</summary>\\n\\n`;
    md += '```txt\\n';
    for (const h of hitsByFile[file]) {
      md += `${h.line}: ${h.text}\\n`;
    }
    md += '```\\n\\n</details>\\n\\n';
  }

  md += `### 3.2 — Frontend pages related to rebate config (detected)\\n\\n`;
  md += '```json\\n';
  md += escapeMd(JSON.stringify(rebatePages, null, 2));
  md += '\\n```\\n\\n';

  md += `## PHẦN 5 — CÁC BẢNG \"MỒ CÔI\" HOẶC NGHI NGỜ KHÔNG CÒN DÙNG\\n\\n`;
  md += 'Rule: model trong prisma/schema.prisma mà không có match `prisma.<modelField>` trong rebate-backend/src (scan text)\\n\\n';
  md += '```json\\n';
  md += escapeMd(JSON.stringify(orphanModels, null, 2));
  md += '\\n```\\n\\n';

  fs.writeFileSync(outPath, md, 'utf8');

  await prisma.$disconnect();
}

main().catch((e) => {
  process.stderr.write(String(e) + '\\n');
  process.exitCode = 1;
});
