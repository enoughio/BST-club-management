"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ApiError, api, fileUrl } from "@/lib/api";

type Material = { id: string; title: string; kind: string; fileName: string | null; url: string | null };
type Project = { id: string; number: number; title: string; description: string | null; materials: Material[] };
type Level = { id: string; number: number; name: string; projects: Project[] };

export default function CurriculumPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [levelName, setLevelName] = useState("");
  const [levelNumber, setLevelNumber] = useState("6");
  const [project, setProject] = useState({ levelId: "", number: "1", title: "", description: "" });

  function load() {
    api<{ levels: Level[] }>("/curriculum").then((data) => {
      setLevels(data.levels);
      setProject((current) => ({ ...current, levelId: current.levelId || data.levels[0]?.id || "" }));
    }).catch(() => undefined);
  }
  useEffect(load, []);

  async function upload(projectId: string, form: HTMLFormElement) {
    const body = new FormData(form);
    try {
      await api(`/curriculum/projects/${projectId}/materials`, { method: "POST", body });
      toast.success("File uploaded");
      form.reset();
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Upload failed");
    }
  }

  async function addLink(projectId: string, form: HTMLFormElement) {
    const body = new FormData(form);
    try {
      await api(`/curriculum/projects/${projectId}/links`, {
        method: "POST",
        body: JSON.stringify({ title: body.get("title"), url: body.get("url"), kind: body.get("kind") }),
      });
      toast.success("Learning link added");
      form.reset();
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not add link");
    }
  }

  return (
    <div>
      <PageIntro title="Curriculum" lede="Levels unlock in order. Each project can have a guide file and learning links. Members download those; they do not upload manuscripts here." />
      <div className="flex flex-col gap-4">
        {levels.map((level, index) => (
          <Card key={level.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-2xl">Level {level.number}: {level.name}</h2>
              {index > 0 && <Badge>Locked until the previous level is complete</Badge>}
            </div>
            {index > 0 && <p className="mt-1 text-sm text-muted-foreground">Members can work on this level only after every project in earlier levels is approved.</p>}
            <LevelEditor level={level} onSaved={load} />
            {level.projects.map((item) => (
              <ProjectEditor key={item.id} project={item} onUpload={upload} onLink={addLink} onSaved={load} />
            ))}
          </Card>
        ))}
      </div>
      <form className="mt-6 flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); api("/curriculum/levels", { method: "POST", body: JSON.stringify({ number: Number(levelNumber), name: levelName }) }).then(() => { toast.success("Level added"); setLevelName(""); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not add level")); }}>
        <h2 className="font-serif text-2xl">Add a level</h2>
        <Field label="Number"><Input value={levelNumber} onChange={(event) => setLevelNumber(event.target.value)} /></Field>
        <Field label="Name"><Input value={levelName} onChange={(event) => setLevelName(event.target.value)} required /></Field>
        <Button type="submit">Add level</Button>
      </form>
      <form className="mt-6 flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); api("/curriculum/projects", { method: "POST", body: JSON.stringify({ levelId: project.levelId, number: Number(project.number), title: project.title, description: project.description || null }) }).then(() => { toast.success("Project added"); setProject({ ...project, title: "", description: "" }); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not add project")); }}>
        <h2 className="font-serif text-2xl">Add a project</h2>
        <Field label="Level">
          <Select value={project.levelId} onChange={(event) => setProject({ ...project, levelId: event.target.value })}>
            {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
          </Select>
        </Field>
        <Field label="Number"><Input value={project.number} onChange={(event) => setProject({ ...project, number: event.target.value })} /></Field>
        <Field label="Title"><Input value={project.title} placeholder="Project title" onChange={(event) => setProject({ ...project, title: event.target.value })} required /></Field>
        <Field label="Description"><Textarea value={project.description} onChange={(event) => setProject({ ...project, description: event.target.value })} /></Field>
        <Button type="submit">Add project</Button>
      </form>
    </div>
  );
}

function LevelEditor({ level, onSaved }: { level: Level; onSaved: () => void }) {
  const [name, setName] = useState(level.name);
  const [number, setNumber] = useState(String(level.number));
  useEffect(() => { setName(level.name); setNumber(String(level.number)); }, [level.name, level.number]);
  return (
    <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(event) => {
      event.preventDefault();
      api(`/curriculum/levels/${level.id}`, { method: "PATCH", body: JSON.stringify({ name, number: Number(number) }) })
        .then(() => { toast.success("Level saved"); onSaved(); })
        .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save level"));
    }}>
      <Field label="Level number"><Input value={number} onChange={(event) => setNumber(event.target.value)} required /></Field>
      <Field label="Level name"><Input value={name} onChange={(event) => setName(event.target.value)} required /></Field>
      <Button type="submit" variant="outline">Save level</Button>
    </form>
  );
}

function MaterialRow({ material, onRemoved }: { material: Material; onRemoved: () => void }) {
  const external = material.kind === "LINK" || material.kind === "YOUTUBE";
  return (
    <p className="mt-1 text-sm">
      {external && material.url ? (
        <a className="text-primary" href={material.url} target="_blank" rel="noreferrer">{material.title}</a>
      ) : external ? (
        <span>{material.title}</span>
      ) : (
        <a className="text-primary" href={fileUrl(`/api/v1/curriculum/materials/${material.id}/download`)}>{material.title}</a>
      )}
      <span className="ml-2 text-muted-foreground">{material.kind}</span>
      <button className="ml-3 text-destructive" onClick={() => api(`/curriculum/materials/${material.id}`, { method: "DELETE" }).then(onRemoved).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not remove"))}>Remove</button>
    </p>
  );
}

function ProjectEditor({ project, onUpload, onLink, onSaved }: { project: Project; onUpload: (projectId: string, form: HTMLFormElement) => Promise<void>; onLink: (projectId: string, form: HTMLFormElement) => Promise<void>; onSaved: () => void }) {
  const [title, setTitle] = useState(project.title);
  const [number, setNumber] = useState(String(project.number));
  const [description, setDescription] = useState(project.description || "");
  useEffect(() => {
    setTitle(project.title);
    setNumber(String(project.number));
    setDescription(project.description || "");
  }, [project.title, project.number, project.description]);

  return (
    <div className="mt-4 border-t pt-3">
      <form className="flex flex-col gap-2" onSubmit={(event) => {
        event.preventDefault();
        api(`/curriculum/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ title, number: Number(number), description: description || null }) })
          .then(() => { toast.success("Project saved"); onSaved(); })
          .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save project"));
      }}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={number} onChange={(event) => setNumber(event.target.value)} aria-label="Project number" className="sm:w-24" />
          <Input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Project title" required />
        </div>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} aria-label="Project description" />
        <Button type="submit" variant="outline">Save project</Button>
      </form>
      {project.materials.map((material) => <MaterialRow key={material.id} material={material} onRemoved={onSaved} />)}
      <form className="mt-3 flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); void onUpload(project.id, event.currentTarget); }}>
        <p className="text-sm font-medium">Project guide</p>
        <Input name="title" placeholder="Guide title" required />
        <input type="hidden" name="kind" value="GUIDE" />
        <Input name="file" type="file" required />
        <Button type="submit" variant="outline">Upload guide</Button>
      </form>
      <form className="mt-3 flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); void onUpload(project.id, event.currentTarget); }}>
        <p className="text-sm font-medium">Handbook or other file</p>
        <Input name="title" placeholder="File title" required />
        <Select name="kind" defaultValue="HANDBOOK"><option value="HANDBOOK">HANDBOOK</option><option value="OTHER">OTHER</option></Select>
        <Input name="file" type="file" required />
        <Button type="submit" variant="outline">Upload file</Button>
      </form>
      <form className="mt-3 flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); void onLink(project.id, event.currentTarget); }}>
        <p className="text-sm font-medium">Learning link</p>
        <Input name="title" placeholder="Link title" required />
        <Input name="url" type="url" placeholder="https://" required />
        <Select name="kind" defaultValue="LINK"><option value="LINK">LINK</option><option value="YOUTUBE">YOUTUBE</option></Select>
        <Button type="submit" variant="outline">Add link</Button>
      </form>
    </div>
  );
}
