"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";

export async function downloadReport(meetingId: string, agendaItemId: string, fileName: string) {
  try {
    const blob = await api<Blob>(`/meetings/${meetingId}/reports/${agendaItemId}`);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : "Could not download the report");
  }
}

export function ReportUpload({
  meetingId,
  agendaItemId,
  existingName,
  onDone,
}: {
  meetingId: string;
  agendaItemId: string;
  existingName?: string | null;
  onDone?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    body.set("agendaItemId", agendaItemId);
    setPending(true);
    try {
      await api(`/meetings/${meetingId}/reports`, { method: "POST", body });
      toast.success(existingName ? "Report replaced" : "Report uploaded");
      setFile(null);
      onDone?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not upload the report");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-3 flex flex-col gap-2" onSubmit={(event) => void submit(event)}>
      <p className="text-sm font-medium">{existingName ? "Replace the report file" : "Upload a report file"}</p>
      <p className="text-xs text-muted-foreground">PDF, Word, or an image. This is stored with the evaluation, separate from the score form.</p>
      {existingName && (
        <button type="button" className="w-fit text-sm text-blue-800 underline" onClick={() => void downloadReport(meetingId, agendaItemId, existingName)}>
          Current file: {existingName}
        </button>
      )}
      <Input
        type="file"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*"
        aria-label="Evaluation report file"
        onChange={(event) => setFile(event.target.files?.[0] || null)}
      />
      <Button type="submit" disabled={pending || !file} className="w-fit">{pending ? "Uploading…" : existingName ? "Replace file" : "Upload report"}</Button>
    </form>
  );
}

export function ReportDownload({
  meetingId,
  agendaItemId,
  fileName,
  title,
  detail,
}: {
  meetingId: string;
  agendaItemId: string;
  fileName: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
      <p className="text-sm font-medium text-blue-950">{title}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
      <Button type="button" variant="outline" className="mt-2" onClick={() => void downloadReport(meetingId, agendaItemId, fileName)}>
        Download {fileName}
      </Button>
    </div>
  );
}
