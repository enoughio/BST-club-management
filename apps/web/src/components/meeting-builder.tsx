"use client";

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { titleCase, when } from "@/lib/format";
import { AGENDA_ROLES, type Meeting, type MemberRow } from "@/lib/types";

type Slot = {
  key: string;
  role: string;
  title: string;
  assigneeId: string;
  targetUserId: string;
  projectId: string;
  durationMin: string;
};

type Project = { id: string; title: string; level?: { name: string } };

export function MeetingBuilder({ meetingId, clubId, canCancel }: { meetingId: string; clubId: string; canCancel: boolean }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [summary, setSummary] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function load() {
    const [meetingData, memberData, curriculum] = await Promise.all([
      api<{ meeting: Meeting }>(`/meetings/${meetingId}`),
      api<{ members: MemberRow[] }>(`/clubs/${clubId}/members`),
      api<{ levels: { name: string; projects: { id: string; title: string }[] }[] }>("/curriculum"),
    ]);
    setMeeting(meetingData.meeting);
    setSummary(meetingData.meeting.summary || "");
    setMembers(memberData.members.filter((row) => row.status === "ACTIVE"));
    setProjects(curriculum.levels.flatMap((level) => level.projects.map((project) => ({ ...project, level: { name: level.name } }))));
    setSlots(
      (meetingData.meeting.agenda || []).map((item) => ({
        key: item.id,
        role: item.role,
        title: item.title,
        assigneeId: item.assigneeId || "",
        targetUserId: item.targetUserId || "",
        projectId: item.projectId || "",
        durationMin: item.durationMin ? String(item.durationMin) : "",
      })),
    );
  }

  useEffect(() => {
    load().catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not load meeting"));
  }, [meetingId]);

  const locked = meeting?.status !== "DRAFT";

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= slots.length) return;
    setSlots(arrayMove(slots, index, next));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = slots.findIndex((slot) => slot.key === active.id);
    const to = slots.findIndex((slot) => slot.key === over.id);
    if (from < 0 || to < 0) return;
    setSlots(arrayMove(slots, from, to));
  }

  async function save() {
    if (!meeting) return;
    try {
      const data = await api<{ meeting: Meeting }>(`/meetings/${meeting.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          agenda: slots.map((slot, index) => ({
            sortOrder: index,
            role: slot.role,
            title: slot.title || titleCase(slot.role),
            assigneeId: slot.assigneeId || null,
            targetUserId: slot.targetUserId || null,
            projectId: slot.projectId || null,
            durationMin: slot.durationMin ? Number(slot.durationMin) : null,
          })),
        }),
      });
      setMeeting(data.meeting);
      toast.success("Agenda saved");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save");
    }
  }

  async function act(path: string, body?: unknown) {
    try {
      await api(path, { method: "POST", body: body ? JSON.stringify(body) : "{}" });
      toast.success("Updated");
      await load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Action failed");
    }
  }

  if (!meeting) return <p>Loading meeting…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">{titleCase(meeting.status)} · {when(meeting.meetingDate)} · {meeting.startTime}–{meeting.endTime}</p>
        <h1 className="font-serif text-3xl">{meeting.title}</h1>
        <p>{meeting.place}</p>
      </div>
      {locked ? (
        <div className="flex flex-col gap-3">
          {(meeting.agenda || []).map((item) => (
            <Card key={item.id} className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{titleCase(item.role)}</p>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm">{item.assignee?.name || "Unassigned"}{item.targetUser ? ` · for ${item.targetUser.name}` : ""}{item.project ? ` · ${item.project.title}` : ""}</p>
            </Card>
          ))}
          <label className="text-sm font-medium">Summary
            <textarea className="mt-1 min-h-28 w-full rounded-md border bg-card p-3" value={summary} onChange={(event) => setSummary(event.target.value)} />
          </label>
          <Button variant="outline" onClick={() => api(`/meetings/${meeting.id}/summary`, { method: "PATCH", body: JSON.stringify({ summary }) }).then(() => toast.success("Summary saved")).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save summary"))}>Save summary</Button>
          {meeting.attendance && (
            <div className="flex flex-col gap-2">
              <h2 className="font-serif text-2xl">Attendance</h2>
              {meeting.attendance.map((row) => (
                <Card key={row.id} className="p-3 text-sm">{row.user?.name} · {row.present ? "Present" : "Absent"}</Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={slots.map((slot) => slot.key)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {slots.map((slot, index) => (
                <SortableSlot key={slot.key} id={slot.key}>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{titleCase(slot.role)}</span>
                      <span className="flex gap-1">
                        <Button type="button" variant="outline" size="icon" aria-label="Move up" onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                        <Button type="button" variant="outline" size="icon" aria-label="Move down" onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      </span>
                    </div>
                    <Select value={slot.role} onChange={(event) => setSlots(slots.map((row, rowIndex) => rowIndex === index ? { ...row, role: event.target.value } : row))}>
                      {AGENDA_ROLES.map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}
                    </Select>
                    <Input value={slot.title} onChange={(event) => setSlots(slots.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row))} />
                    <Select value={slot.assigneeId} onChange={(event) => setSlots(slots.map((row, rowIndex) => rowIndex === index ? { ...row, assigneeId: event.target.value } : row))}>
                      <option value="">Unassigned</option>
                      {members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}
                    </Select>
                    {slot.role === "PREPARED_SPEAKER" && (
                      <Select value={slot.projectId} onChange={(event) => setSlots(slots.map((row, rowIndex) => rowIndex === index ? { ...row, projectId: event.target.value } : row))}>
                        <option value="">Project</option>
                        {projects.map((project) => <option key={project.id} value={project.id}>{project.level?.name}: {project.title}</option>)}
                      </Select>
                    )}
                    {slot.role === "SPEECH_EVALUATOR" && (
                      <Select value={slot.targetUserId} onChange={(event) => setSlots(slots.map((row, rowIndex) => rowIndex === index ? { ...row, targetUserId: event.target.value } : row))}>
                        <option value="">Prepared speaker</option>
                        {slots.filter((row) => row.role === "PREPARED_SPEAKER" && row.assigneeId).map((row) => {
                          const name = members.find((member) => member.user.id === row.assigneeId)?.user.name || "Speaker";
                          return <option key={row.key} value={row.assigneeId}>{name}</option>;
                        })}
                      </Select>
                    )}
                  </div>
                </SortableSlot>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!locked && <Button type="button" variant="outline" onClick={() => setSlots([...slots, { key: crypto.randomUUID(), role: "MOC", title: "Agenda item", assigneeId: "", targetUserId: "", projectId: "", durationMin: "3" }])}>Add slot</Button>}
        {!locked && <Button type="button" onClick={() => void save()}>Save draft</Button>}
        {!locked && <Button type="button" variant="accent" onClick={() => void act(`/meetings/${meeting.id}/finalize`)}>Finalize and email</Button>}
        {!locked && <Button type="button" variant="destructive" onClick={() => api(`/meetings/${meeting.id}`, { method: "DELETE" }).then(() => toast.success("Draft discarded")).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not discard"))}>Discard draft</Button>}
        {canCancel && meeting.status === "FINALIZED" && <Button type="button" variant="destructive" onClick={() => void act(`/meetings/${meeting.id}/cancel`)}>Cancel meeting</Button>}
        {canCancel && meeting.status === "FINALIZED" && <Button type="button" onClick={() => void act(`/meetings/${meeting.id}/complete`, { summary })}>Mark completed</Button>}
      </div>
    </div>
  );
}

function SortableSlot({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="rounded-xl border bg-card p-4 shadow-sm">
      <button type="button" className="mb-2 hidden items-center gap-1 text-xs text-muted-foreground md:inline-flex" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" /> Drag
      </button>
      {children}
    </div>
  );
}
