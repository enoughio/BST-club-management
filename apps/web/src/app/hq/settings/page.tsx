"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";

type Settings = { name: string; primaryColor: string; defaultFeeAmount: number; defaultCurrency: string; supportEmail: string | null };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => { api<{ settings: Settings }>("/settings").then((data) => setSettings({ ...data.settings, defaultFeeAmount: data.settings.defaultFeeAmount / 100 })).catch(() => undefined); }, []);
  if (!settings) return <p>Loading…</p>;

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => {
      event.preventDefault();
      api("/settings", { method: "PATCH", body: JSON.stringify({ ...settings, defaultFeeAmount: Math.round(Number(settings.defaultFeeAmount) * 100) }) })
        .then(() => toast.success("Settings saved"))
        .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save"));
    }}>
      <PageIntro title="Organization" lede="Branding and the default fee used when a new club is discussed." />
      <Field label="Name"><Input value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} /></Field>
      <Field label="Primary color"><Input value={settings.primaryColor} onChange={(event) => setSettings({ ...settings, primaryColor: event.target.value })} /></Field>
      <Field label="Default fee (rupees)"><Input value={settings.defaultFeeAmount} onChange={(event) => setSettings({ ...settings, defaultFeeAmount: Number(event.target.value) })} /></Field>
      <Field label="Currency"><Input value={settings.defaultCurrency} onChange={(event) => setSettings({ ...settings, defaultCurrency: event.target.value })} /></Field>
      <Field label="Support email"><Input value={settings.supportEmail || ""} onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })} /></Field>
      <Button type="submit">Save</Button>
    </form>
  );
}
