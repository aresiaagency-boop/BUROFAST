// Detección de intención de respaldo para HESTIA en modo local (sin IA). Es
// deliberadamente simple y predecible: palabras clave en los seis idiomas.
// La seguridad va primero en el orden: asilo y «quiero una persona» ganan
// siempre a cualquier otra intención.

export const INTENCIONES = [
  "asilo",
  "humano",
  "expediente",
  "pago",
  "precio",
  "documentos",
  "citas",
  "plazos",
  "nacionalidad",
  "camino",
  "gracias",
  "saludo",
] as const;
export type Intencion = (typeof INTENCIONES)[number] | "desconocida";

const CLAVES: Record<(typeof INTENCIONES)[number], string[]> = {
  // Raíces, no palabras: «refugee», «réfugié», «притулку», «захисту»… Ante la
  // duda se escala: un falso positivo es el lado seguro.
  asilo: ["asilo", "refugi", "refuge", "proteccion internacional", "protecao internacional", "asylum", "international protection", "asile", "protection internationale", "لجوء", "لاجئ", "حماية دولية", "притул", "біжен", "захист"],
  // «persona» suelta no basta («¿cuánto cuesta por persona?»): solo frases y
  // palabras que piden a alguien.
  humano: ["una persona", "persona real", "alguien", "humano", "abogad", "a person", "real person", "someone", "somebody", "human", "lawyer", "une personne", "quelqu", "humain", "avocat", "uma pessoa", "alguem", "advogad", "محام", "شخص", "إنسان", "людин", "юрист", "адвокат"],
  expediente: ["expediente", "mi caso", "como va", "status", "my case", "my file", "dossier", "processo", "meu caso", "ملف", "حالتي", "справ", "статус"],
  // Sin «tarjeta/card/carte»: en extranjería casi siempre es la TIE, no un medio de pago.
  pago: ["pagar", "pago", "factura", "pay", "payment", "invoice", "payer", "paiement", "pagamento", "دفع", "оплат", "сплат"],
  precio: ["precio", "cuanto", "cuesta", "coste", "costo", "tarifa", "honorario", "price", "cost", "how much", "fee", "prix", "combien", "tarif", "preco", "quanto", "custa", "سعر", "تكلفة", "كم", "ціна", "скільки", "вартіст"],
  documentos: ["documento", "papeles", "certificado", "antecedentes", "pasaporte", "document", "papers", "papiers", "certificat", "certidao", "وثيق", "مستند", "أوراق", "شهادة", "документ", "довідк", "паспорт"],
  citas: ["cita", "turno", "huella", "appointment", "rendez", "rdv", "marcacao", "agendamento", "موعد", "مواعيد", "запис", "візит"],
  plazos: ["renov", "caduc", "vence", "vencim", "plazo", "expir", "renew", "deadline", "renouvel", "validade", "prazo", "تجديد", "انتهاء", "поновл", "продовж", "термін"],
  nacionalidad: ["nacionalidad", "ciudadania", "nationality", "citizenship", "nationalite", "nacionalidade", "cidadania", "جنسية", "громадянств"],
  camino: ["empezar", "camino", "ruta", "que necesito", "start", "route", "where do i start", "commencer", "chemin", "comecar", "caminho", "ابدأ", "طريق", "почати", "шлях", "маршрут"],
  gracias: ["gracias", "thanks", "thank you", "merci", "obrigad", "شكرا", "дякую"],
  saludo: ["hola", "buenas", "hello", "hi", "hey", "bonjour", "salut", "ola", "oi", "مرحبا", "السلام", "привіт", "вітаю"],
};

export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// En árabe el artículo y algunas preposiciones van pegados a la palabra
// («اللجوء» = «el asilo»): se prueba también sin ellos.
const PREFIJO_ARABE = /^(?:[وفبكل]?ال|لل)/u;

function sinPrefijosArabes(texto: string) {
  return texto.split(" ").map((palabra) => palabra.replace(PREFIJO_ARABE, "")).join(" ");
}

function coincide(normalizado: string, palabras: Set<string>, clave: string) {
  const k = normalizar(clave);
  if (k.includes(" ")) return normalizado.includes(k) || sinPrefijosArabes(normalizado).includes(sinPrefijosArabes(k));
  // Las claves cortas («hi», «كم») exigen palabra exacta: «hijo» no es «hi».
  if (k.length <= 3) return palabras.has(k);
  for (const palabra of palabras) {
    if (palabra.startsWith(k) || palabra.replace(PREFIJO_ARABE, "").startsWith(k)) return true;
  }
  return false;
}

export function detectarIntencion(mensaje: string): Intencion {
  const normalizado = normalizar(mensaje);
  const palabras = new Set(normalizado.split(" ").filter(Boolean));
  for (const intencion of INTENCIONES) {
    if (CLAVES[intencion].some((clave) => coincide(normalizado, palabras, clave))) return intencion;
  }
  return "desconocida";
}
