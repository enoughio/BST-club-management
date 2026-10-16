export const MATERIAL_KINDS = [
  { id: "GUIDE_FILE", label: "Guide file" },
  { id: "VIDEO", label: "Video" },
  { id: "BOOK", label: "Book" },
  { id: "ARTICLE", label: "Article" },
] as const;

export type MaterialKind = (typeof MATERIAL_KINDS)[number]["id"];

export type LearningMaterial = {
  id: string;
  title: string;
  kind: MaterialKind;
  url: string | null;
  fileKey: string | null;
  fileName: string | null;
  mimeType?: string | null;
};

export type CurriculumProject = {
  id: string;
  title: string;
  description: string | null;
  evaluationCriteria: string | null;
  materials: LearningMaterial[];
};

export type CurriculumLevel = {
  id: string;
  name: string;
  projects: CurriculumProject[];
};

export type CurriculumIssue = {
  levelId: string;
  projectId?: string;
  materialId?: string;
  field: string;
  message: string;
};

function validUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function kindLabel(kind: string) {
  return MATERIAL_KINDS.find((item) => item.id === kind)?.label || kind;
}

export function curriculumIssues(levels: CurriculumLevel[], requireGuideFile: boolean): CurriculumIssue[] {
  const issues: CurriculumIssue[] = [];
  levels.forEach((level) => {
    if (level.name.trim().length < 2) issues.push({ levelId: level.id, field: "name", message: "Level name is required." });
    level.projects.forEach((project) => {
      if (project.title.trim().length < 2) issues.push({ levelId: level.id, projectId: project.id, field: "title", message: "Project title is required." });
      if (project.materials.length === 0) issues.push({ levelId: level.id, projectId: project.id, field: "materials", message: "Add at least one learning material." });
      if (requireGuideFile && !project.materials.some((material) => material.kind === "GUIDE_FILE" && (material.fileKey || material.url))) {
        issues.push({ levelId: level.id, projectId: project.id, field: "guide", message: "Add a guide file before this can be published." });
      }
      project.materials.forEach((material) => {
        if (material.title.trim().length < 2) issues.push({ levelId: level.id, projectId: project.id, materialId: material.id, field: "label", message: "Each learning material needs a label." });
        const url = material.url?.trim() || "";
        const fileKey = material.fileKey?.trim() || "";
        if (!url && !fileKey) issues.push({ levelId: level.id, projectId: project.id, materialId: material.id, field: "source", message: "Add a URL or upload a file." });
        else if (url && !validUrl(url)) issues.push({ levelId: level.id, projectId: project.id, materialId: material.id, field: "source", message: "Use an http or https link." });
      });
    });
  });
  return issues;
}

export function newId() {
  return `new-${crypto.randomUUID()}`;
}
