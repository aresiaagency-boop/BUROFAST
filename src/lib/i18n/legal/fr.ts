import type { TextosLegales } from "@/lib/i18n/legal/tipos";

export const fr: TextosLegales = {
  menu: "Mentions",
  nombres: { privacidad: "Confidentialité", condiciones: "Conditions", "aviso-legal": "Mentions légales" },
  pendiente: "à compléter",
  traduccion: "Traduction informative. En cas de doute, la version espagnole prévaut.",
  actualizado: "Dernière mise à jour",
  leerPrivacidad: "Lire la politique de confidentialité",
  aceptarPago: "En payant, vous acceptez les {condiciones}.",
  enlaceCondiciones: "conditions du service",
  documentos: {
    privacidad: {
      titulo: "Politique de confidentialité",
      resumen: "Quelles données nous traitons, pourquoi, avec qui nous les partageons et comment exercer vos droits.",
      secciones: [
        {
          titulo: "Qui est responsable",
          parrafos: ["Le responsable du traitement est {titular}, NIF {nif}, domicilié à {domicilio}. Pour toute question de confidentialité, écrivez-nous à {correo}."],
        },
        {
          titulo: "Quelles données nous traitons",
          parrafos: [
            "Les réponses de votre parcours restent sur votre appareil jusqu’à ce que vous décidiez de les envoyer.",
            "Si vous nous demandez d’étudier votre cas : nom, téléphone, e-mail, langue, l’itinéraire calculé et vos réponses. Le nom, le téléphone et l’e-mail sont conservés chiffrés.",
            "Si vous vous connectez avec Google : votre e-mail vérifié et votre nom. Nous ne conservons ni vos identifiants ni les jetons de Google.",
            "Si vous payez : le montant, l’état et la référence du paiement. Les données de votre carte sont traitées par Stripe ; nous ne les voyons pas.",
            "Si vous parlez avec HESTIA : vos messages et le contexte de votre parcours, sans nom, téléphone ni e-mail. Sur WhatsApp, aussi votre numéro.",
          ],
        },
        {
          titulo: "Pourquoi, et sur quelle base légale",
          parrafos: [
            "Étudier votre cas et vous contacter : votre consentement et les mesures précontractuelles que vous demandez (art. 6.1.a et 6.1.b RGPD).",
            "Fournir et facturer le service que vous contractez : l’exécution du contrat (art. 6.1.b).",
            "Respecter nos obligations comptables, fiscales et professionnelles : la loi (art. 6.1.c).",
            "Protéger le service contre les abus, avec des limites de requêtes et un journal d’audit : notre intérêt légitime (art. 6.1.f).",
            "Vous envoyer des nouvelles, seulement si vous cochez cette case : votre consentement, que vous pouvez retirer à tout moment.",
            "Si vous nous confiez des données particulièrement protégées, comme des données de santé ou de protection internationale, nous les utilisons seulement pour gérer votre dossier et avec votre consentement explicite (art. 9.2.a).",
          ],
        },
        {
          titulo: "Intelligence artificielle et décisions automatisées",
          parrafos: [
            "HESTIA est une intelligence artificielle et vous le dit dès le début. Les moteurs calculent une orientation (itinéraire, rendez-vous, documents et délais) à partir de vos réponses.",
            "Aucune décision qui vous concerne n’est prise de façon uniquement automatique : un avocat inscrit au barreau vérifie votre itinéraire avant de vous facturer quoi que ce soit, et vous pouvez demander à parler à une personne à tout moment.",
          ],
        },
        {
          titulo: "Avec qui nous partageons vos données",
          parrafos: [
            "Avec des prestataires qui les traitent pour notre compte et sous contrat : Vercel (hébergement du site), notre serveur privé au Royaume-Uni (base de données et orchestration de HESTIA), Stripe (paiements), Google (connexion), OpenAI (modèle de langage de HESTIA) et, si vous utilisez WhatsApp, Meta.",
            "Certains se trouvent hors de l’Espace économique européen. Le transfert repose sur une décision d’adéquation de la Commission européenne (Royaume-Uni, ou le cadre de protection des données UE-États-Unis si le prestataire y adhère) ou sur des clauses contractuelles types.",
            "Nous ne vendons pas vos données et ne les cédons pas à des fins publicitaires. Nous les communiquons à l’Administration uniquement quand nous déposons une démarche pour vous ou quand une loi l’exige.",
          ],
        },
        {
          titulo: "Combien de temps nous les gardons",
          parrafos: [
            "Si vous demandez une étude sans contracter : nous les effaçons 12 mois après leur envoi, ou avant si vous le demandez.",
            "Si vous contractez : pendant toute la durée du service puis pendant les délais fixés par la loi, par exemple six ans pour les documents comptables.",
            "La mémoire de votre conversation avec HESTIA dans l’app est liée à un identifiant de cet onglet, pas à votre identité. Sur WhatsApp, elle est liée à votre numéro, et nous l’effaçons quand vous le demandez.",
          ],
        },
        {
          titulo: "Vos droits",
          parrafos: [
            "Vous pouvez accéder à vos données, les corriger, les effacer, vous opposer à leur usage ou le limiter, demander leur portabilité et retirer votre consentement à tout moment. Écrivez-nous à {correo} avec votre référence de parcours si vous en avez une.",
            "Si vous estimez que nous n’avons pas bien traité votre demande, vous pouvez saisir l’Agence espagnole de protection des données (aepd.es).",
          ],
        },
        {
          titulo: "Sécurité et cookies",
          parrafos: [
            "Nous chiffrons le nom, le téléphone et l’e-mail avec AES-256-GCM, et nous retrouvons votre dossier grâce à une empreinte de votre e-mail, jamais avec l’e-mail en clair. Les sessions sont signées.",
            "Nous n’utilisons que des cookies techniques, nécessaires pour vous connecter et payer en sécurité. Aucun cookie d’analyse ni de publicité. Votre progression dans le parcours est gardée dans cet onglet du navigateur et disparaît quand vous le fermez.",
          ],
        },
      ],
    },
    condiciones: {
      titulo: "Conditions du service",
      resumen: "Comment fonctionne BUROFAST, ce que vous payez, quand, et comment réclamer.",
      secciones: [
        {
          titulo: "Qui fournit le service",
          parrafos: ["BUROFAST est un service de {titular} (NIF {nif}). Le conseil juridique est donné et signé par un avocat inscrit : {abogado}, du {colegio}, numéro d’inscription {colegiado}."],
        },
        {
          titulo: "Ce que nous faisons et ce que nous ne faisons pas",
          parrafos: [
            "Nous vous orientons, préparons et déposons vos démarches d’immigration, et vous accompagnons jusqu’à votre objectif.",
            "Nous ne sommes pas l’Administration : la décision sur votre démarche lui appartient, et nous ne pouvons garantir ni le résultat ni les délais.",
            "Les rendez-vous officiels sont gratuits. Nous facturons la gestion, jamais le rendez-vous, et nous n’utilisons jamais de programmes automatiques pour les obtenir.",
            "La protection internationale (asile) est toujours prise en charge par une personne, gratuitement.",
          ],
        },
        {
          titulo: "Prix",
          parrafos: [
            "Les prix du site incluent la TVA. Les taxes de l’Administration, les traductions et les légalisations se paient à part, et nous vous le disons avant.",
            "Le prix final est celui du devis que l’avocat confirme après avoir vérifié votre itinéraire.",
          ],
        },
        {
          titulo: "Comment contracter et payer",
          parrafos: [
            "1. Vous faites votre parcours et vous nous demandez d’étudier votre cas. Vous ne payez rien.",
            "2. Un avocat vérifie votre itinéraire et le confirme ou le corrige.",
            "3. Nous vous envoyons le lien de paiement de l’acompte, 50 % du devis. Le reste se paie au dépôt de la démarche.",
            "Les paiements se font avec Stripe. Le contrat commence quand vous payez l’acompte.",
          ],
        },
        {
          titulo: "Gestion des rendez-vous",
          parrafos: [
            "Vous pouvez choisir entre « Je peux attendre » et « Urgent ». « Urgent » accélère le travail de l’équipe, pas la file officielle.",
            "Garantie Urgent : si nous n’obtenons pas le rendez-vous en 30 jours, nous vous remboursons la différence avec « Je peux attendre ». Pour les rendez-vous qui n’existent qu’après la décision (empreintes, retrait de la carte et serment), le délai commence à l’arrivée de la décision.",
          ],
        },
        {
          titulo: "Droit de rétractation",
          parrafos: [
            "Vous avez 14 jours calendaires après avoir contracté pour vous rétracter sans donner de raison : écrivez-nous à {correo} avec votre référence.",
            "Si vous nous demandez de commencer pendant ce délai puis vous rétractez, vous ne payez que la part du service déjà fournie. Si le service a été entièrement fourni avec votre accord exprès, vous ne pouvez plus vous rétracter.",
            "Nous vous remboursons dans un délai maximal de 14 jours, par le même moyen de paiement.",
          ],
        },
        {
          titulo: "Ce qui dépend de vous",
          parrafos: ["Vous nous donnez des informations vraies et complètes et vous remettez à temps les documents demandés. Si une information est fausse ou tardive, la démarche peut être retardée ou refusée."],
        },
        {
          titulo: "Réclamations et loi applicable",
          parrafos: [
            "Si quelque chose ne va pas, écrivez-nous à {correo} : nous répondons sous 30 jours maximum. Vous pouvez aussi vous adresser aux services de consommation de votre communauté autonome.",
            "La loi espagnole s’applique. Si vous êtes consommateur, vous pouvez saisir les tribunaux de votre domicile.",
          ],
        },
      ],
    },
    "aviso-legal": {
      titulo: "Mentions légales",
      resumen: "Qui est derrière BUROFAST et les règles d’utilisation de ce site.",
      secciones: [
        {
          titulo: "Titulaire",
          parrafos: ["Titulaire : {titular}. NIF : {nif}. Adresse : {domicilio}. E-mail : {correo}. Données d’immatriculation : {registro}."],
        },
        {
          titulo: "Profession réglementée",
          parrafos: ["Les services juridiques sont fournis par un avocat inscrit : {abogado}, du {colegio}, numéro d’inscription {colegiado}. Titre professionnel : avocat (abogado), délivré en Espagne. Règles professionnelles : Statut général de la profession d’avocat en Espagne et Code de déontologie, publiés sur abogacia.es."],
        },
        {
          titulo: "Utilisation du site",
          parrafos: [
            "Vous pouvez utiliser BUROFAST pour vous orienter et contracter nos services. Il est interdit d’automatiser l’accès, de tenter de contourner ses limites ou de l’utiliser à des fins illicites.",
            "Les informations du site sont indicatives et ne remplacent pas le conseil de l’avocat sur votre cas.",
          ],
        },
        {
          titulo: "Intelligence artificielle",
          parrafos: ["HESTIA et les agents ARIANE, CHRONOS, MNÉMOSYNE, ARGOS et THÉMIS sont des systèmes automatiques. HESTIA est une intelligence artificielle conversationnelle et se présente comme telle. Les décisions importantes sont toujours vérifiées par une personne."],
        },
        {
          titulo: "Propriété intellectuelle",
          parrafos: ["La marque BUROFAST, les textes, le design et le code appartiennent à {titular} ou sont utilisés sous licence. Vous ne pouvez pas les reproduire à des fins commerciales sans autorisation."],
        },
        {
          titulo: "Liens",
          parrafos: ["Les liens vers les sites de l’Administration ou de tiers sont informatifs ; nous ne contrôlons pas leur contenu."],
        },
      ],
    },
  },
};
