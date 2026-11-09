import type { TextosLegales } from "@/lib/i18n/legal/tipos";

export const en: TextosLegales = {
  menu: "Legal",
  nombres: { privacidad: "Privacy", condiciones: "Terms", "aviso-legal": "Legal notice" },
  pendiente: "pending",
  traduccion: "Informative translation. If in doubt, the Spanish version prevails.",
  actualizado: "Last updated",
  leerPrivacidad: "Read the privacy policy",
  aceptarPago: "By paying you accept the {condiciones}.",
  enlaceCondiciones: "terms of service",
  documentos: {
    privacidad: {
      titulo: "Privacy policy",
      resumen: "What data we process, why, who we share it with and how you exercise your rights.",
      secciones: [
        {
          titulo: "Who is responsible",
          parrafos: ["The data controller is {titular}, tax ID {nif}, with address at {domicilio}. For any privacy matter, write to {correo}."],
        },
        {
          titulo: "What data we process",
          parrafos: [
            "The answers on your path stay on your device until you decide to send them.",
            "If you ask us to review your case: name, phone, email, language, the calculated route and your answers. Name, phone and email are stored encrypted.",
            "If you sign in with Google: your verified email and your name. We do not store your Google credentials or tokens.",
            "If you pay: the amount, status and reference of the payment. Your card details are handled by Stripe; we never see them.",
            "If you talk to HESTIA: your messages and the context of your path, without name, phone or email. On WhatsApp, also your number.",
          ],
        },
        {
          titulo: "Why, and on what legal basis",
          parrafos: [
            "Studying your case and contacting you: your consent and the pre-contractual steps you ask for (Art. 6(1)(a) and 6(1)(b) GDPR).",
            "Providing and charging for the service you hire: performance of the contract (Art. 6(1)(b)).",
            "Meeting accounting, tax and professional obligations: the law (Art. 6(1)(c)).",
            "Protecting the service against abuse, with request limits and an audit log: our legitimate interest (Art. 6(1)(f)).",
            "Sending you news, only if you tick that box: your consent, which you can withdraw at any time.",
            "If you tell us specially protected data, such as health or international protection data, we use it only to handle your case and with your explicit consent (Art. 9(2)(a)).",
          ],
        },
        {
          titulo: "Artificial intelligence and automated decisions",
          parrafos: [
            "HESTIA is an artificial intelligence and tells you so at the start. The engines calculate guidance (route, appointments, documents and deadlines) from your answers.",
            "No decision that affects you is taken solely by automated means: a registered lawyer reviews your route before charging you anything, and you can ask to talk to a person at any time.",
          ],
        },
        {
          titulo: "Who we share your data with",
          parrafos: [
            "With providers that process it on our behalf and under contract: Vercel (website hosting), our private server in the United Kingdom (database and HESTIA orchestration), Stripe (payments), Google (sign-in), OpenAI (HESTIA's language model) and, if you use WhatsApp, Meta.",
            "Some are outside the European Economic Area. The transfer relies on a European Commission adequacy decision (the United Kingdom, or the EU-US Data Privacy Framework if the provider has joined it) or on standard contractual clauses.",
            "We do not sell your data or share it for advertising. We only disclose it to the authorities when we file a procedure on your behalf or when a law requires it.",
          ],
        },
        {
          titulo: "How long we keep it",
          parrafos: [
            "If you ask for a review and do not hire us: up to 12 months from the last contact, or less if you ask us to delete it.",
            "If you hire us: for as long as the service lasts and, afterwards, for the periods set by law, for example six years for accounting records.",
            "The memory of your conversations with HESTIA is kept to give the conversation continuity and is deleted when you ask.",
          ],
        },
        {
          titulo: "Your rights",
          parrafos: [
            "You can access your data, correct it, delete it, object to or restrict its use, ask for portability and withdraw your consent at any time. Write to {correo} with your path reference if you have one.",
            "If you believe we have not handled your request properly, you can complain to the Spanish Data Protection Agency (aepd.es).",
          ],
        },
        {
          titulo: "Security and cookies",
          parrafos: [
            "We encrypt name, phone and email with AES-256-GCM, and we find your file through a fingerprint of your email, never the email in plain text. Sessions are signed.",
            "We only use technical cookies, needed to sign in and to pay securely. We use no analytics or advertising cookies. Your progress on the path is kept in this browser tab and disappears when you close it.",
          ],
        },
      ],
    },
    condiciones: {
      titulo: "Terms of service",
      resumen: "How BUROFAST works, what you pay, when, and how to complain.",
      secciones: [
        {
          titulo: "Who provides the service",
          parrafos: ["BUROFAST is a service of {titular} (tax ID {nif}). Legal advice is given and signed by a registered lawyer: {abogado}, of the {colegio}, bar number {colegiado}."],
        },
        {
          titulo: "What we do and what we don't",
          parrafos: [
            "We guide you, prepare and file your immigration procedures, and accompany you until you reach your goal.",
            "We are not the authorities: the decision on your procedure is theirs, and we cannot guarantee the outcome or the timing.",
            "Official appointments are free. We charge for managing them, never for the appointment, and we never use automated programs to get them.",
            "International protection (asylum) is always handled by a person, free of charge.",
          ],
        },
        {
          titulo: "Price",
          parrafos: [
            "Prices on the website include VAT. Government fees, translations and legalisations are paid separately, and we tell you beforehand.",
            "The final price is the one in the quote the lawyer confirms after reviewing your route.",
          ],
        },
        {
          titulo: "How to hire and pay",
          parrafos: [
            "1. You go through your path and ask us to review your case. You pay nothing.",
            "2. A lawyer reviews your route and confirms or corrects it.",
            "3. We send you the payment link for the deposit, 50% of the quote. The rest is paid when the procedure is filed.",
            "Payments are made with Stripe. The contract starts when you pay the deposit.",
          ],
        },
        {
          titulo: "Appointment management",
          parrafos: [
            "You can choose between “I can wait” and “Urgent”. “Urgent” speeds up the team's work, not the official queue.",
            "Urgent guarantee: if we do not get the appointment within 30 days, we refund the difference with “I can wait”. For appointments that only exist after the decision (fingerprints, card collection and oath), the period starts when the decision arrives.",
          ],
        },
        {
          titulo: "Right of withdrawal",
          parrafos: [
            "You have 14 calendar days from hiring us to withdraw without giving reasons: write to {correo} with your reference.",
            "If you ask us to start working within that period and then withdraw, you only pay for the part of the service already provided. If the service has been fully provided with your express agreement, you can no longer withdraw.",
            "We refund you within 14 days at most, using the same payment method.",
          ],
        },
        {
          titulo: "Your part",
          parrafos: ["You give us true and complete information and hand in the documents we ask for on time. If information is false or late, the procedure may be delayed or refused."],
        },
        {
          titulo: "Complaints and governing law",
          parrafos: [
            "If something goes wrong, write to {correo}: we reply within 30 days at most. You can also contact the consumer services of your region.",
            "Spanish law applies. If you are a consumer, you can bring a claim before the courts of your place of residence.",
          ],
        },
      ],
    },
    "aviso-legal": {
      titulo: "Legal notice",
      resumen: "Who is behind BUROFAST and the rules for using this website.",
      secciones: [
        {
          titulo: "Owner",
          parrafos: ["Owner: {titular}. Tax ID: {nif}. Address: {domicilio}. Email: {correo}. Registration details: {registro}."],
        },
        {
          titulo: "Regulated profession",
          parrafos: ["Legal services are provided by a registered lawyer: {abogado}, of the {colegio}, bar number {colegiado}. Professional title: lawyer (abogado), issued in Spain. Professional rules: General Statute of the Spanish Legal Profession and Code of Ethics, published at abogacia.es."],
        },
        {
          titulo: "Use of the website",
          parrafos: [
            "You can use BUROFAST to get guidance and hire our services. Automating access, trying to bypass its limits or using it for unlawful purposes is not allowed.",
            "The information on the website is for guidance and does not replace the lawyer's advice on your case.",
          ],
        },
        {
          titulo: "Artificial intelligence",
          parrafos: ["HESTIA and the agents ARIADNA, CRONOS, MNEMOSYNE, ARGOS and THEMIS are automated systems. HESTIA is a conversational artificial intelligence and identifies itself as such. Important decisions are always reviewed by a person."],
        },
        {
          titulo: "Intellectual property",
          parrafos: ["The BUROFAST brand, texts, design and code belong to {titular} or are used under licence. You may not reproduce them for commercial purposes without permission."],
        },
        {
          titulo: "Links",
          parrafos: ["Links to government or third-party websites are for information only; we do not control their content."],
        },
      ],
    },
  },
};
