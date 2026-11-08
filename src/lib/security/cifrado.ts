import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

// Cifrado de datos personales en columna (AES-256-GCM). La clave vive solo en
// el servidor (DATA_ENCRYPTION_KEY, 32 bytes en hex o base64). Sin clave no se
// guarda nada: es preferible rechazar la solicitud a guardar en claro.

function clave() {
  const bruta = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (!bruta) throw new Error("DATA_ENCRYPTION_KEY_NOT_CONFIGURED");
  const buffer = /^[0-9a-f]{64}$/i.test(bruta) ? Buffer.from(bruta, "hex") : Buffer.from(bruta, "base64");
  if (buffer.length !== 32) throw new Error("DATA_ENCRYPTION_KEY_INVALID_LENGTH");
  return buffer;
}

export function cifradoConfigurado() {
  try {
    clave();
    return true;
  } catch {
    return false;
  }
}

export function cifrar(texto: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", clave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), cifrado.toString("base64url")].join(".");
}

export function descifrar(sobre: string) {
  const [version, iv, tag, datos] = sobre.split(".");
  if (version !== "v1" || !iv || !tag || !datos) throw new Error("CIPHERTEXT_MALFORMED");
  const decipher = createDecipheriv("aes-256-gcm", clave(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(datos, "base64url")), decipher.final()]).toString("utf8");
}

// Hash estable para deduplicar teléfonos sin poder revertirlo sin la clave.
export function hashEstable(texto: string) {
  return createHmac("sha256", clave()).update(texto).digest("hex");
}

export function enmascararTelefono(telefono: string) {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length <= 4) return "••••";
  // El prefijo de país tiene de 1 a 3 cifras; el número nacional suele tener 9.
  const prefijo = Math.min(3, Math.max(1, digitos.length - 9));
  return `+${digitos.slice(0, prefijo)} ••• ••• ${digitos.slice(-3)}`;
}
