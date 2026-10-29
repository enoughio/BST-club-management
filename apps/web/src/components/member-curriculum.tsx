"use client";

import { Check, ChevronDown, Lock, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { CertificateView } from "@/components/certificate-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { fileUrl } from "@/lib/api";
import { kindLabel, type CurriculumLevel, type CurriculumProject, type LearningMaterial } from "@/lib/curriculum";
import { when } from "@/lib/format";
import { cn } from "@/lib/utils";

type ProgressRow = {
  projectId: string;
  approved: boolean;
  score: number | null;
  feedback?: string | null;
  approvedAt?: string | null;
};

type TimelineLevel = CurriculumLevel & { number?: number };

type NodeState = "complete" | "current" | "locked" | "upcoming";

type Achievement = { id: string; name: string; score: number | null; earnedAt: string | null };

const MEMBER_BLUE = "hsl(221 83% 40%)";
const STRIP_COLORS = ["bg-blue-700", "bg-emerald-600", "bg-rose-600", "bg-amber-600", "bg-violet-600", "bg-cyan-700"];

export function MemberCurriculum({
  levels,
  progress = [],
  simulated = false,
  showLocks = true,
  onSelect,
  certificates = [],
  memberName,
}: {
  levels: TimelineLevel[];
  progress?: ProgressRow[];
  simulated?: boolean;
  showLocks?: boolean;
  onSelect?: (projectId: string) => void;
  certificates?: CertificateView[];
  memberName?: string;
}) {
  const [openIds, setOpenIds] = useState<string[] | null>(null);
  const [guide, setGuide] = useState<CurriculumProject | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const memberTimeline = !simulated;

  const progressById = useMemo(() => {
    const map = new Map<string, ProgressRow>();
    if (!simulated) progress.forEach((row) => map.set(row.projectId, row));
    return map;
  }, [progress, simulated]);

  const approved = useMemo(() => {
    const ids = new Set<string>();
    progressById.forEach((row, id) => {
      if (row.approved) ids.add(id);
    });
    return ids;
  }, [progressById]);

  const views = useMemo(() => {
    return levels.map((level, index) => {
      const unlocked = !showLocks || (simulated ? index === 0 : levels.slice(0, index).every((earlier) => earlier.projects.every((project) => approved.has(project.id))));
      const complete = level.projects.every((project) => approved.has(project.id));
      return { level, index, number: level.number ?? index + 1, unlocked, complete };
    });
  }, [levels, approved, showLocks, simulated]);

  const currentIndex = views.findIndex((view) => view.unlocked && !view.complete);
  const lastLevelName = levels[levels.length - 1]?.name?.trim() || "";
  const allProjects = levels.flatMap((level) => level.projects);
  const approvedCount = allProjects.filter((project) => approved.has(project.id)).length;
  const percent = allProjects.length === 0 ? 0 : Math.round((approvedCount / allProjects.length) * 100);
  const completedLevels = views.filter((view) => view.complete && view.level.projects.length > 0).map((view) => view.level.name || `Level ${view.number}`);
  const achievements = useMemo(() => buildAchievements(levels, progressById, simulated ? [] : certificates), [levels, progressById, certificates, simulated]);
  const summary = progressSummary({ name: memberName || "Member", percent, completedLevels, achievements });

  function nodeState(index: number): NodeState {
    const view = views[index];
    if (!view) return "upcoming";
    if (showLocks && !view.unlocked) return "locked";
    if (view.complete) return "complete";
    if (index === currentIndex) return "current";
    return "upcoming";
  }

  function isOpen(id: string) {
    if (openIds === null) {
      const current = currentIndex >= 0 ? levels[currentIndex] : undefined;
      return current?.id === id;
    }
    return openIds.includes(id);
  }

  function toggle(id: string) {
    const current = currentIndex >= 0 ? levels[currentIndex] : undefined;
    const base = openIds ?? (current ? [current.id] : []);
    setOpenIds(base.includes(id) ? base.filter((item) => item !== id) : [...base, id]);
  }

  if (levels.length === 0) {
    return <p className="text-sm text-muted-foreground">No curriculum has been published yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {memberTimeline && (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Curriculum progress</p>
              <p className="font-serif text-4xl tabular-nums" style={{ color: MEMBER_BLUE }}>{percent}%</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4" /> Share Progress
            </Button>
          </div>
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-neutral-200"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Curriculum completed"
          >
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${percent}%`, backgroundColor: MEMBER_BLUE }} />
          </div>
          <p className="mt-3 text-sm">{motivation(percent, lastLevelName)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{approvedCount} of {allProjects.length} projects approved</p>
        </Card>
      )}

      <ol className="flex flex-col">
        {views.map((view) => {
          const state = nodeState(view.index);
          const open = isOpen(view.level.id);
          const next = view.index < views.length - 1 ? nodeState(view.index + 1) : null;
          const connector = next == null ? null : next === "locked" ? "dashed" : state === "complete" ? "green" : "muted";
          const requirement = state === "locked" ? lockRequirement(views[view.index - 1]) : null;
          const panelId = `level-panel-${view.level.id}`;
          const active = state === "current" ? activeProject(view.level, view.index, approved, progressById, simulated) : null;
          const cards = view.level.projects.filter((project) => project.id !== active?.id);
          return (
            <li key={view.level.id} className="relative pb-6">
              {connector && <span aria-hidden className={connectorClass(connector)} />}
              <button
                type="button"
                className="flex min-h-11 w-full items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(221_83%_40%)]"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(view.level.id)}
              >
                <LevelNode state={state} number={view.number} />
                <span className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">Level {view.number}: {view.level.name || "Untitled level"}</span>
                    <span className="block text-xs text-muted-foreground">{stateLabel(state)}</span>
                  </span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open ? "" : "-rotate-90")} />
                </span>
              </button>
              {requirement && !open && <p className="ml-14 mt-1 text-xs text-neutral-500">{requirement}</p>}
              {active && (
                <div className="ml-14 mt-3">
                  <ActiveProjectCard project={active} started={isStarted(active, view.index, view.level, progressById, simulated)} onSelect={onSelect} onGuide={() => setGuide(active)} />
                </div>
              )}
              <div className={cn("ml-14 grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div id={panelId} className="min-h-0 overflow-hidden" inert={!open} aria-hidden={open ? undefined : true}>
                  <div className="flex flex-col gap-2 pt-3">
                    {state === "locked" && requirement && (
                      <p className="rounded-lg bg-neutral-100 px-3 py-3 text-sm text-neutral-600">{requirement}</p>
                    )}
                    {state !== "locked" && cards.map((project) => {
                      const row = progressById.get(project.id);
                      const started = isStarted(project, view.index, view.level, progressById, simulated);
                      const status = projectStatus(project.id, started, approved);
                      return (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          status={status}
                          row={row}
                          onSelect={onSelect}
                          onGuide={() => setGuide(project)}
                        />
                      );
                    })}
                    {state !== "locked" && cards.length === 0 && !active && (
                      <p className="text-sm text-muted-foreground">This level has no projects yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {memberTimeline && (
        <section aria-label="Certificates and achievements">
          <h2 className="font-serif text-2xl">Certificates & Achievements</h2>
          {achievements.length === 0 ? (
            <Card className="mt-3 p-4 text-sm text-muted-foreground">No certificates yet. When an evaluator approves a project, it shows up here.</Card>
          ) : (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
              {achievements.map((item, index) => (
                <article key={item.id} className={cn("w-60 shrink-0 snap-start rounded-2xl p-4 text-white shadow-sm", STRIP_COLORS[index % STRIP_COLORS.length])}>
                  <p className="text-[11px] uppercase tracking-wide text-white/80">Certificate</p>
                  <p className="mt-2 line-clamp-2 font-medium">{item.name}</p>
                  <p className="mt-3 font-serif text-3xl tabular-nums">{item.score != null ? item.score : "Earned"}</p>
                  <p className="text-xs text-white/80">{item.score != null ? "Score" : "Award"}{item.earnedAt ? ` · ${when(item.earnedAt)}` : ""}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <Sheet open={Boolean(guide)} onOpenChange={(open) => { if (!open) setGuide(null); }} title={guide?.title || "Learning guide"}>
        {guide && <GuidePanel project={guide} />}
      </Sheet>

      {memberTimeline && (
        <Sheet open={shareOpen} onOpenChange={setShareOpen} title="Share progress">
          <p className="whitespace-pre-wrap text-sm">{summary}</p>
          <div className="mt-4 flex flex-col gap-2">
            <Button type="button" onClick={() => void shareSnapshot(summary, memberName || "Member", percent, completedLevels, achievements)}>Share snapshot</Button>
            <Button type="button" variant="outline" asChild>
              <a href={mailtoHref(memberName || "Member", summary)}>Email summary</a>
            </Button>
            <Button type="button" variant="outline" onClick={() => void downloadSnapshot(memberName || "Member", percent, completedLevels, achievements)}>Download image</Button>
            <Button type="button" variant="outline" onClick={() => void copySummary(summary)}>Copy summary</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function LevelNode({ state, number }: { state: NodeState; number: number }) {
  const className = cn(
    "relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2",
    state === "complete" && "border-emerald-600 bg-emerald-600 text-white",
    state === "current" && "bg-white shadow-[0_0_0_4px_hsl(221_83%_40%/0.18)]",
    state === "locked" && "border-neutral-300 bg-neutral-200 text-neutral-500",
    state === "upcoming" && "border-neutral-300 bg-white text-neutral-500",
  );
  return (
    <span className={className} style={state === "current" ? { borderColor: MEMBER_BLUE, color: MEMBER_BLUE } : undefined} aria-hidden>
      {state === "complete" && <Check className="h-5 w-5" />}
      {state === "locked" && <Lock className="h-5 w-5" />}
      {(state === "current" || state === "upcoming") && <span className="text-sm font-semibold">{number}</span>}
    </span>
  );
}

function ActiveProjectCard({ project, started, onSelect, onGuide }: { project: CurriculumProject; started: boolean; onSelect?: (projectId: string) => void; onGuide: () => void }) {
  const description = project.description?.trim() || project.title || "Untitled project";
  return (
    <Card className="border-[hsl(221_83%_40%)] p-4 shadow-sm ring-1 ring-[hsl(221_83%_40%/0.25)]">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: MEMBER_BLUE }}>{started ? "In progress" : "Ready to start"}</p>
      <p className="mt-1 font-serif text-2xl leading-tight">{project.title || "Untitled project"}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {onSelect && (
          <Button type="button" className="sm:min-w-40" onClick={() => onSelect(project.id)}>{started ? "Continue" : "Start Project"}</Button>
        )}
        <Button type="button" variant="outline" onClick={onGuide}>View Guide</Button>
      </div>
    </Card>
  );
}

function ProjectCard({ project, status, row, onSelect, onGuide }: {
  project: CurriculumProject;
  status: "Approved" | "In Progress" | "Available";
  row?: ProgressRow;
  onSelect?: (projectId: string) => void;
  onGuide: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium">{project.title || "Untitled project"}</p>
        <Badge className={status === "Approved" ? "bg-emerald-100 text-emerald-900" : status === "In Progress" ? "bg-blue-100 text-blue-900" : "bg-card text-foreground"}>{status}{row?.approved && row.score != null ? ` · ${row.score}` : ""}</Badge>
      </div>
      {project.description && <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>}
      {project.evaluationCriteria && <p className="mt-2 text-sm"><span className="font-medium">Evaluation criteria. </span>{project.evaluationCriteria}</p>}
      {row?.feedback && <p className="mt-2 text-sm">{row.feedback}</p>}
      {row?.approved && <p className="mt-2 text-xs text-muted-foreground">{row.score != null ? `Score ${row.score}` : "Approved"}{row.approvedAt ? ` · ${when(row.approvedAt)}` : ""}</p>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {onSelect && status === "Available" && <Button type="button" variant="outline" onClick={() => onSelect(project.id)}>Start Project</Button>}
        {onSelect && status === "In Progress" && <Button type="button" variant="outline" onClick={() => onSelect(project.id)}>Continue</Button>}
        <Button type="button" variant="outline" onClick={onGuide}>View Guide</Button>
      </div>
    </Card>
  );
}

function GuidePanel({ project }: { project: CurriculumProject }) {
  return (
    <div className="flex flex-col gap-3">
      {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
      {project.evaluationCriteria && <p className="text-sm"><span className="font-medium">Evaluation criteria. </span>{project.evaluationCriteria}</p>}
      {project.materials.length === 0 && <p className="rounded-lg bg-muted px-3 py-3 text-sm">No guide yet</p>}
      {project.materials.map((material) => <MaterialBlock key={material.id} material={material} />)}
    </div>
  );
}

function MaterialBlock({ material }: { material: LearningMaterial }) {
  const label = `${kindLabel(material.kind)} · ${material.title || "Untitled"}`;
  const url = material.url?.trim() || "";
  const frame = url ? sameOriginUrl(url) : null;
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">{label}</p>
      {frame && <iframe title={material.title || "Guide"} src={frame} className="mt-2 h-64 w-full rounded-md border" />}
      {url && !frame && (
        <a className="mt-2 inline-flex min-h-11 items-center text-sm text-primary" href={url} target="_blank" rel="noreferrer">Open link</a>
      )}
      {material.fileKey && !material.id.startsWith("new-") && (
        <a className="mt-1 inline-flex min-h-11 items-center text-sm text-primary" href={fileUrl(`/api/v1/curriculum/materials/${material.id}/download`)} target="_blank" rel="noreferrer">
          Download{material.fileName ? ` ${material.fileName}` : " file"}
        </a>
      )}
      {!url && !material.fileKey && <p className="mt-1 text-sm text-muted-foreground">{material.fileName || "No file yet"}</p>}
    </div>
  );
}

function connectorClass(kind: "green" | "dashed" | "muted") {
  if (kind === "dashed") return "absolute bottom-0 left-[22px] top-11 w-0 border-l border-dashed border-neutral-400 sm:border-l-2";
  if (kind === "green") return "absolute bottom-0 left-[21px] top-11 w-px bg-emerald-600 sm:w-0.5";
  return "absolute bottom-0 left-[21px] top-11 w-px bg-neutral-300 sm:w-0.5";
}

function stateLabel(state: NodeState) {
  if (state === "complete") return "Completed";
  if (state === "current") return "Current level";
  if (state === "locked") return "Locked";
  return "Up next";
}

function lockRequirement(previous?: { number: number; level: TimelineLevel }) {
  if (!previous) return "Complete the earlier level to unlock this one.";
  const count = previous.level.projects.length;
  const noun = count === 1 ? "project" : "projects";
  return `Complete all ${count} ${noun} in Level ${previous.number}`;
}

function activeProject(level: TimelineLevel, levelIndex: number, approved: Set<string>, progressById: Map<string, ProgressRow>, simulated: boolean) {
  const started = level.projects.find((project, projectIndex) => {
    const rowStarted = simulated ? levelIndex === 0 && projectIndex === 0 : progressById.has(project.id);
    return rowStarted && !approved.has(project.id);
  });
  if (started) return started;
  return level.projects.find((project) => !approved.has(project.id)) || null;
}

function isStarted(project: CurriculumProject, levelIndex: number, level: TimelineLevel, progressById: Map<string, ProgressRow>, simulated: boolean) {
  if (simulated) {
    const projectIndex = level.projects.findIndex((item) => item.id === project.id);
    return levelIndex === 0 && projectIndex === 0;
  }
  return progressById.has(project.id);
}

function projectStatus(projectId: string, started: boolean, approved: Set<string>): "Approved" | "In Progress" | "Available" {
  if (approved.has(projectId)) return "Approved";
  if (started) return "In Progress";
  return "Available";
}

function motivation(percent: number, lastName: string) {
  const destination = lastName.trim() || "the end of the path";
  if (percent >= 100) return `You finished ${destination}. Every project on the path is approved.`;
  if (percent >= 75) return `The finish line is close. A few projects are left before ${destination}.`;
  if (percent >= 40) return `You're halfway to your ${destination}!`;
  if (percent > 0) return `You're early on the path. Each project you finish moves you closer to ${destination}.`;
  return `This is the start of the path. Your first project is the way toward ${destination}.`;
}

function buildAchievements(levels: TimelineLevel[], progressById: Map<string, ProgressRow>, certificates: CertificateView[]): Achievement[] {
  const projectById = new Map(levels.flatMap((level) => level.projects.map((project) => [project.id, project])));
  const fromCerts: Achievement[] = certificates.map((certificate) => ({
    id: certificate.id,
    name: certificate.memberProject?.project?.title || certificate.title,
    score: certificate.memberProject?.score ?? null,
    earnedAt: certificate.issuedAt,
  }));
  const names = new Set(fromCerts.map((item) => item.name));
  const fromProgress: Achievement[] = [];
  progressById.forEach((row, projectId) => {
    if (!row.approved) return;
    const name = projectById.get(projectId)?.title || "Approved project";
    if (names.has(name)) return;
    fromProgress.push({ id: projectId, name, score: row.score, earnedAt: row.approvedAt || null });
  });
  return [...fromCerts, ...fromProgress].sort((a, b) => (Date.parse(b.earnedAt || "") || 0) - (Date.parse(a.earnedAt || "") || 0));
}

function progressSummary({ name, percent, completedLevels, achievements }: { name: string; percent: number; completedLevels: string[]; achievements: Achievement[] }) {
  const levelLine = completedLevels.length ? `Completed levels: ${completedLevels.join(", ")}.` : "No level is fully completed yet.";
  const latest = achievements.slice(0, 3);
  const certLine = latest.length
    ? `Latest certificates: ${latest.map((item) => {
      const score = item.score != null ? `score ${item.score}` : "earned";
      const date = item.earnedAt ? when(item.earnedAt) : "date not recorded";
      return `${item.name} (${score}, ${date})`;
    }).join("; ")}.`
    : "No certificates yet.";
  return `${name} has completed ${percent}% of the curriculum.\n${levelLine}\n${certLine}`;
}

function mailtoHref(name: string, summary: string) {
  return `mailto:?subject=${encodeURIComponent(`${name}'s club progress`)}&body=${encodeURIComponent(summary)}`;
}

function sameOriginUrl(value: string) {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin === window.location.origin ? url.toString() : null;
  } catch {
    return null;
  }
}

async function shareSnapshot(summary: string, name: string, percent: number, completedLevels: string[], achievements: Achievement[]) {
  try {
    const blob = await renderShareCard({ name, percent, completedLevels, achievements });
    const file = new File([blob], "club-progress.png", { type: "image/png" });
    const title = `${name}'s club progress`;
    if (typeof navigator.share === "function") {
      const withFile = { title, text: summary, files: [file] };
      try {
        if (typeof navigator.canShare === "function" && navigator.canShare(withFile)) {
          await navigator.share(withFile);
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
      try {
        await navigator.share({ title, text: summary });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    downloadBlob(blob, "club-progress.png");
    const copied = await writeClipboard(summary);
    toast.success(copied ? "Image downloaded and summary copied" : "Image downloaded");
  } catch {
    toast.error("Could not share progress");
  }
}

async function downloadSnapshot(name: string, percent: number, completedLevels: string[], achievements: Achievement[]) {
  try {
    const blob = await renderShareCard({ name, percent, completedLevels, achievements });
    downloadBlob(blob, "club-progress.png");
    toast.success("Image downloaded");
  } catch {
    toast.error("Could not download the snapshot");
  }
}

async function copySummary(summary: string) {
  const copied = await writeClipboard(summary);
  toast[copied ? "success" : "error"](copied ? "Summary copied" : "Could not copy the summary");
}

async function writeClipboard(summary: string) {
  try {
    await navigator.clipboard.writeText(summary);
    return true;
  } catch {
    return false;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function renderShareCard({ name, percent, completedLevels, achievements }: { name: string; percent: number; completedLevels: string[]; achievements: Achievement[] }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the snapshot");
  ctx.fillStyle = "#f6f1e8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1147bb";
  ctx.fillRect(0, 0, canvas.width, 390);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 34px Georgia, serif";
  ctx.fillText("Club progress", 72, 110);
  ctx.font = "700 64px Georgia, serif";
  wrapLines(ctx, name, 936).slice(0, 2).forEach((line, index) => ctx.fillText(line, 72, 210 + index * 76));
  ctx.fillStyle = "#1147bb";
  ctx.font = "700 128px Georgia, serif";
  ctx.fillText(`${percent}%`, 72, 560);
  ctx.fillStyle = "#3f3a33";
  ctx.font = "400 32px Georgia, serif";
  ctx.fillText("of the curriculum is complete", 72, 620);
  ctx.font = "700 28px Georgia, serif";
  ctx.fillText("Completed levels", 72, 740);
  ctx.font = "400 30px Georgia, serif";
  const levelText = completedLevels.length ? completedLevels.join(" · ") : "None yet";
  wrapLines(ctx, levelText, 936).slice(0, 2).forEach((line, index) => ctx.fillText(line, 72, 800 + index * 42));
  ctx.font = "700 28px Georgia, serif";
  ctx.fillText("Latest certificates", 72, 960);
  const latest = achievements.slice(0, 3);
  if (latest.length === 0) {
    ctx.font = "400 30px Georgia, serif";
    ctx.fillText("None yet", 72, 1020);
  } else {
    latest.forEach((item, index) => {
      const y = 1000 + index * 100;
      ctx.fillStyle = ["#1147bb", "#059669", "#e11d48"][index] || "#1147bb";
      roundedRect(ctx, 72, y, 936, 84, 18);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 28px Georgia, serif";
      ctx.fillText(fitText(ctx, item.name, 880), 96, y + 36);
      ctx.font = "400 22px Georgia, serif";
      const meta = [item.score != null ? `Score ${item.score}` : "Earned", item.earnedAt ? when(item.earnedAt) : ""].filter(Boolean).join(" · ");
      ctx.fillText(meta, 96, y + 66);
    });
  }
  return canvasBlob(canvas);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not draw the snapshot"))), "image/png");
  });
}
