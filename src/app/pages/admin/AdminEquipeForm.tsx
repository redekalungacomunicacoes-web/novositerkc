import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Image as ImageIcon, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { TeamAvatarImage } from "@/app/components/TeamAvatarImage";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/cms";
import { downloadRkcDriveFile } from "@/services/driveFiles";
import { createThumbnail } from "@/lib/imageThumbnail";
import { driveMediaUrl, driveSlug } from "@/lib/teamAvatar";

const TEAM_AVATARS_BUCKET = "team-avatars";

type PortfolioItem = {
  id: string;
  member_id: string;
  kind: "image" | "video" | "pdf" | "link";
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
  order_index: number;
  foto_url: string;
  avatar_path?: string | null;
  avatar_thumb_path?: string | null;
  email_login: string;
  senha_login: string;
  permissoes: { admin: boolean; editor: boolean; autor: boolean };
};

type AdminEquipeFormMode = "admin" | "self";

type AdminEquipeFormProps = {
  mode?: AdminEquipeFormMode;
  memberId?: string;
};

export function AdminEquipeForm({ mode = "admin", memberId }: AdminEquipeFormProps = {}) {
  const { id } = useParams();
  const isSelfMode = mode === "self";
  const [createdId, setCreatedId] = useState<string | null>(null);
  const resolvedId = isSelfMode ? memberId : (createdId || id);
  const isEditing = !!resolvedId && resolvedId !== "novo";
  const navigate = useNavigate();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, dirtyFields } } = useForm<FormData>({
    defaultValues: {
      nome: "", slug: "", cargo: "", bio: "", curriculo_md: "", instagram: "", whatsapp: "", facebook_url: "", linkedin_url: "", website_url: "",
      ativo: true, is_public: false, order_index: 1, foto_url: "", email_login: "", senha_login: "", permissoes: { admin: false, editor: true, autor: true },
    },
  });

  const [avatarFileId, setAvatarFileId] = useState<string | null>(null);
  const [existingRoles, setExistingRoles] = useState<string[] | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
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
  const [savedAvatarPreviewUrl, setSavedAvatarPreviewUrl] = useState<string>("");
  const [currentOrderIndex, setCurrentOrderIndex] = useState<number>(1);

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
      .select("id,member_id,kind,title,description,file_url,thumb_url,order_index,is_public,created_at")
      .eq("member_id", memberId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setPortfolio((data || []) as PortfolioItem[]);
  }

  async function getInvokeErrorMessage(error: unknown, data: any, fallback: string) {
    const response = (error as { context?: Response } | null)?.context;
    if (response instanceof Response) {
      try { const payload = await response.clone().json(); if (payload?.error) return String(payload.error); } catch { /* response may have no JSON body */ }
    }
    const base = error instanceof Error ? error.message : "";
    if (data?.error) return String(data.error);
    if (base.includes("non-2xx") && data?.message) return String(data.message);
    if (base) return base;
    return fallback;
  }

  useEffect(() => {
    (async () => {
      if (!isSelfMode) {
        const postsRes = await supabase.from("materias").select("id, titulo, slug, status").order("created_at", { ascending: false }).limit(100);
        if (postsRes.error) setPostsError("TODO: tabela materias indisponível, vinculação de matérias desativada.");
        else setPostOptions((postsRes.data || []) as PostOption[]);
      }

      if (!isEditing || !resolvedId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("equipe")
        .select("nome, slug, cargo, bio, curriculo_md, instagram, whatsapp, facebook_url, linkedin_url, website_url, ativo, is_public, order_index, foto_url, avatar_path, avatar_thumb_path, email_login, user_id, avatar_drive:drive_files!equipe_avatar_drive_file_id_fkey(id,public_slug), avatar_thumb_drive:drive_files!equipe_avatar_thumb_drive_file_id_fkey(id,public_slug)")
        .eq("id", resolvedId)
        .single();
      setLoading(false);
      if (error || !data) return alert(error?.message || "Não foi possível carregar o membro.");

      reset({
        nome: data.nome || "", slug: data.slug || "", cargo: data.cargo || "", bio: data.bio || "", curriculo_md: data.curriculo_md || "", instagram: data.instagram || "",
        whatsapp: data.whatsapp || "", facebook_url: data.facebook_url || "", linkedin_url: data.linkedin_url || "", website_url: data.website_url || "",
        ativo: !!data.ativo,
        is_public: !!data.is_public,
        order_index: data.order_index ?? 1,
        foto_url: data.foto_url || "",
        avatar_path: data.avatar_path || "",
        avatar_thumb_path: data.avatar_thumb_path || "",
        email_login: data.email_login || "",
        senha_login: "",
        permissoes: { admin: false, editor: true, autor: true },
      });
      if(!isSelfMode && data.user_id) {
        const roleRes=await supabase.from("user_roles").select("roles(name)").eq("user_id",data.user_id);
        if(!roleRes.error) {
          const names=(roleRes.data||[]).flatMap((row:any)=>Array.isArray(row.roles)?row.roles.map((r:any)=>r.name):[row.roles?.name]).filter(Boolean);
          setExistingRoles(names);
          setValue("permissoes",{admin:names.includes("admin")||names.includes("admin_alfa"),editor:names.includes("editor"),autor:names.includes("autor")});
        }
      } else setExistingRoles([]);
      setSavedFotoUrl(data.foto_url || "");
      const drivePreview = driveMediaUrl(driveSlug((data as any).avatar_thumb_drive) || driveSlug((data as any).avatar_drive));
      const legacyPreview = data.avatar_thumb_path
        ? supabase.storage.from(TEAM_AVATARS_BUCKET).getPublicUrl(data.avatar_thumb_path).data.publicUrl
        : data.avatar_path
          ? supabase.storage.from(TEAM_AVATARS_BUCKET).getPublicUrl(data.avatar_path).data.publicUrl
          : data.foto_url || "";
      const relation:any=(data as any).avatar_thumb_drive || (data as any).avatar_drive;
      setAvatarFileId(Array.isArray(relation)?relation[0]?.id:relation?.id);
      setSavedAvatarPreviewUrl(drivePreview || legacyPreview);
      setCurrentOrderIndex(data.order_index ?? 1);
      setSlugTouched(true);

      if (!isSelfMode) {
        const relRes = await supabase.from("team_member_posts").select("post_id").eq("member_id", resolvedId);
        if (!relRes.error) setSelectedPosts((relRes.data || []).map((r: any) => r.post_id));
        await loadPortfolio(resolvedId);
      }
    })();
  }, [resolvedId, isEditing, isSelfMode, reset]);

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
    let saved = false;
    let avatarSaved = false;
    try {
      if (!isSelfMode && v.senha_login && v.senha_login.trim().length < 6) throw new Error("A senha precisa ter no mínimo 6 caracteres.");
      const normalizedOrderIndex = Number.isInteger(v.order_index) && Number(v.order_index) >= 1
        ? Number(v.order_index)
        : (isEditing ? currentOrderIndex : 1);

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
        order_index: normalizedOrderIndex,
        foto_url: pendingAvatarFile ? (savedFotoUrl || null) : (v.foto_url || null),
        avatar_path: v.avatar_path || null,
        avatar_thumb_path: v.avatar_thumb_path || null,
        email_login: v.email_login || null,
        updated_at: new Date().toISOString(),
      };

      let equipeId = resolvedId as string;
      if (isEditing && resolvedId) {
        const res = await supabase.from("equipe").update(payload).eq("id", resolvedId);
        if (res.error) throw res.error;
      } else {
        if (isSelfMode) throw new Error("Perfil próprio precisa estar vinculado a um integrante existente.");
        const res = await supabase.from("equipe").insert(payload).select("id").single();
        if (res.error) throw res.error;
        equipeId = res.data.id;
        setCreatedId(equipeId);
      }

      saved = true;
      const folder = await supabase.functions.invoke("drive-files", {body:{action:"team-ensure-folder",member_id:equipeId}});
      if(folder.error || !folder.data?.ok) throw new Error("Dados salvos; não foi possível preparar a pasta institucional. Edite o integrante e tente novamente.");
      if(removeAvatar && !pendingAvatarFile) {
        const removed=await supabase.functions.invoke("drive-files",{body:{action:"team-remove-avatar",member_id:equipeId}});
        if(removed.error || !removed.data?.ok) throw new Error("Dados salvos; remoção do avatar pendente.");
      }
      setCurrentOrderIndex(normalizedOrderIndex);

      if (pendingAvatarFile) {
        const thumbBlob = await createThumbnail(pendingAvatarFile, 320, 0.75);
        if (thumbBlob.type !== "image/webp") throw new Error("Este navegador não gerou WebP. Tente outro navegador para o avatar.");
        const thumbContentType = thumbBlob.type;
        const thumbFile = new File([thumbBlob], "avatar-thumb.webp", { type: thumbContentType });
        const avatarPairForm = new FormData();
        avatarPairForm.set("module", "team");
        avatarPairForm.set("operation", "avatar-pair");
        avatarPairForm.set("member_id", equipeId);
        avatarPairForm.set("avatar", pendingAvatarFile);
        avatarPairForm.set("thumb", thumbFile);

        const pairDrive = await supabase.functions.invoke("drive-files", { body: avatarPairForm });
        if (pairDrive.error || pairDrive.data?.ok === false) {
          throw new Error(await getInvokeErrorMessage(pairDrive.error, pairDrive.data, "Falha ao enviar avatar e thumbnail ao Google Drive."));
        }

        avatarSaved = true;
        // Validate delivery in this frontend before retiring replaced Drive files.
        try {
          const pair=pairDrive.data?.files;
          for(const record of [pair?.avatar,pair?.thumb]) {
            if(!record?.id) throw new Error("Par de avatar ausente na resposta.");
            const blob=await downloadRkcDriveFile(record.id);
            const objectUrl=URL.createObjectURL(blob);
            try {const image=new Image();image.src=objectUrl;await image.decode();} finally {URL.revokeObjectURL(objectUrl);}
          }
          const confirm=await supabase.functions.invoke("drive-files",{body:{action:"team-avatar-confirm",member_id:equipeId,avatar_id:pair.avatar.id,thumb_id:pair.thumb.id}});
          if(confirm.error || confirm.data?.cleanup_pending) console.warn("Avatar salvo; limpeza das versões anteriores pendente.");
        } catch {console.warn("Avatar salvo; confirmação visual e limpeza anteriores pendentes.");}
        setSavedFotoUrl("");

        setPendingAvatarFile(null);
        if (avatarPreviewUrl) {
          URL.revokeObjectURL(avatarPreviewUrl);
          setAvatarPreviewUrl(null);
        }
      }

      if (!isSelfMode) {
        const { error: delErr } = await supabase.from("team_member_posts").delete().eq("member_id", equipeId);
        if (delErr) throw delErr;
        if (selectedPosts.length) {
          const rows = selectedPosts.map((postId) => ({ member_id: equipeId, post_id: postId }));
          const { error: insErr } = await supabase.from("team_member_posts").insert(rows);
          if (insErr) throw insErr;
        }
      }

      const email = (v.email_login || "").trim();
      const pass = (v.senha_login || "").trim();
      if (!isSelfMode && pass && pass.length < 6) throw new Error("A senha precisa ter no mínimo 6 caracteres.");
      if (!isSelfMode && email && (!isEditing || pass || dirtyFields.email_login || dirtyFields.permissoes)) {
        const roles: string[] = [];
        if (v.permissoes.admin) roles.push("admin");
        if (v.permissoes.editor) roles.push("editor");
        if (v.permissoes.autor) roles.push("autor");
        if (!dirtyFields.permissoes && isEditing) {
          if(existingRoles === null) throw new Error("Permissões atuais não puderam ser carregadas. Entre novamente antes de alterar o login.");
          roles.splice(0,roles.length,...existingRoles);
        } else if(existingRoles?.includes("admin_alfa") && v.permissoes.admin) {
          roles.splice(roles.indexOf("admin"),1,"admin_alfa");
        }
        if (!roles.length) roles.push("autor");

        const { data, error } = await supabase.functions.invoke("admin-upsert-user", {
          body: {
            equipe_id: equipeId,
            email,
            password: pass || undefined,
            roles,
          },
        });

        if (error || data?.ok === false) {
          throw new Error(await getInvokeErrorMessage(error, data, "Falha ao criar/atualizar usuário."));
        }
      }

      alert("Integrante salvo com sucesso.");
      navigate(isSelfMode ? "/admin/perfil" : "/admin/equipe");
    } catch (e: any) {
      alert(`${saved ? (avatarSaved ? "Perfil e avatar salvos. Etapa complementar pendente: " : "Dados do integrante salvos. Etapa complementar pendente: ") : ""}${e?.message || "Erro ao salvar integrante."}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePortfolioUpload = async (params: { kind: "image" | "video" | "pdf" | "link"; title: string; description: string; file?: File | null; externalUrl?: string }) => {
    const memberId = resolvedId;
    if (!memberId) return alert("Salve o integrante antes de adicionar portfólio.");

    const { kind, title, description, file, externalUrl } = params;

    try {
      let fileUrl = "";
      let thumbUrl: string | null = null;

      if (kind === "link") {
        const normalizedUrl = (externalUrl || "").trim();
        if (!normalizedUrl) throw new Error("Informe um link para o item de portfólio.");
        fileUrl = /^https?:\/\//i.test(normalizedUrl) ? normalizedUrl : `https://${normalizedUrl}`;
      } else {
        if (!file) throw new Error("Selecione um arquivo para o item de portfólio.");
        const form = new window.FormData();
        form.set("module","team");form.set("operation","portfolio");form.set("member_id",memberId);
        form.set("kind",kind);form.set("title",title);form.set("description",description);form.set("file",file);
        const uploaded = await supabase.functions.invoke("drive-files",{body:form});
        if(uploaded.error || !uploaded.data?.ok) throw new Error(await getInvokeErrorMessage(uploaded.error,uploaded.data,"Falha no upload do portfólio ao Drive."));
        await loadPortfolio(memberId);
        return;
      }

      const { error } = await supabase.from("team_member_portfolio").insert({
        member_id: memberId,
        kind,
        title: title || null,
        description: description || null,
        file_url: fileUrl,
        thumb_url: thumbUrl,
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
    if (next < 0 || next >= portfolio.length || !resolvedId) return;
    const ordered = [...portfolio];
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    for (let i = 0; i < ordered.length; i++) {
      await supabase.from("team_member_portfolio").update({ order_index: i }).eq("id", ordered[i].id);
    }
    await loadPortfolio(resolvedId);
  };

  const postsByStatus = useMemo(() => postOptions.filter((p) => p.status !== "archived"), [postOptions]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={isSelfMode ? "/admin" : "/admin/equipe"} className="p-2 hover:bg-muted rounded-full transition-colors"><ArrowLeft className="h-5 w-5 text-muted-foreground" /></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{isSelfMode ? "Perfil" : isEditing ? "Editar Membro" : "Novo Membro"}</h1>
            <p className="text-muted-foreground text-sm">{isSelfMode ? "Edite aqui apenas seu próprio perfil público." : "Perfil público estilo Instagram + matérias + portfólio."}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate(isSelfMode ? "/admin" : "/admin/equipe")} className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors" disabled={loading}>Cancelar</button>
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

          {!isSelfMode && (
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
          )}

          {!isSelfMode && (
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
                    {item.kind === "image" ? <img src={item.thumb_url || item.file_url} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-xs">{item.kind === "video" ? "Vídeo" : item.kind === "pdf" ? "PDF" : "Link"}</div>}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.title || "Sem título"}</p>
                    <p className="text-xs text-muted-foreground">{item.kind} · ordem {item.order_index}</p>
                  </div>
                  <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={item.is_public} onChange={async () => { await supabase.from("team_member_portfolio").update({ is_public: !item.is_public }).eq("id", item.id); if (resolvedId) loadPortfolio(resolvedId); }} />Público</label>
                  <button type="button" onClick={() => movePortfolio(idx, -1)} className="p-2 border rounded"><ArrowUp className="h-3 w-3" /></button>
                  <button type="button" onClick={() => movePortfolio(idx, 1)} className="p-2 border rounded"><ArrowDown className="h-3 w-3" /></button>
                  <button type="button" onClick={async () => { if (!confirm("Remover item?")) return; const result = await supabase.functions.invoke("drive-files", {body:{action:"team-remove-portfolio",id:item.id}}); if(result.error || !result.data?.ok) return alert("Falha ao remover item."); if (resolvedId) loadPortfolio(resolvedId); }} className="p-2 border rounded text-red-600"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
              {portfolio.length === 0 && <p className="text-xs text-muted-foreground">Sem itens no portfólio.</p>}
            </div>
          </div>
          )}

          {!isSelfMode && (
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Acesso ao Painel</h3>
            <input type="email" {...register("email_login")} className="w-full h-10 px-3 rounded-md border" placeholder="email@dominio.com" />
            <input type="password" {...register("senha_login")} className="w-full h-10 px-3 rounded-md border" placeholder="Senha (opcional na edição)" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("permissoes.admin")} />Admin</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("permissoes.editor")} />Editor</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("permissoes.autor")} />Autor</label>
          </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Publicação</h3>
            {!isSelfMode && <label className="flex items-center justify-between text-sm">Ativo <input type="checkbox" {...register("ativo")} /></label>}
            <label className="flex items-center justify-between text-sm">Publicar perfil <input type="checkbox" {...register("is_public")} /></label>
            {!isSelfMode && <input type="number" min={1} {...register("order_index", { setValueAs: (value) => (value === "" || value == null ? undefined : Number(value)), validate: (value) => value == null || (Number.isInteger(value) && value >= 1) || "Ordem deve ser um inteiro >= 1" })} className="w-full h-10 px-3 rounded-md border" placeholder="Ordem" />}
            {!isSelfMode && errors.order_index && <span className="text-destructive text-xs">{errors.order_index.message}</span>}
            <a href={`/equipe/${watch("slug") || ""}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Abrir perfil público</a>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Avatar</h3>
            <label className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center text-center cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePickFile(e.target.files?.[0])} />
              <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm">{uploading ? "Enviando..." : "Clique para upload"}</p>
            </label>
            {(avatarPreviewUrl || savedAvatarPreviewUrl || fotoUrl) && <TeamAvatarImage src={avatarPreviewUrl || savedAvatarPreviewUrl || fotoUrl} fileId={avatarPreviewUrl?null:avatarFileId} alt="Prévia" className="w-full h-48 object-cover rounded-md border" />}
            {(avatarPreviewUrl || savedAvatarPreviewUrl || fotoUrl) && <button type="button" className="text-xs text-red-600" onClick={() => { setRemoveAvatar(true); setPendingAvatarFile(null); if (avatarPreviewUrl) { URL.revokeObjectURL(avatarPreviewUrl); setAvatarPreviewUrl(null); } setSavedAvatarPreviewUrl(""); setValue("foto_url", "", { shouldDirty: true }); }}>Remover avatar</button>}
            <input {...register("foto_url")} className="w-full h-10 px-3 rounded-md border" readOnly placeholder="O avatar deve ser enviado pelo upload acima" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AddPortfolioItem({ onAdd }: { onAdd: (params: { kind: "image" | "video" | "pdf" | "link"; title: string; description: string; file?: File | null; externalUrl?: string }) => Promise<void> }) {
  const [kind, setKind] = useState<"image" | "video" | "pdf" | "link">("image");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const accepts = kind === "image" ? "image/*" : kind === "video" ? "video/*" : ".pdf,application/pdf";

  return (
    <div className="border rounded-md p-3 space-y-2">
      <p className="font-medium text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Adicionar item</p>
      <select value={kind} onChange={(e) => { setKind(e.target.value as any); setFile(null); }} className="w-full h-10 px-3 rounded-md border">
        <option value="image">Imagem</option>
        <option value="video">Vídeo</option>
        <option value="pdf">PDF</option>
        <option value="link">Link externo</option>
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="w-full h-10 px-3 rounded-md border" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="w-full min-h-[70px] p-3 rounded-md border" />
      {kind === "link" ? (
        <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." className="w-full h-10 px-3 rounded-md border" />
      ) : (
        <input key={kind} type="file" accept={accepts} onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
      )}
      <button
        type="button"
        disabled={(kind === "link" ? !externalUrl.trim() : !file) || saving}
        onClick={async () => {
          setSaving(true);
          await onAdd({ kind, title, description, file, externalUrl });
          setTitle("");
          setDescription("");
          setExternalUrl("");
          setFile(null);
          setSaving(false);
        }}
        className="px-3 py-2 text-sm rounded bg-primary text-primary-foreground"
      >
        {saving ? "Salvando..." : "Adicionar"}
      </button>
    </div>
  );
}
