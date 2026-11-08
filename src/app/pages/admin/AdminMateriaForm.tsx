import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Save, ArrowLeft, Image as ImageIcon, Trash2, ChevronUp, ChevronDown, Plus, Bold, Italic, Pilcrow, Heading2, Quote, Highlighter, Rows3, Eye, X, PenLine } from "lucide-react";
import {
  createMateria,
  createMateriaCategoria,
  getMateria,
  listMateriaCategoryNames,
  MateriaContentBlock,
  MateriaTextBlockType,
  slugify,
  updateMateria
} from "@/lib/cms";
import { supabase } from "@/lib/supabase";
import { YouTubeVideoPicker } from "./YouTubeVideoPicker";

type MateriaEditorSection = "principal" | "conteudo" | "publicacao" | "capa" | "banner" | "seo";

type EquipeOption = {
  id: string;
  nome: string;
  cargo?: string | null;
  order_index?: number | null;
  is_public?: boolean | null;
  is_active?: boolean | null;
  ativo?: boolean | null;
};

type MateriaFormData = {
  title: string;
  subtitle: string;
  authorId: string;
  category: string;
  date: string;
  content: string;
  coverImage: string;
  bannerImage: string;
  hashtags: string;
  audioUrl: string;
  photoCredits: string;
  customSlug: string;
  seoTitle: string;
  seoDescription: string;
  status: "published" | "draft" | "archived";
};

type MateriaInterview = {
  id: string;
  title: string;
  format: "text" | "youtube" | "audio";
  youtubeUrl: string;
  audioUrl?: string;
  audioDriveFileId?: string | null;
  transcript?: string;
  thumbnailUrl?: string;
  thumbnailDriveFileId?: string | null;
  questions: Array<{ question: string; answer: string }>;
};

type MateriaGaleriaItem = {
  id: string;
  materia_id: string;
  url: string;
  drive_file_id?: string | null;
  legenda: string | null;
  ordem: number | null;
  created_at?: string;
};

type TextBlock = Extract<MateriaContentBlock, { type: "paragraph" | "heading" | "quote" | "highlight" }>;
type BlockType = MateriaContentBlock["type"];

const blockStyles: Record<
  BlockType,
  {
    border: string;
    bg: string;
    badge: string;
    button: string;
  }
> = {
  paragraph: {
    border: "border-gray-300",
    bg: "bg-gray-50",
    badge: "bg-gray-200 text-gray-700",
    button: "bg-gray-100 hover:bg-gray-200",
  },
  heading: {
    border: "border-green-600",
    bg: "bg-green-50",
    badge: "bg-green-600 text-white",
    button: "bg-green-100 hover:bg-green-200",
  },
  quote: {
    border: "border-[#0F7A3E]",
    bg: "bg-[#0F7A3E]/5",
    badge: "bg-[#0F7A3E] text-white",
    button: "border-[#0F7A3E]/30 bg-[#0F7A3E]/10 text-[#0F7A3E] hover:bg-[#0F7A3E]/15",
  },
  highlight: {
    border: "border-[#F2B705]",
    bg: "bg-[#FDF8E5]",
    badge: "bg-[#F2B705] text-[#5f4b00]",
    button: "border-[#F2B705]/50 bg-[#FDF8E5] text-[#5f4b00] hover:bg-[#F2B705]/20",
  },
  image: {
    border: "border-blue-500",
    bg: "bg-blue-50",
    badge: "bg-blue-500 text-white",
    button: "bg-blue-100 hover:bg-blue-200",
  },
  "image-text": {
    border: "border-emerald-700",
    bg: "bg-emerald-50",
    badge: "bg-emerald-700 text-white",
    button: "bg-emerald-100 hover:bg-emerald-200",
  },
};

const blockTypeLabels: Record<BlockType, string> = {
  paragraph: "Parágrafo",
  heading: "Subtítulo",
  quote: "Citação",
  highlight: "Destaque",
  image: "Imagem",
  "image-text": "Imagem + Texto",
};

function safeFilename(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.\-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || `arquivo-${Date.now()}`
  );
}

function uid(prefix = "block") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeHashtags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => {
          const clean = tag.replace(/^#+/, "").replace(/\s+/g, "").toLowerCase();
          return clean ? `#${clean}` : "";
        })
        .filter(Boolean)
    )
  );
}

function normalizeBlocks(raw: any): MateriaContentBlock[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((block: any) => {
      if (!block || typeof block !== "object") return null;
      if (block.type === "image") {
        if (!block.url) return null;
        return {
          id: block.id || uid("img"),
          type: "image" as const,
          url: String(block.url),
          caption: block.caption ? String(block.caption) : "",
          credit: block.credit ? String(block.credit) : "",
          drive_file_id: block.drive_file_id ? String(block.drive_file_id) : undefined,
        };
      }

      if (block.type === "image-text") {
        return {
          id: block.id || uid("imgtxt"),
          type: "image-text" as const,
          url: String(block.url || ""),
          text: String(block.text || ""),
          caption: block.caption || "",
          credit: block.credit || "",
          drive_file_id: block.drive_file_id ? String(block.drive_file_id) : undefined,
          align: block.align === "right" ? "right" : "left",
          width: ["sm", "md", "lg"].includes(block.width) ? block.width : "md",
        };
      }

      if (["paragraph", "heading", "quote", "highlight"].includes(block.type)) {
        return {
          id: block.id || uid("txt"),
          type: block.type as TextBlock["type"],
          text: block.text ? String(block.text) : "",
          size: block.size === "sm" || block.size === "lg" ? block.size : "md",
          author: block.author ? String(block.author) : "",
        };
      }

      return null;
    })
    .filter(Boolean) as MateriaContentBlock[];
}

function buildLegacyHtml(blocks: MateriaContentBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "image") {
        const caption = block.caption ? `<figcaption>${block.caption}</figcaption>` : "";
        return `<figure><img src="${block.url}" alt="${block.caption || "Imagem da matéria"}"/>${caption}</figure>`;
      }
      if (block.type === "image-text") {
        const caption = block.caption ? `<figcaption>${block.caption}</figcaption>` : "";
        return `<section><figure><img src="${block.url}" alt="${block.caption || "Imagem da matéria"}"/>${caption}</figure><div>${block.text || ""}</div></section>`;
      }

      if (block.type === "heading") return `<h2>${block.text || ""}</h2>`;
      if (block.type === "quote") {
        const author = block.author ? `<cite>${block.author}</cite>` : "";
        return `<blockquote><p>${block.text || ""}</p>${author}</blockquote>`;
      }
      if (block.type === "highlight") return `<aside>${block.text || ""}</aside>`;
      return `<p>${block.text || ""}</p>`;
    })
    .join("\n");
}

async function makeCoverThumbnail(file: File): Promise<File | null> {
  // Safari may silently return a PNG when WebP encoding is unavailable.
  // A failed optional thumbnail must never block uploading the full cover.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    for (const maxSide of [640, 480, 360, 256]) {
      const scale = Math.min(1, maxSide / longest);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.72, 0.52, 0.35]) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/webp", quality));
        if (!blob || blob.type !== "image/webp" || !blob.size ||
            blob.size > 1024 * 1024) continue;
        const signature = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
        const webp = String.fromCharCode(...signature.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
        if (webp) return new File([blob], "capa-thumb.webp", { type: "image/webp" });
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}

async function uploadToDrive(params: {
  materiaId?: string;
  category: "cover" | "banner" | "content" | "gallery" | "audio";
  folder: string;
  file: File;
  thumbnailFile?: File;
  timeoutMs?: number;
}) {
  const { materiaId, category, file, thumbnailFile, timeoutMs } = params;
  if (!materiaId) throw new Error("Salve a matéria como rascunho antes de enviar arquivos.");
  const form = new FormData();
  form.set("module", "materias");
  form.set("materia_id", materiaId);
  form.set("category", category);
  form.set("file", file, safeFilename(file.name));
  if (thumbnailFile) form.set("thumbnail", thumbnailFile, "capa-thumb.webp");
  const request = supabase.functions.invoke("drive-files", { body: form });
  const result = await (timeoutMs ? Promise.race([
    request,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("O envio ao Drive demorou mais que o esperado. Tente novamente.")), timeoutMs)),
  ]) : request);
  const payload = result.data as any;
  if (result.error || payload?.ok === false) {
    const response = (result.error as any)?.context;
    let detail = payload?.error || "";
    if (!detail && response instanceof Response) { try { detail = (await response.clone().json())?.error || ""; } catch { /* response has no JSON */ } }
    throw new Error(detail || result.error?.message || "Falha ao enviar arquivo para o Drive.");
  }
  const record = payload?.file;
  if (!record?.id || !record?.url) throw new Error("O Drive não confirmou o arquivo enviado.");
  return {
    publicUrl: record.url as string,
    path: record.id as string,
    id: record.id as string,
    thumbnail: record.thumbnail?.id && record.thumbnail?.url ? { id: record.thumbnail.id as string, publicUrl: record.thumbnail.url as string } : null,
  };
}

async function ensureUniqueMateriaSlug(baseSlug: string, currentId?: string) {
  let slug = baseSlug || `materia-${Date.now()}`;
  let i = 1;

  while (true) {
    const { data, error } = await supabase
      .from("materias")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return slug;
    if (currentId && data[0]?.id === currentId) return slug;

    i += 1;
    slug = `${baseSlug}-${i}`;
  }
}

export function AdminMateriaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    reset,
    setValue,
    watch,
  } = useForm<MateriaFormData>({
    defaultValues: {
      status: "draft",
      date: today,
      title: "",
      subtitle: "",
      authorId: "",
      category: "",
      content: "",
      coverImage: "",
      bannerImage: "",
      hashtags: "",
      audioUrl: "",
      photoCredits: "",
      customSlug: "",
      seoTitle: "",
      seoDescription: "",
    },
  });

  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewInterviewId, setPreviewInterviewId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [previewEditField, setPreviewEditField] = useState<string | null>(null);
  const [previewImageField, setPreviewImageField] = useState<"coverImage" | "bannerImage">("bannerImage");
  const [equipe, setEquipe] = useState<EquipeOption[]>([]);
  const [loadingEquipe, setLoadingEquipe] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [coverDriveFileId, setCoverDriveFileId] = useState<string | null>(null);
  const [coverThumbDriveFileId, setCoverThumbDriveFileId] = useState<string | null>(null);
  const [coverThumbUrl, setCoverThumbUrl] = useState<string | null>(null);
  const [bannerDriveFileId, setBannerDriveFileId] = useState<string | null>(null);
  const [audioDriveFileId, setAudioDriveFileId] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [selectedAudioFileName, setSelectedAudioFileName] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  const [galeria, setGaleria] = useState<MateriaGaleriaItem[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const [blocks, setBlocks] = useState<MateriaContentBlock[]>([]);
  const [interviews, setInterviews] = useState<MateriaInterview[]>([]);
  const originalBlocks = useRef<MateriaContentBlock[]>([]);
  const originalInterviews = useRef<MateriaInterview[]>([]);
  const [activeBlock, setActiveBlock] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState<"materia" | "entrevistas">("materia");
  const [editorMode, setEditorMode] = useState<"traditional" | "preview">("traditional");
  const [uploadingInterviewAudioId, setUploadingInterviewAudioId] = useState<string | null>(null);
  const [uploadingInterviewCoverId, setUploadingInterviewCoverId] = useState<string | null>(null);
  // Mantém os campos montados enquanto a seção fica recolhida, preservando o formulário.
  const [expandedSections, setExpandedSections] = useState<Record<MateriaEditorSection, boolean>>({
    principal: true,
    conteudo: !isEditing,
    publicacao: !isEditing,
    capa: false,
    banner: false,
    seo: false,
  });

  function toggleSection(section: MateriaEditorSection) {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function goToSection(section: MateriaEditorSection) {
    if (section === "conteudo") setActiveTab("materia");
    setExpandedSections((current) => ({ ...current, [section]: true }));
    requestAnimationFrame(() => {
      document.getElementById(section === "conteudo" ? "materia-panel" : `materia-section-${section}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }
  const [uploadingBlockImageId, setUploadingBlockImageId] = useState<string | null>(null);
  // Local, low-resolution thumbnails are presentation-only; never saved as CMS URLs.
  const [blockPreviews, setBlockPreviews] = useState<Record<string, string>>({});
  const previewObjects = useRef(new Set<string>());
  useEffect(() => () => {
    previewObjects.current.forEach((url) => URL.revokeObjectURL(url));
    previewObjects.current.clear();
  }, []);

  async function makeBlockPreview(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    try {
      const ratio = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Sem contexto de imagem");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const thumb = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Miniatura indisponível")), "image/webp", 0.68));
      const url = URL.createObjectURL(thumb);
      previewObjects.current.add(url);
      return url;
    } finally {
      bitmap.close();
    }
  }

  function clearBlockPreview(blockId: string) {
    setBlockPreviews((current) => {
      const url = current[blockId];
      if (url) {
        URL.revokeObjectURL(url);
        previewObjects.current.delete(url);
      }
      const next = { ...current };
      delete next[blockId];
      return next;
    });
  }
  const [forceRender, setForceRender] = useState(0);
  const isMounted = useRef(true);
  const cleanupCandidateIds = useRef(new Set<string>());

  const coverUrl = watch("coverImage");
  const bannerUrl = watch("bannerImage");
  const selectedAuthorId = watch("authorId");
  const selectedCategory = watch("category");

  const coverInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const canUseGallery = useMemo(() => !!id, [id]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isMounted.current) {
        setForceRender((prev) => prev + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await listMateriaCategoryNames();
      const options = data || [];
      setCategoryOptions(options);
      if (!watch("category") && options.length > 0) {
        setValue("category", options[0], { shouldDirty: false });
      }
    })();
  }, [setValue, watch]);

  useEffect(() => {
    (async () => {
      setLoadingEquipe(true);

      const detailedQuery = supabase
        .from("equipe")
        .select("id, nome, cargo, order_index")
        .order("order_index", { ascending: true })
        .order("nome", { ascending: true });

      const { data: detailedData, error: detailedError } = await detailedQuery;

      if (!detailedError) {
        setEquipe((detailedData || []) as EquipeOption[]);
        setLoadingEquipe(false);
        return;
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("equipe")
        .select("id, nome, cargo")
        .order("nome", { ascending: true });

      if (fallbackError) {
        alert(`Não foi possível carregar os integrantes da equipe. ${fallbackError.message}`);
        setEquipe([]);
        setLoadingEquipe(false);
        return;
      }

      setEquipe((fallbackData || []) as EquipeOption[]);
      setLoadingEquipe(false);
    })();
  }, []);

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      const { data, error } = await getMateria(id);
      setLoading(false);

      if (error || !data) {
        alert(error?.message || "Não foi possível carregar a matéria.");
        return;
      }

      const d: any = data;
      const rawContentBlocks = d.content_blocks || d.contentBlocks;
      const parsedBlocks = normalizeBlocks(rawContentBlocks);
      const interviewCollection = Array.isArray(rawContentBlocks)
        ? rawContentBlocks.find((block: any) => block?.type === "interview_collection")
        : null;
      setInterviews(Array.isArray(interviewCollection?.interviews) ? interviewCollection.interviews.map((interview: any) => ({
        ...interview,
        format: interview.format === "youtube" || interview.format === "audio" ? interview.format : "text",
        youtubeUrl: interview.youtubeUrl || "",
        audioUrl: interview.audioUrl || "",
        audioDriveFileId: interview.audioDriveFileId || null,
        transcript: interview.transcript || "",
        thumbnailUrl: interview.thumbnailUrl || "",
        thumbnailDriveFileId: interview.thumbnailDriveFileId || null,
        questions: Array.isArray(interview.questions) ? interview.questions : [{ question: "", answer: "" }],
      })) : []);
      originalInterviews.current = Array.isArray(interviewCollection?.interviews) ? interviewCollection.interviews.map((interview: any) => ({
        ...interview,
        format: interview.format === "youtube" || interview.format === "audio" ? interview.format : "text",
        youtubeUrl: interview.youtubeUrl || "",
        audioUrl: interview.audioUrl || "",
        audioDriveFileId: interview.audioDriveFileId || null,
        transcript: interview.transcript || "",
        thumbnailUrl: interview.thumbnailUrl || "",
        thumbnailDriveFileId: interview.thumbnailDriveFileId || null,
        questions: Array.isArray(interview.questions) ? interview.questions : [{ question: "", answer: "" }],
      })) : [];

      [d.capa_drive_file_id, d.capa_thumb_drive_file_id, d.banner_drive_file_id, d.audio_drive_file_id,
        ...(Array.isArray(interviewCollection?.interviews) ? interviewCollection.interviews.flatMap((item: any) => [item?.audioDriveFileId, item?.thumbnailDriveFileId]) : []),
        ...parsedBlocks.map((block: any) => block.drive_file_id)]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .forEach((value) => cleanupCandidateIds.current.add(value));

      setBlocks(parsedBlocks);
      originalBlocks.current = parsedBlocks;
      setCoverDriveFileId(d.capa_drive_file_id || null);
      setCoverThumbDriveFileId(d.capa_thumb_drive_file_id || null);
      setCoverThumbUrl(d.capa_thumb_url || null);
      setBannerDriveFileId(d.banner_drive_file_id || null);
      setAudioDriveFileId(d.audio_drive_file_id || null);
      reset({
        title: d.titulo || "",
        subtitle: d.resumo || "",
        authorId: d.autor_equipe_id || d.autor_id || "",
        category: (d.tags && d.tags[0]) ? d.tags[0] : (categoryOptions[0] || ""),
        date: (d.published_at ? new Date(d.published_at) : new Date(d.created_at)).toISOString().split("T")[0],
        content: d.conteudo || "",
        coverImage: d.capa_url || "",
        bannerImage: d.banner_url || "",
        status: d.status || "draft",
        hashtags: Array.isArray(d.hashtags) ? d.hashtags.join(", ") : "",
        audioUrl: d.audio_url || "",
        photoCredits: d.photo_credits || "",
        customSlug: d.slug || "",
        seoTitle: d.seo_title || "",
        seoDescription: d.seo_description || "",
      });

      await loadGaleria(id);
    })();
  }, [categoryOptions, id, reset]);

  async function loadGaleria(materiaId: string) {
    const { data, error } = await supabase
      .from("materia_galeria")
      .select("id, materia_id, url, drive_file_id, legenda, ordem, created_at")
      .eq("materia_id", materiaId)
      .order("ordem", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (error) {
      setGaleria([]);
      return;
    }

    (data || []).forEach((item: any) => { if (item.drive_file_id) cleanupCandidateIds.current.add(item.drive_file_id); });
    setGaleria((data || []) as MateriaGaleriaItem[]);
  }

  async function cleanupUnreferencedMateriaFiles(materiaId: string, driveFileIds = [...cleanupCandidateIds.current]) {
    const form = new FormData();
    form.set("module", "materias");
    form.set("action", "cleanup-unreferenced");
    form.set("materia_id", materiaId);
    form.set("drive_file_ids", JSON.stringify(driveFileIds));
    const { data, error } = await supabase.functions.invoke("drive-files", { body: form });
    if (error || data?.ok === false) throw new Error(data?.error || error?.message || "A limpeza de arquivos substituídos ficou pendente.");
    if (data?.cleanup?.pending > 0) throw new Error(`${data.cleanup.pending} arquivo(s) ficou(ram) arquivado(s) enquanto o Drive tenta concluir a limpeza.`);
    return data?.cleanup;
  }

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      alert("Informe o nome da nova categoria.");
      return;
    }

    const duplicated = categoryOptions.some(
      (category) => category.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0
    );
    if (duplicated) {
      alert("Essa categoria já existe.");
      return;
    }

    setAddingCategory(true);
    try {
      const { data, error } = await createMateriaCategoria(name);
      if (error) {
        if ((error as any).code === "23505") {
          alert("Essa categoria já existe.");
          return;
        }
        if (/materia_categorias/i.test(error.message || "") && /does not exist/i.test(error.message || "")) {
          alert("A tabela de categorias ainda não existe. Execute o SQL de criação e tente novamente.");
          return;
        }
        alert(error.message || "Não foi possível criar a categoria.");
        return;
      }

      const nextName = data?.nome || name;
      const nextOptions = [...categoryOptions, nextName].sort((a, b) =>
        a.localeCompare(b, "pt-BR", { sensitivity: "base" })
      );
      setCategoryOptions(nextOptions);
      setValue("category", nextName, { shouldDirty: true, shouldValidate: true });
      setNewCategoryName("");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleGalleryFilesChange = async (files?: FileList | null) => {
    if (!id || !files || files.length === 0) return;

    setUploadingGallery(true);
    const uploadedIds: string[] = [];
    try {
      const baseOrder = galeria.length;

      for (let i = 0; i < files.length; i++) {
        const { publicUrl, id: driveFileId } = await uploadToDrive({
          materiaId: id,
          category: "gallery",
          folder: `galeria/${id}`,
          file: files[i],
        });
        uploadedIds.push(driveFileId);
        cleanupCandidateIds.current.add(driveFileId);

        const { error: insErr } = await supabase.from("materia_galeria").insert({
          materia_id: id,
          url: publicUrl,
          drive_file_id: driveFileId,
          legenda: null,
          ordem: baseOrder + i,
        });

        if (insErr) throw insErr;
      }

      await loadGaleria(id);
    } catch (err: any) {
      try { if (id && uploadedIds.length) await cleanupUnreferencedMateriaFiles(id, uploadedIds); } catch (cleanupError) { console.warn("[materia-drive] upload de galeria incompleto; limpeza pendente", cleanupError); }
      alert(err?.message || "Erro ao enviar imagem para a galeria.");
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const handleDeleteGalleryItem = async (itemId: string) => {
    if (!id) return;
    if (!confirm("Remover esta foto da galeria?")) return;

    const { error } = await supabase.from("materia_galeria").delete().eq("id", itemId);
    if (error) return alert(error.message);

    try {
      const removed = galeria.find((item) => item.id === itemId);
      await cleanupUnreferencedMateriaFiles(id, removed?.drive_file_id ? [removed.drive_file_id] : []);
    } catch (cleanupError: any) {
      console.warn("[materia-drive] galeria removida; limpeza Drive pendente", cleanupError);
      alert("A foto foi removida da matéria, mas a cópia substituída ainda precisa ser movida para a lixeira do Drive.");
    }

    await loadGaleria(id);
  };

  const handleCoverUpload = async (file?: File) => {
    if (!file) return;

    setUploadingCover(true);
    try {
      const uploaded = await uploadToDrive({
        materiaId: id,
        category: "cover",
        folder: "capas",
        file,
        thumbnailFile: (await makeCoverThumbnail(file)) || undefined,
      });
      setValue("coverImage", uploaded.publicUrl, { shouldDirty: true, shouldValidate: true });
      setCoverDriveFileId(uploaded.id);
      setCoverThumbDriveFileId(uploaded.thumbnail?.id || null);
      setCoverThumbUrl(uploaded.thumbnail?.publicUrl || null);
      cleanupCandidateIds.current.add(uploaded.id);
      if (uploaded.thumbnail?.id) cleanupCandidateIds.current.add(uploaded.thumbnail.id);
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar imagem de capa.");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleAudioUpload = async (file?: File) => {
    setUploadingAudio(true);
    try {
      setSelectedAudioFileName("");

      if (!file) {
        alert("Nenhum arquivo de áudio foi selecionado.");
        return;
      }

      const allowedAudioTypes = new Set([
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/ogg",
        "audio/mp4",
        "audio/x-m4a",
      ]);
      const maxAudioSizeBytes = 20 * 1024 * 1024;

      console.log("[audio-upload] Início do upload de áudio", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      if (!allowedAudioTypes.has(file.type)) {
        alert("Formato de áudio não suportado. Use MP3, WAV, OGG ou M4A.");
        return;
      }

      if (file.size > maxAudioSizeBytes) {
        alert("Arquivo muito grande. O tamanho máximo permitido é 20MB.");
        return;
      }

      setSelectedAudioFileName(file.name);

      const uploaded = await uploadToDrive({
        materiaId: id,
        category: "audio",
        folder: "audios",
        file,
        timeoutMs: 45000,
      });

      setValue("audioUrl", uploaded.publicUrl, { shouldDirty: true, shouldValidate: true });
      setAudioDriveFileId(uploaded.id);
      cleanupCandidateIds.current.add(uploaded.id);
    } catch (err: any) {
      console.error("[audio-upload] Erro no upload de áudio", err);
      setSelectedAudioFileName("");
      alert(err?.message || "Erro ao enviar áudio.");
    } finally {
      setUploadingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  };

  const handleInterviewCoverUpload = async (interviewId: string, file?: File) => {
    if (!file) return;
    if (!id) {
      alert("Salve a matéria como rascunho antes de enviar a capa da entrevista.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 10 MB.");
      return;
    }
    setUploadingInterviewCoverId(interviewId);
    try {
      const uploaded = await uploadToDrive({
        materiaId: id,
        category: "content",
        folder: `entrevistas/${interviewId}/capa`,
        file,
      });
      cleanupCandidateIds.current.add(uploaded.id);
      setInterviews((items) => items.map((item) => item.id === interviewId
        ? { ...item, thumbnailUrl: uploaded.publicUrl, thumbnailDriveFileId: uploaded.id }
        : item));
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar a capa da entrevista.");
    } finally {
      setUploadingInterviewCoverId(null);
    }
  };

  const handleInterviewAudioUpload = async (interviewId: string, file?: File) => {
    if (!file || !id) {
      alert("Salve a matéria como rascunho antes de anexar o áudio da entrevista.");
      return;
    }
    const allowedAudioTypes = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a"]);
    if (!allowedAudioTypes.has(file.type)) {
      alert("Formato de áudio não suportado. Use MP3, WAV, OGG ou M4A.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert("Arquivo muito grande. O tamanho máximo permitido é 20 MB.");
      return;
    }
    setUploadingInterviewAudioId(interviewId);
    try {
      const uploaded = await uploadToDrive({ materiaId: id, category: "audio", folder: `entrevistas/${interviewId}`, file, timeoutMs: 45000 });
      cleanupCandidateIds.current.add(uploaded.id);
      setInterviews((items) => items.map((item) => item.id === interviewId ? { ...item, format: "audio", audioUrl: uploaded.publicUrl, audioDriveFileId: uploaded.id } : item));
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar áudio da entrevista.");
    } finally {
      setUploadingInterviewAudioId(null);
    }
  };

  const handleBannerUpload = async (file?: File) => {
    if (!file) return;

    setUploadingBanner(true);
    try {
      const uploaded = await uploadToDrive({
        materiaId: id,
        category: "banner",
        folder: "banners",
        file,
      });

      setValue("bannerImage", uploaded.publicUrl, { shouldDirty: true, shouldValidate: true });
      setBannerDriveFileId(uploaded.id);
      cleanupCandidateIds.current.add(uploaded.id);
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar imagem de banner.");
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  const addBlock = (type: MateriaTextBlockType | "image" | "image-text", position = blocks.length) => {
    if (!isMounted.current) return;
    setBlocks((prev) => {
      if (!isMounted.current) return prev;
      let newBlock: MateriaContentBlock;

      if (type === "image") {
        newBlock = { id: uid("img"), type: "image", url: "", caption: "", credit: "" };
      } else if (type === "image-text") {
        newBlock = { id: uid("imgtxt"), type: "image-text", url: "", text: "", caption: "", credit: "", align: "left", width: "md" };
      } else {
        newBlock = { id: uid("txt"), type, text: "", size: "md", author: "" };
      }

      // Adicionar vários blocos deve ser rápido: não abre o novo bloco nem move a página.
      const next = [...prev];
      next.splice(Math.max(0, Math.min(position, next.length)), 0, newBlock);
      return next;
    });
  };

  const changeBlockType = (blockId: string, nextType: BlockType) => {
    if (!isMounted.current) return;

    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type === nextType) return block;

        const text = "text" in block ? block.text || "" : "";
        const url = "url" in block ? block.url || "" : "";
        const caption = "caption" in block ? block.caption || "" : "";
        const credit = "credit" in block ? block.credit || "" : "";
        const drive_file_id = "drive_file_id" in block ? block.drive_file_id : undefined;

        if (nextType === "image") {
          return { id: block.id, type: "image", url, caption, credit, drive_file_id };
        }

        if (nextType === "image-text") {
          return {
            id: block.id,
            type: "image-text",
            drive_file_id,
            url,
            text,
            caption,
            credit,
            align: block.type === "image-text" ? block.align : "left",
            width: block.type === "image-text" ? block.width : "md",
          };
        }

        return {
          id: block.id,
          type: nextType,
          text,
          size: "size" in block ? block.size || "md" : "md",
          author: nextType === "quote" && "author" in block ? block.author || "" : "",
        };
      })
    );
  };

  const updateBlock = (id: string, patch: Partial<MateriaContentBlock>) => {
    if (!isMounted.current) return;
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } as MateriaContentBlock : b)));
  };

  const removeBlock = (blockId: string) => {
    if (!isMounted.current) return;
    setBlocks((prev) => {
      if (!isMounted.current) return prev;
      const removedIndex = prev.findIndex((b) => b.id === blockId);
      if (removedIndex === -1 || !prev || !prev[removedIndex]) return prev;
      const next = prev.filter((b) => b.id !== blockId);

      if (isMounted.current) {
        setActiveBlock((current) => {
          if (current === null || current === -1 || removedIndex === -1) return current;
          if (current === removedIndex) return next.length ? Math.min(removedIndex, next.length - 1) : null;
          if (current > removedIndex) return current - 1;
          return current;
        });
      }

      return next;
    });
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    if (!isMounted.current) return;
    setBlocks((prev) => {
      if (!isMounted.current) return prev;
      if (!prev || !prev[index]) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const clone = [...prev];
      const [item] = clone.splice(index, 1);
      clone.splice(target, 0, item);
      return clone;
    });
  };

  const moveBlockTo = (blockId: string, position: number) => {
    if (!Number.isInteger(position)) return;
    setBlocks(prev => {
      const from = prev.findIndex(b => b.id === blockId);
      if (from < 0 || position < 1 || position > prev.length) return prev;
      const result = [...prev];
      const [item] = result.splice(from, 1);
      result.splice(position - 1, 0, item);
      return result;
    });
    setActiveBlock(null);
  };
  const handleUploadBlockImage = async (blockId: string, file?: File) => {
    if (!file) return;

    setUploadingBlockImageId(blockId);
    // Preview is generated from the selected file, independently of Drive latency.
    try {
      const preview = await makeBlockPreview(file).catch(() => null);
      if (preview) {
        setBlockPreviews((current) => {
          const old = current[blockId];
          if (old) { URL.revokeObjectURL(old); previewObjects.current.delete(old); }
          return { ...current, [blockId]: preview };
        });
      }
      const uploaded = await uploadToDrive({
        materiaId: id,
        category: "content",
        folder: `blocos/${id || "draft"}`,
        file,
      });
      updateBlock(blockId, { url: uploaded.publicUrl, drive_file_id: uploaded.id });
      cleanupCandidateIds.current.add(uploaded.id);
    } catch (err: any) {
      clearBlockPreview(blockId);
      alert(err?.message || "Erro ao enviar imagem do bloco.");
    } finally {
      setUploadingBlockImageId(null);
    }
  };

  const applyInlineTag = (blockId: string, tag: "strong" | "em") => {
    const el = document.getElementById(`block-text-${blockId}`) as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = el.value || "";
    const selected = value.slice(start, end) || "texto";
    const wrapped = `<${tag}>${selected}</${tag}>`;
    const next = `${value.slice(0, start)}${wrapped}${value.slice(end)}`;
    updateBlock(blockId, { text: next });
  };

  const submitWithCompat = async (payload: any) => {
    const response = isEditing && id
      ? await updateMateria(id, payload)
      : await createMateria(payload);

    if (!response.error) return response;

    if (!/column .* does not exist/i.test(response.error.message || "")) return response;

    const { content_blocks, hashtags, audio_url, banner_url, photo_credits, ...legacyPayload } = payload;
    return isEditing && id
      ? await updateMateria(id, legacyPayload)
      : await createMateria(legacyPayload);
  };

  const onSubmit = async (data: MateriaFormData) => {
    setSaveMessage("");
    setLoading(true);
    try {
      const tags = data.category ? [data.category] : [];
      const baseSlug = slugify(data.customSlug.trim() || data.title);
      const uniqueSlug = await ensureUniqueMateriaSlug(baseSlug, id);
      const autor = equipe.find((p) => p.id === data.authorId);
      const autor_nome = autor?.nome || null;

      const sanitizedBlocks = normalizeBlocks(blocks);
      const legacyContent = sanitizedBlocks.length > 0 ? buildLegacyHtml(sanitizedBlocks) : (data.content || null);

      const payload: any = {
        titulo: data.title,
        slug: uniqueSlug,
        resumo: data.subtitle || null,
        seo_title: data.seoTitle.trim() || null,
        seo_description: data.seoDescription.trim() || null,
        conteudo: legacyContent,
        content_blocks: sanitizedBlocks.length || interviews.length
          ? [...sanitizedBlocks, ...(interviews.length ? [{ type: "interview_collection", interviews }] : [])]
          : null,
        hashtags: normalizeHashtags(data.hashtags),
        audio_url: data.audioUrl || null,
        photo_credits: data.photoCredits || null,
        capa_url: data.coverImage || null,
        capa_drive_file_id: coverDriveFileId,
        capa_thumb_drive_file_id: coverThumbDriveFileId,
        capa_thumb_url: coverThumbUrl,
        banner_url: data.bannerImage || null,
        banner_drive_file_id: bannerDriveFileId,
        audio_drive_file_id: audioDriveFileId,
        tags,
        status: data.status,
        published_at: data.status === "published" ? new Date(data.date).toISOString() : null,
        autor_equipe_id: data.authorId || null,
        autor_id: data.authorId || null,
        autor_nome,
      };

      let payloadToSave = payload;
      if (isEditing) {
        const partial: Record<string, unknown> = {};
        if (dirtyFields.title) partial.titulo = payload.titulo;
        if (dirtyFields.subtitle) partial.resumo = payload.resumo;
        if (dirtyFields.seoTitle) partial.seo_title = payload.seo_title;
        if (dirtyFields.seoDescription) partial.seo_description = payload.seo_description;
        if (dirtyFields.title || dirtyFields.customSlug) partial.slug = payload.slug;
        const blocksChanged = JSON.stringify(sanitizedBlocks) !== JSON.stringify(originalBlocks.current);
        const interviewsChanged = JSON.stringify(interviews) !== JSON.stringify(originalInterviews.current);
        if (dirtyFields.content || blocksChanged || interviewsChanged) {
          partial.conteudo = legacyContent;
          partial.content_blocks = payload.content_blocks;
        }
        if (dirtyFields.hashtags) partial.hashtags = payload.hashtags;
        if (dirtyFields.audioUrl) {
          partial.audio_url = payload.audio_url;
          partial.audio_drive_file_id = payload.audio_drive_file_id;
        }
        if (dirtyFields.photoCredits) partial.photo_credits = payload.photo_credits;
        if (dirtyFields.coverImage) {
          partial.capa_url = payload.capa_url;
          partial.capa_drive_file_id = payload.capa_drive_file_id;
          partial.capa_thumb_drive_file_id = payload.capa_thumb_drive_file_id;
          partial.capa_thumb_url = payload.capa_thumb_url;
        }
        if (dirtyFields.bannerImage) {
          partial.banner_url = payload.banner_url;
          partial.banner_drive_file_id = payload.banner_drive_file_id;
        }
        if (dirtyFields.authorId) {
          partial.autor_equipe_id = payload.autor_equipe_id;
          partial.autor_id = payload.autor_id;
          partial.autor_nome = payload.autor_nome;
        }
        if (dirtyFields.category) partial.tags = payload.tags;
        if (dirtyFields.status || dirtyFields.date) {
          partial.status = payload.status;
          partial.published_at = payload.published_at;
        }
        payloadToSave = partial;
      }

      const res = Object.keys(payloadToSave).length > 0
        ? await submitWithCompat(payloadToSave)
        : { data: { id }, error: null };
      if (res.error) return alert(res.error.message);

      const savedId = res.data?.id || id;
      if (savedId) {
        try {
          await cleanupUnreferencedMateriaFiles(savedId, [...cleanupCandidateIds.current]);
        } catch (cleanupError: any) {
          console.warn("[materia-drive] matéria salva; limpeza Drive pendente", cleanupError);
          alert("A matéria foi salva. A limpeza de arquivos substituídos ficou pendente e será retomada ao salvar novamente.");
        }
      }

      originalBlocks.current = sanitizedBlocks;
      originalInterviews.current = interviews;
      if (isEditing) reset(data);

      if (!id && savedId) {
        navigate(`/admin/materias/editar/${savedId}`, { replace: true });
      }
      setSaveMessage("Matéria salva com sucesso.");
    } catch (err: any) {
      alert(err?.message || "Erro ao salvar matéria.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div key={forceRender} className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/materias" className="p-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{isEditing ? "Editar Matéria" : "Nova Matéria"}</h1>
            <p className="text-muted-foreground text-sm">
              {isEditing ? "Atualize os detalhes da publicação." : "Preencha os campos para criar uma nova publicação."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" aria-pressed={editorMode === "traditional"} onClick={() => { setEditorMode("traditional"); setShowPreview(false); }} className={`px-3 py-2 text-sm font-medium border rounded-md transition-colors ${editorMode === "traditional" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} disabled={loading}>Editor tradicional</button>
          <button type="button" aria-pressed={editorMode === "preview"} onClick={() => { setEditorMode("preview"); setPreviewInterviewId(null); setShowPreview(true); }} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md transition-colors ${editorMode === "preview" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} disabled={loading}>
            <Eye className="h-4 w-4" /> Editor com prévia
          </button>
          <button type="button" onClick={async () => { if (id) { try { await cleanupUnreferencedMateriaFiles(id); } catch (cleanupError) { console.warn("[materia-drive] cancelamento com limpeza pendente", cleanupError); } } navigate("/admin/materias"); }} className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors" disabled={loading}>Cancelar</button>
          <button type="button" onClick={handleSubmit(onSubmit)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm" disabled={loading}>
            <Save className="h-4 w-4" />
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {saveMessage && (
        <p role="status" aria-live="polite" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {saveMessage}
        </p>
      )}

      <nav aria-label="Acesso rápido às seções da matéria" className="sticky top-2 z-20 rounded-xl border bg-background/95 backdrop-blur shadow-sm px-3 py-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <span className="text-xs font-medium text-muted-foreground mr-1">Ir para:</span>
        {([
          ["principal", "Informações"],
          ["conteudo", "Conteúdo"],
          ["publicacao", "Publicação"],
          ["capa", "Capa"],
          ["banner", "Banner"],
          ["seo", "SEO"],
        ] as const).map(([section, label]) => (
          <button
            key={section}
            type="button"
            onClick={() => goToSection(section)}
            className="shrink-0 px-3 py-1.5 rounded-md border bg-card text-xs font-medium hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div id="materia-section-principal" className="bg-card border rounded-xl p-6 shadow-sm space-y-4 scroll-mt-24">
            <button type="button" aria-expanded={expandedSections.principal} aria-controls="materia-principal-body" onClick={() => toggleSection("principal")} className="flex w-full items-center justify-between gap-2 text-left border-b pb-4">
              <span className="font-semibold text-lg">Informações Principais</span>
              {expandedSections.principal ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
            </button>
            <div id="materia-principal-body" hidden={!expandedSections.principal} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <input {...register("title", { required: "Título é obrigatório" })} className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" placeholder="Digite o título da matéria" />
              {errors.title && <span className="text-destructive text-xs">{errors.title.message}</span>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subtítulo (Linha fina)</label>
              <textarea {...register("subtitle")} className="w-full h-20 p-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none" placeholder="Um breve resumo que aparece abaixo do título" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Publicação</label>
                <input type="date" {...register("date")} className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
              </div>
            </div>
            </div>
          </div>

          <div className="tabs-menu grid grid-cols-2 gap-2 mb-2" role="tablist" aria-label="Seções da edição da matéria">
            <button
              type="button"
              role="tab"
              id="materia-tab"
              aria-controls="materia-panel"
              aria-selected={activeTab === "materia"}
              className={`px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === "materia" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
              onClick={() => setActiveTab("materia")}
            >
              Matéria
            </button>
            <button
              type="button"
              role="tab"
              id="entrevistas-tab"
              aria-controls="entrevistas-panel"
              aria-selected={activeTab === "entrevistas"}
              className={`px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === "entrevistas" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
              onClick={() => setActiveTab("entrevistas")}
            >
              Entrevistas {interviews.length > 0 ? `(${interviews.length})` : ""}
            </button>
          </div>

          {activeTab === "materia" && (
          <div id="materia-panel" role="tabpanel" aria-labelledby="materia-tab" className="bg-card border rounded-xl p-6 shadow-sm space-y-4 scroll-mt-24">
            <button type="button" aria-expanded={expandedSections.conteudo} aria-controls="materia-conteudo-body" onClick={() => toggleSection("conteudo")} className="flex w-full items-center justify-between gap-3 text-left border-b pb-4">
              <span>
                <span className="block font-semibold text-lg">Conteúdo da Matéria</span>
                <span className="block text-xs text-muted-foreground">{blocks.length} {blocks.length === 1 ? "bloco" : "blocos"} · clique para {expandedSections.conteudo ? "recolher" : "expandir"}</span>
              </span>
              {expandedSections.conteudo ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
            </button>
            <div id="materia-conteudo-body" hidden={!expandedSections.conteudo} className="space-y-4">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h3 className="font-semibold text-lg">Conteúdo em blocos</h3>
                <p className="text-xs text-muted-foreground mt-1">As cores abaixo reproduzem a linguagem visual usada na matéria publicada.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" title="Texto corrido da matéria" onClick={() => addBlock("paragraph")} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${blockStyles.paragraph.button}`}><Pilcrow className="w-3.5 h-3.5" /> Parágrafo</button>
                <button type="button" title="Título de seção em verde RKC" onClick={() => addBlock("heading")} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${blockStyles.heading.button}`}><Heading2 className="w-3.5 h-3.5" /> Subtítulo</button>
                <button type="button" title="Citação com barra verde e autor/fonte opcional" onClick={() => addBlock("quote")} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${blockStyles.quote.button}`}><Quote className="w-3.5 h-3.5" /> Citação</button>
                <button type="button" title="Caixa amarela para uma informação importante" onClick={() => addBlock("highlight")} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${blockStyles.highlight.button}`}><Highlighter className="w-3.5 h-3.5" /> Destaque</button>
                <button type="button" title="Imagem em largura completa" onClick={() => addBlock("image")} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${blockStyles.image.button}`}><ImageIcon className="w-3.5 h-3.5" /> Imagem</button>
                <button type="button" title="Composição de imagem ao lado do texto" onClick={() => addBlock("image-text")} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${blockStyles["image-text"].button}`}><Rows3 className="w-3.5 h-3.5" /> Imagem + Texto</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
                <span className="font-semibold text-[#0F7A3E]">Subtítulo</span>
                <span className="text-muted-foreground"> · título de seção verde</span>
              </div>
              <div className="rounded-md border-l-4 border-[#0F7A3E] bg-[#0F7A3E]/5 px-3 py-2">
                <span className="font-semibold text-[#0F7A3E]">Citação</span>
                <span className="text-muted-foreground"> · barra verde</span>
              </div>
              <div className="rounded-md border-l-4 border-[#F2B705] bg-[#FDF8E5] px-3 py-2">
                <span className="font-semibold text-[#5f4b00]">Destaque</span>
                <span className="text-[#5f4b00]/75"> · caixa amarela</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setActiveBlock(null)} className="px-3 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors">
                Recolher todos
              </button>
              <button type="button" onClick={() => setActiveBlock(-1)} className="px-3 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors">
                Expandir todos
              </button>
            </div>

            {blocks.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-sm text-muted-foreground">
                Nenhum bloco ainda. Use os botões acima para montar a matéria em formato de blog.
              </div>
            ) : (
              <div className="space-y-4">
                {blocks.map((block, index) => {
                  const isExpanded = activeBlock === -1 || activeBlock === index;
                  const isActive = activeBlock === index;
                  return (
                  <div
                    key={block.id}
                    id={`block-${index}`}
                    className={`rounded-lg border-2 transition-colors ${blockStyles[block.type].border} ${blockStyles[block.type].bg} ${isActive ? "ring-2 ring-primary/30" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2 p-4 cursor-pointer" onClick={() => setActiveBlock(isActive ? null : index)}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
                        <div className={`text-xs px-2 py-1 rounded font-medium ${blockStyles[block.type].badge}`}>
                          Bloco {index + 1} · {blockTypeLabels[block.type]}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <label className="sr-only" htmlFor={`block-type-${block.id}`}>Alterar tipo do bloco {index + 1}</label>
                        <select
                          id={`block-type-${block.id}`}
                          value={block.type}
                          onChange={(e) => changeBlockType(block.id, e.target.value as BlockType)}
                          className="h-8 max-w-[150px] rounded border bg-background px-2 text-xs"
                          title="Alterar tipo deste bloco"
                        >
                          {(Object.keys(blockTypeLabels) as BlockType[]).map((type) => (
                            <option key={type} value={type}>{blockTypeLabels[type]}</option>
                          ))}
                        </select>
                        <input key={`${block.id}-${index}`} type="number" min={1} max={blocks.length} defaultValue={index + 1} aria-label={`Mover bloco ${index + 1} para posição`} title="Digite a posição e pressione Enter" className="h-8 w-14 rounded border bg-background text-center text-xs" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); moveBlockTo(block.id, Number(e.currentTarget.value)); } }} onBlur={(e) => {if(Number(e.currentTarget.value)!==index+1)moveBlockTo(block.id,Number(e.currentTarget.value));}} />
                        <button type="button" className="p-1 rounded border hover:bg-destructive/10" onClick={() => removeBlock(block.id)}><Trash2 className="w-3 h-3 text-destructive" /></button>
                      </div>
                    </div>

                    {isExpanded && (block.type === "image" ? (
                      <div className="px-4 pb-4">
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input value={block.url || ""} onChange={(e) => updateBlock(block.id, { url: e.target.value })} className="w-full h-10 px-3 rounded-md border" placeholder="https://..." />
                          <label className="px-3 h-10 inline-flex items-center rounded-md border text-sm cursor-pointer hover:bg-muted">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadBlockImage(block.id, e.target.files?.[0])} />
                            {uploadingBlockImageId === block.id ? "Enviando..." : "Upload"}
                          </label>
                        </div>
                        {(blockPreviews[block.id] || block.url) ? <img src={blockPreviews[block.id] || block.url} alt="Prévia da imagem" loading="lazy" decoding="async" className="w-full max-h-56 object-contain rounded-md border bg-muted/20" /> : null}
                        <input value={block.caption || ""} onChange={(e) => updateBlock(block.id, { caption: e.target.value })} className="w-full h-10 px-3 rounded-md border" placeholder="Legenda (opcional)" />
                        <input value={block.credit || ""} onChange={(e) => updateBlock(block.id, { credit: e.target.value })} className="w-full h-10 px-3 rounded-md border" placeholder="Crédito (opcional)" />
                      </div>
                      </div>
                    ) : block.type === "image-text" ? (
                      <div className="px-4 pb-4">
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input value={block.url || ""} onChange={(e) => updateBlock(block.id, { url: e.target.value })} className="w-full h-10 px-3 rounded-md border" placeholder="https://..." />
                          <label className="px-3 h-10 inline-flex items-center rounded-md border text-sm cursor-pointer hover:bg-muted">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadBlockImage(block.id, e.target.files?.[0])} />
                            {uploadingBlockImageId === block.id ? "Enviando..." : "Upload"}
                          </label>
                        </div>

                        <div className={`flex flex-col md:flex-row gap-4 ${block.align === "right" ? "md:flex-row-reverse" : ""}`}>
                          <figure className={`${block.width === "sm" ? "md:w-[30%]" : block.width === "lg" ? "md:w-[50%]" : "md:w-[40%]"} w-full`}>
                            {(blockPreviews[block.id] || block.url) ? (
                              <img src={blockPreviews[block.id] || block.url} alt={block.caption || "Prévia da imagem"} loading="lazy" decoding="async" className="w-full max-h-56 object-contain rounded-md border bg-muted/20" />
                            ) : (
                              <div className="w-full h-40 rounded-md border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground">Sem imagem</div>
                            )}
                            {(block.caption || block.credit) ? (
                              <figcaption className="text-xs text-muted-foreground mt-2">
                                {block.caption || ""}
                                {block.caption && block.credit ? " • " : ""}
                                {block.credit ? `Crédito: ${block.credit}` : ""}
                              </figcaption>
                            ) : null}
                          </figure>
                          <div className="flex-1 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: block.text || "<p>Texto ao lado da imagem</p>" }} />
                        </div>

                        <textarea
                          id={`block-text-${block.id}`}
                          value={block.text || ""}
                          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                          className="w-full min-h-[120px] p-3 rounded-md border font-mono text-sm"
                          placeholder="Texto ao lado da imagem"
                        />
                        <input value={block.caption || ""} onChange={(e) => updateBlock(block.id, { caption: e.target.value })} className="w-full h-10 px-3 rounded-md border" placeholder="Legenda (opcional)" />
                        <input value={block.credit || ""} onChange={(e) => updateBlock(block.id, { credit: e.target.value })} className="w-full h-10 px-3 rounded-md border" placeholder="Crédito (opcional)" />
                        <select value={block.align || "left"} onChange={(e) => updateBlock(block.id, { align: e.target.value === "right" ? "right" : "left" })} className="w-full h-10 px-3 rounded-md border bg-background">
                          <option value="left">Imagem à esquerda</option>
                          <option value="right">Imagem à direita</option>
                        </select>
                        <select value={block.width || "md"} onChange={(e) => updateBlock(block.id, { width: e.target.value === "sm" || e.target.value === "lg" ? e.target.value : "md" })} className="w-full h-10 px-3 rounded-md border bg-background">
                          <option value="sm">Pequena</option>
                          <option value="md">Média</option>
                          <option value="lg">Grande</option>
                        </select>
                      </div>
                      </div>
                    ) : (
                      <div className="px-4 pb-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => applyInlineTag(block.id, "strong")} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-md hover:bg-muted"><Bold className="w-3 h-3" /> Negrito</button>
                          <button type="button" onClick={() => applyInlineTag(block.id, "em")} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-md hover:bg-muted"><Italic className="w-3 h-3" /> Itálico</button>
                          <select value={block.size || "md"} onChange={(e) => updateBlock(block.id, { size: e.target.value as TextBlock["size"] })} className="h-8 px-2 rounded-md border text-xs">
                            <option value="sm">Texto pequeno</option>
                            <option value="md">Texto normal</option>
                            <option value="lg">Texto grande</option>
                          </select>
                        </div>

                        <textarea
                          id={`block-text-${block.id}`}
                          value={block.text || ""}
                          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                          className="w-full min-h-[120px] p-3 rounded-md border font-mono text-sm"
                          placeholder={block.type === "heading" ? "Subtítulo da seção" : "Texto do bloco"}
                        />

                        {block.type === "quote" && (
                          <input
                            value={block.author || ""}
                            onChange={(e) => updateBlock(block.id, { author: e.target.value })}
                            className="w-full h-10 px-3 rounded-md border"
                            placeholder="Autor/Fonte da citação (opcional)"
                          />
                        )}
                      </div>
                      </div>
                    ))}
                  </div>
                );
                })}
              </div>
            )}

            </div>
          </div>
          )}

          {activeTab === "entrevistas" && (
            <section id="entrevistas-panel" role="tabpanel" aria-labelledby="entrevistas-tab" className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Entrevistas da matéria</h2>
                <p className="text-sm text-muted-foreground">Adicione entrevistas em texto, vídeo do canal/YouTube ou áudio. Cada título terá uma página própria.</p>
              </div>
              {interviews.map((interview, interviewIndex) => (
                <div key={interview.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2"><h3 className="font-medium">Entrevista {interviewIndex + 1}</h3><button type="button" className="rounded-md border px-3 py-1.5 text-sm text-destructive" onClick={() => setInterviews((items) => items.filter((item) => item.id !== interview.id))}>Remover</button></div>
                  <input aria-label="Título da entrevista" value={interview.title} onChange={(event) => setInterviews((items) => items.map((item) => item.id === interview.id ? { ...item, title: event.target.value } : item))} className="h-10 w-full rounded-md border px-3" placeholder="Ex.: Entrevista com Maria Kalunga" />
                  <label className="block text-sm font-medium">Formato<select value={interview.format} onChange={(event) => setInterviews((items) => items.map((item) => item.id === interview.id ? { ...item, format: event.target.value as MateriaInterview["format"] } : item))} className="mt-1 h-10 w-full rounded-md border px-3"><option value="text">Texto, com perguntas e respostas</option><option value="youtube">Vídeo do YouTube</option><option value="audio">Áudio anexado</option></select></label>
                  <div className="space-y-2">
                    <span className="block text-sm font-medium">Capa da entrevista</span>
                    {interview.thumbnailUrl ? (
                      <div className="flex flex-wrap items-start gap-3 rounded-md border bg-muted/20 p-3">
                        <img src={interview.thumbnailUrl} alt="Prévia da capa da entrevista" className="h-28 w-28 rounded-md object-cover" />
                        <div className="flex flex-wrap gap-2">
                          <label className="inline-flex cursor-pointer items-center rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted">
                            {uploadingInterviewCoverId === interview.id ? "Enviando…" : "Substituir capa"}
                            <input type="file" accept="image/*" className="sr-only" disabled={uploadingInterviewCoverId === interview.id} onChange={(event) => handleInterviewCoverUpload(interview.id, event.target.files?.[0])} />
                          </label>
                          <button type="button" onClick={() => setInterviews((items) => items.map((item) => item.id === interview.id ? { ...item, thumbnailUrl: "", thumbnailDriveFileId: null } : item))} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">Remover capa</button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 py-5 text-sm hover:border-green-600 hover:bg-muted/30">
                        <ImageIcon className="h-4 w-4" />
                        {uploadingInterviewCoverId === interview.id ? "Enviando capa…" : "Adicionar capa por upload"}
                        <input type="file" accept="image/*" className="sr-only" disabled={uploadingInterviewCoverId === interview.id} onChange={(event) => handleInterviewCoverUpload(interview.id, event.target.files?.[0])} />
                      </label>
                    )}
                    <p className="text-xs text-muted-foreground">Imagem JPG, PNG ou WebP, até 10 MB. A matéria precisa estar salva como rascunho para liberar o envio.</p>
                  </div>
                  {interview.format === "youtube" ? (
                    <div className="space-y-3">
                      <YouTubeVideoPicker value={interview.youtubeUrl} onSelect={(url) => setInterviews((items) => items.map((item) => item.id === interview.id ? { ...item, youtubeUrl: url } : item))} />
                      <label className="block text-sm">Ou cole o link de um vídeo externo do YouTube
                        <input type="url" value={interview.youtubeUrl} onChange={(event) => setInterviews((items) => items.map((item) => item.id === interview.id ? { ...item, youtubeUrl: event.target.value } : item))} className="mt-1 h-10 w-full rounded-md border px-3" placeholder="https://www.youtube.com/watch?v=..." />
                      </label>
                    </div>
                  ) : interview.format === "audio" ? (
                    <div className="space-y-3 rounded-md bg-muted/30 p-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                        <input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,audio/x-m4a" className="sr-only" disabled={uploadingInterviewAudioId === interview.id} onChange={(event) => handleInterviewAudioUpload(interview.id, event.target.files?.[0])} />
                        {uploadingInterviewAudioId === interview.id ? "Enviando áudio…" : interview.audioUrl ? "Substituir áudio" : "Anexar áudio"}
                      </label>
                      {interview.audioUrl ? <audio controls preload="none" className="w-full"><source src={interview.audioUrl} />Seu navegador não suporta áudio.</audio> : <p className="text-xs text-muted-foreground">MP3, WAV, OGG ou M4A, até 20 MB. A matéria precisa estar salva como rascunho para anexar o arquivo.</p>}
                      <label className="block text-sm">Transcrição do áudio (opcional)
                        <textarea value={interview.transcript || ""} onChange={(event) => setInterviews((items) => items.map((item) => item.id === interview.id ? { ...item, transcript: event.target.value } : item))} className="mt-1 min-h-28 w-full rounded-md border p-3" placeholder="Inclua aqui a transcrição para facilitar o acesso ao conteúdo." />
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {interview.questions.map((pair, pairIndex) => <div key={interview.id + "-" + pairIndex} className="grid gap-2 rounded-md bg-muted/30 p-3">
                        <input value={pair.question} onChange={(event) => setInterviews((items) => items.map((item) => item.id === interview.id ? { ...item, questions: item.questions.map((entry, index) => index === pairIndex ? { ...entry, question: event.target.value } : entry) } : item))} className="h-10 rounded-md border px-3" placeholder="Pergunta do repórter" />
                        <textarea value={pair.answer} onChange={(event) => setInterviews((items) => items.map((item) => item.id === interview.id ? { ...item, questions: item.questions.map((entry, index) => index === pairIndex ? { ...entry, answer: event.target.value } : entry) } : item))} className="min-h-20 rounded-md border p-3" placeholder="Resposta da pessoa entrevistada" />
                        <button type="button" className="justify-self-start text-sm text-destructive" onClick={() => setInterviews((items) => items.map((item) => item.id === interview.id ? { ...item, questions: item.questions.filter((_, index) => index !== pairIndex) } : item))}>Remover pergunta e resposta</button>
                      </div>)}
                      <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => setInterviews((items) => items.map((item) => item.id === interview.id ? { ...item, questions: [...item.questions, { question: "", answer: "" }] } : item))}>Adicionar pergunta e resposta</button>
                    </div>
                  )}
                </div>
              ))}
              <button type="button" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted" onClick={() => setInterviews((items) => [...items, { id: uid("interview"), title: "", format: "text", youtubeUrl: "", audioUrl: "", audioDriveFileId: null, transcript: "", thumbnailUrl: "", thumbnailDriveFileId: null, questions: [{ question: "", answer: "" }] }])}>Adicionar entrevista</button>
            </section>
          )}

          {activeTab === "materia" && (
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h3 className="font-semibold text-lg">Galeria de Fotos</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{canUseGallery ? "Adicione fotos que ilustram esta matéria." : "Salve a matéria primeiro para liberar a galeria."}</p>
              </div>

              <input ref={galleryInputRef} type="file" multiple accept="image/*" className="hidden" id="gallery-input" disabled={!canUseGallery} onChange={(e) => handleGalleryFilesChange(e.target.files)} />
              <label htmlFor="gallery-input" className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer hover:bg-muted transition-colors ${!canUseGallery ? "opacity-40 pointer-events-none" : ""}`}>
                <ImageIcon className="w-4 h-4" />
                {uploadingGallery ? "Enviando..." : "Adicionar fotos"}
              </label>
            </div>

            {galeria.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                <ImageIcon className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">Nenhuma foto na galeria ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {galeria.map((item) => (
                  <div key={item.id} className="rounded-xl border overflow-hidden group relative">
                    <img src={item.url} alt="Foto da matéria" className="w-full h-40 object-cover" />
                    <div className="p-2 flex items-center justify-between bg-background">
                      <span className="text-xs text-muted-foreground truncate">{item.legenda || "Sem legenda"}</span>
                      <button type="button" onClick={() => handleDeleteGalleryItem(item.id)} className="p-1.5 rounded-lg border hover:bg-destructive/10 hover:border-destructive/30 transition-colors" title="Remover foto">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <label className="text-sm font-medium">Créditos das fotos</label>
              <input
                {...register("photoCredits")}
                className="w-full h-10 px-3 rounded-md border bg-background"
                placeholder="Ex: João Silva, Maria Souza"
              />
              <p className="text-xs text-muted-foreground">Será exibido abaixo da galeria na matéria publicada.</p>
            </div>
          </div>
          )}
        </div>

        {activeTab === "materia" && <div className="space-y-6">
          <section id="materia-section-seo" className="bg-card border rounded-xl p-4 shadow-sm space-y-3 scroll-mt-24" aria-label="SEO e compartilhamento">
            <button type="button" aria-expanded={expandedSections.seo} aria-controls="materia-seo-body" onClick={() => toggleSection("seo")} className="flex w-full items-center justify-between gap-2 text-left">
              <span className="font-semibold text-base">SEO e compartilhamento</span>
              {expandedSections.seo ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
            </button>
            <div id="materia-seo-body" hidden={!expandedSections.seo} className="space-y-3">
            <label className="block text-sm">URL da matéria (slug)
              <input {...register("customSlug")} className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm" placeholder="automaticamente pelo título" />
            </label>
            <p className="text-xs text-muted-foreground">Alterar o slug de uma matéria publicada muda o endereço do link.</p>
            <label className="block text-sm">Título da prévia
              <input {...register("seoTitle")} maxLength={120} className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm" placeholder={watch("title") || "Título da matéria"} />
            </label>
            <p className={`text-xs ${(watch("seoTitle") || "").length > 60 ? "text-amber-700" : "text-muted-foreground"}`}>
              {(watch("seoTitle") || "").length}/120 caracteres. Use um título claro; cerca de 50 a 60 caracteres é uma referência, não uma regra.
            </p>
            <label className="block text-sm">Descrição da prévia
              <textarea {...register("seoDescription")} maxLength={300} rows={3} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" placeholder={watch("subtitle") || "Resumo da matéria"} />
            </label>
            <p className={`text-xs ${(watch("seoDescription") || "").length > 170 ? "text-amber-700" : "text-muted-foreground"}`}>
              {(watch("seoDescription") || "").length}/300 caracteres. Uma descrição específica com cerca de 120 a 160 caracteres costuma caber melhor na prévia.
            </p>
            <p className="text-xs text-muted-foreground">Se os campos ficarem vazios, o site usa o título e o resumo da matéria. Imagem: banner; se não houver, capa.</p>
            </div>
          </section>
          <div id="materia-section-publicacao" className="bg-card border rounded-xl p-6 shadow-sm space-y-4 scroll-mt-24">
            <button type="button" aria-expanded={expandedSections.publicacao} aria-controls="materia-publicacao-body" onClick={() => toggleSection("publicacao")} className="flex w-full items-center justify-between gap-2 text-left border-b pb-4">
              <span>
                <span className="block font-semibold text-lg">Publicação</span>
                <span className="block text-xs text-muted-foreground">{watch("status") === "published" ? "Publicado" : watch("status") === "archived" ? "Arquivado" : "Rascunho"}{selectedCategory ? ` · ${selectedCategory}` : ""}</span>
              </span>
              {expandedSections.publicacao ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
            </button>
            <div id="materia-publicacao-body" hidden={!expandedSections.publicacao} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Autor</label>
                <select {...register("authorId")} className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                  <option value="">{loadingEquipe ? "Carregando equipe..." : equipe.length ? "Selecione um autor..." : "Nenhum integrante cadastrado"}</option>
                  {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.cargo ? ` — ${p.cargo}` : ""}</option>)}
                </select>
                {selectedAuthorId && <p className="text-xs text-muted-foreground">Autor: <b>{equipe.find((p) => p.id === selectedAuthorId)?.nome || "—"}</b></p>}
              </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select {...register("status")} className="w-full h-10 px-3 rounded-md border bg-background">
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <select {...register("category")} className="w-full h-10 px-3 rounded-md border bg-background">
                {!selectedCategory ? <option value="">Selecione uma categoria</option> : null}
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  placeholder="Nova categoria"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="inline-flex items-center gap-2 px-3 h-10 text-sm rounded-md border hover:bg-muted disabled:opacity-60"
                  disabled={addingCategory}
                >
                  <Plus className="w-4 h-4" />
                  {addingCategory ? "Salvando..." : "Nova"}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Hashtags</label>
              <input {...register("hashtags")} className="w-full h-10 px-3 rounded-md border bg-background" placeholder="#quilombo, #cultura, #reportagem" />
              <p className="text-xs text-muted-foreground">Separe por vírgula. Normalização automática no salvamento.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Áudio da matéria</label>
              <input {...register("audioUrl", { onChange: () => setAudioDriveFileId(null) })} className="w-full h-10 px-3 rounded-md border bg-background" placeholder="https://..." />
              <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${uploadingAudio ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-muted"}`}>
                <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" disabled={uploadingAudio} onChange={(e) => handleAudioUpload(e.target.files?.[0])} />
                <Plus className="w-4 h-4" />
                {uploadingAudio ? "Enviando áudio..." : "Upload de áudio"}
              </label>
              {!!selectedAudioFileName && <p className="text-xs text-muted-foreground">Arquivo selecionado: {selectedAudioFileName}</p>}
            </div>
            </div>
          </div>

          <div id="materia-section-capa" className="bg-card border rounded-xl p-3 shadow-sm space-y-2 scroll-mt-24">
            <div className="flex items-center justify-between gap-2">
              <button type="button" aria-expanded={expandedSections.capa} aria-controls="materia-capa-body" onClick={() => toggleSection("capa")} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span>
                  <span className="block font-semibold text-lg">Capa da Matéria</span>
                  <span className="block text-xs text-muted-foreground">{coverUrl ? "Capa configurada" : "Sem capa"}</span>
                </span>
                {expandedSections.capa ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
              </button>

              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" id="cover-input" onChange={(e) => handleCoverUpload(e.target.files?.[0])} />
              <label htmlFor="cover-input" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer hover:bg-muted transition-colors">
                <ImageIcon className="w-4 h-4" />
                {uploadingCover ? "Enviando..." : "Enviar capa"}
              </label>
            </div>

            <div id="materia-capa-body" hidden={!expandedSections.capa} className="space-y-2">
            {coverUrl ? <div className="flex items-center justify-between rounded-md bg-muted p-2 text-xs"><span>✓ Capa carregada</span><button type="button" className="text-destructive underline" onClick={() => { setValue("coverImage", ""); setCoverDriveFileId(null); setCoverThumbDriveFileId(null); setCoverThumbUrl(null); }}>Remover</button></div> : <p className="text-xs text-muted-foreground">Sem capa</p>}
            <p className="text-xs text-muted-foreground">
              Usada na listagem e nos cards. Recomendado: formato quadrado 1:1 (ex.: 800x800 ou 960x960).
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Ou cole a URL</label>
              <input {...register("coverImage", { onChange: () => { setCoverDriveFileId(null); setCoverThumbDriveFileId(null); setCoverThumbUrl(null); } })} className="w-full h-10 px-3 rounded-md border bg-background" placeholder="https://..." />
            </div>
            </div>
          </div>

          <div id="materia-section-banner" className="bg-card border rounded-xl p-3 shadow-sm space-y-2 scroll-mt-24">
            <div className="flex items-center justify-between gap-2">
              <button type="button" aria-expanded={expandedSections.banner} aria-controls="materia-banner-body" onClick={() => toggleSection("banner")} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span>
                  <span className="block font-semibold text-lg">Banner da Matéria</span>
                  <span className="block text-xs text-muted-foreground">{bannerUrl ? "Banner configurado" : "Sem banner"}</span>
                </span>
                {expandedSections.banner ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
              </button>

              <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" id="banner-input" onChange={(e) => handleBannerUpload(e.target.files?.[0])} />
              <label htmlFor="banner-input" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer hover:bg-muted transition-colors">
                <ImageIcon className="w-4 h-4" />
                {uploadingBanner ? "Enviando..." : "Enviar banner"}
              </label>
            </div>

            <div id="materia-banner-body" hidden={!expandedSections.banner} className="space-y-2">
            {bannerUrl ? <div className="flex items-center justify-between rounded-md bg-muted p-2 text-xs"><span>✓ Banner carregado</span><button type="button" className="text-destructive underline" onClick={() => { setValue("bannerImage", ""); setBannerDriveFileId(null); }}>Remover</button></div> : <p className="text-xs text-muted-foreground">Sem banner</p>}
            <p className="text-xs text-muted-foreground">
              Usado no topo da matéria publicada. Recomendado: formato horizontal (ex.: 1600x900, 1440x810 ou 1280x720).
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Ou cole a URL</label>
              <input {...register("bannerImage", { onChange: () => setBannerDriveFileId(null) })} className="w-full h-10 px-3 rounded-md border bg-background" placeholder="https://..." />
            </div>
            </div>
          </div>
        </div>}
      </div>
      {showPreview && (() => {
        const previewData = watch();
        const previewDate = previewData.date
          ? new Date(`${previewData.date}T12:00:00`).toLocaleDateString("pt-BR")
          : "";
        const articleImage = previewData.bannerImage || previewData.coverImage;
        const previewEditButton = (key: string, label: string) => (
          <button
            type="button"
            onClick={() => setPreviewEditField((current) => current === key ? null : key)}
            aria-label={`Editar ${label}`}
            title={`Editar ${label}`}
            className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <PenLine className="h-3.5 w-3.5" />
            {previewEditField === key ? "Concluir" : "Editar"}
          </button>
        );
        const previewAddBlockMenu = (position: number) => (
          <details className="my-3 rounded-lg border border-dashed border-green-700/40 bg-green-50/40 p-2">
            <summary className="cursor-pointer list-none text-center text-sm font-medium text-green-800">＋ Adicionar bloco</summary>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {([["paragraph", "Parágrafo"], ["heading", "Subtítulo"], ["quote", "Citação"], ["highlight", "Destaque"], ["image", "Imagem"], ["image-text", "Imagem + texto"]] as const).map(([type, label]) => <button key={type} type="button" onClick={() => addBlock(type, position)} className="rounded-md border bg-white px-3 py-1.5 text-xs hover:border-green-700">{label}</button>)}
            </div>
          </details>
        );

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={() => { setShowPreview(false); setEditorMode("traditional"); setPreviewInterviewId(null); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="materia-preview-title" className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="z-10 flex shrink-0 items-center justify-between border-b bg-white px-4 py-3">
                <div>
                  <h2 id="materia-preview-title" className="font-semibold">Pré-visualização editável</h2>
                  <p className="text-xs text-muted-foreground">Use os lápis para alterar o conteúdo sem fechar a prévia.</p>
                </div>
                <button type="button" onClick={() => { setShowPreview(false); setEditorMode("traditional"); setPreviewInterviewId(null); }} aria-label="Fechar pré-visualização" className="rounded-md p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="relative">
                  {articleImage ? <img src={articleImage} alt="" className="max-h-[420px] w-full bg-gray-100 object-cover" /> : <div className="flex h-52 items-center justify-center bg-gray-100 text-sm text-gray-500">Sem imagem principal</div>}
                  <div className="absolute right-3 top-3">{previewEditButton("image", "imagem principal")}</div>
                </div>
                {previewEditField === "image" ? (
                  <div className="mx-auto flex max-w-3xl flex-col gap-2 px-5 pt-4 sm:flex-row sm:items-end sm:px-10">
                    <label className="flex-1 text-sm">
                      Imagem para editar
                      <select value={previewImageField} onChange={(event) => setPreviewImageField(event.target.value as "coverImage" | "bannerImage")} className="mt-1 h-10 w-full rounded-md border px-3">
                        <option value="bannerImage">Banner</option>
                        <option value="coverImage">Capa</option>
                      </select>
                    </label>
                    <label className="flex-1 text-sm">
                      URL da imagem
                      <input value={previewData[previewImageField] || ""} onChange={(event) => setValue(previewImageField, event.target.value, { shouldDirty: true, shouldValidate: true })} className="mt-1 h-10 w-full rounded-md border px-3" />
                    </label>
                    <button type="button" onClick={() => (previewImageField === "bannerImage" ? bannerInputRef : coverInputRef).current?.click()} className="h-10 rounded-md border px-3 text-sm hover:bg-muted">
                      Enviar arquivo
                    </button>
                  </div>
                ) : null}

                <article className="mx-auto max-w-3xl px-5 py-8 sm:px-10">
                  <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {previewData.category ? <span className="rounded-full bg-green-50 px-3 py-1 font-medium text-green-800">{previewData.category}</span> : <span>Sem categoria</span>}
                      {previewEditButton("category", "categoria")}
                    </div>
                    <div className="flex items-center gap-2">
                      {previewDate ? <time>{previewDate}</time> : <span>Sem data</span>}
                      {previewEditButton("date", "data")}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-1">{previewData.status === "published" ? "Publicado" : previewData.status === "archived" ? "Arquivado" : "Rascunho"}</span>
                      {previewEditButton("status", "status")}
                    </div>
                  </div>
                  {previewEditField === "category" ? <select value={previewData.category || ""} onChange={(event) => setValue("category", event.target.value, { shouldDirty: true })} className="mb-4 h-10 rounded-md border px-3">{categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select> : null}
                  {previewEditField === "date" ? <input type="date" value={previewData.date || ""} onChange={(event) => setValue("date", event.target.value, { shouldDirty: true })} className="mb-4 h-10 rounded-md border px-3" /> : null}
                  {previewEditField === "status" ? <select value={previewData.status} onChange={(event) => setValue("status", event.target.value as MateriaFormData["status"], { shouldDirty: true })} className="mb-4 h-10 rounded-md border px-3"><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="archived">Arquivado</option></select> : null}

                  <div className="flex items-start justify-between gap-3">
                    {previewEditField === "title" ? (
                      <input autoFocus value={previewData.title || ""} onChange={(event) => setValue("title", event.target.value, { shouldDirty: true, shouldValidate: true })} className="w-full rounded-md border px-3 py-2 text-3xl font-bold sm:text-5xl" />
                    ) : <h1 className="text-3xl font-bold leading-tight text-gray-950 sm:text-5xl">{previewData.title || "Título da matéria"}</h1>}
                    {previewEditButton("title", "título")}
                  </div>

                  <div className="mt-4 flex items-start gap-3">
                    {previewEditField === "subtitle" ? (
                      <textarea autoFocus value={previewData.subtitle || ""} onChange={(event) => setValue("subtitle", event.target.value, { shouldDirty: true })} rows={3} className="w-full rounded-md border p-3 text-xl" />
                    ) : previewData.subtitle ? <p className="flex-1 text-xl leading-relaxed text-gray-600">{previewData.subtitle}</p> : <p className="flex-1 text-base text-gray-400">Adicione uma linha fina</p>}
                    {previewEditButton("subtitle", "subtítulo")}
                  </div>

                  <div className="mt-5 flex items-center gap-2 text-sm text-gray-600">
                    <span>{previewData.authorId ? equipe.find((person) => person.id === previewData.authorId)?.nome || "Autor" : "Sem autor"}</span>
                    {previewEditButton("author", "autor")}
                  </div>
                  {previewEditField === "author" ? <select value={previewData.authorId || ""} onChange={(event) => setValue("authorId", event.target.value, { shouldDirty: true })} className="mt-2 h-10 rounded-md border px-3"><option value="">Selecione um autor</option>{equipe.map((person) => <option key={person.id} value={person.id}>{person.nome}</option>)}</select> : null}

                  <div className="mt-8 space-y-6 text-lg leading-relaxed text-gray-700">
                    {blocks.length > 0 ? blocks.map((block, blockIndex) => {
                      const editKey = `block:${block.id}`;
                      const editing = previewEditField === editKey;
                      if (block.type === "image") return (
                        <figure key={block.id} className="space-y-3">
                          {blockPreviews[block.id] || block.url ? <img src={blockPreviews[block.id] || block.url} alt={block.caption || "Imagem da matéria"} className="mx-auto max-h-[640px] rounded-lg object-contain" /> : null}
                          <div className="flex justify-end">{previewEditButton(editKey, "imagem e legenda")}</div>
                          {editing ? <div className="space-y-2"><input value={block.url || ""} onChange={(event) => updateBlock(block.id, { url: event.target.value })} aria-label="URL da imagem" className="h-10 w-full rounded-md border px-3" placeholder="URL da imagem" /><input value={block.caption || ""} onChange={(event) => updateBlock(block.id, { caption: event.target.value })} aria-label="Legenda da imagem" className="h-10 w-full rounded-md border px-3" placeholder="Legenda" /><input value={block.credit || ""} onChange={(event) => updateBlock(block.id, { credit: event.target.value })} aria-label="Crédito da imagem" className="h-10 w-full rounded-md border px-3" placeholder="Crédito" /></div> : block.caption ? <figcaption className="mt-2 text-center text-sm text-gray-500">{block.caption}{block.credit ? ` • Crédito: ${block.credit}` : ""}</figcaption> : null}
                        </figure>
                      );
                      if (block.type === "image-text") return (
                        <figure key={block.id} className="space-y-3">
                          <img src={blockPreviews[block.id] || block.url} alt={block.caption || "Imagem da matéria"} className="mx-auto max-h-[500px] rounded-lg object-contain" />
                          <div className="flex justify-end">{previewEditButton(editKey, "imagem e texto")}</div>
                          {editing ? <div className="space-y-2"><input value={block.url || ""} onChange={(event) => updateBlock(block.id, { url: event.target.value })} className="h-10 w-full rounded-md border px-3" placeholder="URL da imagem" /><input value={block.caption || ""} onChange={(event) => updateBlock(block.id, { caption: event.target.value })} className="h-10 w-full rounded-md border px-3" placeholder="Legenda" /><textarea autoFocus value={block.text || ""} onChange={(event) => updateBlock(block.id, { text: event.target.value })} rows={5} className="w-full rounded-md border p-3" placeholder="Texto ao lado da imagem" /></div> : <><figcaption className="text-center text-sm text-gray-500">{block.caption || ""}{block.credit ? ` • Crédito: ${block.credit}` : ""}</figcaption><p className="whitespace-pre-wrap">{block.text || ""}</p></>}
                        </figure>
                      );
                      const plainText = (block.text || "").replace(/<[^>]*>/g, "");
                      return (
                        <section key={block.id} className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            {editing ? <textarea autoFocus value={block.text || ""} onChange={(event) => updateBlock(block.id, { text: event.target.value })} rows={5} className="w-full rounded-md border p-3" /> : (
                              block.type === "heading" ? <h2 className="flex-1 pt-4 text-2xl font-bold text-gray-900">{plainText}</h2>
                              : block.type === "quote" ? <blockquote className="flex-1 border-l-4 border-green-700 pl-5 italic">{plainText}{block.author ? <cite className="mt-2 block text-sm not-italic text-gray-500">{block.author}</cite> : null}</blockquote>
                              : block.type === "highlight" ? <aside className="flex-1 rounded-lg bg-amber-50 p-5">{plainText}</aside>
                              : <p className="flex-1 whitespace-pre-wrap">{plainText}</p>
                            )}
                            {previewEditButton(editKey, "bloco de texto")}
                          </div>
                          {editing && block.type === "quote" ? <input value={block.author || ""} onChange={(event) => updateBlock(block.id, { author: event.target.value })} className="h-10 w-full rounded-md border px-3" placeholder="Autoria da citação" /> : null}
                          {previewAddBlockMenu(blockIndex + 1)}
                        </section>
                      );
                    }) : (
                      <section className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          {previewEditField === "legacyContent" ? <textarea autoFocus value={previewData.content || ""} onChange={(event) => setValue("content", event.target.value, { shouldDirty: true })} rows={10} className="w-full rounded-md border p-3" /> : <div className="flex-1 whitespace-pre-wrap">{previewData.content || "O conteúdo da matéria aparecerá aqui."}</div>}
                          {previewEditButton("legacyContent", "conteúdo")}
                        </div>
                        {previewAddBlockMenu(0)}
                      </section>
                    )}
                  </div>

                  {galeria.length > 0 ? <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">{galeria.map((item) => <figure key={item.id}><img src={item.url} alt={item.legenda || "Foto da matéria"} className="h-40 w-full rounded-lg object-cover" />{item.legenda ? <figcaption className="mt-1 text-xs text-gray-500">{item.legenda}</figcaption> : null}</figure>)}</div> : null}
                  <div className="mt-6 flex items-center justify-between gap-3">
                    {previewData.photoCredits ? <p className="text-sm text-gray-500">Créditos das fotos: {previewData.photoCredits}</p> : <span />}
                    {previewEditButton("photoCredits", "créditos das fotos")}
                  </div>
                  {previewEditField === "photoCredits" ? <input value={previewData.photoCredits || ""} onChange={(event) => setValue("photoCredits", event.target.value, { shouldDirty: true })} className="mt-2 h-10 w-full rounded-md border px-3" placeholder="Créditos das fotos" /> : null}
                  {previewData.audioUrl ? <div className="mt-5 flex items-center gap-3 text-sm"><a href={previewData.audioUrl} target="_blank" rel="noreferrer" className="text-green-800 underline">Ouvir áudio da matéria</a>{previewEditButton("audioUrl", "áudio")}</div> : null}
                  {previewEditField === "audioUrl" ? <input value={previewData.audioUrl || ""} onChange={(event) => setValue("audioUrl", event.target.value, { shouldDirty: true })} className="mt-2 h-10 w-full rounded-md border px-3" placeholder="URL do áudio" /> : null}
                  {interviews.length > 0 ? <section className="mt-8 border-t pt-6">
                    <h2 className="mb-4 text-xl font-bold text-green-800">Entrevistas</h2>
                    <div className="grid grid-cols-4 gap-2 sm:gap-3">{interviews.map((interview) => <button key={interview.id} type="button" onClick={() => setPreviewInterviewId(interview.id)} className={`overflow-hidden rounded-lg border bg-white text-left hover:border-green-700 ${previewInterviewId === interview.id ? "ring-2 ring-green-700" : ""}`}>
                      {interview.thumbnailUrl ? <img src={interview.thumbnailUrl} alt="" className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center bg-green-50 text-xs text-green-800">{interview.format === "audio" ? "Áudio" : interview.format === "youtube" ? "Vídeo" : "Texto"}</div>}
                      <span className="block truncate p-2 text-xs font-semibold">{interview.title || "Entrevista sem título"}</span>
                    </button>)}</div>
                    {previewInterviewId ? (() => { const interview = interviews.find((item) => item.id === previewInterviewId); if (!interview) return null; return <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold">{interview.title || "Prévia da entrevista"}</h3><button type="button" onClick={() => setPreviewInterviewId(null)} className="text-sm text-green-800 underline">Voltar às entrevistas</button></div>
                      {interview.format === "audio" && interview.audioUrl ? <audio controls preload="none" className="w-full"><source src={interview.audioUrl} />Seu navegador não suporta áudio.</audio> : null}
                      {interview.format === "youtube" && interview.youtubeUrl ? (() => { const videoId = interview.youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)?.[1]; return videoId ? <div className="aspect-video overflow-hidden rounded-lg"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={interview.title || "Entrevista no YouTube"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div> : <p className="text-sm text-red-700">Confira o link do YouTube.</p>; })() : null}
                      {interview.format === "text" ? <div className="space-y-3">{interview.questions.map((pair, index) => <div key={index}><p className="font-semibold">{pair.question || "Pergunta do repórter"}</p><p className="mt-1 whitespace-pre-wrap text-gray-700">{pair.answer || "Resposta da pessoa entrevistada"}</p></div>)}</div> : null}
                      {interview.transcript ? <details className="mt-3"><summary className="cursor-pointer font-medium">Ler transcrição</summary><p className="mt-2 whitespace-pre-wrap text-gray-700">{interview.transcript}</p></details> : null}
                    </div>; })() : null}
                  </section> : null}
                  {previewData.hashtags ? <div className="mt-6 flex items-center gap-3 text-sm text-gray-500"><p>{previewData.hashtags}</p>{previewEditButton("hashtags", "hashtags")}</div> : null}
                  {previewEditField === "hashtags" ? <input value={previewData.hashtags || ""} onChange={(event) => setValue("hashtags", event.target.value, { shouldDirty: true })} className="mt-2 h-10 w-full rounded-md border px-3" placeholder="Hashtags separadas por vírgula" /> : null}
                </article>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t bg-white px-4 py-3">
                <button type="button" onClick={() => { setShowPreview(false); setEditorMode("traditional"); setPreviewInterviewId(null); }} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Fechar prévia</button>
                <button type="button" onClick={handleSubmit(onSubmit)} disabled={loading} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{loading ? "Salvando..." : "Salvar alterações"}</button>
              </div>
            </section>
          </div>
        );
      })()}

    </div>
  );
}
