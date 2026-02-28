import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Image as ImageIcon, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/cms";
import { createThumbnail } from "@/lib/imageThumbnail";

const TEAM_AVATARS_BUCKET = "team-avatars";

type PortfolioItem = {
  id: string;
  member_id: string;
  kind: "image" | "video";
  title: string | null;
  description: string | null;
  file_url: string;
  thumb_url: string | null;
  order_index: number;
  is_public: boolean;
  created_at: string;
};

type PostOption = { id: string; titulo: string; slug: string | null; status: string | null };

type FormData = {
  nome: string;
  slug: string;
  cargo: string;
  bio: string;
  curriculo_md: string;
  instagram: string;
  whatsapp: string;
  facebook_url: string;
  linkedin_url: string;
  website_url: string;
  ativo: boolean;
  is_public: boolean;
  ordem: number;
  foto_url: string;
  avatar_path?: string | null;
  avatar_thumb_path?: string | null;
  email_login: string;
  senha_login: string;
  permissoes: { admin: boolean; editor: boolean; autor: boolean };
};

function safeFilename(name: string) {
  return (name || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .toLowerCase();
}

async function uploadToBucket(bucket: string, path: string, file: Blob, contentType: string) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function AdminEquipeForm() {
  const { id } = useParams();
  const isEditing = !!id && id !== "novo";
  const navigate = useNavigate();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      nome: "", slug: "", cargo: "", bio: "", curriculo_md: "", instagram: "", whatsapp: "", facebook_url: "", linkedin_url: "", website_url: "",
      ativo: true, is_public: false, ordem: 0, foto_url: "", email_login: "", senha_login: "", permissoes: { admin: false, editor: true, autor: true },
    },
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [postOptions, setPostOptions] = useState<PostOption[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [postsError, setPostsError] = useState<string>("");
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [savedFotoUrl, setSavedFotoUrl] = useState<string>("");

  const fotoUrl = watch("foto_url");
  const nome = watch("nome");
  const curriculoMd = watch("curriculo_md");

  useEffect(() => {
    if (slugTouched) return;
    setValue("slug", slugify(nome || ""), { shouldDirty: true });
  }, [nome, setValue, slugTouched]);

  async function loadPortfolio(memberId: string) {
    const { data, error } = await supabase
      .from("team_member_portfolio")
      .select("id, member_id, kind, title, description, file_url, thumb_url, order_index, is_public, created_at")
      .eq("member_id", memberId)
      .order("order_index", { ascending: true });
    if (!error) setPortfolio((data || []) as PortfolioItem[]);
  }

  useEffect(() => {
    (async () => {
      const postsRes = await supabase.from("materias").select("id, titulo, slug, status").order("created_at", { ascending: false }).limit(100);
      if (postsRes.error) setPostsError("TODO: tabela materias indisponível, vinculação de matérias desativada.");
      else setPostOptions((postsRes.data || []) as PostOption[]);

      if (!isEditing || !id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("equipe")
        .select("nome, slug, cargo, bio, curriculo_md, instagram, whatsapp, facebook_url, linkedin_url, website_url, ativo, is_public, ordem, foto_url, avatar_path, avatar_thumb_path, email_login")
        .eq("id", id)
        .single();
      setLoading(false);
      if (error || !data) return alert(error?.message || "Não foi possível carregar o membro.");

      reset({
        nome: data.nome || "", slug: data.slug || "", cargo: data.cargo || "", bio: data.bio || "", curriculo_md: data.curriculo_md || "", instagram: data.instagram || "",
        whatsapp: data.whatsapp || "", facebook_url: data.facebook_url || "", linkedin_url: data.linkedin_url || "", website_url: data.website_url || "",
        ativo: !!data.ativo,
        is_public: !!data.is_public,
        ordem: data.ordem ?? 0,
        foto_url: data.foto_url || "",
        avatar_path: data.avatar_path || "",
        avatar_thumb_path: data.avatar_thumb_path || "",
        email_login: data.email_login || "",
        senha_login: "",
        permissoes: { admin: false, editor: true, autor: true },
      });
      setSavedFotoUrl(data.foto_url || "");
      setSlugTouched(true);

      const relRes = await supabase.from("team_member_posts").select("post_id").eq("member_id", id);
      if (!relRes.error) setSelectedPosts((relRes.data || []).map((r: any) => r.post_id));
      await loadPortfolio(id);
    })();
  }, [id, isEditing, reset]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const handlePickFile = async (file?: File | null) => {
    if (!file) return;
    try {
      setUploading(true);
      setPendingAvatarFile(file);
      const previewUrl = URL.createObjectURL(file);
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarPreviewUrl(previewUrl);
      setValue("foto_url", previewUrl, { shouldDirty: true });
    } catch (e: any) {
      alert(e?.message || "Erro no upload da foto.");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (v: FormData) => {
    setLoading(true);
    try {
      const payload = {
        nome: v.nome,
        slug: slugify(v.slug || v.nome),
        cargo: v.cargo || null,
        bio: v.bio || null,
        curriculo_md: v.curriculo_md || null,
        instagram: v.instagram.trim() || null,
        whatsapp: v.whatsapp.trim() || null,
        facebook_url: v.facebook_url.trim() || null,
        linkedin_url: v.linkedin_url.trim() || null,
        website_url: v.website_url.trim() || null,
        ativo: !!v.ativo,
        is_public: !!v.is_public,
        ordem: Number(v.ordem || 0),
        foto_url: pendingAvatarFile ? (savedFotoUrl || null) : (v.foto_url || null),
        avatar_path: v.avatar_path || null,
        avatar_thumb_path: v.avatar_thumb_path || null,
        email_login: v.email_login || null,
        updated_at: new Date().toISOString(),
      };

      let equipeId = id as string;
      if (isEditing && id) {
        const res = await supabase.from("equipe").update(payload).eq("id", id);
        if (res.error) throw res.error;
      } else {
        const res = await supabase.from("equipe").insert(payload).select("id").single();
        if (res.error) throw res.error;
        equipeId = res.data.id;
      }

      if (pendingAvatarFile) {
        const thumbBlob = await createThumbnail(pendingAvatarFile, 320, 0.75);
        const thumbContentType = thumbBlob.type || "image/jpeg";
        const isThumbWebp = thumbContentType.includes("webp");
        const thumbExt = isThumbWebp ? "webp" : "jpg";
        const originalIsWebp = pendingAvatarFile.type.includes("webp");
        const originalExt = originalIsWebp ? "webp" : "jpg";
        const originalType = originalIsWebp ? "image/webp" : "image/jpeg";

        const avatarPath = `avatars/${equipeId}/avatar.${originalExt}`;
        const avatarThumbPath = `avatars/${equipeId}/thumb.${thumbExt}`;

        const [avatarUrl] = await Promise.all([
          uploadToBucket(TEAM_AVATARS_BUCKET, avatarPath, pendingAvatarFile, originalType),
          uploadToBucket(TEAM_AVATARS_BUCKET, avatarThumbPath, thumbBlob, thumbContentType),
        ]);

        const { error: avatarUpdateError } = await supabase
          .from("equipe")
          .update({
            foto_url: avatarUrl,
            avatar_path: avatarPath,
            avatar_thumb_path: avatarThumbPath,
          })
          .eq("id", equipeId);

        if (avatarUpdateError) throw avatarUpdateError;
        setSavedFotoUrl(avatarUrl);
        setPendingAvatarFile(null);
        if (avatarPreviewUrl) {
          URL.revokeObjectURL(avatarPreviewUrl);
          setAvatarPreviewUrl(null);
        }
      }

      const { error: delErr } = await supabase.from("team_member_posts").delete().eq("member_id", equipeId);
      if (delErr) throw delErr;
      if (selectedPosts.length) {
        const rows = selectedPosts.map((postId) => ({ member_id: equipeId, post_id: postId }));
        const { error: insErr } = await supabase.from("team_member_posts").insert(rows);
        if (insErr) throw insErr;
      }

      const email = (v.email_login || "").trim();
      const pass = (v.senha_login || "").trim();
      if (pass && pass.length < 6) throw new Error("A senha precisa ter no mínimo 6 caracteres.");
      if (email && pass) {
        const roles: string[] = [];
        if (v.permissoes.admin) roles.push("admin");
        if (v.permissoes.editor) roles.push("editor");
        if (v.permissoes.autor) roles.push("autor");
        if (!roles.length) roles.push("autor");
        const { data, error } = await supabase.functions.invoke("admin-upsert-user", { body: { equipe_id: equipeId, email, password: pass, roles } });
        if (error) throw error;
        if (data?.ok === false) throw new Error(data?.error || "Falha ao criar usuário.");
      }

      navigate("/admin/equipe");
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar membro.");
    } finally {
      setLoading(false);
    }
  };

  const handlePortfolioUpload = async (file: File, kind: "image" | "video", title: string, description: string) => {
    const memberId = id;
    if (!memberId) return alert("Salve o integrante antes de adicionar portfólio.");
    const ext = file.name.split(".").pop() || (kind === "image" ? "jpg" : "mp4");
    const portfolioId = crypto.randomUUID();
    const path = `${memberId}/${portfolioId}.${safeFilename(ext)}`;
    try {
      const url = await uploadToBucket("team-portfolio", path, file, file.type || (kind === "image" ? "image/jpeg" : "video/mp4"));
      const { error } = await supabase.from("team_member_portfolio").insert({
        id: portfolioId,
        member_id: memberId,
        kind,
        title: title || null,
        description: description || null,
        file_url: url,
        thumb_url: kind === "image" ? url : null,
        order_index: portfolio.length,
        is_public: true,
      });
      if (error) throw error;
      await loadPortfolio(memberId);
    } catch (e: any) {
      alert(e?.message || "Erro ao adicionar item ao portfólio.");
    }
  };

  const movePortfolio = async (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= portfolio.length || !id) return;
    const ordered = [...portfolio];
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    for (let i = 0; i < ordered.length; i++) {
      await supabase.from("team_member_portfolio").update({ order_index: i }).eq("id", ordered[i].id);
    }
    await loadPortfolio(id);
  };

  const postsByStatus = useMemo(() => postOptions.filter((p) => p.status !== "archived"), [postOptions]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/equipe" className="p-2 hover:bg-muted rounded-full transition-colors"><ArrowLeft className="h-5 w-5 text-muted-foreground" /></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{isEditing ? "Editar Membro" : "Novo Membro"}</h1>
            <p className="text-muted-foreground text-sm">Perfil público estilo Instagram + matérias + portfólio.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate("/admin/equipe")} className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors" disabled={loading}>Cancelar</button>
          <button onClick={handleSubmit(onSubmit)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md" disabled={loading}><Save className="h-4 w-4" />{loading ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Dados principais</h3>
            <input {...register("nome", { required: "Nome é obrigatório" })} placeholder="Nome" className="w-full h-10 px-3 rounded-md border" />
            {errors.nome && <span className="text-destructive text-xs">{errors.nome.message}</span>}
            <input {...register("slug", { required: "Slug obrigatório" })} onChange={(e) => { setSlugTouched(true); setValue("slug", slugify(e.target.value)); }} placeholder="slug-do-perfil" className="w-full h-10 px-3 rounded-md border" />
            <input {...register("cargo")} placeholder="Profissão/Cargo" className="w-full h-10 px-3 rounded-md border" />
            <textarea {...register("bio")} placeholder="Bio curta" className="w-full min-h-[90px] p-3 rounded-md border" />
            <textarea {...register("curriculo_md")} placeholder="Currículo detalhado em markdown" className="w-full min-h-[180px] p-3 rounded-md border font-mono text-sm" />
            <details>
              <summary className="cursor-pointer text-sm">Preview do currículo</summary>
              <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap">{curriculoMd || "Sem conteúdo"}</pre>
            </details>
            <div className="grid md:grid-cols-2 gap-3">
              <input {...register("instagram")} placeholder="Instagram" className="w-full h-10 px-3 rounded-md border" />
              <input {...register("whatsapp")} placeholder="WhatsApp" className="w-full h-10 px-3 rounded-md border" />
              <input {...register("facebook_url")} placeholder="Facebook URL" className="w-full h-10 px-3 rounded-md border" />
              <input {...register("linkedin_url")} placeholder="LinkedIn URL" className="w-full h-10 px-3 rounded-md border" />
              <input {...register("website_url")} placeholder="Website URL" className="w-full h-10 px-3 rounded-md border md:col-span-2" />
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Matérias vinculadas</h3>
            {postsError && <p className="text-xs text-amber-600">{postsError}</p>}
            <div className="max-h-52 overflow-auto border rounded-md p-3 space-y-2">
              {postsByStatus.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedPosts.includes(p.id)}
                    onChange={() => setSelectedPosts((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                  />
                  {p.titulo}
                </label>
              ))}
              {!postsByStatus.length && <p className="text-xs text-muted-foreground">Nenhuma matéria disponível.</p>}
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Portfólio</h3>
            {!isEditing && <p className="text-xs text-muted-foreground">Salve o integrante para liberar upload do portfólio.</p>}
            {isEditing && (
              <AddPortfolioItem onAdd={handlePortfolioUpload} />
            )}
            <div className="space-y-2">
              {portfolio.map((item, idx) => (
                <div key={item.id} className="border rounded-md p-3 flex items-center gap-3">
                  <div className="h-14 w-14 rounded bg-muted overflow-hidden">
                    {item.kind === "image" ? <img src={item.thumb_url || item.file_url} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-xs">Vídeo</div>}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.title || "Sem título"}</p>
                    <p className="text-xs text-muted-foreground">{item.kind} · ordem {item.order_index}</p>
                  </div>
                  <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={item.is_public} onChange={async () => { await supabase.from("team_member_portfolio").update({ is_public: !item.is_public }).eq("id", item.id); if (id) loadPortfolio(id); }} />Público</label>
                  <button type="button" onClick={() => movePortfolio(idx, -1)} className="p-2 border rounded"><ArrowUp className="h-3 w-3" /></button>
                  <button type="button" onClick={() => movePortfolio(idx, 1)} className="p-2 border rounded"><ArrowDown className="h-3 w-3" /></button>
                  <button type="button" onClick={async () => { if (!confirm("Remover item?")) return; await supabase.from("team_member_portfolio").delete().eq("id", item.id); if (id) loadPortfolio(id); }} className="p-2 border rounded text-red-600"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
              {portfolio.length === 0 && <p className="text-xs text-muted-foreground">Sem itens no portfólio.</p>}
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Acesso ao Painel</h3>
            <input type="email" {...register("email_login")} className="w-full h-10 px-3 rounded-md border" placeholder="email@dominio.com" />
            <input type="password" {...register("senha_login")} className="w-full h-10 px-3 rounded-md border" placeholder="Senha" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("permissoes.admin")} />Admin</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("permissoes.editor")} />Editor</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("permissoes.autor")} />Autor</label>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Publicação</h3>
            <label className="flex items-center justify-between text-sm">Ativo <input type="checkbox" {...register("ativo")} /></label>
            <label className="flex items-center justify-between text-sm">Publicar perfil <input type="checkbox" {...register("is_public")} /></label>
            <input type="number" {...register("ordem", { valueAsNumber: true })} className="w-full h-10 px-3 rounded-md border" placeholder="Ordem" />
            <a href={`/equipe/${watch("slug") || ""}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Abrir perfil público</a>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Avatar</h3>
            <label className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center text-center cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePickFile(e.target.files?.[0])} />
              <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm">{uploading ? "Enviando..." : "Clique para upload"}</p>
            </label>
            {fotoUrl && <img src={fotoUrl} alt="Prévia" className="w-full h-48 object-cover rounded-md border" />}
            {fotoUrl && <button type="button" className="text-xs text-red-600" onClick={() => { setPendingAvatarFile(null); if (avatarPreviewUrl) { URL.revokeObjectURL(avatarPreviewUrl); setAvatarPreviewUrl(null); } setValue("foto_url", "", { shouldDirty: true }); }}>Remover avatar</button>}
            <input {...register("foto_url")} className="w-full h-10 px-3 rounded-md border" placeholder="Ou URL do avatar" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AddPortfolioItem({ onAdd }: { onAdd: (file: File, kind: "image" | "video", title: string, description: string) => Promise<void> }) {
  const [kind, setKind] = useState<"image" | "video">("image");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <div className="border rounded-md p-3 space-y-2">
      <p className="font-medium text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Adicionar item</p>
      <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="w-full h-10 px-3 rounded-md border">
        <option value="image">Imagem</option>
        <option value="video">Vídeo</option>
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="w-full h-10 px-3 rounded-md border" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="w-full min-h-[70px] p-3 rounded-md border" />
      <input type="file" accept={kind === "image" ? "image/*" : "video/*"} onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
      <button type="button" disabled={!file || saving} onClick={async () => { if (!file) return; setSaving(true); await onAdd(file, kind, title, description); setTitle(""); setDescription(""); setFile(null); setSaving(false); }} className="px-3 py-2 text-sm rounded bg-primary text-primary-foreground">{saving ? "Salvando..." : "Adicionar"}</button>
    </div>
  );
}
