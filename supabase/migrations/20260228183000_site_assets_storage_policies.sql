-- Garantir políticas de acesso ao bucket público usado no rodapé
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do update
set public = excluded.public;

-- Leitura pública dos arquivos do bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public can read site-assets files'
  ) THEN
    CREATE POLICY "Public can read site-assets files"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'site-assets');
  END IF;
END $$;

-- Usuários autenticados podem enviar arquivos ao bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated can upload site-assets files'
  ) THEN
    CREATE POLICY "Authenticated can upload site-assets files"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'site-assets');
  END IF;
END $$;

-- Usuários autenticados podem atualizar arquivos do bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated can update site-assets files'
  ) THEN
    CREATE POLICY "Authenticated can update site-assets files"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'site-assets')
      WITH CHECK (bucket_id = 'site-assets');
  END IF;
END $$;

-- Usuários autenticados podem remover arquivos do bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated can delete site-assets files'
  ) THEN
    CREATE POLICY "Authenticated can delete site-assets files"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'site-assets');
  END IF;
END $$;
