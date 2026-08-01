// A minimal ZIP reader, because Epoch AI publishes its benchmark export as one archive and this
// project has no runtime dependency that can open one. Node ships the hard part — `inflateRawSync`
// is the DEFLATE decoder — so what is left is walking the central directory.
//
// Deliberately small: it reads stored and deflated entries and nothing else. No encryption, no
// ZIP64, no streaming. If Epoch's export ever outgrows that, this throws rather than returning a
// half-read archive, because a silently truncated member would look exactly like a leaderboard
// that dropped some models.

import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** @returns {Map<string, Buffer>} member name -> contents */
export const readZip = (buffer) => {
  // The end-of-central-directory record sits at the tail, after a comment of unknown length,
  // so it is found by scanning backwards for its signature.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i > buffer.length - 22 - 65535; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("not a zip file: no end-of-central-directory record");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  if (cursor === 0xffffffff) throw new Error("ZIP64 archive: this reader does not support it");

  const entries = new Map();
  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw new Error(`corrupt central directory at entry ${i}`);
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    if (buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
      throw new Error(`corrupt local header for ${name}`);
    }
    // The local header repeats the name and extra fields, and its extra length can differ from
    // the central directory's — read the local one or the data offset lands mid-file.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);

    if (method === 0) entries.set(name, Buffer.from(raw));
    else if (method === 8) entries.set(name, inflateRawSync(raw));
    else throw new Error(`${name}: unsupported compression method ${method}`);

    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

/**
 * RFC 4180 CSV. Epoch's exports contain quoted fields with commas in model notes, so splitting
 * on "," loses columns and shifts every value one to the left — silently, into the wrong field.
 */
export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') { field += char; continue; }
      if (text[i + 1] === '"') { field += '"'; i += 1; continue; }
      quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ",") { row.push(field); field = ""; continue; }
    if (char === "\r") continue;
    if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += char;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1)
    .filter((cells) => cells.some((cell) => cell !== ""))
    .map((cells) => Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ""])));
};
