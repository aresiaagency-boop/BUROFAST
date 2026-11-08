import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }) => Promise<Buffer>;
const PARAMETROS = { N: 16_384, r: 8, p: 1 };

// Formato: scrypt:N:r:p:salt:hash (sin «$», que dotenv expandiría) (base64url). Lo genera `npm run hash-password`.
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, PARAMETROS);
  return ["scrypt", PARAMETROS.N, PARAMETROS.r, PARAMETROS.p, salt.toString("base64url"), hash.toString("base64url")].join(":");
}

export async function verificarPassword(password: string, almacenado: string) {
  const [algoritmo, n, r, p, salt, hash] = almacenado.split(":");
  if (algoritmo !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const esperado = Buffer.from(hash, "base64url");
  const calculado = await scrypt(password, Buffer.from(salt, "base64url"), esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}
