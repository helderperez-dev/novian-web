import type { Metadata } from "next";
import LegalPageShell from "../LegalPageShell";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos de Uso do portal da Novian.",
};

const sections = [
  {
    title: "1. Aceitação",
    content: [
      "Ao acessar e utilizar o portal da Novian, você concorda com estes Termos de Uso. Caso não concorde com qualquer condição aqui prevista, recomendamos que não utilize o site e seus canais digitais vinculados.",
    ],
  },
  {
    title: "2. Natureza da Novian",
    content: [
      "A Novian é uma Proptech e opera um portal digital voltado à apresentação de imóveis, experiência do usuário, geração de relacionamento e conexão comercial.",
      "A Novian não se apresenta como uma imobiliária tradicional. Quando houver atividade de corretagem, intermediação técnica ou atendimento profissional relacionado ao imóvel, a responsável é Bárbara Camargo - CRECI 301258-F.",
    ],
  },
  {
    title: "3. Finalidade do portal",
    content: [
      "O portal tem como finalidade apresentar oportunidades, conteúdos institucionais, canais de contato, agendamentos e recursos tecnológicos relacionados à jornada imobiliária.",
      "As informações disponibilizadas podem ser atualizadas, alteradas ou removidas a qualquer momento, sem obrigação de disponibilidade permanente de qualquer imóvel, condição comercial ou funcionalidade.",
    ],
  },
  {
    title: "4. Uso adequado",
    content: [
      "Você se compromete a utilizar o portal de forma lícita, ética e compatível com estes termos, sem praticar qualquer ato que possa comprometer a segurança, integridade, disponibilidade ou reputação da Novian e de seus usuários.",
      "Não é permitido copiar, reproduzir, raspar dados, automatizar acessos indevidos, contornar mecanismos técnicos ou utilizar o conteúdo do portal para finalidades ilícitas ou concorrenciais sem autorização.",
    ],
  },
  {
    title: "5. Conteúdo e informações de imóveis",
    content: [
      "A Novian busca manter as informações do portal organizadas e atualizadas, mas não garante que descrições, preços, disponibilidade, imagens, metragem ou demais atributos permaneçam inalterados.",
      "Decisões relacionadas à contratação, visita, negociação, proposta, documentação ou fechamento devem sempre considerar validações específicas no momento do atendimento.",
    ],
  },
  {
    title: "6. Propriedade intelectual",
    content: [
      "Textos, elementos visuais, identidade da marca, estrutura do portal, imagens, componentes e demais materiais vinculados à Novian são protegidos por direitos de propriedade intelectual e não podem ser utilizados sem autorização.",
    ],
  },
  {
    title: "7. Limitação de responsabilidade",
    content: [
      "A Novian não se responsabiliza por indisponibilidades temporárias, falhas de terceiros, interrupções técnicas, decisões tomadas exclusivamente com base no conteúdo do portal ou uso indevido por parte do usuário.",
      "O uso do portal não cria automaticamente relação de corretagem, exclusividade, representação imobiliária ou garantia de fechamento de negócio.",
    ],
  },
  {
    title: "8. Contato e responsabilidade profissional",
    content: [
      "Para informações sobre o portal, privacidade, atendimento e solicitações relacionadas ao uso do site, utilize os canais oficiais da Novian.",
      "A corretora responsável é Bárbara Camargo - CRECI 301258-F. Esta identificação é parte essencial da comunicação institucional da Novian.",
    ],
  },
];

export default function TermosDeUsoPage() {
  return (
    <LegalPageShell
      eyebrow="Documento legal"
      title="Termos de Uso"
      description="Condições de uso do portal da Novian, com esclarecimentos sobre a natureza da empresa, do atendimento e da atuação profissional responsável."
    >
      <section className="rounded-[24px] border border-novian-accent/14 bg-white/82 p-6 sm:p-7">
        <p className="text-sm leading-7 text-novian-text/68">
          Estes termos regulam o uso institucional e informacional do portal da Novian. O objetivo é oferecer
          clareza sobre o funcionamento da plataforma, seus limites e a responsabilidade profissional envolvida.
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
