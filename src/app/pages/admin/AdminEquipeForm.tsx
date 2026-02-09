import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

const BUCKET = "site";

type FormData = {
  nome: string;
  cargo: string;
  bio: string;
  instagram: string;
  ativo: boolean;
  ordem: number;
  foto_url: string;

  // login/permissões (somente admin_alfa usa)
  email_login: string;
  senha_login: string;
  permissoes: {
    admin: boolean;
    editor: boolean;
    autor: boolean;
  };
};

async function uploadEquipeFoto(file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `equipe/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function AdminEquipeForm() {
  const { id } = useParams();
  const isEditing = !!id && id !== "novo";
  const navigate = useNavigate();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormData>({
      defaultValues: {
        nome: "",
        cargo: "",
        bio: "",
        instagram: "",
        ativo: true,
        ordem: 0,
        foto_url: "",
        email_login: "",
        senha_login: "",
        permissoes: { admin: false, editor: true, autor: true },
      },
    });

  const foto_url = watch("foto_url");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isEditing || !id) return;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("equipe")
        .select("nome, cargo, bio, instagram, ativo, ordem, foto_url, email_login")
        .eq("id", id)
        .single();

      setLoading(false);

      if (error || !data) {
        alert(error?.message || "Não foi possível carregar o membro.");
        return;
      }

      reset({
        nome: data.nome || "",
        cargo: data.cargo || "",
        bio: data.bio || "",
        instagram: data.instagram || "",
        ativo: !!data.ativo,
        ordem: data.ordem ?? 0,
        foto_url: data.foto_url || "",
        email_login: data.email_login || "",
        senha_login: "",
        permissoes: { admin: false, editor: true, autor: true },
      });
    })();
  }, [id, isEditing, reset]);

  const handlePickFile = async (file?: File | null) => {
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadEquipeFoto(file);
      setValue("foto_url", url, { shouldDirty: true });
    } catch (e: any) {
      alert(e?.message || "Erro no upload da foto.");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (v: FormData) => {
    setLoading(true);

    try {
      // 1) salva/atualiza perfil público da equipe
      const payload = {
        nome: v.nome,
        cargo: v.cargo || null,
        bio: v.bio || null,
        instagram: v.instagram || null,
        ativo: !!v.ativo,
        ordem: Number(v.ordem || 0),
        foto_url: v.foto_url || null,
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

      // 2) se admin_alfa preencheu email/senha, cria/atualiza usuário no Auth + roles
      const email = (v.email_login || "").trim();
const pass = (v.senha_login || "").trim();
const hasLogin = !!email && !!pass;

if (pass && pass.length > 0 && pass.length < 6) {
  throw new Error("A senha precisa ter no mínimo 6 caracteres.");
}

      if (hasLogin) {
        const roles: string[] = [];
        if (v.permissoes.admin) roles.push("admin");
        if (v.permissoes.editor) roles.push("editor");
        if (v.permissoes.autor) roles.push("autor");

        // fallback mínimo
        if (!roles.length) roles.push("autor");

        // IMPORTANTE: isso só funciona se a Edge Function estiver DEPLOYADA
        try {
          const { data, error } = await supabase.functions.invoke("admin-upsert-user", {
            body: {
              equipe_id: equipeId,
              email: v.email_login.trim(),
              password: v.senha_login.trim(),
              roles,
            },
          });

          if (error) throw error;
          if (data?.ok === false) throw new Error(data?.error || "Falha ao criar usuário.");
        } catch (err: any) {
          // mensagem bem mais clara que “Failed to send…”
          throw new Error(
            err?.message ||
              "Falha ao chamar Edge Function. Verifique se a função 'admin-upsert-user' está deployada e com CORS liberado."
          );
        }
      }

      navigate("/admin/equipe");
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar membro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/equipe" className="p-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditing ? "Editar Membro" : "Novo Membro"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isEditing ? "Atualize os dados do perfil público." : "Cadastre um novo perfil da equipe."}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate("/admin/equipe")}
            className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>

          <button
            onClick={handleSubmit(onSubmit)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm"
            disabled={loading}
          >
            <Save className="h-4 w-4" />
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Dados</h3>

            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <input
                {...register("nome", { required: "Nome é obrigatório" })}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
              {errors.nome && <span className="text-destructive text-xs">{errors.nome.message}</span>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cargo</label>
              <input
                {...register("cargo")}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Bio</label>
              <textarea
                {...register("bio")}
                className="w-full min-h-[160px] p-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Instagram</label>
              <input
                {...register("instagram")}
                placeholder="https://instagram.com/..."
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>

          {/* Acesso (admin_alfa) */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Acesso ao Painel</h3>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                {...register("email_login")}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="email@dominio.com"
              />
              <p className="text-xs text-muted-foreground">
                Se você preencher Email + Senha, o sistema cria/atualiza o usuário no Auth.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <input
                type="password"
                {...register("senha_login")}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Defina uma senha inicial"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Permissões</label>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("permissoes.admin")} />
                Admin (ver tudo do ADM)
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("permissoes.editor")} />
                Editor (matérias, projetos)
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("permissoes.autor")} />
                Autor (matérias)
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Publicação</h3>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Ativo</label>
              <input type="checkbox" {...register("ativo")} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ordem</label>
              <input
                type="number"
                {...register("ordem", { valueAsNumber: true })}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
              <p className="text-xs text-muted-foreground">Menor número aparece primeiro no Quem Somos.</p>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Foto</h3>

            <label className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer bg-muted/10">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePickFile(e.target.files?.[0])}
              />
              <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">{uploading ? "Enviando..." : "Clique para fazer upload"}</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG até 5MB</p>
            </label>

            {foto_url && (
              <div className="rounded-lg overflow-hidden border">
                <img src={foto_url} alt="Prévia" className="w-full h-48 object-cover" />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Ou URL</label>
              <input
                {...register("foto_url")}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
