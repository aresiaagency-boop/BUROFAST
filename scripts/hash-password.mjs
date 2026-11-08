// Genera OWNER_PASSWORD_HASH sin que la contraseña quede en el historial:
// se lee por stdin. Uso: printf '%s' 'tu-frase' | npm run -s hash-password
import { randomBytes, scrypt } from "node:crypto";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString("utf8");
if (password.length < 12) {
  console.error("La contraseña debe tener al menos 12 caracteres.");
  process.exit(1);
}
const salt = randomBytes(16);
scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 }, (error, hash) => {
  if (error) throw error;
  console.log(["scrypt", 16384, 8, 1, salt.toString("base64url"), hash.toString("base64url")].join(":"));
});
