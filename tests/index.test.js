'use strict';

/**
 * @file index.test.js
 * @description Tests for apidoc-gen.
 * @author idirdev
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  extractJSDocBlocks,
  parseJSDoc,
  scanFile,
  generateMarkdown,
  generateHtml,
  groupByFile,
  groupByTag,
} = require('../src/index.js');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'apidoc-gen-'));
}

const BASIC_BLOCK = [
  ' Add two numbers.',
  ' @param {number} a - First operand.',
  ' @param {number} b - Second operand.',
  ' @returns {number} The sum.',
  ' @throws {TypeError} If inputs are not numbers.',
  ' @example',
  ' add(1, 2); // 3',
].join('\n');

const ROUTE_BLOCK = [
  ' Get user by ID.',
  ' @route GET /users/:id',
  ' @param {string} id - User ID.',
  ' @returns {Object} User object.',
].join('\n');

test('extractJSDocBlocks: extracts multiple blocks', () => {
  const src = '/** block one */ function a(){} /** block two */ function b(){}';
  const blocks = extractJSDocBlocks(src);
  assert.equal(blocks.length, 2);
  assert.ok(blocks[0].includes('block one'));
  assert.ok(blocks[1].includes('block two'));
});

test('extractJSDocBlocks: returns empty array when no blocks', () => {
  assert.deepEqual(extractJSDocBlocks('function noop() {}'), []);
});

test('parseJSDoc: parses description text', () => {
  const e = parseJSDoc(BASIC_BLOCK);
  assert.ok(e.description.includes('Add two numbers'));
});

test('parseJSDoc: parses @param tags with type and name', () => {
  const e = parseJSDoc(BASIC_BLOCK);
  assert.equal(e.params.length, 2);
  assert.equal(e.params[0].name, 'a');
  assert.equal(e.params[0].type, 'number');
  assert.equal(e.params[1].name, 'b');
});

test('parseJSDoc: parses @returns tag', () => {
  const e = parseJSDoc(BASIC_BLOCK);
  assert.ok(e.returns !== null);
  assert.equal(e.returns.type, 'number');
  assert.ok(e.returns.description.includes('sum'));
});

test('parseJSDoc: parses @throws tag', () => {
  const e = parseJSDoc(BASIC_BLOCK);
  assert.equal(e.throws.length, 1);
  assert.equal(e.throws[0].type, 'TypeError');
});

test('parseJSDoc: parses @example block', () => {
  const e = parseJSDoc(BASIC_BLOCK);
  assert.equal(e.examples.length, 1);
  assert.ok(e.examples[0].includes('add(1, 2)'));
});

test('parseJSDoc: parses @route tag', () => {
  const e = parseJSDoc(ROUTE_BLOCK);
  assert.ok(e.route !== null);
  assert.equal(e.route.method, 'GET');
  assert.equal(e.route.path, '/users/:id');
});

test('scanFile: extracts entries from a JS file', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'util.js');
  fs.writeFileSync(file, [
    '/**',
    ' * Multiply two numbers.',
    ' * @param {number} x - First.',
    ' * @param {number} y - Second.',
    ' * @returns {number} Product.',
    ' */',
    'function multiply(x, y) { return x * y; }',
  ].join('\n'));
  const entries = scanFile(file);
  assert.ok(entries.length >= 1);
  assert.ok(entries[0].description.toLowerCase().includes('multiply'));
  assert.equal(entries[0].params.length, 2);
});

test('generateMarkdown: outputs heading and content', () => {
  const docs = [{
    description: 'Do something useful.',
    params: [{ type: 'string', name: 'input', description: 'the input' }],
    returns: { type: 'void', description: '' },
    throws: [],
    examples: [],
    route: null,
    tags: {},
    filePath: '/src/helper.js',
  }];
  const md = generateMarkdown(docs);
  assert.ok(md.includes('# API Documentation'));
  assert.ok(md.includes('helper.js'));
  assert.ok(md.includes('Do something useful'));
});

test('generateMarkdown: no-docs case returns placeholder', () => {
  assert.ok(generateMarkdown([]).includes('No documentation found'));
});

test('generateHtml: wraps content in HTML skeleton', () => {
  const html = generateHtml([]);
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('<body>'));
});

test('groupByFile: groups by filePath', () => {
  const docs = [
    { filePath: '/a.js' }, { filePath: '/b.js' }, { filePath: '/a.js' },
  ];
  const grouped = groupByFile(docs);
  assert.equal(grouped['/a.js'].length, 2);
  assert.equal(grouped['/b.js'].length, 1);
});

test('groupByTag: groups by custom tag, uncategorized fallback', () => {
  const docs = [
    { tags: { category: 'auth' } },
    { tags: { category: 'auth' } },
    { tags: { category: 'users' } },
    { tags: {} },
  ];
  const grouped = groupByTag(docs, 'category');
  assert.equal(grouped['auth'].length, 2);
  assert.equal(grouped['users'].length, 1);
  assert.equal(grouped['uncategorized'].length, 1);
});
