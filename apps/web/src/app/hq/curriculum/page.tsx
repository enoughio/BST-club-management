"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { ApiError, api, fileUrl } from "@/lib/api";

type Material = { id: string; title: string; kind: string; fileName: string };
type Project = { id: string; number: number; title: string; description: string | null; materials: Material[] };
type Level = { id: string; number: number; name: string; projects: Project[] };

export default function CurriculumPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [levelName, setLevelName] = useState("");
  const [levelNumber, setLevelNumber] = useState("6");
  const [project, setProject] = useState({ levelId: "", number: "1", title: "" });

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

  return (
    <div>
      <PageIntro title="Curriculum" lede="Levels, projects, and the files members download." />
      <div className="flex flex-col gap-4">
        {levels.map((level) => (
          <Card key={level.id} className="p-4">
            <h2 className="font-serif text-2xl">Level {level.number}: {level.name}</h2>
            {level.projects.map((item) => (
              <div key={item.id} className="mt-3 border-t pt-3">
                <p className="font-medium">{item.number}. {item.title}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                {item.materials.map((material) => (
                  <p key={material.id} className="mt-1 text-sm">
                    <a className="text-primary" href={fileUrl(`/api/v1/curriculum/materials/${material.id}/download`)}>{material.title}</a>
                    <button className="ml-3 text-destructive" onClick={() => api(`/curriculum/materials/${material.id}`, { method: "DELETE" }).then(load)}>Remove</button>
                  </p>
                ))}
                <form className="mt-2 flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); void upload(item.id, event.currentTarget); }}>
                  <Input name="title" placeholder="File title" required />
                  <Select name="kind" defaultValue="GUIDE"><option>GUIDE</option><option>HANDBOOK</option><option>OTHER</option></Select>
                  <Input name="file" type="file" required />
                  <Button type="submit" variant="outline">Upload</Button>
                </form>
              </div>
            ))}
          </Card>
        ))}
      </div>
      <form className="mt-6 flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); api("/curriculum/levels", { method: "POST", body: JSON.stringify({ number: Number(levelNumber), name: levelName }) }).then(() => { toast.success("Level added"); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not add level")); }}>
        <h2 className="font-serif text-2xl">Add a level</h2>
        <Field label="Number"><Input value={levelNumber} onChange={(event) => setLevelNumber(event.target.value)} /></Field>
        <Field label="Name"><Input value={levelName} onChange={(event) => setLevelName(event.target.value)} /></Field>
        <Button type="submit">Add level</Button>
      </form>
      <form className="mt-6 flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); api("/curriculum/projects", { method: "POST", body: JSON.stringify({ levelId: project.levelId, number: Number(project.number), title: project.title }) }).then(() => { toast.success("Project added"); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not add project")); }}>
        <h2 className="font-serif text-2xl">Add a project</h2>
        <Select value={project.levelId} onChange={(event) => setProject({ ...project, levelId: event.target.value })}>
          {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
        </Select>
        <Input value={project.number} onChange={(event) => setProject({ ...project, number: event.target.value })} />
        <Input value={project.title} placeholder="Project title" onChange={(event) => setProject({ ...project, title: event.target.value })} />
        <Button type="submit">Add project</Button>
      </form>
    </div>
  );
}
