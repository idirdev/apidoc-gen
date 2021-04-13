'use strict';

/**
 * @module apidoc-gen
 * @description Generate API documentation from JSDoc comments in source files.
 * @author idirdev
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract raw JSDoc block bodies from a source string.
 * Each returned string is the interior of a /** ... *\/ block.
 * @param {string} source - Raw source file content.
 * @returns {string[]} Array of raw block bodies.
 */
function extractJSDocBlocks(source) {
  const blocks = [];
  // Use a simple state machine to avoid regex backtracking issues on large files.
  let i = 0;
  while (i < source.length - 1) {
    if (source[i] === '/' && source[i + 1] === '*' && source[i + 2] === '*') {
      const start = i + 3;
      const end = source.indexOf('*/', start);
      if (end === -1) break;
      blocks.push(source.slice(start, end));
      i = end + 2;
    } else {
      i++;
    }
  }
  return blocks;
}

/**
 * Parse a single JSDoc block body into a structured documentation entry.
 * @param {string} block - Raw block body (without /** and *\/).
 * @returns {Object} Entry with { description, params, returns, throws, examples, route, tags }.
 */
function parseJSDoc(block) {
  const lines = block.split('\n').map((l) => l.replace(/^\s*\*\s?/, '').trimEnd());

  const entry = {
    description: '',
    params: [],
    returns: null,
    throws: [],
    examples: [],
    route: null,
    tags: {},
  };

  const descLines = [];
  let inExample = false;
  let exampleBuf = [];

  const flushExample = () => {
    if (exampleBuf.length) {
      entry.examples.push(exampleBuf.join('\n').trim());
      exampleBuf = [];
    }
    inExample = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed.startsWith('@')) {
      if (inExample) {
        exampleBuf.push(line);
      } else {
        descLines.push(trimmed);
      }
      continue;
    }

    if (inExample) flushExample();

    const m = trimmed.match(/^@(\w+)(?:\s+(.*))?/);
    if (!m) continue;
    const tag = m[1];
    const rest = (m[2] || '').trim();

    switch (tag) {
      case 'param': {
        const pm = rest.match(/^\{([^}]+)\}\s+(\S+)(?:\s+-?\s*(.*))?/);
        if (pm) {
          entry.params.push({ type: pm[1], name: pm[2], description: (pm[3] || '').trim() });
        } else {
          entry.params.push({ type: 'any', name: rest, description: '' });
        }
        break;
      }
      case 'returns':
      case 'return': {
        const rm = rest.match(/^\{([^}]+)\}(?:\s+(.*))?/);
        if (rm) {
          entry.returns = { type: rm[1], description: (rm[2] || '').trim() };
        } else {
          entry.returns = { type: 'any', description: rest };
        }
        break;
      }
      case 'throws':
      case 'exception': {
        const tm = rest.match(/^\{([^}]+)\}(?:\s+(.*))?/);
        if (tm) {
          entry.throws.push({ type: tm[1], description: (tm[2] || '').trim() });
        } else {
          entry.throws.push({ type: 'Error', description: rest });
        }
        break;
      }
      case 'example': {
        inExample = true;
        if (rest) exampleBuf.push(rest);
        break;
      }
      case 'route': {
        const rm = rest.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/i);
        entry.route = rm
          ? { method: rm[1].toUpperCase(), path: rm[2] }
          : { method: '', path: rest };
        break;
      }
      case 'description': {
        descLines.push(rest);
        break;
      }
      default: {
        entry.tags[tag] = rest;
      }
    }
  }

  if (inExample) flushExample();
  entry.description = descLines.filter(Boolean).join(' ').trim();
  return entry;
}

/**
 * Scan a single .js file and return an array of parsed JSDoc entries.
 * @param {string} filePath - Absolute path to the file.
 * @returns {Object[]} Parsed JSDoc entries annotated with filePath.
 */
function scanFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const blocks = extractJSDocBlocks(source);
  return blocks
    .map((b) => Object.assign(parseJSDoc(b), { filePath }))
    .filter((e) => e.description || e.params.length || e.returns || e.route);
}

/**
 * Recursively scan a directory for .js files and extract all JSDoc entries.
 * @param {string} dir - Root directory to scan.
 * @param {Object} [opts={}] - Scan options.
 * @param {string[]} [opts.ignore] - Directory names to skip.
 * @returns {Object[]} All parsed entries from all scanned files.
 */
function scanDir(dir, opts) {
  const ignore = (opts && opts.ignore) || ['node_modules', '.git', 'coverage', 'dist'];
  const results = [];

  function walk(current) {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!ignore.includes(e.name)) walk(path.join(current, e.name));
      } else if (e.isFile() && e.name.endsWith('.js')) {
        try { results.push(...scanFile(path.join(current, e.name))); } catch { /* skip */ }
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Group an array of doc entries by their source file path.
 * @param {Object[]} docs - Array of parsed JSDoc entries.
 * @returns {Object} Map of filePath → entry[].
 */
function groupByFile(docs) {
  const map = {};
  for (const doc of docs) {
    const key = doc.filePath || 'unknown';
    if (!map[key]) map[key] = [];
    map[key].push(doc);
  }
  return map;
}

/**
 * Group an array of doc entries by a named tag value.
 * @param {Object[]} docs - Array of parsed JSDoc entries.
 * @param {string} tag - Tag name to group by (e.g. 'module', 'category').
 * @returns {Object} Map of tagValue → entry[].
 */
function groupByTag(docs, tag) {
  const map = {};
  for (const doc of docs) {
    const value = (doc.tags && doc.tags[tag]) || 'uncategorized';
    if (!map[value]) map[value] = [];
    map[value].push(doc);
  }
  return map;
}

/**
 * Render a single doc entry as a markdown string.
 * @param {Object} entry - Parsed JSDoc entry.
 * @returns {string} Markdown block for this entry.
 */
function renderEntry(entry) {
  const lines = [];

  if (entry.route) {
    lines.push('### ' + entry.route.method + ' ' + entry.route.path + '\n');
  } else if (entry.tags && entry.tags.function) {
    lines.push('### ' + entry.tags.function + '\n');
  }

  if (entry.description) lines.push(entry.description + '\n');

  if (entry.params.length) {
    lines.push('**Parameters:**\n');
    lines.push('| Name | Type | Description |');
    lines.push('|------|------|-------------|');
    for (const p of entry.params) {
      lines.push('| ' + p.name + ' | `' + p.type + '` | ' + p.description + ' |');
    }
    lines.push('');
  }

  if (entry.returns) {
    lines.push('**Returns:** `' + entry.returns.type + '` — ' + entry.returns.description + '\n');
  }

  if (entry.throws.length) {
    lines.push('**Throws:**\n');
    for (const t of entry.throws) {
      lines.push('- `' + t.type + '` — ' + t.description);
    }
    lines.push('');
  }

  if (entry.examples.length) {
    lines.push('**Example:**\n');
    for (const ex of entry.examples) {
      lines.push('```js');
      lines.push(ex);
      lines.push('```');
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate full markdown documentation from an array of JSDoc entries.
 * @param {Object[]} docs - Array of parsed JSDoc entries.
 * @returns {string} Markdown documentation string.
 */
function generateMarkdown(docs) {
  if (!docs.length) return '# API Documentation\n\n_No documentation found._\n';

  const byFile = groupByFile(docs);
  const parts = ['# API Documentation\n'];

  for (const [filePath, entries] of Object.entries(byFile)) {
    parts.push('## ' + path.basename(filePath) + '\n');
    for (const entry of entries) {
      parts.push(renderEntry(entry));
      parts.push('---\n');
    }
  }

  return parts.join('\n');
}

/**
 * Generate HTML documentation wrapping the markdown content.
 * @param {Object[]} docs - Array of parsed JSDoc entries.
 * @returns {string} HTML string.
 */
function generateHtml(docs) {
  const md = generateMarkdown(docs);
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <title>API Documentation</title>',
    '  <style>',
    '    body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;line-height:1.6}',
    '    pre{background:#f4f4f4;padding:1rem;border-radius:4px;overflow-x:auto}',
    '    code{background:#f4f4f4;padding:.2em .4em;border-radius:3px}',
    '    table{border-collapse:collapse;width:100%}',
    '    th,td{border:1px solid #ddd;padding:.5rem .75rem;text-align:left}',
    '    th{background:#f0f0f0}',
    '    hr{border:none;border-top:1px solid #eee;margin:2rem 0}',
    '  </style>',
    '</head>',
    '<body>',
    '<pre>' + esc + '</pre>',
    '</body>',
    '</html>',
  ].join('\n');
}

module.exports = {
  extractJSDocBlocks,
  parseJSDoc,
  scanFile,
  scanDir,
  generateMarkdown,
  generateHtml,
  groupByFile,
  groupByTag,
};
