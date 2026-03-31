/**
 * reMarkable .rm File Parser & PDF Renderer
 * Parses v5 and v6 .rm notebook formats and renders strokes to PDF.
 */

import { createRequire } from "module";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

const RM_WIDTH = 1404;
const RM_HEIGHT = 1872;
const PDF_WIDTH = 468;
const PDF_HEIGHT = 624;
const SCALE = PDF_WIDTH / RM_WIDTH;

const COLORS: Record<number, string> = {
  0: "#000000", 1: "#808080", 2: "#ffffff", 3: "#ffff00",
  4: "#00c800", 5: "#ff00ff", 6: "#0000ff", 7: "#ff0000",
  8: "#808080", 9: "#ffff00", 10: "#00c800", 11: "#00ffff",
  12: "#ff00ff", 13: "#ffff00",
};

const HIGHLIGHTER_PENS = new Set([5, 18]); // highlighter v1/v2
const ERASER_PENS = new Set([6, 8]); // eraser, eraser area

interface RmPoint {
  x: number;
  y: number;
  speed: number;
  direction: number;
  width: number;
  pressure: number;
}

interface RmStroke {
  pen: number;
  color: number;
  baseWidth: number;
  thicknessScale: number;
  points: RmPoint[];
}

interface RmPage {
  strokes: RmStroke[];
}

// ─── V5 Parser ──────────────────────────────────────────────────

function parseRmV5(buffer: Buffer): RmPage {
  let offset = 43;
  const strokes: RmStroke[] = [];

  const numLayers = buffer.readInt32LE(offset); offset += 4;

  for (let l = 0; l < numLayers; l++) {
    const numStrokes = buffer.readInt32LE(offset); offset += 4;

    for (let s = 0; s < numStrokes; s++) {
      const pen = buffer.readInt32LE(offset); offset += 4;
      const color = buffer.readInt32LE(offset); offset += 4;
      offset += 4; // padding
      const baseWidth = buffer.readFloatLE(offset); offset += 4;
      offset += 4; // unknown
      const numPoints = buffer.readInt32LE(offset); offset += 4;

      const points: RmPoint[] = [];
      for (let p = 0; p < numPoints; p++) {
        points.push({
          x: buffer.readFloatLE(offset), y: buffer.readFloatLE(offset + 4),
          speed: buffer.readFloatLE(offset + 8), direction: buffer.readFloatLE(offset + 12),
          width: buffer.readFloatLE(offset + 16), pressure: buffer.readFloatLE(offset + 20),
        });
        offset += 24;
      }

      strokes.push({ pen, color, baseWidth, thicknessScale: 1, points });
    }
  }

  return { strokes };
}

// ─── V6 Parser (rmscene) ────────────────────────────────────────

class DataStream {
  private buf: Buffer;
  private pos: number;
  private end: number;

  constructor(buf: Buffer, start = 0, end?: number) {
    this.buf = buf;
    this.pos = start;
    this.end = end ?? buf.length;
  }

  get remaining(): number { return this.end - this.pos; }
  get position(): number { return this.pos; }

  readBytes(n: number): Buffer {
    const slice = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }

  readUint8(): number { const v = this.buf.readUInt8(this.pos); this.pos += 1; return v; }
  readUint16(): number { const v = this.buf.readUInt16LE(this.pos); this.pos += 2; return v; }
  readUint32(): number { const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
  readFloat32(): number { const v = this.buf.readFloatLE(this.pos); this.pos += 4; return v; }
  readFloat64(): number { const v = this.buf.readDoubleLE(this.pos); this.pos += 8; return v; }
  readBool(): boolean { return this.readUint8() !== 0; }

  readVaruint(): number {
    let shift = 0, result = 0;
    while (true) {
      const b = this.readUint8();
      result |= (b & 0x7F) << shift;
      shift += 7;
      if (!(b & 0x80)) break;
      if (shift > 35) throw new Error("Varuint too large");
    }
    return result;
  }

  readCrdtId(): [number, number] {
    const part1 = this.readUint8();
    const part2 = this.readVaruint();
    return [part1, part2];
  }

  readTag(): { index: number; tagType: number } | null {
    if (this.remaining <= 0) return null;
    const tag = this.readVaruint();
    return { index: tag >> 4, tagType: tag & 0xF };
  }

  peekTag(): { index: number; tagType: number } | null {
    if (this.remaining <= 0) return null;
    const savedPos = this.pos;
    const result = this.readTag();
    this.pos = savedPos;
    return result;
  }

  skip(n: number): void { this.pos += n; }
  seekTo(pos: number): void { this.pos = pos; }
}

const TAG_ID = 0xF;
const TAG_LENGTH4 = 0xC;
const TAG_BYTE8 = 0x8;
const TAG_BYTE4 = 0x4;
const TAG_BYTE1 = 0x1;

function parseRmV6(buffer: Buffer): RmPage {
  const stream = new DataStream(buffer, 43); // skip header
  const strokes: RmStroke[] = [];

  while (stream.remaining > 8) {
    // Block layout: [uint32 contentLen][uint8 unknown][uint8 minVer][uint8 curVer][uint8 type][contentLen bytes]
    let contentLength: number;
    try {
      contentLength = stream.readUint32();
    } catch { break; }

    const _unknown = stream.readUint8();
    const _minVersion = stream.readUint8();
    const currentVersion = stream.readUint8();
    const blockType = stream.readUint8();

    const blockEnd = stream.position + contentLength;
    if (contentLength === 0 || blockEnd > buffer.length) {
      // Try to continue
      if (blockEnd <= buffer.length) { stream.seekTo(blockEnd); continue; }
      break;
    }

    if (blockType === 0x05) {
      // SceneLineItemBlock — contains stroke data
      try {
        const stroke = parseSceneLineItemBlock(stream, blockEnd, currentVersion);
        if (stroke) strokes.push(stroke);
      } catch {
        // Skip malformed block
      }
    }

    // Ensure we advance to the end of this block
    stream.seekTo(blockEnd);
  }

  return { strokes };
}

function parseSceneLineItemBlock(
  stream: DataStream,
  blockEnd: number,
  version: number
): RmStroke | null {
  // Read scene item header: parent_id, item_id, left_id, right_id, deleted_length
  // Each prefixed by a tag
  let deletedLength = 0;

  while (stream.position < blockEnd) {
    const tag = stream.peekTag();
    if (!tag) break;

    if (tag.index <= 4 && tag.tagType === TAG_ID) {
      // CrdtId fields (parent, item, left, right)
      stream.readTag();
      stream.readCrdtId();
    } else if (tag.index === 5 && tag.tagType === TAG_BYTE4) {
      // deleted_length
      stream.readTag();
      deletedLength = stream.readUint32();
    } else if (tag.index === 6 && tag.tagType === TAG_LENGTH4) {
      // Value subblock — contains the actual line data
      stream.readTag();
      const subLength = stream.readUint32();
      const subEnd = stream.position + subLength;

      if (deletedLength > 0) {
        stream.seekTo(subEnd);
        return null; // Deleted stroke
      }

      // Read item_type
      const itemType = stream.readUint8();
      if (itemType !== 0x03) {
        // Not a line
        stream.seekTo(subEnd);
        return null;
      }

      // Parse line data
      const stroke = parseLineData(stream, subEnd, version);
      stream.seekTo(subEnd);
      return stroke;
    } else {
      // Unknown tag — skip it
      stream.readTag();
      if (tag.tagType === TAG_LENGTH4) {
        const len = stream.readUint32();
        stream.skip(len);
      } else if (tag.tagType === TAG_BYTE8) {
        stream.skip(8);
      } else if (tag.tagType === TAG_BYTE4) {
        stream.skip(4);
      } else if (tag.tagType === TAG_BYTE1) {
        stream.skip(1);
      } else if (tag.tagType === TAG_ID) {
        stream.readCrdtId();
      } else {
        break;
      }
    }
  }

  return null;
}

function parseLineData(stream: DataStream, blockEnd: number, version: number): RmStroke | null {
  let pen = 0, color = 0, thicknessScale = 1.0, startingLength = 0;
  const points: RmPoint[] = [];

  while (stream.position < blockEnd) {
    const tag = stream.peekTag();
    if (!tag) break;

    if (tag.index === 1 && tag.tagType === TAG_BYTE4) {
      stream.readTag();
      pen = stream.readUint32();
    } else if (tag.index === 2 && tag.tagType === TAG_BYTE4) {
      stream.readTag();
      color = stream.readUint32();
    } else if (tag.index === 3 && tag.tagType === TAG_BYTE8) {
      stream.readTag();
      thicknessScale = stream.readFloat64();
    } else if (tag.index === 4 && tag.tagType === TAG_BYTE4) {
      stream.readTag();
      startingLength = stream.readFloat32();
    } else if (tag.index === 5 && tag.tagType === TAG_LENGTH4) {
      // Points subblock — raw packed data, no tags
      stream.readTag();
      const dataLength = stream.readUint32();
      const pointsEnd = stream.position + dataLength;

      // Determine point size based on version
      const pointSize = version >= 2 ? 14 : 24;
      const numPoints = Math.floor(dataLength / pointSize);

      for (let i = 0; i < numPoints; i++) {
        if (stream.position + pointSize > pointsEnd) break;

        if (version >= 2) {
          // v2: float32 x, float32 y, uint16 speed, uint16 width, uint8 direction, uint8 pressure
          const x = stream.readFloat32();
          const y = stream.readFloat32();
          const speed = stream.readUint16();
          const width = stream.readUint16();
          const direction = stream.readUint8();
          const pressure = stream.readUint8();
          points.push({ x, y, speed, direction, width, pressure });
        } else {
          // v1: 6 float32s
          const x = stream.readFloat32();
          const y = stream.readFloat32();
          const speedRaw = stream.readFloat32();
          const dirRaw = stream.readFloat32();
          const widthRaw = stream.readFloat32();
          const pressureRaw = stream.readFloat32();
          points.push({
            x, y,
            speed: speedRaw * 4,
            direction: Math.round(255 * dirRaw / (2 * Math.PI)),
            width: Math.round(widthRaw * 4),
            pressure: Math.round(pressureRaw * 255),
          });
        }
      }

      stream.seekTo(pointsEnd);
    } else if (tag.index === 6 && tag.tagType === TAG_ID) {
      // timestamp CrdtId
      stream.readTag();
      stream.readCrdtId();
    } else if (tag.index === 7 && tag.tagType === TAG_ID) {
      // move_id CrdtId
      stream.readTag();
      stream.readCrdtId();
    } else {
      // Skip unknown
      stream.readTag();
      if (tag.tagType === TAG_LENGTH4) {
        const len = stream.readUint32();
        stream.skip(len);
      } else if (tag.tagType === TAG_BYTE8) stream.skip(8);
      else if (tag.tagType === TAG_BYTE4) stream.skip(4);
      else if (tag.tagType === TAG_BYTE1) stream.skip(1);
      else if (tag.tagType === TAG_ID) stream.readCrdtId();
      else break;
    }
  }

  if (points.length === 0) return null;

  return { pen, color, baseWidth: startingLength, thicknessScale, points };
}

// ─── Auto-detect and parse ──────────────────────────────────────

export function parseRmFile(buffer: Buffer): RmPage {
  const header = buffer.subarray(0, 43).toString("ascii");

  if (header.startsWith("reMarkable .lines file, version=6")) {
    return parseRmV6(buffer);
  }

  if (header.startsWith("reMarkable .lines file, version=5")) {
    return parseRmV5(buffer);
  }

  try { return parseRmV5(buffer); } catch { return { strokes: [] }; }
}

// ─── PDF Renderer ───────────────────────────────────────────────

/**
 * Render typed text to PDF with basic formatting.
 * Detects headings (short first lines, ALL CAPS lines) and applies appropriate styling.
 */
function renderTextToPdf(doc: InstanceType<typeof PDFDocument>, text: string, pageWidth: number) {
  const margin = 10;
  const width = pageWidth - margin * 2;
  let y = margin;

  const lines = text.split("\n");
  let isFirstLine = true;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      y += 8; // Empty line spacing
      continue;
    }

    // Detect heading: first non-empty line that's short, or ALL CAPS short line
    const isHeading = isFirstLine && trimmed.length < 60;
    const isAllCaps = trimmed.length > 2 && trimmed.length < 40 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

    if (isHeading) {
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#000000");
      doc.text(trimmed, margin, y, { width, align: "center" });
      y = doc.y + 8;
      isFirstLine = false;
    } else if (isAllCaps) {
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#333333");
      doc.text(trimmed, margin, y, { width });
      y = doc.y + 4;
    } else {
      doc.font("Helvetica").fontSize(10).fillColor("#000000");
      doc.text(trimmed, margin, y, { width });
      y = doc.y + 2;
    }

    if (isFirstLine) isFirstLine = false;
  }
}

function getPageBounds(page: RmPage): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = 0, minY = 0, maxX = RM_WIDTH, maxY = RM_HEIGHT;
  for (const stroke of page.strokes) {
    if (ERASER_PENS.has(stroke.pen)) continue;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return { minX: Math.floor(minX), minY: Math.floor(minY), maxX: Math.ceil(maxX), maxY: Math.ceil(maxY) };
}

function renderPageToPdf(
  doc: InstanceType<typeof PDFDocument>,
  page: RmPage,
  scale: number,
  offsetX: number,
  offsetY: number,
) {
  for (const stroke of page.strokes) {
    if (stroke.points.length < 2) continue;
    if (ERASER_PENS.has(stroke.pen)) continue;

    const colorHex = COLORS[stroke.color] || "#000000";
    const isHighlighter = HIGHLIGHTER_PENS.has(stroke.pen);

    doc.strokeColor(colorHex);
    doc.opacity(isHighlighter ? 0.3 : 1);
    doc.lineJoin("round").lineCap("round");

    for (let i = 0; i < stroke.points.length - 1; i++) {
      const p1 = stroke.points[i]!;
      const p2 = stroke.points[i + 1]!;
      // Width: v6 uint16 values are typically 1-50, v5 float values are larger
      const rawWidth = p1.width > 100 ? p1.width * 0.5 : p1.width * 0.8;
      const w = stroke.thicknessScale * Math.max(0.3, rawWidth * scale);

      doc.moveTo((p1.x + offsetX) * scale, (p1.y + offsetY) * scale)
        .lineTo((p2.x + offsetX) * scale, (p2.y + offsetY) * scale)
        .lineWidth(w)
        .stroke();
    }

    doc.opacity(1);
  }
}

// ─── Notebook Zip → PDF ─────────────────────────────────────────

export async function renderNotebookToPdf(zipBuffer: Buffer): Promise<Buffer> {
  const tmpDir = `/tmp/openframe-remarkable/notebook-${Date.now()}`;
  const tmpZip = `${tmpDir}.zip`;

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(tmpZip, zipBuffer);
    try { execSync(`unzip -o "${tmpZip}" -d "${tmpDir}"`, { timeout: 10000 }); } catch {}

    // Find the document UUID directory
    const entries = fs.readdirSync(tmpDir);
    let docDir = tmpDir;
    const uuidDir = entries.find(e => {
      try { return fs.statSync(path.join(tmpDir, e)).isDirectory() && /^[a-f0-9-]+$/i.test(e); }
      catch { return false; }
    });
    if (uuidDir) docDir = path.join(tmpDir, uuidDir);

    // Read .content file for page order
    // The .content file may be at the zip root (tmpDir) or inside docDir
    let pageIds: string[] = [];
    const contentFile =
      fs.readdirSync(tmpDir).find(f => f.endsWith(".content")) ||
      fs.readdirSync(docDir).find(f => f.endsWith(".content"));
    const contentDir = fs.readdirSync(tmpDir).find(f => f.endsWith(".content")) ? tmpDir : docDir;
    if (contentFile) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(contentDir, contentFile), "utf-8"));
        if (content.cPages?.pages) {
          pageIds = content.cPages.pages.map((p: { id: string }) => p.id);
        } else if (content.pages) {
          pageIds = content.pages;
        }
      } catch {}
    }

    // Fallback: find .rm files
    if (pageIds.length === 0) {
      const allFiles = findFilesRecursive(docDir, ".rm");
      allFiles.sort();
      pageIds = allFiles.map(f => path.basename(f, ".rm"));
    }

    // Parse each page
    const pages: RmPage[] = [];
    for (const pageId of pageIds) {
      const rmFile = findRmFile(docDir, pageId);
      if (rmFile) {
        const rmBuffer = fs.readFileSync(rmFile);
        pages.push(parseRmFile(rmBuffer));
      } else {
        pages.push({ strokes: [] });
      }
    }

    if (pages.length === 0) throw new Error("No pages found in notebook");

    // Also check for text in RootText blocks (type 0x07) — collect per page
    const pageTexts = extractPageTexts(tmpDir, docDir, pageIds);

    return new Promise<Buffer>((resolve, reject) => {
      try {
        // First pass: calculate page sizes
        const pageConfigs = pages.map((page, idx) => {
          const bounds = getPageBounds(page);
          // Include standard RM dimensions as minimum
          const contentWidth = Math.max(RM_WIDTH, bounds.maxX - bounds.minX + 40);
          const contentHeight = Math.max(RM_HEIGHT, bounds.maxY - bounds.minY + 40);
          const scale = PDF_WIDTH / contentWidth;
          const pdfHeight = contentHeight * scale;
          const offsetX = -bounds.minX + 20;
          const offsetY = -bounds.minY + 20;
          return { scale, pdfHeight, offsetX, offsetY, text: pageTexts[idx] };
        });

        const firstConfig = pageConfigs[0]!;
        const doc = new PDFDocument({
          size: [PDF_WIDTH, firstConfig.pdfHeight],
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        pages.forEach((page, index) => {
          const cfg = pageConfigs[index]!;
          if (index > 0) doc.addPage({ size: [PDF_WIDTH, cfg.pdfHeight] });
          doc.rect(0, 0, PDF_WIDTH, cfg.pdfHeight).fill("#ffffff");

          // Render typed text first (as background)
          if (cfg.text) {
            renderTextToPdf(doc, cfg.text, PDF_WIDTH);
          }

          // Render strokes on top
          renderPageToPdf(doc, page, cfg.scale, cfg.offsetX, cfg.offsetY);
        });

        doc.end();
      } catch (error) { reject(error); }
    });
  } finally {
    try { execSync(`rm -rf "${tmpZip}" "${tmpDir}"`); } catch {}
  }
}

/**
 * Extract typed text from v6 RootText blocks (block type 0x07)
 * Text is stored in length-prefixed subblocks with tag 0x6C (index=6, type=0xC).
 * Each segment has a small header (typically 2 bytes) then UTF-8 text.
 * Segments are concatenated in order to form the full text.
 */
function extractPageTexts(_tmpDir: string, docDir: string, pageIds: string[]): (string | null)[] {
  return pageIds.map(pageId => {
    const rmFile = findRmFile(docDir, pageId);
    if (!rmFile) return null;

    try {
      const buf = fs.readFileSync(rmFile);
      if (!buf.subarray(0, 43).toString("ascii").startsWith("reMarkable .lines file, version=6")) return null;

      let pos = 43;

      while (pos < buf.length - 8) {
        const contentLen = buf.readUInt32LE(pos);
        if (pos + 8 + contentLen > buf.length) break;
        const blockType = buf[pos + 7];

        if (blockType === 0x07) {
          // RootText block — extract text from 0x6C subblocks
          const content = buf.subarray(pos + 8, pos + 8 + contentLen);
          const segments: string[] = [];

          for (let i = 0; i < content.length - 5; i++) {
            // Look for tag 0x6C (index=6, type=0xC = Length4 subblock)
            if (content[i] === 0x6c) {
              const strLen = content.readUInt32LE(i + 1);
              if (strLen > 0 && strLen < 10000 && i + 5 + strLen <= content.length) {
                const raw = content.subarray(i + 5, i + 5 + strLen);
                // Header is: varuint (text length) + 0x01 byte, then the text
                // Parse the varuint to find where text starts
                let hdrPos = 0;
                let shift = 0;
                // Read varuint
                while (hdrPos < raw.length && hdrPos < 5) {
                  const b = raw[hdrPos]!;
                  hdrPos++;
                  shift += 7;
                  if (!(b & 0x80)) break;
                }
                // Skip the 0x01 separator if present
                if (hdrPos < raw.length && raw[hdrPos] === 0x01) hdrPos++;
                const text = raw.subarray(hdrPos).toString("utf-8");
                if (text.length > 0) segments.push(text);
                i += 4 + strLen; // Skip past this subblock
              }
            }
          }

          if (segments.length > 0) {
            return segments.join("");
          }
        }

        pos += 8 + contentLen;
      }

      return null;
    } catch {
      return null;
    }
  });
}

function findFilesRecursive(dir: string, ext: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findFilesRecursive(full, ext));
    else if (entry.name.endsWith(ext)) results.push(full);
  }
  return results;
}

function findRmFile(docDir: string, pageId: string): string | null {
  // Try direct path in UUID subdir
  const direct = path.join(docDir, `${pageId}.rm`);
  if (fs.existsSync(direct)) return direct;

  // Search in subdirectories
  for (const entry of fs.readdirSync(docDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const nested = path.join(docDir, entry.name, `${pageId}.rm`);
      if (fs.existsSync(nested)) return nested;
    }
  }

  return null;
}
