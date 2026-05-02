#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
const MANIFEST_PATH = path.join(ROOT, 'src', 'manifest.json');

const { version } = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

if (manifest.version === version) {
    console.log(`manifest.json already at ${version}, nothing to do`);
    process.exit(0);
}

manifest.version = version;
fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, '\t')}\n`, 'utf8');
console.log(`manifest.json synced to ${version}`);
