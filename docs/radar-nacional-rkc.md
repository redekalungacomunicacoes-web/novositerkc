# Radar Nacional de Oportunidades — RKC

Escopo exclusivo da Rede Kalunga Comunicações. Não incorporar marcas, painéis ou integrações de outras organizações.

## Fontes e cobertura
- PNCP e Compras.gov.br: licitações e contratos públicos.
- Ministério da Cultura, PNAB, Cultura Viva, Secult Goiás e portais oficiais: editais, prêmios e fomento.
- Petrobras/Petronect e outras fontes oficiais: conectores específicos após validação.
- Cobertura nacional, priorizando Goiás e territórios Kalunga.

## Temas
Cultura, patrimônio, comunicação comunitária, audiovisual, documentários, povos e territórios tradicionais, educação, direitos humanos, design, tecnologia, marketing, assessoria de comunicação, editoração e serviços audiovisuais.

## Requisitos
1. Preservar as tabelas captacao_radar_fontes, captacao_radar_oportunidades e captacao_radar_sincronizacoes e dados existentes.
2. Identificar o workflow atual antes de modificar agendamentos. Objetivo: 06h15, dias úteis, America/Sao_Paulo.
3. Consultar fontes oficiais com paginação, limites, retentativas e logs por fonte.
4. Deduplicar por identificador oficial estável e fonte; não fundir automaticamente por semelhança textual.
5. Versionar retificações, prorrogações e cancelamentos sem sobrescrever evidências anteriores.
6. Classificar em Fomento e Premiações ou Licitações e Contratos, com filtros compactos.
7. Tratar elegibilidade como verificada, pendente ou impeditiva, com fonte e evidência; nunca presumir aptidão.
8. Não publicar, inscrever, enviar mensagens ou alterar credenciais automaticamente.
9. Testar idempotência, falhas parciais, permissões RLS, logs e regressões antes de merge.

## Implantação
Auditar coletor e workflow existentes; criar migrações aditivas e adaptadores em branch; homologar; solicitar autorização antes de merge e publicação.
