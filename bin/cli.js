#!/usr/bin/env node
'use strict';

/**
 * @file cli.js
 * @description CLI entry point for apidoc-gen.
 * @usage apidoc-gen [dir] [--output docs/] [--format markdown|html] [--json]
 * @author idirdev
 */

const fs = require('fs');
const path = require('path');
const { scanDir, generateMarkdown, generateHtml } = require('../src/index.js');

const args = process.argv.slice(2);
const flags = {};
const positional = [];

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  } else {
    positional.push(args[i]);
  }
}

const dir = path.resolve(positional[0] || '.');
const outputDir = typeof flags.output === 'string' ? flags.output : null;
const format = typeof flags.format === 'string' ? flags.format : 'markdown';
const asJson = flags.json === true;

let docs;
try {
  docs = scanDir(dir);
} catch (err) {
  console.error('Error scanning directory:', err.message);
  process.exit(1);
}

if (asJson) {
  const out = JSON.stringify(docs, null, 2);
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'apidoc.json'), out);
    console.log('Written apidoc.json to', outputDir);
  } else {
    process.stdout.write(out + '\n');
  }
  process.exit(0);
}

const content = format === 'html' ? generateHtml(docs) : generateMarkdown(docs);
const filename = 'apidoc.' + (format === 'html' ? 'html' : 'md');

if (outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, filename), content);
  console.log('Written ' + filename + ' to ' + outputDir);
} else {
  process.stdout.write(content);
}
