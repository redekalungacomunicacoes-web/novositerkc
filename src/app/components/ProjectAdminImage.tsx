import { ImgHTMLAttributes, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { projectDriveSlug } from "@/lib/projectDrive";

export function ProjectAdminImage({src = "", ...props}: ImgHTMLAttributes<HTMLImageElement>) {
  const [preview, setPreview] = useState("");
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setPreview("");
    setFailed(false);
    return () => { generation.current++; };
  }, [src]);
  useEffect(() => () => { if(preview) URL.revokeObjectURL(preview); }, [preview]);
  const fallback = async () => {
    if(failed || preview) return;
    setFailed(true);
    const slug = projectDriveSlug(src);
    if(!slug) return;
    const current = generation.current;
    const {data,error} = await supabase.functions.invoke("drive-files", {body:{action:"project-preview",slug}});
    if(!error && data instanceof Blob && current===generation.current) setPreview(URL.createObjectURL(data));
  };
  return <img {...props} src={preview || src} decoding="async" onError={() => { void fallback(); }} />;
}
