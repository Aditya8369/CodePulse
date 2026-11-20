/**
 * Lightweight WebAssembly SHA-256 Proof-of-Work (PoW) Solver Library
 *
 * Executes the entire SHA-256 compression and nonce brute-force search loop
 * inside compiled WebAssembly linear memory without crossing the JS/Wasm
 * boundary per hash iteration.
 */

export interface PowChallengePayload {
  challenge: string;
  challengeId?: string;
  algorithm?: string;
  difficulty: number;
  targetPrefix?: string;
  issuedAt?: number;
  expiresAt?: number;
  ttlSeconds?: number;
  surgeActive?: boolean;
}

export interface PowSolveOptions {
  startNonce?: number;
  maxIterations?: number;
}

export interface PowSolveResult {
  nonce: string;
  hash: string;
  iterations: number;
  durationMs: number;
  engine: 'wasm';
}

interface PowWasmExports {
  memory: WebAssembly.Memory;
  sha256: (msgOffset: number, msgLen: number) => void;
  mine: (
    challengeOffset: number,
    challengeLen: number,
    leadingZeros: number,
    startNonce: number,
    maxIterations: number,
  ) => number;
}

// SHA-256 round constants K[0..63]
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

// SHA-256 initial state H0[0..7]
const SHA256_H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
]);

// Linear memory layout inside 1 Wasm page (65,536 bytes):
// 0x0000..0x00FF : K[0..63]
// 0x0100..0x011F : H0[0..7]
// 0x0120..0x013F : H[0..7] (output hash state)
// 0x0140..0x023F : W[0..63] (message schedule)
// 0x0240..0x027F : blockBuf[0..63]
// 0x0300..0x1FFF : challenge + nonce working buffer
const ADDR_K = 0x0000;
const ADDR_H0 = 0x0100;
const ADDR_H = 0x0120;
const ADDR_W = 0x0140;
const ADDR_BLOCK = 0x0240;
const ADDR_INPUT = 0x0300;

function encodeU32Leb(value: number): number[] {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (v !== 0);
  return bytes;
}

function encodeI32Leb(value: number): number[] {
  const bytes: number[] = [];
  let v = value | 0;
  let more = true;
  while (more) {
    const byte = v & 0x7f;
    v >>= 7;
    if ((v === 0 && (byte & 0x40) === 0) || (v === -1 && (byte & 0x40) !== 0)) {
      more = false;
      bytes.push(byte);
    } else {
      bytes.push(byte | 0x80);
    }
  }
  return bytes;
}

function encodeSection(id: number, payload: number[]): number[] {
  return [id, ...encodeU32Leb(payload.length), ...payload];
}

function encodeString(str: string): number[] {
  const encoded = new TextEncoder().encode(str);
  return [...encodeU32Leb(encoded.length), ...encoded];
}

// Wasm bytecode helpers
const OP = {
  block: 0x02,
  loop: 0x03,
  if: 0x04,
  end: 0x0b,
  br: 0x0c,
  brIf: 0x0d,
  return: 0x0f,
  call: 0x10,
  localGet: 0x20,
  localSet: 0x21,
  localTee: 0x22,
  i32Load: 0x28,
  i32Load8U: 0x2d,
  i32Store: 0x36,
  i32Store8: 0x3a,
  i32Const: 0x41,
  i32Eqz: 0x45,
  i32Eq: 0x46,
  i32Ne: 0x47,
  i32LtS: 0x48,
  i32LtU: 0x49,
  i32GtS: 0x4a,
  i32GtU: 0x4b,
  i32GeS: 0x4e,
  i32GeU: 0x4f,
  i32Add: 0x6a,
  i32Sub: 0x6b,
  i32DivU: 0x6e,
  i32RemU: 0x70,
  i32And: 0x71,
  i32Or: 0x72,
  i32Xor: 0x73,
  i32Shl: 0x74,
  i32ShrU: 0x76,
  i32Rotr: 0x78,
} as const;

const i32Const = (v: number) => [OP.i32Const, ...encodeI32Leb(v)];
const localGet = (idx: number) => [OP.localGet, ...encodeU32Leb(idx)];
const localSet = (idx: number) => [OP.localSet, ...encodeU32Leb(idx)];
const localTee = (idx: number) => [OP.localTee, ...encodeU32Leb(idx)];
const i32Load = (offset: number) => [OP.i32Load, 0x02, ...encodeU32Leb(offset)];
const i32Load8U = (offset: number) => [
  OP.i32Load8U,
  0x00,
  ...encodeU32Leb(offset),
];
const i32Store = (offset: number) => [
  OP.i32Store,
  0x02,
  ...encodeU32Leb(offset),
];
const i32Store8 = (offset: number) => [
  OP.i32Store8,
  0x00,
  ...encodeU32Leb(offset),
];

function rotrExpr(valOps: number[], shift: number): number[] {
  return [...valOps, ...i32Const(shift), OP.i32Rotr];
}

function shrUExpr(valOps: number[], shift: number): number[] {
  return [...valOps, ...i32Const(shift), OP.i32ShrU];
}

/**
 * Builds the standalone WebAssembly binary implementing SHA-256 and the
 * inner nonce search loop.
 */
export function buildPowWasmModule(): Uint8Array {
  // Type Section:
  // type 0: () -> ()
  // type 1: (i32, i32) -> ()
  // type 2: (i32, i32, i32, i32, i32) -> (i32)
  const typeSection = encodeSection(1, [
    0x03,
    0x60,
    0x00,
    0x00,
    0x60,
    0x02,
    0x7f,
    0x7f,
    0x00,
    0x60,
    0x05,
    0x7f,
    0x7f,
    0x7f,
    0x7f,
    0x7f,
    0x01,
    0x7f,
  ]);

  // Function Section: 3 functions mapped to types 0, 1, 2
  const functionSection = encodeSection(3, [0x03, 0x00, 0x01, 0x02]);

  // Memory Section: 1 memory, min 1 page (64 KiB)
  const memorySection = encodeSection(5, [0x01, 0x00, 0x01]);

  // Export Section: memory, sha256 (func 1), mine (func 2)
  const exportSection = encodeSection(7, [
    0x03,
    ...encodeString('memory'),
    0x02,
    0x00,
    ...encodeString('sha256'),
    0x00,
    0x01,
    ...encodeString('mine'),
    0x00,
    0x02,
  ]);

  // Func 0: compressBlock()
  // Locals: 0:i, 1:a, 2:b, 3:c, 4:d, 5:e, 6:f, 7:g, 8:h, 9:t1, 10:t2, 11:tmp
  const L_I = 0,
    L_A = 1,
    L_B = 2,
    L_C = 3,
    L_D = 4,
    L_E = 5,
    L_F = 6,
    L_G = 7,
    L_H = 8,
    L_T1 = 9,
    L_T2 = 10,
    L_TMP = 11;

  const func0Body: number[] = [
    0x01,
    0x0c,
    0x7f, // 1 local group of 12 i32s
    // i = 0; load big-endian W[0..15] from ADDR_BLOCK
    ...i32Const(0),
    ...localSet(L_I),
    OP.block,
    0x40,
    OP.loop,
    0x40,
    ...localGet(L_I),
    ...i32Const(16),
    OP.i32GeU,
    OP.if,
    0x40,
    OP.br,
    0x02,
    OP.end,
    // tmp = ADDR_BLOCK + (i << 2)
    ...i32Const(ADDR_BLOCK),
    ...localGet(L_I),
    ...i32Const(2),
    OP.i32Shl,
    OP.i32Add,
    ...localSet(L_TMP),
    // W[i] = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
    ...i32Const(ADDR_W),
    ...localGet(L_I),
    ...i32Const(2),
    OP.i32Shl,
    OP.i32Add,
    ...localGet(L_TMP),
    ...i32Load8U(0),
    ...i32Const(24),
    OP.i32Shl,
    ...localGet(L_TMP),
    ...i32Load8U(1),
    ...i32Const(16),
    OP.i32Shl,
    OP.i32Or,
    ...localGet(L_TMP),
    ...i32Load8U(2),
    ...i32Const(8),
    OP.i32Shl,
    OP.i32Or,
    ...localGet(L_TMP),
    ...i32Load8U(3),
    OP.i32Or,
    ...i32Store(0),
    ...localGet(L_I),
    ...i32Const(1),
    OP.i32Add,
    ...localSet(L_I),
    OP.br,
    0x00,
    OP.end,
    OP.end,

    // Extend W[16..63]
    ...i32Const(16),
    ...localSet(L_I),
    OP.block,
    0x40,
    OP.loop,
    0x40,
    ...localGet(L_I),
    ...i32Const(64),
    OP.i32GeU,
    OP.if,
    0x40,
    OP.br,
    0x02,
    OP.end,
    // addr of W[i]
    ...i32Const(ADDR_W),
    ...localGet(L_I),
    ...i32Const(2),
    OP.i32Shl,
    OP.i32Add,
    // W[i - 16]
    ...i32Const(ADDR_W),
    ...localGet(L_I),
    ...i32Const(16),
    OP.i32Sub,
    ...i32Const(2),
    OP.i32Shl,
    OP.i32Add,
    ...i32Load(0),
    // s0(W[i - 15])
    ...i32Const(ADDR_W),
    ...localGet(L_I),
    ...i32Const(15),
    OP.i32Sub,
    ...i32Const(2),
    OP.i32Shl,
    OP.i32Add,
    ...i32Load(0),
    ...localTee(L_TMP),
    ...i32Const(7),
    OP.i32Rotr,
    ...rotrExpr(localGet(L_TMP), 18),
    OP.i32Xor,
    ...shrUExpr(localGet(L_TMP), 3),
    OP.i32Xor,
    OP.i32Add,
    // + W[i - 7]
    ...i32Const(ADDR_W),
    ...localGet(L_I),
    ...i32Const(7),
    OP.i32Sub,
    ...i32Const(2),
    OP.i32Shl,
    OP.i32Add,
    ...i32Load(0),
    OP.i32Add,
    // + s1(W[i - 2])
    ...i32Const(ADDR_W),
    ...localGet(L_I),
    ...i32Const(2),
    OP.i32Sub,
    ...i32Const(2),
    OP.i32Shl,
    OP.i32Add,
    ...i32Load(0),
    ...localTee(L_TMP),
    ...i32Const(17),
    OP.i32Rotr,
    ...rotrExpr(localGet(L_TMP), 19),
    OP.i32Xor,
    ...shrUExpr(localGet(L_TMP), 10),
    OP.i32Xor,
    OP.i32Add,
    ...i32Store(0),
    ...localGet(L_I),
    ...i32Const(1),
    OP.i32Add,
    ...localSet(L_I),
    OP.br,
    0x00,
    OP.end,
    OP.end,

    // Initialize working vars a..h from ADDR_H
    ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((idx) => [
      ...i32Const(ADDR_H + idx * 4),
      ...i32Load(0),
      ...localSet(L_A + idx),
    ]),

    // Compression loop i = 0..63
    ...i32Const(0),
    ...localSet(L_I),
    OP.block,
    0x40,
    OP.loop,
    0x40,
    ...localGet(L_I),
    ...i32Const(64),
    OP.i32GeU,
    OP.if,
    0x40,
    OP.br,
    0x02,
    OP.end,
    // t1 = h + Sigma1(e) + Ch(e, f, g) + K[i] + W[i]
    ...localGet(L_H),
    ...rotrExpr(localGet(L_E), 6),
    ...rotrExpr(localGet(L_E), 11),
    OP.i32Xor,
    ...rotrExpr(localGet(L_E), 25),
    OP.i32Xor,
    OP.i32Add,
    // Ch(e, f, g) = (e & f) ^ ((e ^ -1) & g)
    ...localGet(L_E),
    ...localGet(L_F),
    OP.i32And,
    ...localGet(L_E),
    ...i32Const(-1),
    OP.i32Xor,
    ...localGet(L_G),
    OP.i32And,
    OP.i32Xor,
    OP.i32Add,
    // + K[i]
    ...i32Const(ADDR_K),
    ...localGet(L_I),
    ...i32Const(2),
    OP.i32Shl,
    OP.i32Add,
    ...i32Load(0),
    OP.i32Add,
    // + W[i]
    ...i32Const(ADDR_W),
    ...localGet(L_I),
    ...i32Const(2),
    OP.i32Shl,
    OP.i32Add,
    ...i32Load(0),
    OP.i32Add,
    ...localSet(L_T1),

    // t2 = Sigma0(a) + Maj(a, b, c)
    ...rotrExpr(localGet(L_A), 2),
    ...rotrExpr(localGet(L_A), 13),
    OP.i32Xor,
    ...rotrExpr(localGet(L_A), 22),
    OP.i32Xor,
    // Maj(a, b, c) = (a & b) ^ (a & c) ^ (b & c)
    ...localGet(L_A),
    ...localGet(L_B),
    OP.i32And,
    ...localGet(L_A),
    ...localGet(L_C),
    OP.i32And,
    OP.i32Xor,
    ...localGet(L_B),
    ...localGet(L_C),
    OP.i32And,
    OP.i32Xor,
    OP.i32Add,
    ...localSet(L_T2),

    // Rotate registers
    ...localGet(L_G),
    ...localSet(L_H),
    ...localGet(L_F),
    ...localSet(L_G),
    ...localGet(L_E),
    ...localSet(L_F),
    ...localGet(L_D),
    ...localGet(L_T1),
    OP.i32Add,
    ...localSet(L_E),
    ...localGet(L_C),
    ...localSet(L_D),
    ...localGet(L_B),
    ...localSet(L_C),
    ...localGet(L_A),
    ...localSet(L_B),
    ...localGet(L_T1),
    ...localGet(L_T2),
    OP.i32Add,
    ...localSet(L_A),

    ...localGet(L_I),
    ...i32Const(1),
    OP.i32Add,
    ...localSet(L_I),
    OP.br,
    0x00,
    OP.end,
    OP.end,

    // Add a..h back into ADDR_H[0..7]
    ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((idx) => [
      ...i32Const(ADDR_H + idx * 4),
      ...i32Const(ADDR_H + idx * 4),
      ...i32Load(0),
      ...localGet(L_A + idx),
      OP.i32Add,
      ...i32Store(0),
    ]),
    OP.end,
  ];

  // Helper snippet to zero the 64-byte block buffer at ADDR_BLOCK using local `jIdx`
  const zeroBlockOps = (jIdx: number): number[] => [
    ...i32Const(0),
    ...localSet(jIdx),
    OP.block,
    0x40,
    OP.loop,
    0x40,
    ...localGet(jIdx),
    ...i32Const(16),
    OP.i32GeU,
    OP.if,
    0x40,
    OP.br,
    0x02,
    OP.end,
    ...i32Const(ADDR_BLOCK),
    ...localGet(jIdx),
    ...i32Const(2),
    OP.i32Shl,
    OP.i32Add,
    ...i32Const(0),
    ...i32Store(0),
    ...localGet(jIdx),
    ...i32Const(1),
    OP.i32Add,
    ...localSet(jIdx),
    OP.br,
    0x00,
    OP.end,
    OP.end,
  ];

  // Func 1: sha256(msgOffset: i32, msgLen: i32)
  // Params: 0: msgOffset, 1: msgLen
  // Locals: 2: offset, 3: rem, 4: j
  const P_MSG_OFFSET = 0,
    P_MSG_LEN = 1,
    L_OFFSET = 2,
    L_REM = 3,
    L_J = 4;

  const func1Body: number[] = [
    0x01,
    0x03,
    0x7f, // 3 i32 locals
    // Copy H0[0..7] -> H[0..7]
    ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((idx) => [
      ...i32Const(ADDR_H + idx * 4),
      ...i32Const(ADDR_H0 + idx * 4),
      ...i32Load(0),
      ...i32Store(0),
    ]),
    ...i32Const(0),
    ...localSet(L_OFFSET),
    // Process full 64-byte chunks
    OP.block,
    0x40,
    OP.loop,
    0x40,
    ...localGet(L_OFFSET),
    ...i32Const(64),
    OP.i32Add,
    ...localGet(P_MSG_LEN),
    OP.i32GtU,
    OP.if,
    0x40,
    OP.br,
    0x02,
    OP.end,
    // Copy 64 bytes into ADDR_BLOCK
    ...i32Const(0),
    ...localSet(L_J),
    OP.block,
    0x40,
    OP.loop,
    0x40,
    ...localGet(L_J),
    ...i32Const(64),
    OP.i32GeU,
    OP.if,
    0x40,
    OP.br,
    0x02,
    OP.end,
    ...i32Const(ADDR_BLOCK),
    ...localGet(L_J),
    OP.i32Add,
    ...localGet(P_MSG_OFFSET),
    ...localGet(L_OFFSET),
    OP.i32Add,
    ...localGet(L_J),
    OP.i32Add,
    ...i32Load8U(0),
    ...i32Store8(0),
    ...localGet(L_J),
    ...i32Const(1),
    OP.i32Add,
    ...localSet(L_J),
    OP.br,
    0x00,
    OP.end,
    OP.end,
    OP.call,
    0x00,
    ...localGet(L_OFFSET),
    ...i32Const(64),
    OP.i32Add,
    ...localSet(L_OFFSET),
    OP.br,
    0x00,
    OP.end,
    OP.end,

    // Final padded block(s)
    ...zeroBlockOps(L_J),
    ...localGet(P_MSG_LEN),
    ...localGet(L_OFFSET),
    OP.i32Sub,
    ...localSet(L_REM),

    // Copy rem bytes into ADDR_BLOCK
    ...i32Const(0),
    ...localSet(L_J),
    OP.block,
    0x40,
    OP.loop,
    0x40,
    ...localGet(L_J),
    ...localGet(L_REM),
    OP.i32GeU,
    OP.if,
    0x40,
    OP.br,
    0x02,
    OP.end,
    ...i32Const(ADDR_BLOCK),
    ...localGet(L_J),
    OP.i32Add,
    ...localGet(P_MSG_OFFSET),
    ...localGet(L_OFFSET),
    OP.i32Add,
    ...localGet(L_J),
    OP.i32Add,
    ...i32Load8U(0),
    ...i32Store8(0),
    ...localGet(L_J),
    ...i32Const(1),
    OP.i32Add,
    ...localSet(L_J),
    OP.br,
    0x00,
    OP.end,
    OP.end,

    // Append 0x80 bit marker
    ...i32Const(ADDR_BLOCK),
    ...localGet(L_REM),
    OP.i32Add,
    ...i32Const(0x80),
    ...i32Store8(0),

    // If rem >= 56, compress this block and zero a fresh final block for the 64-bit length
    ...localGet(L_REM),
    ...i32Const(56),
    OP.i32GeU,
    OP.if,
    0x40,
    OP.call,
    0x00,
    ...zeroBlockOps(L_J),
    OP.end,

    // Write 64-bit big-endian bit length (msgLen * 8) at ADDR_BLOCK + 56..63
    // High 32 bits: msgLen >>> 29
    ...i32Const(ADDR_BLOCK + 56),
    ...localGet(P_MSG_LEN),
    ...i32Const(29),
    OP.i32ShrU,
    ...i32Const(24),
    OP.i32ShrU,
    ...i32Store8(0),
    ...i32Const(ADDR_BLOCK + 57),
    ...localGet(P_MSG_LEN),
    ...i32Const(29),
    OP.i32ShrU,
    ...i32Const(16),
    OP.i32ShrU,
    ...i32Store8(0),
    ...i32Const(ADDR_BLOCK + 58),
    ...localGet(P_MSG_LEN),
    ...i32Const(29),
    OP.i32ShrU,
    ...i32Const(8),
    OP.i32ShrU,
    ...i32Store8(0),
    ...i32Const(ADDR_BLOCK + 59),
    ...localGet(P_MSG_LEN),
    ...i32Const(29),
    OP.i32ShrU,
    ...i32Store8(0),
    // Low 32 bits: msgLen << 3
    ...i32Const(ADDR_BLOCK + 60),
    ...localGet(P_MSG_LEN),
    ...i32Const(3),
    OP.i32Shl,
    ...i32Const(24),
    OP.i32ShrU,
    ...i32Store8(0),
    ...i32Const(ADDR_BLOCK + 61),
    ...localGet(P_MSG_LEN),
    ...i32Const(3),
    OP.i32Shl,
    ...i32Const(16),
    OP.i32ShrU,
    ...i32Store8(0),
    ...i32Const(ADDR_BLOCK + 62),
    ...localGet(P_MSG_LEN),
    ...i32Const(3),
    OP.i32Shl,
    ...i32Const(8),
    OP.i32ShrU,
    ...i32Store8(0),
    ...i32Const(ADDR_BLOCK + 63),
    ...localGet(P_MSG_LEN),
    ...i32Const(3),
    OP.i32Shl,
    ...i32Store8(0),

    OP.call,
    0x00,
    OP.end,
  ];

  // Func 2: mine(challengeOffset, challengeLen, leadingZeros, startNonce, maxIterations) -> i32
  // Params: 0: challengeOffset, 1: challengeLen, 2: leadingZeros, 3: startNonce, 4: maxIterations
  // Locals: 5: iter, 6: nonce, 7: tmp, 8: digits, 9: writePos, 10: k, 11: wordVal, 12: shift, 13: ok
  const P_CHAL_OFF = 0,
    P_CHAL_LEN = 1,
    P_ZEROS = 2,
    P_START_NONCE = 3,
    P_MAX_ITER = 4,
    L_ITER = 5,
    L_NONCE = 6,
    L_MTMP = 7,
    L_DIGITS = 8,
    L_WRITE_POS = 9,
    L_K = 10,
    L_WORD = 11,
    L_SHIFT = 12,
    L_OK = 13;

  const func2Body: number[] = [
    0x01,
    0x09,
    0x7f, // 9 i32 locals
    ...i32Const(0),
    ...localSet(L_ITER),

    OP.block,
    0x40,
    OP.loop,
    0x40,
    ...localGet(L_ITER),
    ...localGet(P_MAX_ITER),
    OP.i32GeU,
    OP.if,
    0x40,
    OP.br,
    0x02,
    OP.end,

    // nonce = startNonce + iter
    ...localGet(P_START_NONCE),
    ...localGet(L_ITER),
    OP.i32Add,
    ...localTee(L_NONCE),
    ...localSet(L_MTMP),

    // Count decimal digits of nonce
    ...i32Const(1),
    ...localSet(L_DIGITS),
    OP.block,
    0x40,
    OP.loop,
    0x40,
    ...localGet(L_MTMP),
    ...i32Const(10),
    OP.i32LtU,
    OP.if,
    0x40,
    OP.br,
    0x02,
    OP.end,
    ...localGet(L_MTMP),
    ...i32Const(10),
    OP.i32DivU,
    ...localSet(L_MTMP),
    ...localGet(L_DIGITS),
    ...i32Const(1),
    OP.i32Add,
    ...localSet(L_DIGITS),
    OP.br,
    0x00,
    OP.end,
    OP.end,

    // Write ASCII decimal digits right-to-left starting at challengeOffset + challengeLen + digits - 1
    ...localGet(P_CHAL_OFF),
    ...localGet(P_CHAL_LEN),
    OP.i32Add,
    ...localGet(L_DIGITS),
    OP.i32Add,
    ...i32Const(1),
    OP.i32Sub,
    ...localSet(L_WRITE_POS),
    ...localGet(L_NONCE),
    ...localSet(L_MTMP),

    OP.block,
    0x40,
    OP.loop,
    0x40,
    ...localGet(L_WRITE_POS),
    ...localGet(P_CHAL_OFF),
    ...localGet(P_CHAL_LEN),
    OP.i32Add,
    OP.i32LtS,
    OP.if,
    0x40,
    OP.br,
    0x02,
    OP.end,
    ...localGet(L_WRITE_POS),
    ...i32Const(48),
    ...localGet(L_MTMP),
    ...i32Const(10),
    OP.i32RemU,
    OP.i32Add,
    ...i32Store8(0),
    ...localGet(L_MTMP),
    ...i32Const(10),
    OP.i32DivU,
    ...localSet(L_MTMP),
    ...localGet(L_WRITE_POS),
    ...i32Const(1),
    OP.i32Sub,
    ...localSet(L_WRITE_POS),
    OP.br,
    0x00,
    OP.end,
    OP.end,

    // Compute sha256(challengeOffset, challengeLen + digits)
    ...localGet(P_CHAL_OFF),
    ...localGet(P_CHAL_LEN),
    ...localGet(L_DIGITS),
    OP.i32Add,
    OP.call,
    0x01,

    // Verify leadingZeros hex nibbles in H[0..7] (ADDR_H)
    ...i32Const(1),
    ...localSet(L_OK),
    ...i32Const(0),
    ...localSet(L_K),

    OP.block,
    0x40,
    OP.loop,
    0x40,
    ...localGet(L_K),
    ...localGet(P_ZEROS),
    OP.i32GeS,
    OP.if,
    0x40,
    OP.br,
    0x02,
    OP.end,
    // wordVal = load(ADDR_H + ((k >> 3) << 2))
    ...i32Const(ADDR_H),
    ...localGet(L_K),
    ...i32Const(3),
    OP.i32ShrU,
    ...i32Const(2),
    OP.i32Shl,
    OP.i32Add,
    ...i32Load(0),
    ...localSet(L_WORD),
    // shift = (7 - (k & 7)) << 2
    ...i32Const(7),
    ...localGet(L_K),
    ...i32Const(7),
    OP.i32And,
    OP.i32Sub,
    ...i32Const(2),
    OP.i32Shl,
    ...localSet(L_SHIFT),
    // if (((wordVal >>> shift) & 0xF) != 0) { ok = 0; break; }
    ...localGet(L_WORD),
    ...localGet(L_SHIFT),
    OP.i32ShrU,
    ...i32Const(15),
    OP.i32And,
    ...i32Const(0),
    OP.i32Ne,
    OP.if,
    0x40,
    ...i32Const(0),
    ...localSet(L_OK),
    OP.br,
    0x02,
    OP.end,
    ...localGet(L_K),
    ...i32Const(1),
    OP.i32Add,
    ...localSet(L_K),
    OP.br,
    0x00,
    OP.end,
    OP.end,

    ...localGet(L_OK),
    ...i32Const(1),
    OP.i32Eq,
    OP.if,
    0x40,
    ...localGet(L_NONCE),
    OP.return,
    OP.end,

    ...localGet(L_ITER),
    ...i32Const(1),
    OP.i32Add,
    ...localSet(L_ITER),
    OP.br,
    0x00,
    OP.end,
    OP.end,

    ...i32Const(-1),
    OP.end,
  ];

  const encodeFuncBody = (body: number[]) => [
    ...encodeU32Leb(body.length),
    ...body,
  ];

  const codeSection = encodeSection(10, [
    0x03,
    ...encodeFuncBody(func0Body),
    ...encodeFuncBody(func1Body),
    ...encodeFuncBody(func2Body),
  ]);

  // Data Section: initialize K[0..63] at 0x0000 and H0[0..7] at 0x0100
  const kBytes = Array.from(new Uint8Array(SHA256_K.buffer));
  const h0Bytes = Array.from(new Uint8Array(SHA256_H0.buffer));
  const dataSection = encodeSection(11, [
    0x02,
    // Segment 0: memory 0, offset i32.const 0
    0x00,
    OP.i32Const,
    ...encodeI32Leb(ADDR_K),
    OP.end,
    ...encodeU32Leb(kBytes.length),
    ...kBytes,
    // Segment 1: memory 0, offset i32.const 0x0100
    0x00,
    OP.i32Const,
    ...encodeI32Leb(ADDR_H0),
    OP.end,
    ...encodeU32Leb(h0Bytes.length),
    ...h0Bytes,
  ]);

  return new Uint8Array([
    0x00,
    0x61,
    0x73,
    0x6d, // \0asm
    0x01,
    0x00,
    0x00,
    0x00, // version 1
    ...typeSection,
    ...functionSection,
    ...memorySection,
    ...exportSection,
    ...codeSection,
    ...dataSection,
  ]);
}

let cachedWasmExports: PowWasmExports | null = null;

/**
 * Instantiates and caches the WebAssembly SHA-256 miner singleton.
 */
export async function initPowWasm(): Promise<PowWasmExports> {
  if (cachedWasmExports) {
    return cachedWasmExports;
  }
  const wasmBytes = buildPowWasmModule();
  const instantiated = await WebAssembly.instantiate(
    wasmBytes as unknown as BufferSource,
    {},
  );
  const instance =
    'instance' in instantiated ? instantiated.instance : instantiated;
  cachedWasmExports = instance.exports as unknown as PowWasmExports;
  return cachedWasmExports;
}

function readDigestHex(memory: WebAssembly.Memory): string {
  const words = new Uint32Array(memory.buffer, ADDR_H, 8);
  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += (words[i] >>> 0).toString(16).padStart(8, '0');
  }
  return hex;
}

/**
 * Computes a SHA-256 hex digest using the WebAssembly module.
 */
export async function wasmSha256Hex(input: string): Promise<string> {
  const exports = await initPowWasm();
  const encoded = new TextEncoder().encode(input);
  const memView = new Uint8Array(exports.memory.buffer);
  if (ADDR_INPUT + encoded.length >= memView.length) {
    throw new Error('Input exceeds Wasm linear memory buffer');
  }
  memView.set(encoded, ADDR_INPUT);
  exports.sha256(ADDR_INPUT, encoded.length);
  return readDigestHex(exports.memory);
}

/**
 * Solves a Proof-of-Work challenge using the compiled WebAssembly SHA-256 engine.
 * Finds `nonce` such that SHA256(challenge + nonce) begins with `difficulty` hex zeros.
 */
export async function solvePowChallenge(
  challenge: string,
  difficulty: number,
  options: PowSolveOptions = {},
): Promise<PowSolveResult> {
  if (!challenge) {
    throw new Error('Challenge string must not be empty');
  }
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 10) {
    throw new Error('Difficulty must be an integer between 1 and 10');
  }

  const exports = await initPowWasm();
  const encodedChallenge = new TextEncoder().encode(challenge);
  const memView = new Uint8Array(exports.memory.buffer);

  if (ADDR_INPUT + encodedChallenge.length + 32 >= memView.length) {
    throw new Error('Challenge length exceeds Wasm buffer capacity');
  }

  memView.set(encodedChallenge, ADDR_INPUT);

  const startNonce = options.startNonce ?? 0;
  const maxIterations =
    options.maxIterations ?? (difficulty <= 4 ? 2_000_000 : 100_000_000);
  const batchSize = 500_000;

  const startTime = performance.now();
  let currentStart = startNonce;
  let totalChecked = 0;

  while (totalChecked < maxIterations) {
    const batch = Math.min(batchSize, maxIterations - totalChecked);
    const foundNonce = exports.mine(
      ADDR_INPUT,
      encodedChallenge.length,
      difficulty,
      currentStart,
      batch,
    );

    if (foundNonce >= 0) {
      const durationMs = performance.now() - startTime;
      const hash = readDigestHex(exports.memory);
      const iterations = foundNonce - startNonce + 1;
      return {
        nonce: String(foundNonce),
        hash,
        iterations,
        durationMs,
        engine: 'wasm',
      };
    }

    currentStart += batch;
    totalChecked += batch;
  }

  throw new Error(
    `Failed to solve PoW challenge within ${maxIterations} iterations`,
  );
}

/**
 * Fetch wrapper that transparently handles HTTP 428 / 403 Proof-of-Work
 * challenges by solving them in WebAssembly and retrying with X-PoW headers.
 */
export async function fetchWithPow(
  input: RequestInfo | URL,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const initialResponse = await fetchImpl(input, init);

  if (initialResponse.status !== 428 && initialResponse.status !== 403) {
    return initialResponse;
  }

  let body: { pow?: PowChallengePayload } | null = null;
  try {
    body = (await initialResponse.clone().json()) as {
      pow?: PowChallengePayload;
    };
  } catch {
    return initialResponse;
  }

  const pow = body?.pow;
  if (!pow?.challenge || typeof pow.difficulty !== 'number') {
    return initialResponse;
  }

  const solution = await solvePowChallenge(pow.challenge, pow.difficulty);
  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('x-pow-challenge', pow.challenge);
  retryHeaders.set('x-pow-nonce', solution.nonce);

  return fetchImpl(input, {
    ...init,
    headers: retryHeaders,
  });
}
