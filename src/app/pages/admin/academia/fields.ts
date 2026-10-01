import type { AcademyData } from "./types";
import { opts, type Field } from "./components";
import type { Entity } from "./service";
const title: Field = { name: "title", label: "Título", required: true };
const position: Field = { name: "position", label: "Ordem", type: "number" };
const status: Field = {
  name: "status",
  label: "Status",
  type: "select",
  options: opts(["draft", "review", "published", "archived"]),
};
const required: Field = {
  name: "required",
  label: "Obrigatório",
  type: "checkbox",
};
export function fieldsFor(
  entity: Entity,
  data: AcademyData,
  courseId?: string,
): Field[] {
  const courses = data.courses.map((c) => ({ value: c.id, label: c.title }));
  const course: Field = {
    name: "course_id",
    label: "Curso",
    type: "select",
    required: true,
    options: courses,
  };
  const lessons = data.lessons
    .filter((l) => l.course_id === courseId)
    .map((l) => ({ value: l.id, label: l.title }));
  const lesson: Field = {
    name: "lesson_id",
    label: "Aula vinculada",
    type: "select",
    nullable: true,
    options: lessons,
  };
  const published: Field = {
    ...status,
    options: opts(["draft", "published", "archived"]),
  };
  switch (entity) {
    case "courses":
      return [
        {
          ...title,
          hint: "Depois de salvar os dados, o curso ficará selecionado para você enviar e conferir a capa no Drive RKC.",
        },
        {
          name: "slug",
          label: "Slug (endereço único)",
          hint: "Gerado a partir do título se ficar vazio.",
        },
        { name: "summary", label: "Descrição curta", type: "textarea" },
        { name: "description", label: "Descrição completa", type: "textarea" },
        {
          name: "category_id",
          label: "Categoria",
          type: "select",
          nullable: true,
          options: data.categories.map((c) => ({ value: c.id, label: c.name })),
        },
        {
          name: "level",
          label: "Nível",
          type: "select",
          options: opts(["iniciante", "intermediario", "avancado"]),
        },
        {
          name: "hours",
          label: "Carga horária (horas)",
          type: "number",
          min: 0,
        },
        { name: "objectives", label: "Objetivos", type: "textarea" },
        {
          name: "competencies",
          label: "Competências (uma por linha)",
          type: "array",
        },
        { name: "audience", label: "Público-alvo" },
        { name: "prerequisites", label: "Pré-requisitos", type: "textarea" },
        status,
        {
          name: "visibility",
          label: "Visibilidade",
          type: "select",
          options: opts(["internal", "public"]),
        },
        {
          name: "access_mode",
          label: "Modalidade",
          type: "select",
          options: opts(["internal", "free", "paid"]),
          hint: "A V1 permite publicar somente cursos internos. As outras modalidades podem ser preparadas em rascunho.",
        },
        { name: "price", label: "Preço futuro (BRL)", type: "number", min: 0 },
        {
          name: "enrollment_mode",
          label: "Matrícula",
          type: "select",
          options: opts(["manual", "self", "automatic"]),
        },
        required,
        position,
        {
          name: "available_from",
          label: "Disponível a partir de",
          type: "datetime-local",
          nullable: true,
        },
        {
          name: "available_until",
          label: "Disponível até",
          type: "datetime-local",
          nullable: true,
        },
      ];
    case "modules":
      return [
        title,
        { name: "description", label: "Descrição", type: "textarea" },
        position,
      ];
    case "lessons":
      return [
        title,
        {
          name: "module_id",
          label: "Módulo",
          type: "select",
          required: true,
          options: data.modules
            .filter((m) => m.course_id === courseId)
            .map((m) => ({ value: m.id, label: m.title })),
        },
        { name: "description", label: "Descrição", type: "textarea" },
        { name: "content", label: "Conteúdo (texto)", type: "textarea" },
        {
          name: "type",
          label: "Formato",
          type: "select",
          options: opts([
            "text",
            "video",
            "audio",
            "image",
            "pdf",
            "document",
            "presentation",
            "link",
            "mixed",
          ]),
        },
        {
          name: "media_source",
          label: "Origem do conteúdo",
          type: "select",
          options: [
            { value: "none", label: "Somente texto" },
            { value: "drive", label: "Arquivo ou vídeo do Drive RKC" },
            { value: "vimeo", label: "Vimeo" },
            { value: "youtube", label: "YouTube" },
          ],
          hint: "Para usar arquivo, PDF ou vídeo da RKC, selecione Drive. Salve a aula e envie o conteúdo pelo painel da aula.",
        },
        {
          name: "media_url",
          label: "Link do Vimeo ou YouTube",
          nullable: true,
          visibleWhen: { field: "media_source", equals: ["vimeo", "youtube"] },
        },
        {
          name: "duration_minutes",
          label: "Duração estimada (minutos)",
          type: "number",
          min: 0,
        },
        required,
        position,
        published,
        {
          name: "context_route",
          label: "Área para praticar (/admin/...)",
          nullable: true,
        },
        {
          name: "context_feature",
          label: "Funcionalidade relacionada",
          nullable: true,
        },
      ];
    case "materials":
      return [
        title,
        lesson,
        { name: "url", label: "Link HTTPS", nullable: true },
      ];
    case "activities":
      return [
        title,
        lesson,
        { name: "instructions", label: "Instruções", type: "textarea" },
        {
          name: "kind",
          label: "Tipo",
          type: "select",
          options: opts(["activity", "assessment"]),
        },
        required,
        {
          name: "passing_score",
          label: "Nota mínima (%)",
          type: "number",
          min: 0,
          max: 100,
        },
        {
          name: "max_attempts",
          label: "Máximo de tentativas",
          type: "number",
          min: 1,
          max: 100,
        },
        published,
      ];
    case "questions":
      return [
        {
          name: "prompt",
          label: "Enunciado",
          type: "textarea",
          required: true,
        },
        {
          name: "type",
          label: "Tipo de questão",
          type: "select",
          options: opts(["choice", "boolean", "short", "essay", "practical"]),
        },
        {
          name: "options",
          label: "Alternativas (uma por linha)",
          type: "array",
          hint: "Em verdadeiro/falso, a resposta esperada é verdadeiro ou falso.",
        },
        {
          name: "answer",
          label: "Gabarito",
          hint: "Informe o texto exato da alternativa ou resposta curta. Discursivas e práticas recebem correção manual.",
        },
        { name: "points", label: "Pontos", type: "number", min: 0.01 },
        position,
        {
          name: "time_limit_seconds",
          label: "Tempo recomendado por questão (segundos)",
          type: "number",
          min: 1,
          nullable: true,
          hint: "Tempo recomendado na V1; preparado para limite obrigatório futuro.",
        },
      ];
    case "categories":
      return [{ name: "name", label: "Nome", required: true }];
    case "instructors":
      return [
        {
          name: "member_id",
          label: "Integrante",
          type: "select",
          nullable: true,
          options: data.members.map((m) => ({ value: m.id, label: m.nome })),
        },
        {
          name: "external_name",
          label: "Nome de instrutor externo",
          nullable: true,
          hint: "Preencha somente se não houver integrante selecionado.",
        },
        { name: "bio", label: "Apresentação", type: "textarea" },
      ];
    case "courseInstructors":
      return [
        {
          name: "instructor_id",
          label: "Instrutor",
          type: "select",
          required: true,
          options: data.instructors.map((i) => ({
            value: i.id,
            label:
              i.external_name ||
              data.members.find((m) => m.id === i.member_id)?.nome ||
              "Integrante",
          })),
        },
        { name: "can_edit", label: "Pode editar este curso", type: "checkbox" },
      ];
    case "enrollments":
      return [
        course,
        {
          name: "user_id",
          label: "Integrante",
          type: "select",
          required: true,
          options: data.members
            .filter((m) => m.user_id)
            .map((m) => ({ value: m.user_id!, label: m.nome })),
        },
        required,
        {
          name: "status",
          label: "Status",
          type: "select",
          options: opts(["active", "cancelled"]),
        },
      ];
    case "contributions":
      return [
        title,
        { ...course, nullable: true, required: false },
        {
          name: "content",
          label: "Conteúdo / experiência",
          type: "textarea",
          required: true,
        },
        { name: "reference_url", label: "Referência HTTPS", nullable: true },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: opts(["draft", "review"]),
        },
      ];
    case "settings":
      return [
        title,
        {
          name: "welcome_text",
          label: "Mensagem de boas-vindas",
          type: "textarea",
        },
      ];
    default:
      return [];
  }
}
export function defaults(entity: Entity): Record<string, unknown> {
  switch (entity) {
    case "courses":
      return {
        status: "draft",
        level: "iniciante",
        visibility: "internal",
        access_mode: "internal",
        enrollment_mode: "self",
        hours: 0,
        price: 0,
        position: 0,
        required: false,
        competencies: [],
      };
    case "modules":
      return { position: 0 };
    case "lessons":
      return {
        type: "text",
        media_source: "none",
        status: "draft",
        position: 0,
        duration_minutes: 0,
        required: true,
      };
    case "activities":
      return {
        kind: "activity",
        status: "draft",
        passing_score: 70,
        max_attempts: 3,
        required: true,
      };
    case "questions":
      return {
        type: "choice",
        options: [],
        points: 1,
        position: 0,
        time_limit_seconds: "",
      };
    case "enrollments":
      return { status: "active", required: false, source: "manual" };
    case "contributions":
      return { status: "draft" };
    case "courseInstructors":
      return { can_edit: false };
    default:
      return {};
  }
}
