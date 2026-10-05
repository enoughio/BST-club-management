import nodemailer from "nodemailer";

function configured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function transport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function fromAddress() {
  return process.env.MAIL_FROM || process.env.GMAIL_USER || "club-portal@localhost";
}

export async function sendMail(to: string, subject: string, text: string, html: string) {
  if (!configured()) {
    console.info(`[mail] skipped (Gmail not configured) to=${to} subject=${subject}\n${text}`);
    return;
  }
  await transport().sendMail({ from: fromAddress(), to, subject, text, html });
}

function page(title: string, body: string) {
  return `<div style="font-family:Georgia,serif;color:#1c1915;line-height:1.5"><h1 style="font-size:22px">${title}</h1>${body}</div>`;
}

export async function sendApplicationLink(to: string, clubName: string, url: string, kind: string) {
  const action = kind === "REINSTATE" ? "reinstate your membership" : "join";
  const text = `You are invited to ${action} ${clubName}. Open this page, complete the form, and pay the fee: ${url}`;
  await sendMail(to, `${clubName} membership`, text, page(clubName, `<p>${text}</p><p><a href="${url}">Open the membership page</a></p>`));
}

export async function sendSetPassword(to: string, name: string, url: string) {
  const text = `Hello ${name}, set a password for your club portal account: ${url}`;
  await sendMail(to, "Set your password", text, page("Set your password", `<p>${text}</p>`));
}

export async function sendPasswordReset(to: string, url: string) {
  const text = `Reset your club portal password: ${url}. This link expires in one hour.`;
  await sendMail(to, "Reset your password", text, page("Reset your password", `<p>${text}</p>`));
}

export async function sendMeetingNotice(input: {
  to: string;
  clubName: string;
  when: string;
  place: string;
  role: string | null;
  cancelled?: boolean;
}) {
  const title = input.cancelled ? `Meeting cancelled — ${input.clubName}` : `Meeting agenda — ${input.clubName}`;
  const roleLine = input.role ? `Your role: ${input.role}.` : "You have no assigned role.";
  const text = input.cancelled
    ? `The meeting on ${input.when} at ${input.place} has been cancelled.`
    : `A meeting is set for ${input.when} at ${input.place}. ${roleLine}`;
  await sendMail(input.to, title, text, page(title, `<p>${text}</p>`));
}

export async function sendAnnouncementMail(to: string, title: string, body: string) {
  await sendMail(to, title, body, page(title, `<p>${body.replace(/\n/g, "<br/>")}</p>`));
}

export async function sendRemovalRequested(to: string, clubName: string, memberName: string, reason: string) {
  const text = `${memberName} has a pending removal request in ${clubName}. Reason: ${reason}.`;
  await sendMail(to, `Removal request — ${clubName}`, text, page("Removal request", `<p>${text}</p>`));
}

export async function sendRemovalDecision(to: string, clubName: string, memberName: string, approved: boolean) {
  const text = approved
    ? `The removal of ${memberName} from ${clubName} was approved. Their other memberships are unchanged.`
    : `The removal request for ${memberName} in ${clubName} was rejected.`;
  await sendMail(to, approved ? "Removal approved" : "Removal rejected", text, page("Removal decision", `<p>${text}</p>`));
}

export async function sendElectionOpened(to: string, clubName: string, url: string) {
  const text = `Nominations are open for the ${clubName} executive committee. You have 7 days to stand: ${url}`;
  await sendMail(to, `Election open — ${clubName}`, text, page("Election open", `<p>${text}</p>`));
}

export async function sendElectionResults(to: string, clubName: string, summary: string) {
  const text = `The ${clubName} election has closed.\n${summary}`;
  await sendMail(to, `Election results — ${clubName}`, text, page("Election results", `<p>${summary.replace(/\n/g, "<br/>")}</p>`));
}
