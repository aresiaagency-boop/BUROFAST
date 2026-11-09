import type { TextosLegales } from "@/lib/i18n/legal/tipos";

export const pt: TextosLegales = {
  menu: "Legal",
  nombres: { privacidad: "Privacidade", condiciones: "Condições", "aviso-legal": "Aviso legal" },
  pendiente: "pendente",
  traduccion: "Tradução informativa. Em caso de dúvida, prevalece a versão em espanhol.",
  actualizado: "Última atualização",
  leerPrivacidad: "Ler a política de privacidade",
  aceptarPago: "Ao pagar aceitas as {condiciones}.",
  enlaceCondiciones: "condições do serviço",
  documentos: {
    privacidad: {
      titulo: "Política de privacidade",
      resumen: "Que dados tratamos, para quê, com quem os partilhamos e como exerces os teus direitos.",
      secciones: [
        {
          titulo: "Quem é o responsável",
          parrafos: ["O responsável pelo tratamento é {titular}, com NIF {nif} e domicílio em {domicilio}. Para qualquer assunto de privacidade, escreve-nos para {correo}."],
        },
        {
          titulo: "Que dados tratamos",
          parrafos: [
            "As respostas do teu percurso ficam no teu dispositivo até decidires enviá-las.",
            "Se nos pedires para analisar o teu caso: nome, telefone, e-mail, idioma, a rota calculada e as tuas respostas. O nome, o telefone e o e-mail são guardados cifrados.",
            "Se entrares com o Google: o teu e-mail verificado e o teu nome. Não guardamos as tuas credenciais nem os tokens do Google.",
            "Se pagares: o montante, o estado e a referência do pagamento. Os dados do teu cartão são tratados pela Stripe; nós não os vemos.",
            "Se falares com a HESTIA: as tuas mensagens e o contexto do teu percurso, sem nome, telefone nem e-mail. No WhatsApp, também o teu número.",
          ],
        },
        {
          titulo: "Para quê e com que base legal",
          parrafos: [
            "Analisar o teu caso e contactar-te: o teu consentimento e as diligências pré-contratuais que nos pedes (art. 6.º, n.º 1, alíneas a) e b), do RGPD).",
            "Prestar e cobrar o serviço que contratas: a execução do contrato (art. 6.º, n.º 1, alínea b)).",
            "Cumprir obrigações contabilísticas, fiscais e profissionais: a lei (art. 6.º, n.º 1, alínea c)).",
            "Proteger o serviço contra abusos, com limites de pedidos e registo de auditoria: o nosso interesse legítimo (art. 6.º, n.º 1, alínea f)).",
            "Enviar-te novidades, só se marcares essa opção: o teu consentimento, que podes retirar quando quiseres.",
            "Se nos contares dados especialmente protegidos, como dados de saúde ou de proteção internacional, usamo-los só para tratar o teu caso e com o teu consentimento explícito (art. 9.º, n.º 2, alínea a)).",
          ],
        },
        {
          titulo: "Inteligência artificial e decisões automatizadas",
          parrafos: [
            "A HESTIA é uma inteligência artificial e di-lo logo no início. Os motores calculam uma orientação (rota, marcações, documentos e prazos) a partir das tuas respostas.",
            "Nenhuma decisão que te afete é tomada só de forma automática: um advogado inscrito na Ordem revê a tua rota antes de te cobrar o que quer que seja, e podes pedir para falar com uma pessoa a qualquer momento.",
          ],
        },
        {
          titulo: "Com quem partilhamos os teus dados",
          parrafos: [
            "Com fornecedores que os tratam por nossa conta e sob contrato: Vercel (alojamento do site), o nosso servidor privado no Reino Unido (base de dados e orquestração da HESTIA), Stripe (pagamentos), Google (início de sessão), OpenAI (modelo de linguagem da HESTIA) e, se usares o WhatsApp, Meta.",
            "Alguns estão fora do Espaço Económico Europeu. A transferência baseia-se numa decisão de adequação da Comissão Europeia (Reino Unido, ou o Quadro de Privacidade de Dados UE-EUA se o fornecedor aderiu) ou em cláusulas contratuais-tipo.",
            "Não vendemos os teus dados nem os cedemos para publicidade. Só os comunicamos à Administração quando apresentamos um processo a teu pedido ou quando a lei o exige.",
          ],
        },
        {
          titulo: "Durante quanto tempo os guardamos",
          parrafos: [
            "Se pedires uma análise e não contratares: até 12 meses desde o último contacto, ou menos se nos pedires para os apagar.",
            "Se contratares: enquanto durar o serviço e, depois, durante os prazos fixados pela lei, por exemplo seis anos para a documentação contabilística.",
            "A memória das conversas com a HESTIA é guardada para dar continuidade à conversa e apagada quando o pedires.",
          ],
        },
        {
          titulo: "Os teus direitos",
          parrafos: [
            "Podes aceder aos teus dados, corrigi-los, apagá-los, opor-te ao seu uso ou limitá-lo, pedir a sua portabilidade e retirar o teu consentimento quando quiseres. Escreve-nos para {correo} com a referência do teu percurso, se a tiveres.",
            "Se achares que não tratámos bem o teu pedido, podes reclamar junto da Agência Espanhola de Proteção de Dados (aepd.es).",
          ],
        },
        {
          titulo: "Segurança e cookies",
          parrafos: [
            "Ciframos o nome, o telefone e o e-mail com AES-256-GCM, e encontramos o teu processo através de uma impressão digital do e-mail, nunca pelo e-mail em claro. As sessões são assinadas.",
            "Só usamos cookies técnicos, necessários para iniciar sessão e pagar com segurança. Não usamos cookies de análise nem de publicidade. O teu progresso no percurso fica guardado neste separador do navegador e desaparece quando o fechas.",
          ],
        },
      ],
    },
    condiciones: {
      titulo: "Condições do serviço",
      resumen: "Como funciona a BUROFAST, o que pagas, quando e como reclamar.",
      secciones: [
        {
          titulo: "Quem presta o serviço",
          parrafos: ["A BUROFAST é um serviço de {titular} (NIF {nif}). O aconselhamento jurídico é prestado e assinado por um advogado inscrito: {abogado}, do {colegio}, com o número de inscrição {colegiado}."],
        },
        {
          titulo: "O que fazemos e o que não fazemos",
          parrafos: [
            "Orientamos-te, preparamos e apresentamos os teus processos de imigração, e acompanhamos-te até à tua meta.",
            "Não somos a Administração: a decisão sobre o teu processo é dela, e não podemos garantir nem o resultado nem os prazos.",
            "As marcações oficiais são gratuitas. Cobramos a gestão, nunca a marcação, e nunca usamos programas automáticos para as conseguir.",
            "A proteção internacional (asilo) é sempre tratada por uma pessoa, sem custos.",
          ],
        },
        {
          titulo: "Preço",
          parrafos: [
            "Os preços do site incluem IVA. As taxas da Administração, as traduções e as legalizações pagam-se à parte, e dizemos-te antes.",
            "O preço final é o do orçamento que o advogado confirma depois de rever a tua rota.",
          ],
        },
        {
          titulo: "Como se contrata e se paga",
          parrafos: [
            "1. Fazes o teu percurso e pedes-nos para analisar o teu caso. Não pagas nada.",
            "2. Um advogado revê a tua rota e confirma-a ou corrige-a.",
            "3. Enviamos-te a ligação de pagamento do adiantamento, 50 % do orçamento. O resto paga-se quando o processo é apresentado.",
            "Os pagamentos fazem-se com a Stripe. O contrato começa quando pagas o adiantamento.",
          ],
        },
        {
          titulo: "Gestão de marcações",
          parrafos: [
            "Podes escolher entre «Posso esperar» e «Urgente». «Urgente» acelera o trabalho da equipa, não a fila oficial.",
            "Garantia Urgente: se em 30 dias não conseguirmos a marcação, devolvemos-te a diferença para «Posso esperar». Nas marcações que só existem depois da decisão (impressões digitais, levantamento do cartão e juramento), o prazo começa quando chega a decisão.",
          ],
        },
        {
          titulo: "Direito de livre resolução",
          parrafos: [
            "Tens 14 dias seguidos desde que contratas para desistir sem dar explicações: escreve-nos para {correo} com a tua referência.",
            "Se nos pedires para começar a trabalhar dentro desse prazo e depois desistires, pagas só a parte do serviço já prestada. Se o serviço tiver sido prestado por completo com o teu acordo expresso, já não podes desistir.",
            "Devolvemos-te o dinheiro em 14 dias, no máximo, pelo mesmo meio de pagamento.",
          ],
        },
        {
          titulo: "A tua parte",
          parrafos: ["Dás-nos dados verdadeiros e completos e entregas a tempo os documentos que te pedimos. Se um dado for falso ou chegar tarde, o processo pode atrasar-se ou ser indeferido."],
        },
        {
          titulo: "Reclamações e lei aplicável",
          parrafos: [
            "Se algo correr mal, escreve-nos para {correo}: respondemos em 30 dias, no máximo. Também podes recorrer aos serviços de consumo da tua comunidade autónoma.",
            "Aplica-se a lei espanhola. Se fores consumidor, podes reclamar nos tribunais do teu domicílio.",
          ],
        },
      ],
    },
    "aviso-legal": {
      titulo: "Aviso legal",
      resumen: "Quem está por trás da BUROFAST e as regras de utilização deste site.",
      secciones: [
        {
          titulo: "Titular",
          parrafos: ["Titular: {titular}. NIF: {nif}. Domicílio: {domicilio}. E-mail: {correo}. Dados de registo: {registro}."],
        },
        {
          titulo: "Profissão regulamentada",
          parrafos: ["Os serviços jurídicos são prestados por um advogado inscrito: {abogado}, do {colegio}, com o número de inscrição {colegiado}. Título profissional: advogado (abogado), emitido em Espanha. Normas profissionais: Estatuto Geral da Advocacia Espanhola e Código Deontológico, publicados em abogacia.es."],
        },
        {
          titulo: "Utilização do site",
          parrafos: [
            "Podes usar a BUROFAST para te orientares e contratares os nossos serviços. Não é permitido automatizar o acesso, tentar contornar os seus limites nem usá-la para fins ilícitos.",
            "A informação do site é orientativa e não substitui o aconselhamento do advogado sobre o teu caso.",
          ],
        },
        {
          titulo: "Inteligência artificial",
          parrafos: ["A HESTIA e os agentes ARIADNE, CRONOS, MNEMÓSINE, ARGOS e TÉMIS são sistemas automáticos. A HESTIA é uma inteligência artificial conversacional e identifica-se como tal. As decisões importantes são sempre revistas por uma pessoa."],
        },
        {
          titulo: "Propriedade intelectual",
          parrafos: ["A marca BUROFAST, os textos, o design e o código pertencem a {titular} ou são usados sob licença. Não podes reproduzi-los para fins comerciais sem autorização."],
        },
        {
          titulo: "Ligações",
          parrafos: ["As ligações para sites da Administração ou de terceiros são informativas; não controlamos o seu conteúdo."],
        },
      ],
    },
  },
};
