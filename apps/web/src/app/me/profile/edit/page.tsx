"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function EditProfilePage() {
  const { user, refresh } = useSession();
  const [pending, setPending] = useState(false);
  if (!user) return null;
  const dob = user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "";

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await api("/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.get("name"),
          phone: form.get("phone"),
          dateOfBirth: form.get("dateOfBirth") || null,
          gender: form.get("gender"),
          address: form.get("address"),
          city: form.get("city"),
          occupation: form.get("occupation"),
          goals: form.get("goals"),
        }),
      });
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        const body = new FormData();
        body.set("file", file);
        await api("/me/avatar", { method: "POST", body });
      }
      await refresh();
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={save}>
      <PageIntro title="Edit profile" />
      <Field label="Name"><Input name="name" defaultValue={user.name} required /></Field>
      <Field label="Phone"><Input name="phone" defaultValue={user.phone || ""} /></Field>
      <Field label="Date of birth"><Input name="dateOfBirth" type="date" defaultValue={dob} /></Field>
      <Field label="Gender"><Input name="gender" defaultValue={user.gender || ""} /></Field>
      <Field label="Address"><Input name="address" defaultValue={user.address || ""} /></Field>
      <Field label="City"><Input name="city" defaultValue={user.city || ""} /></Field>
      <Field label="Occupation"><Input name="occupation" defaultValue={user.occupation || ""} /></Field>
      <Field label="Goals"><Textarea name="goals" defaultValue={user.goals || ""} /></Field>
      <Field label="Photo"><Input name="file" type="file" accept="image/*" /></Field>
      <Button type="submit" disabled={pending}>Save</Button>
    </form>
  );
}
