#!/usr/bin/env node
/**
 * Convert snarkjs verification key (vk.json) to Soroban VerificationKeyBytes hex format.
 *
 * Usage: node scripts/convert-vk.js circuits/zkombat-circom/vk.json
 *
 * Output: JSON with { alpha, beta, gamma, delta, ic } as hex strings
 * suitable for deploying the CircomGroth16Verifier contract.
 *
 * G1 point (64 bytes): x(32) || y(32)
 * G2 point (128 bytes): x.c1(32) || x.c0(32) || y.c1(32) || y.c0(32)
 *   (Soroban expects imaginary || real ordering, snarkjs gives [c0, c1])
 */

const fs = require("fs");

function toBE32(decStr) {
  let n = BigInt(decStr);
  const buf = Buffer.alloc(32);
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}

/** G1 affine point → 64-byte hex (x || y), skip z coordinate */
function g1ToHex(point) {
  const x = toBE32(point[0]);
  const y = toBE32(point[1]);
  return Buffer.concat([x, y]).toString("hex");
}

/**
 * G2 affine point → 128-byte hex
 * snarkjs format: [[x_c0, x_c1], [y_c0, y_c1], [z_c0, z_c1]]
 * Soroban format: x_c1 || x_c0 || y_c1 || y_c0  (imaginary first)
 */
function g2ToHex(point) {
  const x_c0 = toBE32(point[0][0]);
  const x_c1 = toBE32(point[0][1]);
  const y_c0 = toBE32(point[1][0]);
  const y_c1 = toBE32(point[1][1]);
  return Buffer.concat([x_c1, x_c0, y_c1, y_c0]).toString("hex");
}

function main() {
  const vkPath = process.argv[2];
  if (!vkPath) {
    console.error("Usage: node scripts/convert-vk.js <vk.json>");
    process.exit(1);
  }

  const vk = JSON.parse(fs.readFileSync(vkPath, "utf8"));

  const result = {
    alpha: g1ToHex(vk.vk_alpha_1),
    beta: g2ToHex(vk.vk_beta_2),
    gamma: g2ToHex(vk.vk_gamma_2),
    delta: g2ToHex(vk.vk_delta_2),
    ic: vk.IC.map((p) => g1ToHex(p)),
  };

  console.log(JSON.stringify(result, null, 2));
}

main();
