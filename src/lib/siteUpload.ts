import { supabase } from "@/lib/supabase";

type UploadArgs = {
  bucket: string; // "site"
  path: string;   // ex: "home/banner/banner"
  file: File;
};

export async function uploadPublicImage({ bucket, path, file }: UploadArgs): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const finalPath = `${path}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(finalPath, file, { upsert: true, contentType: file.type });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from(bucket).getPublicUrl(finalPath);
  return data.publicUrl;
}
