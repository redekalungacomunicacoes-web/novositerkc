import { Link } from "react-router-dom";

const sections = [
  {
    title: "1. Quem somos",
    content: (
      <p>
        A Rede Kalunga Comunicações (RKC) é uma iniciativa de comunicação e jornalismo
        independente dedicada à produção e à divulgação de notícias, reportagens, conteúdos
        culturais e informações sobre o Território Kalunga e a Chapada dos Veadeiros.
        Esta Política explica como tratamos dados pessoais quando você acessa nosso site,
        entra em contato ou se inscreve em nossas comunicações.
      </p>
    ),
  },
  {
    title: "2. Quais dados podemos tratar",
    content: (
      <>
        <p>Dependendo de como você utiliza o site, podemos tratar:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Formulário de contato:</strong> nome, endereço de e-mail, assunto e conteúdo da mensagem.</li>
          <li><strong>Newsletter:</strong> nome e endereço de e-mail, além do registro da inscrição e da manifestação de consentimento.</li>
          <li><strong>Navegação:</strong> páginas acessadas, informações técnicas do navegador e dispositivo, identificadores on-line e dados de uso, conforme as ferramentas de medição habilitadas no site.</li>
          <li><strong>Comunicação com a equipe:</strong> informações que você decidir fornecer voluntariamente ao enviar uma mensagem ou solicitação.</li>
        </ul>
        <p>Não solicitamos que você envie dados pessoais sensíveis pelos formulários públicos. Evite incluir esse tipo de informação nas mensagens.</p>
      </>
    ),
  },
  {
    title: "3. Para que utilizamos os dados",
    content: (
      <ul className="list-disc space-y-2 pl-6">
        <li>Responder mensagens, dúvidas, sugestões de pauta e propostas de parceria.</li>
        <li>Gerenciar inscrições e enviar a newsletter quando houver consentimento.</li>
        <li>Operar, proteger, manter e aprimorar o site e seus recursos.</li>
        <li>Compreender, de forma agregada ou individualizada conforme a ferramenta, como o público utiliza o site e avaliar seu desempenho.</li>
        <li>Prevenir fraudes, abusos, acessos indevidos e incidentes de segurança.</li>
        <li>Cumprir obrigações legais e exercer direitos em procedimentos administrativos ou judiciais, quando necessário.</li>
      </ul>
    ),
  },
  {
    title: "4. Google Drive e serviços do Google",
    content: (
      <>
        <p>
          O site utiliza uma integração técnica com a API do Google Drive para localizar e
          disponibilizar arquivos de mídia utilizados pela RKC, como imagens e outros
          materiais editoriais. Essa integração é operada no servidor e utiliza credenciais
          mantidas em ambiente protegido, não sendo necessário que visitantes forneçam
          acesso à própria conta Google para visualizar as matérias.
        </p>
        <p>
          Os dados obtidos do Google Drive são utilizados para a finalidade de operar e
          exibir os arquivos de mídia associados ao site. A RKC não utiliza esses dados
          para publicidade, não os comercializa e não os utiliza para finalidades
          incompatíveis com essa operação. O tratamento também observa a
          <a className="text-green-700 underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer"> Política de Dados do Usuário dos Serviços de API do Google</a>,
          incluindo os requisitos de uso limitado aplicáveis.
        </p>
      </>
    ),
  },
  {
    title: "5. Armazenamento e fornecedores de tecnologia",
    content: (
      <p>
        Para manter o site e suas funcionalidades, a RKC utiliza fornecedores de
        infraestrutura e tecnologia, incluindo Supabase para recursos de banco de dados,
        autenticação e processamento de funcionalidades do site, Google para serviços
        relacionados ao Drive e, quando habilitado, Google Analytics para medição de
        audiência. Esses fornecedores podem tratar dados em nome da RKC ou de acordo com
        suas próprias políticas e obrigações. Adotamos configurações e medidas de acesso
        destinadas a limitar o tratamento ao necessário para cada finalidade.
      </p>
    ),
  },
  {
    title: "6. Cookies, armazenamento local e análise de audiência",
    content: (
      <p>
        O site pode utilizar cookies, armazenamento local do navegador e tecnologias
        semelhantes para manter sessões, permitir funcionalidades e melhorar a
        experiência de navegação. Quando a ferramenta de análise de audiência estiver
        habilitada, o Google Analytics poderá utilizar identificadores e tecnologias
        semelhantes para produzir estatísticas de utilização. Você pode gerenciar
        cookies nas configurações do navegador; a desativação de alguns recursos pode
        afetar o funcionamento de determinadas funcionalidades.
      </p>
    ),
  },
  {
    title: "7. Compartilhamento de dados",
    content: (
      <p>
        A RKC não comercializa dados pessoais. O compartilhamento pode ocorrer com
        fornecedores que viabilizam hospedagem, armazenamento, segurança, comunicação e
        análise do site, limitado ao necessário para a prestação desses serviços; quando
        exigido por lei, ordem válida de autoridade competente ou para proteção de
        direitos; ou mediante sua solicitação ou autorização. Não autorizamos fornecedores
        a utilizar os dados tratados em nosso nome para finalidades próprias incompatíveis
        com os serviços contratados.
      </p>
    ),
  },
  {
    title: "8. Prazo de armazenamento e segurança",
    content: (
      <p>
        Mantemos os dados pelo período necessário às finalidades descritas nesta Política,
        considerando a natureza da informação, a relação com o titular, necessidades
        operacionais e obrigações legais. Depois desse período, os dados poderão ser
        eliminados ou anonimizados, ressalvadas as hipóteses legais de conservação.
        Utilizamos medidas técnicas e administrativas razoáveis para proteger as
        informações contra acessos não autorizados, perda, alteração ou divulgação
        indevida. Nenhum sistema é completamente livre de riscos.
      </p>
    ),
  },
  {
    title: "9. Seus direitos",
    content: (
      <>
        <p>
          Nos termos da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018),
          você pode solicitar, conforme aplicável, confirmação da existência de
          tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados
          desnecessários ou tratados em desconformidade, portabilidade, informações sobre
          compartilhamento, revogação do consentimento e demais direitos previstos em lei.
        </p>
        <p>
          Para cancelar a newsletter, utilize o mecanismo de cancelamento disponibilizado
          na própria comunicação, quando presente, ou entre em contato pelo endereço
          indicado nesta Política. A revogação do consentimento não torna ilícitos os
          tratamentos realizados anteriormente com base nele.
        </p>
      </>
    ),
  },
  {
    title: "10. Links para outros sites",
    content: (
      <p>
        As matérias e páginas da RKC podem conter links para sites, redes sociais,
        vídeos ou serviços de terceiros. Ao acessar esses ambientes, o tratamento de
        dados passa a seguir também as políticas e condições dos respectivos
        fornecedores. Recomendamos que você consulte essas informações antes de
        compartilhar dados nesses serviços.
      </p>
    ),
  },
  {
    title: "11. Atualizações desta Política",
    content: (
      <p>
        Esta Política poderá ser atualizada para refletir mudanças no site, nas
        integrações utilizadas ou nas exigências legais. A versão vigente ficará
        disponível nesta página, com a data da última atualização.
      </p>
    ),
  },
  {
    title: "12. Contato sobre privacidade",
    content: (
      <p>
        Para exercer seus direitos ou esclarecer dúvidas sobre esta Política e o
        tratamento de dados pessoais pela Rede Kalunga Comunicações, escreva para
        <a className="text-green-700 underline" href="mailto:redekalungacomunicacoes@gmail.com"> redekalungacomunicacoes@gmail.com</a>.
      </p>
    ),
  },
];

export function PoliticaPrivacidade() {
  return (
    <main className="bg-white">
      <section className="bg-gradient-to-br from-[#0F7A3E] to-[#2FA866] px-4 py-16 text-white md:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-white/80">
            Rede Kalunga Comunicações
          </p>
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">
            Política de Privacidade
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/90 md:text-lg">
            Transparência sobre como tratamos informações pessoais durante sua
            navegação e interação com nosso site.
          </p>
          <p className="mt-6 text-sm text-white/80">
            Última atualização: 22 de novembro de 2026
          </p>
        </div>
      </section>

      <section className="px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 rounded-xl border border-green-100 bg-green-50 p-5 text-sm leading-relaxed text-slate-700">
            Esta Política foi elaborada para o site da Rede Kalunga Comunicações.
            Leia o conteúdo com atenção. Ao utilizar o site, você poderá ter seus dados
            tratados conforme as finalidades e condições descritas abaixo e a legislação
            aplicável.
          </div>

          <div className="space-y-9 text-[15px] leading-7 text-slate-700">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="mb-3 text-xl font-semibold text-slate-900">
                  {section.title}
                </h2>
                <div className="space-y-3">{section.content}</div>
              </section>
            ))}
          </div>

          <div className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-600">
            <Link to="/" className="font-medium text-green-700 hover:text-green-800">
              Voltar à página inicial
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
