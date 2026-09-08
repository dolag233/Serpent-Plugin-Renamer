'use strict';

const { readdirSync, readFileSync, statSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { crc32, deflateRawSync } = require('node:zlib');

function listPackageFiles(root) {
  const files = [];
  const visit = (relativeDirectory) => {
    const directory = relativeDirectory ? path.join(root, ...relativeDirectory.split('/')) : root;
    for (const name of readdirSync(directory).sort()) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      const fullPath = path.join(root, ...relativePath.split('/'));
      if (statSync(fullPath).isDirectory()) visit(relativePath);
      else if (statSync(fullPath).isFile()) files.push(relativePath);
    }
  };
  visit('');
  return files;
}

function writePosixZip(root, zipPath) {
  const files = listPackageFiles(root);
  const chunks = [];
  const records = [];
  let offset = 0;
  for (const relativePath of files) {
    const data = readFileSync(path.join(root, ...relativePath.split('/')));
    const name = Buffer.from(relativePath, 'utf8');
    const compressed = deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data) >>> 0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, compressed);
    records.push({ name, crc: crc32(data) >>> 0, compressedSize: compressed.length, size: data.length, offset });
    offset += 30 + name.length + compressed.length;
  }
  const centralDirectoryOffset = offset;
  for (const record of records) {
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(record.crc, 16);
    central.writeUInt32LE(record.compressedSize, 20);
    central.writeUInt32LE(record.size, 24);
    central.writeUInt16LE(record.name.length, 28);
    central.writeUInt32LE((0o100644 * 0x10000) >>> 0, 38);
    central.writeUInt32LE(record.offset, 42);
    chunks.push(central, record.name);
    offset += 46 + record.name.length;
  }
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(records.length, 8);
  eocd.writeUInt16LE(records.length, 10);
  eocd.writeUInt32LE(offset - centralDirectoryOffset, 12);
  eocd.writeUInt32LE(centralDirectoryOffset, 16);
  chunks.push(eocd);
  writeFileSync(zipPath, Buffer.concat(chunks));
  return files;
}

module.exports = { listPackageFiles, writePosixZip };
