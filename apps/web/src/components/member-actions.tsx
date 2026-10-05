"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ApiError, api } from "@/lib/api";
import { titleCase } from "@/lib/format";

export type HqMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  occupation: string | null;
  goals: string | null;
  memberships: { clubId: string; clubName: string; status: string }[];
};

type ProfileDraft = {
  name: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  city: string;
  occupation: string;
  goals: string;
};

function draftFrom(user: HqMember): ProfileDraft {
  return {
    name: user.name,
    phone: user.phone || "",
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "",
    gender: user.gender || "",
    address: user.address || "",
    city: user.city || "",
    occupation: user.occupation || "",
    goals: user.goals || "",
  };
}

export function MemberActions({ user, onChanged }: { user: HqMember; onChanged: () => void }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [removalOpen, setRemovalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFrom(user));
  const [removalClubId, setRemovalClubId] = useState(user.memberships.find((row) => row.status === "ACTIVE")?.clubId || user.memberships[0]?.clubId || "");
  const [reason, setReason] = useState("RESIGNATION");
  const [details, setDetails] = useState("");
  const [linkClubId, setLinkClubId] = useState(user.memberships.find((row) => row.status !== "ACTIVE")?.clubId || "");

  const nameMatches = typed.trim() === user.name.trim();
  const former = user.memberships.filter((row) => row.status !== "ACTIVE");

  function closeMenus() {
    setMenu(false);
    setEditing(false);
  }

  async function run(action: () => Promise<void>, success: string, close: () => void) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      close();
      closeMenus();
      setTyped("");
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setDraft(draftFrom(user)); setEditing(false); setMenu(true); }}>Actions</Button>
      <Sheet open={menu} onOpenChange={setMenu} title={editing ? "Edit profile" : user.name}>
        {editing ? (
          <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); setEditOpen(true); }}>
            <Field label="Name"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></Field>
            <Field label="Phone"><Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></Field>
            <Field label="Date of birth"><Input type="date" value={draft.dateOfBirth} onChange={(event) => setDraft({ ...draft, dateOfBirth: event.target.value })} /></Field>
            <Field label="Gender"><Input value={draft.gender} onChange={(event) => setDraft({ ...draft, gender: event.target.value })} /></Field>
            <Field label="City"><Input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></Field>
            <Field label="Address"><Input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></Field>
            <Field label="Occupation"><Input value={draft.occupation} onChange={(event) => setDraft({ ...draft, occupation: event.target.value })} /></Field>
            <Field label="Goals"><Textarea value={draft.goals} onChange={(event) => setDraft({ ...draft, goals: event.target.value })} /></Field>
            <Button type="submit">Review changes</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Back</Button>
          </form>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="outline" asChild><Link href={`/members/${user.id}`}>View profile</Link></Button>
            <Button variant="outline" onClick={() => setEditing(true)}>Edit profile</Button>
            <Button variant="outline" onClick={() => { closeMenus(); setFreezeOpen(true); }}>Freeze</Button>
            <Button variant="outline" onClick={() => { closeMenus(); setReinstateOpen(true); }}>Reinstate</Button>
            <Button variant="outline" onClick={() => { closeMenus(); setTyped(""); setRemovalOpen(true); }}>Start removal</Button>
            <Button variant="destructive" onClick={() => { closeMenus(); setTyped(""); setDeleteOpen(true); }}>Delete account</Button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={freezeOpen}
        onOpenChange={setFreezeOpen}
        title={`Freeze ${user.name}`}
        description="Their account will be suspended. They cannot sign in or take part until you reinstate them."
        confirmLabel="Freeze account"
        destructive
        pending={busy}
        onConfirm={() => void run(() => api(`/users/${user.id}/freeze`, { method: "POST", body: "{}" }), "Account frozen", () => setFreezeOpen(false))}
      />

      <ConfirmDialog
        open={reinstateOpen}
        onOpenChange={setReinstateOpen}
        title={`Reinstate ${user.name}`}
        description="A suspended account returns to active. Removed, lapsed, and expired club memberships are restored to active. You can also email the club reinstatement link."
        confirmLabel="Restore to active"
        pending={busy}
        onConfirm={() => void run(() => api(`/users/${user.id}/reinstate`, { method: "POST", body: "{}" }), "Member reinstated", () => setReinstateOpen(false))}
      >
        <ul className="text-sm">
          <li>Account: {titleCase(user.status)}{user.status === "SUSPENDED" ? " → Active" : ""}</li>
          {user.memberships.length === 0 && <li>No club memberships.</li>}
          {user.memberships.map((row) => (
            <li key={row.clubId}>{row.clubName}: {titleCase(row.status)}{row.status !== "ACTIVE" ? " → Active" : ""}</li>
          ))}
        </ul>
        <Field label="Reinstatement link">
          <Select value={linkClubId} onChange={(event) => setLinkClubId(event.target.value)}>
            <option value="">Choose a former membership</option>
            {(former.length ? former : user.memberships).map((row) => <option key={row.clubId} value={row.clubId}>{row.clubName} ({titleCase(row.status)})</option>)}
          </Select>
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (!linkClubId) {
              toast.error("Choose a club for the reinstatement link");
              return;
            }
            void run(
              () => api(`/clubs/${linkClubId}/members/${user.id}/reinstate`, { method: "POST", body: "{}" }),
              "Reinstatement link sent",
              () => setReinstateOpen(false),
            );
          }}
        >
          Send reinstatement link
        </Button>
      </ConfirmDialog>

      <ConfirmDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title={`Save changes for ${user.name}`}
        description="Profile details are updated only after you confirm."
        confirmLabel="Save profile"
        pending={busy}
        onConfirm={() => void run(
          () => api(`/users/${user.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: draft.name,
              phone: draft.phone || null,
              dateOfBirth: draft.dateOfBirth || null,
              gender: draft.gender || null,
              address: draft.address || null,
              city: draft.city || null,
              occupation: draft.occupation || null,
              goals: draft.goals || null,
            }),
          }),
          "Profile updated",
          () => setEditOpen(false),
        )}
      />

      <ConfirmDialog
        open={removalOpen}
        onOpenChange={setRemovalOpen}
        title={`Remove ${user.name}`}
        description="This starts a removal request for one club. Type the member's name to confirm. The membership ends when the request is approved."
        confirmLabel="Request removal"
        destructive
        pending={busy}
        confirmDisabled={!nameMatches || !removalClubId}
        onConfirm={() => void run(
          () => api(`/clubs/${removalClubId}/removals`, {
            method: "POST",
            body: JSON.stringify({ userId: user.id, reason, details: details || null }),
          }),
          "Removal requested",
          () => setRemovalOpen(false),
        )}
      >
        <Field label="Club">
          <Select value={removalClubId} onChange={(event) => setRemovalClubId(event.target.value)}>
            <option value="">Choose a club</option>
            {user.memberships.map((row) => <option key={row.clubId} value={row.clubId}>{row.clubName} ({titleCase(row.status)})</option>)}
          </Select>
        </Field>
        <Field label="Reason">
          <Select value={reason} onChange={(event) => setReason(event.target.value)}>
            <option value="RESIGNATION">Resignation</option>
            <option value="DUES_UNPAID">Dues unpaid</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Details"><Textarea value={details} onChange={(event) => setDetails(event.target.value)} /></Field>
        <Field label={`Type ${user.name} to confirm`}><Input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" /></Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${user.name}`}
        description="This permanently deletes the account and cannot be undone. Type the member's name to confirm."
        confirmLabel="Delete account"
        destructive
        pending={busy}
        confirmDisabled={!nameMatches}
        onConfirm={() => void run(() => api(`/users/${user.id}`, { method: "DELETE" }), "Account deleted", () => setDeleteOpen(false))}
      >
        <Field label={`Type ${user.name} to confirm`}><Input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" /></Field>
      </ConfirmDialog>
    </>
  );
}
