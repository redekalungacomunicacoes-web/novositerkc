# Arquitetura de pastas do Google Drive — RKC

## Regra obrigatória

Cada entidade criada pelo sistema possui uma pasta própria no módulo correspondente. O nome da pasta é humano; o vínculo técnico é sempre o ID imutável do Google Drive salvo no Supabase. Renomear uma entidade pode renomear a pasta, mas nunca deve quebrar os vínculos.

Uploads não podem procurar o destino apenas pelo nome a cada envio. O fluxo é: criar/obter pasta uma vez -> persistir drive_folder_id -> reutilizar o ID.

## Estrutura

RKC - SISTEMA DO SITE/
- 01_SITE/
  - MATERIAS/<nome da matéria>/{CAPA,BANNER,IMAGENS,GALERIA,AUDIO,DOCUMENTOS}
  - PROJETOS/<nome do projeto>/{CAPA,DOCUMENTOS,IMAGENS,OUTROS}
- 04_EQUIPE/<nome do integrante>/{PERFIL,PORTFOLIO,DOCUMENTOS}
- 09_ACADEMIA/
  - CURSOS/<nome do curso>/
    - CAPA/
    - MATERIAIS/
    - AULAS/<ordem - nome da aula>/{VIDEO,MATERIAIS,IMAGENS}

## Academia

academy_courses.drive_folder_id identifica a pasta do curso.
academy_lessons.drive_folder_id identifica a pasta da aula.
Arquivos continuam registrados em drive_files e ligados por academy_course_id/academy_lesson_id/academy_kind.

A capa é privada. Vídeos e materiais também são privados por padrão.

## Uploads

- Capa: upload simples, imagem.
- Vídeos e materiais grandes: upload resumível do Google Drive.
- Limite funcional da Academia: 15 GB por arquivo para media/material.
- O backend autentica, resolve o drive_folder_id e cria a sessão resumível.
- O navegador envia o arquivo em partes para a sessão.
- Ao concluir, o backend valida o arquivo no Drive e chama academy_commit_drive.
- Nenhum arquivo é considerado concluído antes do commit no Supabase.
- academy_upload_id garante idempotência/retry.

## Estados de UI

Pronto para enviar -> Preparando pasta -> Enviando N% -> Confirmando no Drive -> Vinculando ao curso/aula -> Concluído.

Em falha, manter o arquivo selecionado para nova tentativa. Não criar outra pasta para o mesmo curso/aula.

## Regra para outros módulos

Matéria, Projeto e Integrante seguem o mesmo contrato: a entidade deve possuir drive_folder_id persistido e todos os subdiretórios devem nascer dentro dessa pasta. Implementações novas não devem usar UUID como nome visível de pasta.
