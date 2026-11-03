'use strict';

function generateQrSvg(textInput) {
  const text = String(textInput || 'http://127.0.0.1:5252');
  const dataBytes = Array.from(Buffer.from(text, 'utf8'));

  // Version table for Error Correction Level L (Byte mode): [version, totalCodewords, ecCodewordsPerBlock, numBlocks]
  const VERSION_SPECS = [
    null,
    [1, 26, 7, 1],
    [2, 44, 10, 1],
    [3, 70, 15, 1],
    [4, 100, 20, 1],
    [5, 134, 26, 1],
    [6, 172, 18, 2]
  ];

  let spec = VERSION_SPECS[6];
  for (let v = 1; v <= 6; v++) {
    const [, totalCw, ecCw, blocks] = VERSION_SPECS[v];
    const dataCw = totalCw - ecCw * blocks;
    if (dataBytes.length + 2 <= dataCw) {
      spec = VERSION_SPECS[v];
      break;
    }
  }

  const [version, totalCodewords, ecLen, numBlocks] = spec;
  const dataCapacity = totalCodewords - ecLen * numBlocks;
  const size = 17 + version * 4;

  // Build bit stream (Byte mode = 0100, 8-bit length for v1-9)
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };
  pushBits(0b0100, 4);
  pushBits(dataBytes.length, 8);
  for (const b of dataBytes) pushBits(b, 8);
  pushBits(0, Math.min(4, dataCapacity * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (codewords.length < dataCapacity) {
    codewords.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // GF(256) math for Reed-Solomon
  const gfExp = new Uint8Array(512);
  const gfLog = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    gfExp[i] = x;
    gfLog[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];
  const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : gfExp[gfLog[a] + gfLog[b]]);

  // Generator polynomial for degree ecLen
  let gen = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], gfExp[i]);
    }
    gen = next;
  }

  const computeEc = (block) => {
    const rem = new Array(ecLen).fill(0);
    for (const byte of block) {
      const factor = byte ^ rem.shift();
      rem.push(0);
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
    return rem;
  };

  const dataBlocks = [];
  const ecBlocks = [];
  const blockSize = Math.floor(dataCapacity / numBlocks);
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const blk = codewords.slice(offset, offset + blockSize);
    offset += blockSize;
    dataBlocks.push(blk);
    ecBlocks.push(computeEc(blk));
  }

  const finalBytes = [];
  for (let i = 0; i < blockSize; i++) {
    for (let b = 0; b < numBlocks; b++) finalBytes.push(dataBlocks[b][i]);
  }
  for (let i = 0; i < ecLen; i++) {
    for (let b = 0; b < numBlocks; b++) finalBytes.push(ecBlocks[b][i]);
  }

  const grid = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setModule = (r, c, val, isFunc) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    grid[r][c] = Boolean(val);
    if (isFunc) reserved[r][c] = true;
  };

  const placeFinder = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setModule(row + r, col + c, inOuter || inInner, true);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0, true);
    setModule(i, 6, i % 2 === 0, true);
  }

  if (version >= 2) {
    const alignCoord = size - 7;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        setModule(alignCoord + r, alignCoord + c, dark, true);
      }
    }
  }

  // Reserve format info areas + dark module
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  setModule(size - 8, 8, true, true);

  // Place data bits with mask 0 ((r + c) % 2 === 0)
  const allBits = [];
  for (const byte of finalBytes) {
    for (let i = 7; i >= 0; i--) allBits.push((byte >>> i) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!reserved[r][c]) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          const masked = bit ^ ((r + c) % 2 === 0 ? 1 : 0);
          grid[r][c] = Boolean(masked);
        }
      }
    }
    upward = !upward;
  }

  // Format bits for Level L (01) + Mask 0 (000) -> 0x77c4
  const formatBits = 0x77c4;
  const fBits = [];
  for (let i = 0; i < 15; i++) fBits.push((formatBits >>> i) & 1);

  for (let i = 0; i <= 5; i++) setModule(8, i, fBits[i], true);
  setModule(8, 7, fBits[6], true);
  setModule(8, 8, fBits[7], true);
  setModule(7, 8, fBits[8], true);
  for (let i = 9; i < 15; i++) setModule(14 - i, 8, fBits[i], true);

  for (let i = 0; i < 8; i++) setModule(8, size - 1 - i, fBits[i], true);
  for (let i = 8; i < 15; i++) setModule(size - 15 + i, 8, fBits[i], true);

  const margin = 4;
  const total = size + margin * 2;
  let pathData = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        pathData += `M${c + margin},${r + margin}h1v1h-1z`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="220" height="220" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff" rx="2"/><path d="${pathData}" fill="#12090d"/></svg>`;
}

module.exports = generateQrSvg;
