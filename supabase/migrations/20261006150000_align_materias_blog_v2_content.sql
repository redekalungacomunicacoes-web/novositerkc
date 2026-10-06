-- Alinha o conteúdo do curso "Matérias para Blog" à Apostila v2.0 Visual.
-- Resolve IDs dinamicamente por curso/módulo/posição para manter a migração portátil.
do $$
declare c uuid; m2 uuid; m3 uuid; m4 uuid; m5 uuid;
begin
 select id into c from public.academy_courses where title='Matérias para Blog' order by created_at limit 1;
 if c is null then raise exception 'Curso Matérias para Blog não encontrado'; end if;
 select id into m2 from public.academy_modules where course_id=c and position=2;
 select id into m3 from public.academy_modules where course_id=c and position=3;
 select id into m4 from public.academy_modules where course_id=c and position=4;
 select id into m5 from public.academy_modules where course_id=c and position=5;

 update public.academy_lessons set
 description='Crie uma nova matéria, preencha os campos essenciais, mantenha Rascunho e salve primeiro para gerar o ID necessário ao fluxo de arquivos.',
 content=$txt$OBJETIVO DA AULA

Criar uma nova matéria, preencher os campos essenciais e salvar o primeiro rascunho antes de trabalhar com arquivos.

PASSO A PASSO

1. Abra Matérias e clique em Nova Matéria.
2. Preencha Título.
3. Preencha Linha fina.
4. Selecione Autor.
5. Confira a Data.
6. Selecione a Categoria.
7. Mantenha Status como Rascunho.
8. Clique em Salvar.
9. Abra novamente a matéria em Editar.

POR QUE SALVAR PRIMEIRO?

O fluxo de arquivos da RKC precisa que a matéria já exista e possua um ID. Nesta etapa não envie capa, banner, áudio ou imagens antes do primeiro salvamento.

RESUMO

Preencha a estrutura essencial → mantenha Rascunho → salve → reabra em Editar.

PRÁTICA

Crie uma matéria fictícia de treinamento, preencha os campos essenciais e salve como Rascunho. Não publique.$txt$,
 duration_minutes=9, updated_at=now()
 where course_id=c and module_id=m2 and position=1;

 update public.academy_lessons set
 description='Monte primeiro a estrutura da matéria com blocos, criando vários em sequência sem interromper o fluxo; depois abra cada bloco para preencher.',
 content=$txt$OBJETIVO DA AULA

Montar a estrutura da matéria utilizando os blocos disponíveis no editor.

BLOCOS

• Parágrafo
• Subtítulo
• Citação
• Destaque
• Imagem
• Imagem + Texto

FLUXO RECOMENDADO

1. Na aba Conteúdo, adicione os blocos desejados.
2. Você pode criar vários blocos em sequência antes de preenchê-los.
3. O editor não deve rolar automaticamente para o fim nem abrir o bloco recém-criado.
4. Depois de montar a sequência, desça até os blocos.
5. Abra o cabeçalho do bloco que deseja editar.
6. Preencha o conteúdo.
7. Recolha o bloco quando terminar.

EXEMPLO

Parágrafo → Parágrafo → Subtítulo → Parágrafo → Citação → Destaque → Imagem.

PRÁTICA

Monte uma sequência com 2 Parágrafos, 1 Subtítulo, 1 Citação, 1 Destaque e 1 Imagem antes de começar a preencher.$txt$,
 duration_minutes=9, updated_at=now()
 where course_id=c and module_id=m2 and position=2;

 update public.academy_lessons set
 description='Edite parágrafos, subtítulos, citações e destaques, reorganize a narrativa e troque o tipo do próprio bloco sem perder sua posição.',
 content=$txt$OBJETIVO DA AULA

Editar os blocos de texto, reorganizar a narrativa e corrigir tipos de bloco sem reconstruir a matéria.

PARÁGRAFO
Use para o texto corrido.

SUBTÍTULO
Use para dividir o conteúdo em seções.

CITAÇÃO
Use para destacar uma fala e informe autor ou fonte quando aplicável. A referência visual é verde RKC.

DESTAQUE
Use para uma informação importante. A referência visual é amarela/creme.

NEGRITO E ITÁLICO
Use com moderação e apenas nos trechos necessários.

REORGANIZAÇÃO
Use os controles subir e descer para mudar a posição do bloco.

TROCANDO O TIPO DO BLOCO

1. Abra o seletor de tipo no próprio cabeçalho.
2. Escolha o novo tipo.
3. O bloco permanece na mesma posição.
4. Confira os campos após a conversão.

PRÁTICA

Preencha os blocos criados na aula anterior, altere o tipo de um deles e reorganize outro usando subir/descer.$txt$,
 duration_minutes=8, updated_at=now()
 where course_id=c and module_id=m2 and position=3;

 update public.academy_lessons set
 description='Depois de salvar o rascunho, envie capa, banner e imagens pelo Google Drive da RKC, conferindo prévias, legendas e créditos.',
 content=$txt$OBJETIVO DA AULA

Enviar capa, banner e imagens da matéria pelo fluxo integrado ao Google Drive da RKC.

PRÉ-REQUISITO

A matéria precisa estar salva e possuir ID.

CAPA
1. Clique em Enviar capa.
2. Escolha a imagem.
3. Aguarde a confirmação.
4. Confira a prévia.
5. Prefira formato quadrado 1:1.

BANNER
1. Clique em Enviar banner.
2. Escolha uma imagem horizontal.
3. Aguarde o envio.
4. Confira a prévia.

IMAGEM NO BLOCO
1. Abra um bloco Imagem ou Imagem + Texto.
2. Clique em Upload.
3. Selecione o arquivo.
4. Confira a prévia.
5. Preencha legenda e crédito.

IMPORTANTE

O fluxo atualizado utiliza o Google Drive da RKC. A orientação antiga de usar o bucket materias do Supabase Storage não é mais a referência deste treinamento.$txt$,
 duration_minutes=9, updated_at=now()
 where course_id=c and module_id=m3 and position=1;

 update public.academy_lessons set
 description='Adicione galeria de fotos e áudio depois que a matéria já possuir ID, seguindo o fluxo integrado ao Google Drive da RKC.',
 content=$txt$OBJETIVO DA AULA

Adicionar galeria de fotos e áudio corretamente depois que a matéria já estiver salva.

GALERIA

1. Mantenha a matéria como Rascunho e salve.
2. Abra novamente em Editar.
3. Entre em Galeria de Fotos.
4. Clique em Adicionar fotos.
5. Selecione uma ou várias imagens.
6. Confira a galeria.
7. Informe os créditos.

As imagens seguem o fluxo do Google Drive da RKC e ficam associadas ao ID da matéria.

ÁUDIO

O campo aceita URL ou upload. O fluxo documentado valida MP3, WAV, OGG e M4A, com limite de 20 MB por arquivo.

PRÁTICA

Adicione fotos à galeria de uma matéria de treinamento já salva e confira os créditos.$txt$,
 duration_minutes=8, updated_at=now()
 where course_id=c and module_id=m3 and position=2;

 update public.academy_lessons set
 description='Organize categoria, hashtags e status da matéria e mantenha Rascunho durante toda a produção e revisão.',
 content=$txt$OBJETIVO DA AULA

Organizar categoria, hashtags e status antes da revisão final.

CATEGORIA
Selecione uma categoria existente. Crie uma nova somente quando necessário e evite duplicidades.

HASHTAGS
Separe por vírgula. Exemplo: #quilombo, #cultura, #comunicacao, #juventude.

STATUS

Rascunho — enquanto escreve, revisa, aguarda arquivos ou aprovação.
Publicado — quando a matéria está pronta para aparecer no site.
Arquivado — quando deve permanecer registrada sem circulação normal.

REGRA

Enquanto estiver trabalhando na publicação, mantenha Rascunho. Publicado só entra depois da revisão.$txt$,
 duration_minutes=7, updated_at=now()
 where course_id=c and module_id=m4 and position=1;

 update public.academy_lessons set
 description='Faça a revisão operacional completa, publique somente quando tudo estiver correto e confira o resultado no site público.',
 content=$txt$OBJETIVO DA AULA

Revisar, publicar e conferir a matéria no site público.

CHECKLIST

• Título e linha fina corretos
• Autor, data e categoria corretos
• Blocos na ordem e nos tipos corretos
• Citações com fonte quando necessário
• Capa e banner carregados
• Imagens com legenda e crédito
• Galeria conferida
• Áudio testado, se houver
• Hashtags revisadas

PUBLICAÇÃO

1. Mantenha Rascunho durante a revisão.
2. Quando tudo estiver correto, altere para Publicado.
3. Clique em Salvar.
4. Volte à listagem.
5. Use Visualizar.
6. Confira a matéria no site público.

A publicação só termina depois dessa conferência.$txt$,
 duration_minutes=8, updated_at=now()
 where course_id=c and module_id=m4 and position=2;

 update public.academy_lessons set
 description='Execute o fluxo completo em uma matéria fictícia de treinamento, do primeiro rascunho à conferência final.',
 content=$txt$OBJETIVO DA AULA

Executar o processo completo usando uma matéria fictícia de treinamento.

EXERCÍCIO

Crie a matéria “Teste de treinamento - Academia RKC”. Ela não precisa ser publicada.

1. Crie a matéria e salve primeiro como Rascunho.
2. Reabra em Editar.
3. Adicione sem preencher: 2 Parágrafos, 1 Subtítulo, 1 Citação, 1 Destaque e 1 Imagem.
4. Confirme que a criação dos blocos não interrompe o fluxo.
5. Abra e preencha cada bloco.
6. Troque o tipo de um bloco e confirme que permanece na mesma posição.
7. Reordene outro bloco.
8. Envie uma capa e uma imagem de bloco.
9. Adicione uma foto à galeria.
10. Revise categoria, hashtags, legendas e créditos.
11. Salve e visualize o resultado.
12. Mantenha o exercício como Rascunho ou exclua-o ao final conforme orientação interna.

DEPOIS DE DOMINAR A FERRAMENTA

O estudo pode avançar para planejamento de pauta, sugestões de matérias e boas práticas editoriais. Esses temas vêm depois do domínio operacional do painel.$txt$,
 duration_minutes=12, updated_at=now()
 where course_id=c and module_id=m5 and position=1;
end $$;