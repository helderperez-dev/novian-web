import type { Metadata } from "next";
import LegalPageShell from "../LegalPageShell";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Política de Privacidade da Novian.",
};

const sections = [
  {
    title: "1. Quem somos",
    content: [
      "A Novian atua como uma Proptech e opera um portal digital para apresentação de imóveis, geração de relacionamento e conexão entre interessados e atendimento especializado.",
      "A Novian não se apresenta como uma imobiliária tradicional. A corretora responsável pelas atividades de corretagem e atendimento profissional é Bárbara Camargo - CRECI 301258-F.",
    ],
  },
  {
    title: "2. Dados que podemos coletar",
    content: [
      "Podemos coletar dados informados diretamente por você, como nome, telefone, e-mail e mensagens enviadas por formulários, WhatsApp, agenda de atendimento ou outros canais de contato.",
      "Também podemos coletar dados técnicos e de navegação, como páginas acessadas, cliques, origem de tráfego, dispositivo, navegador e identificadores de sessão, com a finalidade de melhorar a experiência e medir a performance do portal.",
    ],
  },
  {
    title: "3. Como usamos essas informações",
    content: [
      "Os dados podem ser utilizados para responder contatos, apresentar imóveis compatíveis com o seu interesse, organizar agendamentos, aprimorar o portal, analisar métricas e cumprir obrigações legais ou regulatórias.",
      "Também poderemos usar essas informações para personalizar a comunicação da Novian, sempre dentro de finalidades legítimas e relacionadas ao relacionamento iniciado por você.",
    ],
  },
  {
    title: "4. Compartilhamento de dados",
    content: [
      "A Novian pode compartilhar dados com fornecedores e ferramentas essenciais para operação do portal, automações, agenda, analytics, atendimento e hospedagem, sempre dentro do necessário para a prestação dos serviços digitais.",
      "Quando houver atividade de corretagem, atendimento comercial ou condução técnica da negociação, a responsável é Bárbara Camargo - CRECI 301258-F.",
    ],
  },
  {
    title: "5. Base legal e retenção",
    content: [
      "Tratamos dados com base em hipóteses legais aplicáveis, como consentimento, legítimo interesse, execução de procedimentos preliminares relacionados ao seu atendimento e cumprimento de obrigações legais.",
      "Os dados serão mantidos pelo tempo necessário para atender às finalidades desta política, resguardar direitos da Novian e cumprir exigências legais ou regulatórias.",
    ],
  },
  {
    title: "6. Seus direitos",
    content: [
      "Você pode solicitar confirmação de tratamento, acesso, correção, atualização, anonimização, portabilidade, eliminação de dados quando aplicável e revisão de consentimentos, nos termos da legislação vigente.",
      "Para isso, entre em contato pelos canais oficiais da Novian. Sempre que necessário, poderemos solicitar informações adicionais para confirmar a sua identidade antes de atender à solicitação.",
    ],
  },
  {
    title: "7. Importante sobre a natureza da Novian",
    content: [
      "A Novian é uma empresa de tecnologia para o mercado imobiliário, com atuação como Proptech e portal digital.",
      "A Novian não deve ser interpretada, nesta apresentação institucional e digital, como uma imobiliária. A corretora responsável é Bárbara Camargo - CRECI 301258-F.",
    ],
  },
];

export default function PoliticaDePrivacidadePage() {
  return (
    <LegalPageShell
      eyebrow="Documento legal"
      title="Política de Privacidade"
      description="Transparência sobre como a Novian trata dados pessoais, opera seu portal digital e organiza o atendimento aos usuários."
    >
      <section className="rounded-[24px] border border-novian-accent/14 bg-white/82 p-6 sm:p-7">
        <p className="text-sm leading-7 text-novian-text/68">
          Esta política se aplica ao portal da Novian e aos canais digitais vinculados à marca. Ao utilizar o
          site, entrar em contato ou agendar atendimento, você declara ciência desta política.
        </p>
      </section>

      {sections.map((section) => (
        <section
          key={section.title}
          className="rounded-[24px] border border-novian-muted/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(249,245,237,0.9))] p-6 sm:p-7"
        >
          <h2 className="text-[1.3rem] font-medium tracking-[-0.03em] text-novian-text">{section.title}</h2>
          <div className="mt-4 space-y-4">
            {section.content.map((paragraph) => (
              <p key={paragraph} className="text-[15px] leading-7 text-novian-text/68 sm:text-base">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}
    </LegalPageShell>
  );
}
