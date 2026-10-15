"use client";

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Check, GripVertical, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDashboardBus } from "@/components/dashboard-bus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
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

const statusTone: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-900",
  FINALIZED: "bg-sky-100 text-sky-900",
  COMPLETED: "bg-stone-200 text-stone-700",
  CANCELLED: "bg-stone-100 text-stone-500",
};

/** Minutes between two HH:MM strings; falls back to 120 if either is malformed. */
function windowMinutes(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((value) => Number.isNaN(value))) return 120;
  return Math.max(eh * 60 + em - (sh * 60 + sm), 1);
}

export function MeetingBuilder({ meetingId, clubId, canCancel, backHref }: { meetingId: string; clubId: string; canCancel: boolean; backHref?: string }) {
  const listHref = backHref || `/club/${clubId}/meetings`;
  const { emit } = useDashboardBus();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [summary, setSummary] = useState("");
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [dirty, setDirty] = useState(false);
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
    setDirty(false);
  }

  useEffect(() => {
    load().catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not load meeting"));
  }, [meetingId]);

  const locked = meeting?.status !== "DRAFT";
  const totalMinutes = slots.reduce((sum, slot) => sum + (Number(slot.durationMin) || 0), 0);
  const budget = meeting ? windowMinutes(meeting.startTime, meeting.endTime) : 120;
  const over = totalMinutes > budget;
  const hasRole = (role: string) => slots.some((slot) => slot.role === role && slot.assigneeId);
  const missingKeys = !hasRole("MOC") || !hasRole("OPEN_MIC_COORDINATOR");
  const unassigned = slots.filter((slot) => !slot.assigneeId).length;
  const doubleBooked = (() => {
    const seen = new Map<string, number>();
    for (const slot of slots) if (slot.assigneeId) seen.set(slot.assigneeId, (seen.get(slot.assigneeId) || 0) + 1);
    return [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => members.find((member) => member.user.id === id)?.user.name || "A member");
  })();
  const memberName = (id: string) => members.find((member) => member.user.id === id)?.user.name;

  function update(index: number, patch: Partial<Slot>) {
    setSlots(slots.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    setDirty(true);
  }

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= slots.length) return;
    setSlots(arrayMove(slots, index, next));
    setDirty(true);
  }

  function remove(index: number) {
    setSlots(slots.filter((_, rowIndex) => rowIndex !== index));
    setDirty(true);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over: target } = event;
    if (!target || active.id === target.id) return;
    const from = slots.findIndex((slot) => slot.key === active.id);
    const to = slots.findIndex((slot) => slot.key === target.id);
    if (from < 0 || to < 0) return;
    setSlots(arrayMove(slots, from, to));
    setDirty(true);
  }

  async function save() {
    if (!meeting) return false;
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
      setDirty(false);
      toast.success("Draft saved");
      emit("meeting:changed");
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save");
      return false;
    }
  }

  async function act(path: string, body?: unknown) {
    try {
      await api(path, { method: "POST", body: body ? JSON.stringify(body) : "{}" });
      toast.success("Updated");
      await load();
      emit("meeting:changed");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Action failed");
    }
  }

  async function finalize() {
    if (!meeting) return;
    setFinalizeOpen(false);
    if (dirty && !(await save())) return;
    await act(`/meetings/${meeting.id}/finalize`);
  }

  if (!meeting) return <p className="text-muted-foreground">Loading meeting…</p>;

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Link href={listHref} className="text-sm text-primary">← All meetings</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-3xl">{meeting.title}</h1>
          <Badge className={statusTone[meeting.status] || ""}>{titleCase(meeting.status)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{when(meeting.meetingDate)} · {meeting.startTime}–{meeting.endTime} · {meeting.place}</p>
      </div>
      {!locked && dirty && <p className="text-sm text-amber-700">Unsaved changes</p>}
    </div>
  );

  if (locked) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section>
            <h2 className="mb-3 font-serif text-2xl">Agenda</h2>
            <ol className="flex flex-col gap-2">
              {(meeting.agenda || []).map((item, index) => (
                <li key={item.id} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{titleCase(item.role)}</p>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.assignee?.name || "Unassigned"}{item.targetUser ? ` · evaluating ${item.targetUser.name}` : ""}{item.project ? ` · ${item.project.title}` : ""}</p>
                  </div>
                  {item.durationMin && <span className="shrink-0 text-sm text-muted-foreground">{item.durationMin} min</span>}
                </li>
              ))}
              {(meeting.agenda || []).length === 0 && <li className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No agenda items were recorded.</li>}
            </ol>
          </section>
          <aside className="flex flex-col gap-4">
            <Card className="p-4">
              <h2 className="font-serif text-xl">Summary</h2>
              <Textarea className="mt-2 min-h-28" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What happened at this meeting?" />
              <Button className="mt-2 w-full" variant="outline" onClick={() => api(`/meetings/${meeting.id}/summary`, { method: "PATCH", body: JSON.stringify({ summary }) }).then(() => toast.success("Summary saved")).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save summary"))}>Save summary</Button>
            </Card>
            {meeting.attendance && meeting.attendance.length > 0 && (
              <Card className="p-4">
                <h2 className="font-serif text-xl">Attendance</h2>
                <p className="text-sm text-muted-foreground">{meeting.attendance.filter((row) => row.present).length} present · {meeting.attendance.filter((row) => row.late).length} late</p>
                <ul className="mt-2 flex flex-col divide-y text-sm">
                  {meeting.attendance.map((row) => (
                    <li key={row.id || row.userId} className="flex items-center justify-between py-2">
                      <span>{row.user?.name || "Member"}</span>
                      <Badge className={row.present ? (row.late ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900") : "bg-muted text-muted-foreground"}>{row.present ? (row.late ? "Late" : "Present") : "Absent"}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {canCancel && meeting.status === "FINALIZED" && (
              <Card className="flex flex-col gap-2 p-4">
                <Button type="button" onClick={() => void act(`/meetings/${meeting.id}/complete`, { summary })}>Mark completed</Button>
                <Button type="button" variant="destructive" onClick={() => setCancelOpen(true)}>Cancel meeting</Button>
              </Card>
            )}
          </aside>
        </div>
        <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel meeting" description="Members receive the cancellation immediately." confirmLabel="Cancel and email" destructive confirmDisabled={reason.trim().length < 3} onConfirm={() => { setCancelOpen(false); void act(`/meetings/${meeting.id}/cancel`, { reason }); }}>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" />
        </ConfirmDialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-2xl">Agenda</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => { setSlots([...slots, { key: crypto.randomUUID(), role: "MOC", title: "", assigneeId: "", targetUserId: "", projectId: "", durationMin: "3" }]); setDirty(true); }}>Add item</Button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={slots.map((slot) => slot.key)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {slots.length === 0 && <Card className="p-4 text-sm text-muted-foreground">Add the first agenda item. Master of Ceremony and Open Mic Coordinator are required before sending.</Card>}
                {slots.map((slot, index) => (
                  <SortableSlot
                    key={slot.key}
                    id={slot.key}
                    index={index}
                    controls={
                      <>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Move down" disabled={index === slots.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" aria-label="Remove item" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    }
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Role
                        <Select value={slot.role} onChange={(event) => update(index, { role: event.target.value, targetUserId: "", projectId: "" })}>
                          {AGENDA_ROLES.map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}
                        </Select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Member
                        <Select value={slot.assigneeId} onChange={(event) => update(index, { assigneeId: event.target.value })}>
                          <option value="">Unassigned</option>
                          {members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}
                        </Select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Title
                        <Input value={slot.title} placeholder={titleCase(slot.role)} onChange={(event) => update(index, { title: event.target.value })} />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Time limit (minutes)
                        <Input value={slot.durationMin} type="number" min={1} inputMode="numeric" onChange={(event) => update(index, { durationMin: event.target.value })} />
                      </label>
                      {slot.role === "PREPARED_SPEAKER" && (
                        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">Project
                          <Select value={slot.projectId} onChange={(event) => update(index, { projectId: event.target.value })}>
                            <option value="">Choose a project</option>
                            {projects.map((project) => <option key={project.id} value={project.id}>{project.level?.name}: {project.title}</option>)}
                          </Select>
                        </label>
                      )}
                      {slot.role === "SPEECH_EVALUATOR" && (
                        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">Evaluating
                          <Select value={slot.targetUserId} onChange={(event) => update(index, { targetUserId: event.target.value })}>
                            <option value="">Choose the prepared speaker</option>
                            {slots.filter((row) => row.role === "PREPARED_SPEAKER" && row.assigneeId).map((row) => (
                              <option key={row.key} value={row.assigneeId}>{memberName(row.assigneeId) || "Speaker"}</option>
                            ))}
                          </Select>
                        </label>
                      )}
                    </div>
                  </SortableSlot>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
          <Card className="p-4">
            <h2 className="font-serif text-xl">Timing</h2>
            <div className="mt-2 flex items-baseline justify-between text-sm">
              <span className={over ? "font-medium text-destructive" : ""}>{totalMinutes} min planned</span>
              <span className="text-muted-foreground">{budget} min available</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min((totalMinutes / budget) * 100, 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{over ? `Over by ${totalMinutes - budget} minutes. Trim a time limit or drop an item.` : `${budget - totalMinutes} minutes to spare in the ${meeting.startTime}–${meeting.endTime} window.`}</p>
          </Card>

          <Card className="p-4">
            <h2 className="font-serif text-xl">Ready to send?</h2>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              <ReadyItem item="Master of Ceremony assigned" ok={hasRole("MOC")} />
              <ReadyItem item="Open Mic Coordinator assigned" ok={hasRole("OPEN_MIC_COORDINATOR")} />
              <ReadyItem item={unassigned ? `${unassigned} item${unassigned === 1 ? "" : "s"} still unassigned` : "Every item has a member"} ok={unassigned === 0} soft />
              <ReadyItem item={doubleBooked.length ? `${doubleBooked.join(", ")} assigned twice` : "One member, one role"} ok={doubleBooked.length === 0} />
              <ReadyItem item={over ? "Runs past the meeting window" : "Fits the meeting window"} ok={!over} soft />
            </ul>
          </Card>

          <Card className="p-4">
            <h2 className="font-serif text-xl">Member preview</h2>
            <p className="text-xs text-muted-foreground">This is the order members receive by email.</p>
            <ol className="mt-2 flex flex-col gap-1 text-sm">
              {slots.map((slot, index) => (
                <li key={slot.key} className="flex gap-2">
                  <span className="w-5 shrink-0 text-muted-foreground">{index + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">{slot.title || titleCase(slot.role)} <span className="text-muted-foreground">· {memberName(slot.assigneeId) || "Unassigned"}</span></span>
                  <span className="shrink-0 text-muted-foreground">{slot.durationMin || "—"} min</span>
                </li>
              ))}
              {slots.length === 0 && <li className="text-muted-foreground">Nothing to preview yet.</li>}
            </ol>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" onClick={() => void save()}>Save as draft</Button>
            <Button type="button" variant="accent" disabled={missingKeys || doubleBooked.length > 0} onClick={() => setFinalizeOpen(true)}>Finalize and send</Button>
            <Button type="button" variant="ghost" className="text-destructive" onClick={() => setDeleteOpen(true)}>Delete draft</Button>
          </div>
        </aside>
      </div>

      <ConfirmDialog open={finalizeOpen} onOpenChange={setFinalizeOpen} title="Finalize and send?" description={`This saves the agenda and emails every active member the ${slots.length} item${slots.length === 1 ? "" : "s"} in the order shown in the preview. After sending, only the Club Admin can cancel.`} confirmLabel="Send agenda" confirmDisabled={missingKeys} onConfirm={() => void finalize()} />
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete this draft?" description="The draft and its agenda are removed. Nobody is emailed." confirmLabel="Delete" destructive onConfirm={() => { setDeleteOpen(false); api(`/meetings/${meeting.id}`, { method: "DELETE" }).then(() => { toast.success("Draft deleted"); emit("meeting:changed"); window.location.href = listHref; }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not delete")); }} />
    </div>
  );
}

function ReadyItem({ item, ok, soft = false }: { item: string; ok: boolean; soft?: boolean }) {
  const tone = ok ? "text-emerald-700" : soft ? "text-amber-700" : "text-destructive";
  return (
    <li className={`flex items-center gap-2 ${tone}`}>
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${ok ? "border-emerald-600 bg-emerald-50" : soft ? "border-amber-500 bg-amber-50" : "border-destructive bg-red-50"}`}>{ok && <Check className="h-3 w-3" />}</span>
      {item}
    </li>
  );
}

function SortableSlot({ id, index, controls, children }: { id: string; index: number; controls: React.ReactNode; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`rounded-xl border bg-card p-4 shadow-sm ${isDragging ? "ring-2 ring-primary" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" className="tap inline-flex cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing" aria-label="Drag to reorder" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">{index + 1}</span>
        </div>
        <div className="flex items-center gap-1">{controls}</div>
      </div>
      {children}
    </div>
  );
}
