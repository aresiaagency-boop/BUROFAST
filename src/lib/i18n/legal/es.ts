import type { TextosLegales } from "@/lib/i18n/legal/tipos";

export const es: TextosLegales = {
  menu: "Legal",
  nombres: { privacidad: "Privacidad", condiciones: "Condiciones", "aviso-legal": "Aviso legal" },
  pendiente: "pendiente",
  traduccion: null,
  actualizado: "Última actualización",
  leerPrivacidad: "Leer la política de privacidad",
  aceptarPago: "Al pagar aceptas las {condiciones}.",
  enlaceCondiciones: "condiciones del servicio",
  documentos: {
    privacidad: {
      titulo: "Política de privacidad",
      resumen: "Qué datos tratamos, para qué, con quién los compartimos y cómo ejerces tus derechos.",
      secciones: [
        {
          titulo: "Quién es responsable",
          parrafos: ["El responsable del tratamiento es {titular}, con NIF {nif} y domicilio en {domicilio}. Para cualquier asunto de privacidad, escríbenos a {correo}."],
        },
        {
          titulo: "Qué datos tratamos",
          parrafos: [
            "Las respuestas de tu camino se quedan en tu dispositivo hasta que decides enviarlas.",
            "Si pides que revisemos tu caso: nombre, teléfono, correo, idioma, la ruta calculada y tus respuestas. El nombre, el teléfono y el correo se guardan cifrados.",
            "Si entras con Google: tu correo verificado y tu nombre. No guardamos tus credenciales ni los tokens de Google.",
            "Si pagas: el importe, el estado y la referencia del pago. Los datos de tu tarjeta los trata Stripe; nosotros no los vemos.",
            "Si hablas con HESTIA: tus mensajes y el contexto de tu camino, sin nombre, teléfono ni correo. Por WhatsApp, también tu número.",
          ],
        },
        {
          titulo: "Para qué y con qué base legal",
          parrafos: [
            "Estudiar tu caso y contactarte: tu consentimiento y las medidas previas al contrato que nos pides (art. 6.1.a y 6.1.b RGPD).",
            "Prestar y cobrar el servicio que contratas: la ejecución del contrato (art. 6.1.b).",
            "Cumplir obligaciones contables, fiscales y profesionales: la ley (art. 6.1.c).",
            "Proteger el servicio frente a abusos, con límites de peticiones y registro de auditoría: nuestro interés legítimo (art. 6.1.f).",
            "Enviarte novedades, solo si marcas esa casilla: tu consentimiento, que puedes retirar cuando quieras.",
            "Si nos cuentas datos especialmente protegidos, como datos de salud o de protección internacional, los usamos solo para gestionar tu caso y con tu consentimiento explícito (art. 9.2.a).",
          ],
        },
        {
          titulo: "Inteligencia artificial y decisiones automatizadas",
          parrafos: [
            "HESTIA es una inteligencia artificial y te lo dice al empezar. Los motores calculan una orientación (ruta, citas, documentos y plazos) a partir de tus respuestas.",
            "Ninguna decisión que te afecte se toma solo de forma automática: un abogado colegiado revisa tu ruta antes de cobrarte nada, y puedes pedir hablar con una persona en cualquier momento.",
          ],
        },
        {
          titulo: "Con quién compartimos tus datos",
          parrafos: [
            "Con proveedores que los tratan por encargo nuestro y bajo contrato: Vercel (alojamiento de la web), nuestro servidor privado en el Reino Unido (base de datos y orquestación de HESTIA), Stripe (pagos), Google (inicio de sesión), OpenAI (modelo de lenguaje de HESTIA) y, si usas WhatsApp, Meta.",
            "Algunos están fuera del Espacio Económico Europeo. La transferencia se apoya en una decisión de adecuación de la Comisión Europea (Reino Unido, o el Marco de Privacidad de Datos UE-EE. UU. si el proveedor está adherido) o en cláusulas contractuales tipo.",
            "No vendemos tus datos ni los cedemos para publicidad. Solo los comunicamos a la Administración cuando presentamos un trámite por encargo tuyo o cuando una ley lo exige.",
          ],
        },
        {
          titulo: "Cuánto tiempo los guardamos",
          parrafos: [
            "Si pides revisión y no llegas a contratar: hasta 12 meses desde el último contacto, o menos si nos pides que los borremos.",
            "Si contratas: mientras dure el servicio y, después, durante los plazos que fija la ley, por ejemplo seis años para la documentación contable.",
            "La memoria de las conversaciones con HESTIA se guarda para dar continuidad a la conversación y se borra cuando lo pides.",
          ],
        },
        {
          titulo: "Tus derechos",
          parrafos: [
            "Puedes acceder a tus datos, corregirlos, borrarlos, oponerte o limitar su uso, pedir su portabilidad y retirar tu consentimiento cuando quieras. Escríbenos a {correo} con tu referencia de camino si la tienes.",
            "Si crees que no hemos atendido bien tu petición, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).",
          ],
        },
        {
          titulo: "Seguridad y cookies",
          parrafos: [
            "Ciframos el nombre, el teléfono y el correo con AES-256-GCM, y buscamos tu expediente por una huella del correo, nunca por el correo en claro. Las sesiones van firmadas.",
            "Solo usamos cookies técnicas, necesarias para iniciar sesión y pagar con seguridad. No usamos cookies de analítica ni de publicidad. Tu progreso en el camino se guarda en esta pestaña del navegador y desaparece al cerrarla.",
          ],
        },
      ],
    },
    condiciones: {
      titulo: "Condiciones del servicio",
      resumen: "Cómo funciona BUROFAST, qué pagas, cuándo y cómo reclamar.",
      secciones: [
        {
          titulo: "Quién presta el servicio",
          parrafos: ["BUROFAST es un servicio de {titular} (NIF {nif}). El asesoramiento jurídico lo presta y lo firma un abogado colegiado: {abogado}, del {colegio}, con número de colegiado {colegiado}."],
        },
        {
          titulo: "Qué hacemos y qué no",
          parrafos: [
            "Te orientamos, preparamos y presentamos tus trámites de extranjería, y te acompañamos hasta tu meta.",
            "No somos la Administración: la decisión sobre tu trámite es suya, y no podemos garantizar ni el resultado ni los plazos.",
            "Las citas oficiales son gratuitas. Cobramos la gestión, nunca la cita, y nunca usamos programas automáticos para conseguirlas.",
            "La protección internacional (asilo) la atiende siempre una persona, sin coste.",
          ],
        },
        {
          titulo: "Precio",
          parrafos: [
            "Los precios de la web incluyen el IVA. Las tasas de la Administración, las traducciones y las legalizaciones se pagan aparte, y te lo decimos antes.",
            "El precio final es el del presupuesto que confirma el abogado después de revisar tu ruta.",
          ],
        },
        {
          titulo: "Cómo se contrata y se paga",
          parrafos: [
            "1. Recorres tu camino y pides que revisemos tu caso. No pagas nada.",
            "2. Un abogado revisa tu ruta y la confirma o la corrige.",
            "3. Te enviamos el enlace de pago del anticipo, el 50 % del presupuesto. El resto se paga al presentar el trámite.",
            "Los pagos se hacen con Stripe. El contrato empieza cuando pagas el anticipo.",
          ],
        },
        {
          titulo: "Gestión de citas",
          parrafos: [
            "Puedes elegir entre «Puedo esperar» y «Urgente». «Urgente» acelera el trabajo del equipo, no la cola oficial.",
            "Garantía Urgente: si en 30 días no conseguimos la cita, te devolvemos la diferencia con «Puedo esperar». En las citas que solo existen después de la resolución (huellas, recogida de la tarjeta y jura), el plazo empieza cuando llega la resolución.",
          ],
        },
        {
          titulo: "Derecho de desistimiento",
          parrafos: [
            "Tienes 14 días naturales desde que contratas para desistir sin dar explicaciones: escríbenos a {correo} con tu referencia.",
            "Si nos pides que empecemos a trabajar dentro de ese plazo y después desistes, pagas solo la parte del servicio ya prestada. Si el servicio se ha prestado por completo con tu conformidad expresa, ya no puedes desistir.",
            "Te devolvemos el dinero en un máximo de 14 días, por el mismo medio de pago.",
          ],
        },
        {
          titulo: "Lo que te toca a ti",
          parrafos: ["Nos das datos verdaderos y completos, y nos entregas a tiempo los documentos que te pedimos. Si un dato es falso o llega tarde, el trámite puede retrasarse o denegarse."],
        },
        {
          titulo: "Reclamaciones y ley aplicable",
          parrafos: [
            "Si algo no va bien, escríbenos a {correo}: respondemos en un máximo de 30 días. También puedes acudir a los servicios de consumo de tu comunidad autónoma.",
            "Se aplica la ley española. Si eres consumidor, puedes reclamar ante los tribunales de tu domicilio.",
          ],
        },
      ],
    },
    "aviso-legal": {
      titulo: "Aviso legal",
      resumen: "Quién está detrás de BUROFAST y las reglas de uso de esta web.",
      secciones: [
        {
          titulo: "Titular",
          parrafos: ["Titular: {titular}. NIF: {nif}. Domicilio: {domicilio}. Correo: {correo}. Datos registrales: {registro}."],
        },
        {
          titulo: "Profesión regulada",
          parrafos: ["Los servicios jurídicos los presta un abogado colegiado: {abogado}, del {colegio}, con número de colegiado {colegiado}. Título profesional: abogado, expedido en España. Normas profesionales: Estatuto General de la Abogacía Española y Código Deontológico, publicados en abogacia.es."],
        },
        {
          titulo: "Uso de la web",
          parrafos: [
            "Puedes usar BUROFAST para orientarte y contratar nuestros servicios. No está permitido automatizar el acceso, intentar saltarse sus límites ni usarla para fines ilícitos.",
            "La información de la web es orientativa y no sustituye el asesoramiento del abogado sobre tu caso.",
          ],
        },
        {
          titulo: "Inteligencia artificial",
          parrafos: ["HESTIA y los agentes ARIADNA, CRONOS, MNEMÓSINE, ARGOS y TEMIS son sistemas automáticos. HESTIA es una inteligencia artificial conversacional y se identifica como tal. Las decisiones importantes las revisa siempre una persona."],
        },
        {
          titulo: "Propiedad intelectual",
          parrafos: ["La marca BUROFAST, los textos, el diseño y el código son de {titular} o se usan con licencia. No puedes reproducirlos con fines comerciales sin permiso."],
        },
        {
          titulo: "Enlaces",
          parrafos: ["Los enlaces a webs de la Administración o de terceros son informativos; no controlamos su contenido."],
        },
      ],
    },
  },
};
