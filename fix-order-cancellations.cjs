/*
 * Run from your existing CRA admin project root:
 *   node fix-order-cancellations.cjs
 * Optional: pass the admin project directory as the first argument.
 * This script only patches src/pages/OrderCancellations.js. It adds explicit
 * grouping to mixed && / || expressions without changing their current
 * JavaScript evaluation order. It uses the Babel parser already installed
 * with react-scripts, checks the parsed code before writing, and backs up
 * the original file to your operating system's temporary directory.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

const metadataKeys = new Set([
  'start', 'end', 'loc', 'range', 'extra', 'tokens', 'errors', 'comments',
  'leadingComments', 'trailingComments', 'innerComments'
]);

function codeStructure(value) {
  if (Array.isArray(value)) return value.map(codeStructure);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).filter(key => !metadataKeys.has(key))
    .sort().map(key => [key, codeStructure(value[key])]));
}

function addLogicalParentheses(source, parser) {
  const options = { sourceType: 'unambiguous', plugins: ['jsx'] };
  const before = parser.parse(source, options);
  const positions = new Map();
  const changed = new Map();
  const logical = operator => operator === '&&' || operator === '||';
  function mark(position, type) {
    const counts = positions.get(position) || { open: 0, close: 0 };
    counts[type]++;
    positions.set(position, counts);
  }
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (node.type === 'LogicalExpression' && logical(node.operator)) {
      for (const side of ['left', 'right']) {
        const child = node[side];
        if (child?.type !== 'LogicalExpression' || !logical(child.operator) ||
          child.operator === node.operator || child.extra?.parenthesized) continue;
        const key = `${child.start}:${child.end}`;
        if (!changed.has(key)) {
          changed.set(key, { line: child.loc.start.line });
          mark(child.start, 'open');
          mark(child.end, 'close');
        }
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (!metadataKeys.has(key) && value && typeof value === 'object') visit(value);
    }
  }
  visit(before);
  let result = source;
  for (const [position, counts] of [...positions].sort((a, b) => b[0] - a[0])) {
    const added = ')'.repeat(counts.close) + '('.repeat(counts.open);
    result = result.slice(0, position) + added + result.slice(position);
  }
  const after = parser.parse(result, options);
  if (JSON.stringify(codeStructure(before)) !== JSON.stringify(codeStructure(after))) {
    throw new Error('The parsed code structure changed. The original file was not modified.');
  }
  return { source: result, pairs: changed.size,
    lines: [...new Set([...changed.values()].map(change => change.line))].sort((a, b) => a - b) };
}

function projectParser(projectRoot) {
  const projectRequire = createRequire(path.join(projectRoot, 'package.json'));
  try { return projectRequire('@babel/parser'); } catch {
    try {
      const craRequire = createRequire(projectRequire.resolve('react-scripts/package.json'));
      return craRequire('@babel/parser');
    } catch {
      throw new Error('Admin dependencies are missing. Run npm ci in this admin project, then run this script again.');
    }
  }
}

function main() {
  if (process.argv.length > 3) throw new Error('Usage: node fix-order-cancellations.cjs [admin-project-directory]');
  const projectRoot = path.resolve(process.argv[2] || process.cwd());
  const target = path.join(projectRoot, 'src', 'pages', 'OrderCancellations.js');
  if (!fs.existsSync(path.join(projectRoot, 'package.json')) || !fs.existsSync(target)) {
    throw new Error('Run this script from the existing admin project root containing package.json and src/pages/OrderCancellations.js.');
  }
  const original = fs.readFileSync(target, 'utf8');
  const result = addLogicalParentheses(original, projectParser(projectRoot));
  if (!result.pairs) {
    console.log('OrderCancellations.js already has explicit grouping for mixed && / || conditions. No changes were needed.');
    return;
  }
  const backupDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'v1garments-order-cancellations-'));
  const backup = path.join(backupDirectory, 'OrderCancellations.js');
  fs.copyFileSync(target, backup);
  // Keep the existing file's permissions and line endings. No formatter runs.
  fs.writeFileSync(target, result.source, 'utf8');
  console.log(`Updated src/pages/OrderCancellations.js: ${result.pairs} parenthesis pair(s), line(s) ${result.lines.join(', ')}.`);
  console.log('Verified: the parsed JavaScript structure and evaluation order are unchanged.');
  console.log(`Original file backup: ${backup}`);
  console.log('Next: run npm run build, then commit/push src/pages/OrderCancellations.js.');
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error('Cancellation page fix failed:', error.message);
    process.exitCode = 1;
  }
}
module.exports = { addLogicalParentheses };
