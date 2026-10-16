"use client";

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, History, Lock, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MemberCurriculum } from "@/components/member-curriculum";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ApiError, api } from "@/lib/api";
import { MATERIAL_KINDS, curriculumIssues, kindLabel, newId, type CurriculumIssue, type CurriculumLevel, type CurriculumProject, type LearningMaterial, type MaterialKind } from "@/lib/curriculum";

type Version = { id: string; status: "DRAFT" | "PUBLISHED"; summary: string; createdAt: string; author: { id: string; name: string } | null };
type Builder = { source: "draft" | "published"; draftSavedAt: string | null; levels: CurriculumLevel[]; requireGuideFile: boolean; versions: Version[]; progressCounts: Record<string, number> };
type Pending = { summary: string; next: CurriculumLevel[]; revert: CurriculumLevel[] | null };

export default function CurriculumPage() {
  const [levels, setLevels] = useState<CurriculumLevel[]>([]);
  const [saved, setSaved] = useState<CurriculumLevel[]>([]);
  const [source, setSource] = useState<"draft" | "published">("published");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [requireGuideFile, setRequireGuideFile] = useState(true);
  const [versions, setVersions] = useState<Version[]>([]);
  const [progressCounts, setProgressCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState("");
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function applyPayload(data: Builder) {
    setLevels(data.levels);
    setSaved(data.levels);
    setSource(data.source);
    setDraftSavedAt(data.draftSavedAt);
    setRequireGuideFile(data.requireGuideFile);
    setVersions(data.versions);
    setProgressCounts(data.progressCounts);
    setSelectedId((current) => (data.levels.some((level) => level.id === current) ? current : data.levels[0]?.id || ""));
    setOpenIds((current) => current.filter((id) => data.levels.some((level) => level.id === id)));
  }

  useEffect(() => {
    api<Builder>("/curriculum/builder").then(applyPayload).catch(() => undefined);
  }, []);

  const issues = useMemo(() => curriculumIssues(levels, requireGuideFile), [levels, requireGuideFile]);
  const selected = levels.find((level) => level.id === selectedId) || null;
  const dirty = JSON.stringify(levels) !== JSON.stringify(saved);

  function stage(next: CurriculumLevel[], summary: string, revert: CurriculumLevel[] | null) {
    setLevels(next);
    setPending({ summary, next, revert });
  }

  function cancelPending() {
    if (pending?.revert) setLevels(pending.revert);
    setPending(null);
  }

  async function commit(mode: "draft" | "publish") {
    if (!pending) return;
    setBusy(true);
    try {
      const data = await api<Builder>(mode === "draft" ? "/curriculum/draft" : "/curriculum/publish", {
        method: mode === "draft" ? "PUT" : "POST",
        body: JSON.stringify({ levels: pending.next, summary: pending.summary.replace(/\?$/, "") }),
      });
      applyPayload(data);
      setPending(null);
      toast.success(mode === "draft" ? "Draft saved. Members still see the published curriculum." : "Curriculum published.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save the curriculum");
    } finally {
      setBusy(false);
    }
  }

  function onLevelDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = levels.findIndex((level) => level.id === active.id);
    const newIndex = levels.findIndex((level) => level.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    stage(arrayMove(levels, oldIndex, newIndex), "Reorder levels?", levels);
  }

  function onProjectDragEnd(event: DragEndEvent) {
    if (!selected) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = selected.projects.findIndex((project) => project.id === active.id);
    const newIndex = selected.projects.findIndex((project) => project.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = levels.map((level) => (level.id === selected.id ? { ...level, projects: arrayMove(level.projects, oldIndex, newIndex) } : level));
    stage(next, `Reorder projects in ${selected.name || "this level"}?`, levels);
  }

  function addLevel() {
    const level: CurriculumLevel = { id: newId(), name: "", projects: [] };
    setSelectedId(level.id);
    setOpenIds((current) => [...current, level.id]);
    stage([...levels, level], "Add a level?", levels);
  }

  function addProject(level: CurriculumLevel) {
    const project: CurriculumProject = { id: newId(), title: "", description: "", evaluationCriteria: "", materials: [] };
    setSelectedId(level.id);
    stage(levels.map((item) => (item.id === level.id ? { ...item, projects: [...item.projects, project] } : item)), `Add a project to ${level.name || "this level"}?`, levels);
  }

  function deleteLevel(level: CurriculumLevel) {
    const next = levels.filter((item) => item.id !== level.id);
    if (selectedId === level.id) setSelectedId(next[0]?.id || "");
    stage(next, `Delete ${level.name || "this level"}?`, levels);
  }

  function deleteProject(level: CurriculumLevel, project: CurriculumProject) {
    stage(
      levels.map((item) => (item.id === level.id ? { ...item, projects: item.projects.filter((row) => row.id !== project.id) } : item)),
      `Delete ${project.title || "this project"}?`,
      levels,
    );
  }

  const pendingIssues = pending ? curriculumIssues(pending.next, requireGuideFile) : [];
  const removedSubmissions = pending
    ? saved.reduce((sum, level) => sum + level.projects.reduce((inner, project) => {
      const kept = pending.next.some((item) => item.projects.some((row) => row.id === project.id));
      return inner + (kept ? 0 : progressCounts[project.id] || 0);
    }, 0), 0)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        title="Curriculum"
        lede="Levels unlock in order. Edit a draft, then publish when every project has a title and its learning materials."
        actions={
          <>
            <Button variant={preview ? "default" : "outline"} onClick={() => setPreview((value) => !value)}>{preview ? "Back to editor" : "Preview as Member"}</Button>
            <Button variant="outline" onClick={() => setHistoryOpen(true)}><History className="h-4 w-4" /> History</Button>
          </>
        }
      />
      {source === "draft" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span>Editing a draft{draftSavedAt ? ` saved ${new Date(draftSavedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}. Members still see the last published curriculum.</span>
          <Button variant="outline" size="sm" onClick={() => setDiscardOpen(true)}>Discard draft</Button>
        </div>
      )}
      {preview ? (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">This is the member view of the builder, with locks and progress simulated. Level 1 is open and its first project is in progress. Members will not see it until you publish.</p>
          <MemberCurriculum levels={levels} simulated />
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:h-[calc(100vh-12rem)] lg:flex-row lg:overflow-hidden">
          <aside className="flex flex-col gap-2 lg:w-80 lg:overflow-y-auto lg:pr-2">
            <Button onClick={addLevel}><Plus className="h-4 w-4" /> Add level</Button>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onLevelDragEnd}>
              <SortableContext items={levels.map((level) => level.id)} strategy={verticalListSortingStrategy}>
                {levels.map((level, index) => (
                  <LevelRow
                    key={level.id}
                    level={level}
                    index={index}
                    selected={level.id === selectedId}
                    open={openIds.includes(level.id)}
                    flagged={issues.some((issue) => issue.levelId === level.id)}
                    onSelect={() => {
                      setSelectedId(level.id);
                      setOpenIds((current) => (current.includes(level.id) ? current.filter((id) => id !== level.id) : [...current, level.id]));
                    }}
                    onOpenProject={(projectId) => {
                      setSelectedId(level.id);
                      document.getElementById(`project-${projectId}`)?.scrollIntoView({ block: "start" });
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {levels.length === 0 && <p className="text-sm text-muted-foreground">Add the first level to start the path.</p>}
          </aside>
          <div className="min-w-0 flex-1 lg:overflow-y-auto">
            {!selected && <p className="text-sm text-muted-foreground">Select a level to edit its projects.</p>}
            {selected && (
              <LevelEditor
                level={selected}
                index={levels.findIndex((level) => level.id === selected.id)}
                previousName={levels[levels.findIndex((level) => level.id === selected.id) - 1]?.name}
                issues={issues.filter((issue) => issue.levelId === selected.id)}
                sensors={sensors}
                onName={(name) => setLevels(levels.map((level) => (level.id === selected.id ? { ...level, name } : level)))}
                onAdd={() => addProject(selected)}
                onDeleteLevel={() => deleteLevel(selected)}
                onDragEnd={onProjectDragEnd}
                onProject={(projectId, patch) => setLevels(levels.map((level) => level.id === selected.id ? { ...level, projects: level.projects.map((project) => project.id === projectId ? { ...project, ...patch } : project) } : level))}
                onMaterials={(projectId, materials) => setLevels(levels.map((level) => level.id === selected.id ? { ...level, projects: level.projects.map((project) => project.id === projectId ? { ...project, materials } : project) } : level))}
                onDeleteProject={(project) => deleteProject(selected, project)}
                onSave={(summary) => stage(levels, summary, null)}
                onUpload={async (projectId, materialId, file) => {
                  const body = new FormData();
                  body.set("file", file);
                  try {
                    const uploaded = await api<{ fileKey: string; fileName: string; mimeType: string }>("/curriculum/uploads", { method: "POST", body });
                    setLevels((current) => current.map((level) => level.id !== selected.id ? level : {
                      ...level,
                      projects: level.projects.map((project) => project.id !== projectId ? project : {
                        ...project,
                        materials: project.materials.map((material) => material.id === materialId ? { ...material, ...uploaded, title: material.title || file.name.replace(/\.[^.]+$/, "") } : material),
                      }),
                    }));
                    toast.success("File uploaded. Save the project to keep it in the curriculum.");
                  } catch (error) {
                    toast.error(error instanceof ApiError ? error.message : "Upload failed");
                  }
                }}
              />
            )}
            {dirty && (
              <div className="sticky bottom-3 mt-4 flex items-center justify-between gap-2 rounded-xl border bg-card p-3 shadow-sm">
                <p className="text-sm">Unsaved edits are only in this browser until you save.</p>
                <Button onClick={() => stage(levels, "Save these curriculum edits?", null)}>Save changes</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {pending && (
        <ChoiceDialog
          summary={pending.summary}
          removedSubmissions={removedSubmissions}
          issues={pendingIssues}
          pending={busy}
          onCancel={cancelPending}
          onDraft={() => void commit("draft")}
          onPublish={() => void commit("publish")}
        />
      )}

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen} title="Version history">
        <div className="flex flex-col gap-2">
          {versions.length === 0 && <p className="text-sm text-muted-foreground">No versions yet. The first publish is recorded here.</p>}
          {versions.map((version) => (
            <Card key={version.id} className="p-3">
              <p className="text-sm font-medium">{version.status === "DRAFT" ? "Draft" : "Published"}</p>
              <p className="text-sm">{version.summary}</p>
              <p className="text-xs text-muted-foreground">{version.author?.name || "HQ"} · {new Date(version.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              {version.status === "PUBLISHED" && <Button className="mt-2" variant="outline" size="sm" onClick={() => setRestoreId(version.id)}>Restore this version</Button>}
            </Card>
          ))}
        </div>
      </Sheet>

      <ConfirmDialog
        open={Boolean(restoreId)}
        onOpenChange={(open) => { if (!open) setRestoreId(null); }}
        title="Restore this published version?"
        description="Members will see this curriculum immediately. The version you are replacing stays in the history, so you can restore it again."
        confirmLabel="Restore"
        pending={busy}
        onConfirm={() => {
          if (!restoreId) return;
          setBusy(true);
          api<Builder>("/curriculum/rollback", { method: "POST", body: JSON.stringify({ versionId: restoreId }) })
            .then((data) => { applyPayload(data); setRestoreId(null); setHistoryOpen(false); toast.success("Curriculum restored"); })
            .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not restore"))
            .finally(() => setBusy(false));
        }}
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard the draft?"
        description="The editor reloads the published curriculum. The draft version is removed."
        confirmLabel="Discard draft"
        destructive
        pending={busy}
        onConfirm={() => {
          setBusy(true);
          api<Builder>("/curriculum/draft", { method: "DELETE" })
            .then((data) => { applyPayload(data); setDiscardOpen(false); toast.success("Draft discarded"); })
            .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not discard"))
            .finally(() => setBusy(false));
        }}
      />
    </div>
  );
}

function LevelRow({ level, index, selected, open, flagged, onSelect, onOpenProject }: {
  level: CurriculumLevel;
  index: number;
  selected: boolean;
  open: boolean;
  flagged: boolean;
  onSelect: () => void;
  onOpenProject: (projectId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: level.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`rounded-xl border bg-card ${selected ? "border-primary" : ""} ${flagged ? "border-red-300" : ""}`}>
      <div className="flex items-center gap-1 p-2">
        <button type="button" className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Drag to reorder level" {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={onSelect}>
          <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "" : "-rotate-90"}`} />
          <span className="truncate text-sm font-medium">Level {index + 1}: {level.name || "Untitled"}</span>
          {index > 0 && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-800" aria-label={`Unlocks after Level ${index} completion`} />}
          {flagged && <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" title="This level has something that blocks publishing" />}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-1 px-3 pb-2">
          {level.projects.map((project, projectIndex) => (
            <button key={project.id} type="button" className="truncate rounded px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => onOpenProject(project.id)}>{projectIndex + 1}. {project.title || "Untitled project"}</button>
          ))}
          {level.projects.length === 0 && <p className="px-2 text-xs text-muted-foreground">No projects yet.</p>}
        </div>
      )}
    </div>
  );
}

function LevelEditor({
  level, index, previousName, issues, sensors, onName, onAdd, onDeleteLevel, onDragEnd, onProject, onMaterials, onDeleteProject, onSave, onUpload,
}: {
  level: CurriculumLevel;
  index: number;
  previousName?: string;
  issues: CurriculumIssue[];
  sensors: ReturnType<typeof useSensors>;
  onName: (name: string) => void;
  onAdd: () => void;
  onDeleteLevel: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  onProject: (projectId: string, patch: Partial<CurriculumProject>) => void;
  onMaterials: (projectId: string, materials: LearningMaterial[]) => void;
  onDeleteProject: (project: CurriculumProject) => void;
  onSave: (summary: string) => void;
  onUpload: (projectId: string, materialId: string, file: File) => Promise<void>;
}) {
  const nameIssue = issues.find((issue) => issue.field === "name" && !issue.projectId);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl">Level {index + 1}</h2>
            {index > 0 && (
              <span title={`Unlocks after Level ${index} completion`} className="inline-flex items-center gap-1 text-sm text-amber-900">
                <Lock className="h-4 w-4" /> Members: unlocks after Level {index}{previousName ? ` (${previousName})` : ""} completion
              </span>
            )}
          </div>
          <Field label="Level name">
            <Input value={level.name} placeholder="Level name" onChange={(event) => onName(event.target.value)} className={nameIssue ? "border-red-500" : ""} />
          </Field>
          {nameIssue && <p className="mt-1 text-xs text-red-700">{nameIssue.message}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onAdd}><Plus className="h-4 w-4" /> Add project</Button>
          <Button variant="outline" onClick={onDeleteLevel}><Trash2 className="h-4 w-4" /> Delete level</Button>
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={level.projects.map((project) => project.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {level.projects.map((project, projectIndex) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={projectIndex}
                issues={issues.filter((issue) => issue.projectId === project.id)}
                onChange={(patch) => onProject(project.id, patch)}
                onMaterials={(materials) => onMaterials(project.id, materials)}
                onDelete={() => onDeleteProject(project)}
                onSave={() => onSave(`Save ${project.title || "this project"} and any other unsaved edits?`)}
                onUpload={(materialId, file) => onUpload(project.id, materialId, file)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {level.projects.length === 0 && <Card className="p-4 text-sm text-muted-foreground">This level has no projects. Add one from the level header.</Card>}
    </div>
  );
}

function ProjectCard({ project, index, issues, onChange, onMaterials, onDelete, onSave, onUpload }: {
  project: CurriculumProject;
  index: number;
  issues: CurriculumIssue[];
  onChange: (patch: Partial<CurriculumProject>) => void;
  onMaterials: (materials: LearningMaterial[]) => void;
  onDelete: () => void;
  onSave: () => void;
  onUpload: (materialId: string, file: File) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: project.id });
  const titleIssue = issues.find((issue) => issue.field === "title");
  const materialIssue = issues.find((issue) => issue.field === "materials");
  const guideIssue = issues.find((issue) => issue.field === "guide");
  return (
    <div id={`project-${project.id}`} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`rounded-xl border bg-card p-4 shadow-sm ${issues.length ? "border-red-300" : ""}`}>
      <div className="flex items-start gap-2">
        <button type="button" className="mt-2 cursor-grab rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Drag to reorder project" {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">Project {index + 1}</p>
            <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Delete project" onClick={onDelete}><Trash2 className="h-4 w-4" /></button>
          </div>
          <Field label="Project title">
            <Input value={project.title} placeholder="Project title" onChange={(event) => onChange({ title: event.target.value })} className={titleIssue ? "border-red-500" : ""} />
          </Field>
          {titleIssue && <p className="-mt-2 text-xs text-red-700">{titleIssue.message}</p>}
          <Field label="Description">
            <Textarea value={project.description || ""} placeholder="What the member prepares and delivers" onChange={(event) => onChange({ description: event.target.value })} />
          </Field>
          <Field label="Evaluation criteria">
            <Textarea value={project.evaluationCriteria || ""} placeholder="What the evaluator looks for" onChange={(event) => onChange({ evaluationCriteria: event.target.value })} />
          </Field>
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Learning materials</p>
              <Button type="button" variant="outline" size="sm" onClick={() => onMaterials([...project.materials, { id: newId(), title: "", kind: "GUIDE_FILE", url: "", fileKey: null, fileName: null }])}>Add material</Button>
            </div>
            <p className="text-xs text-muted-foreground">Guide files, videos, books, and articles live in one list. Order is the order members see.</p>
            {materialIssue && <p className="mt-1 text-xs text-red-700">{materialIssue.message}</p>}
            {guideIssue && <p className="mt-1 text-xs text-red-700">{guideIssue.message}</p>}
            <div className="mt-2 flex flex-col gap-2">
              {project.materials.map((material, materialIndex) => (
                <MaterialRow
                  key={material.id}
                  material={material}
                  issues={issues.filter((issue) => issue.materialId === material.id)}
                  onChange={(patch) => onMaterials(project.materials.map((item) => (item.id === material.id ? { ...item, ...patch } : item)))}
                  onRemove={() => onMaterials(project.materials.filter((item) => item.id !== material.id))}
                  onMove={(direction) => {
                    const target = materialIndex + direction;
                    if (target < 0 || target >= project.materials.length) return;
                    onMaterials(arrayMove(project.materials, materialIndex, target));
                  }}
                  onUpload={(file) => onUpload(material.id, file)}
                />
              ))}
            </div>
          </div>
          <Button type="button" variant="outline" onClick={onSave}>Save project</Button>
        </div>
      </div>
    </div>
  );
}

function MaterialRow({ material, issues, onChange, onRemove, onMove, onUpload }: {
  material: LearningMaterial;
  issues: CurriculumIssue[];
  onChange: (patch: Partial<LearningMaterial>) => void;
  onRemove: () => void;
  onMove: (direction: number) => void;
  onUpload: (file: File) => void;
}) {
  const labelIssue = issues.find((issue) => issue.field === "label");
  const sourceIssue = issues.find((issue) => issue.field === "source");
  return (
    <div className={`rounded-lg border p-3 ${issues.length ? "border-red-400" : ""}`}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" onClick={() => onMove(-1)} aria-label="Move material up">↑</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onMove(1)} aria-label="Move material down">↓</Button>
        </div>
        <Select value={material.kind} onChange={(event) => onChange({ kind: event.target.value as MaterialKind })} aria-label="Material type" className="sm:w-40">
          {MATERIAL_KINDS.map((kind) => <option key={kind.id} value={kind.id}>{kind.label}</option>)}
        </Select>
        <Input value={material.title} placeholder="Label" aria-label="Material label" onChange={(event) => onChange({ title: event.target.value })} className={labelIssue ? "border-red-500" : ""} />
        <button type="button" className="self-center rounded p-1 text-muted-foreground hover:text-destructive" aria-label="Remove material" onClick={onRemove}><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input value={material.url || ""} placeholder="https://" aria-label="Material URL" onChange={(event) => onChange({ url: event.target.value })} className={sourceIssue ? "border-red-500" : ""} />
        <label className="text-sm text-primary">
          <input type="file" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ""; }} />
          <span className="inline-flex h-11 cursor-pointer items-center rounded-md border px-3">Upload file</span>
        </label>
      </div>
      {material.fileName && <p className="mt-1 text-xs text-muted-foreground">File: {material.fileName}</p>}
      {(labelIssue || sourceIssue) && <p className="mt-1 text-xs text-red-700">{labelIssue?.message || sourceIssue?.message}</p>}
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{kindLabel(material.kind)}</p>
    </div>
  );
}

function ChoiceDialog({ summary, removedSubmissions, issues, pending, onCancel, onDraft, onPublish }: {
  summary: string;
  removedSubmissions: number;
  issues: CurriculumIssue[];
  pending: boolean;
  onCancel: () => void;
  onDraft: () => void;
  onPublish: () => void;
}) {
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => { if (!open) onCancel(); }}
      title={summary}
      description="This changes the curriculum members are working through. Publishing applies it immediately. Saving as a draft keeps the current published version in place until you publish."
      confirmLabel="Publish now"
      confirmDisabled={issues.length > 0}
      pending={pending}
      onConfirm={onPublish}
    >
      {removedSubmissions > 0 && <p className="text-sm text-red-700">{removedSubmissions} member submission{removedSubmissions === 1 ? "" : "s"} sit on projects you are removing. Publishing deletes those submissions.</p>}
      {issues.length > 0 && (
        <div className="text-sm text-red-700">
          <p>Publishing is blocked until these are fixed:</p>
          <ul className="mt-1 list-disc pl-4">
            {issues.slice(0, 6).map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}
          </ul>
        </div>
      )}
      <Button type="button" variant="outline" disabled={pending} onClick={onDraft}>Save as draft</Button>
    </ConfirmDialog>
  );
}
