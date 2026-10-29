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
    return false;
  }
  await transport().sendMail({ from: fromAddress(), to, subject, text, html });
  return true;
}

function page(title: string, body: string) {
  return `<div style="font-family:Georgia,serif;color:#1c1915;line-height:1.5"><h1 style="font-size:22px">${title}</h1>${body}</div>`;
}

export async function sendApplicationLink(to: string, clubName: string, url: string, kind: string) {
  const action = kind === "REINSTATE" ? "reinstate your membership" : "join";
  const text = `You are invited to ${action} ${clubName}. The form asks for the child's full name and date of birth, school and grade, and both parents' or guardians' names, mobile numbers, and email addresses, plus consent for photos, participation, and data handling. Open this page, complete the form, and pay the fee: ${url}`;
  await sendMail(
    to,
    `${clubName} membership`,
    text,
    page(
      clubName,
      `<p>You are invited to ${action} ${clubName}.</p>
       <p>The registration form asks for:</p>
       <ul>
         <li>The child's full name and date of birth</li>
         <li>School and grade</li>
         <li>Both parents' or guardians' names, mobile numbers, and email addresses</li>
         <li>Consent for photos, participation, and data handling</li>
       </ul>
       <p><a href="${url}">Open the membership form</a></p>`,
    ),
  );
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
  reason?: string | null;
  agenda?: { title: string; role: string; assignee: string | null }[];
  url?: string;
}) {
  const title = input.cancelled ? `Meeting cancelled — ${input.clubName}` : `Meeting agenda — ${input.clubName}`;
  const roleLine = input.role ? `Your role: ${input.role}.` : "You have no assigned role.";
  const agendaText = (input.agenda || []).map((item, index) => `${index + 1}. ${item.title} (${item.role})${item.assignee ? ` — ${item.assignee}` : ""}`).join("\n");
  const text = input.cancelled
    ? `The meeting on ${input.when} at ${input.place} has been cancelled.${input.reason ? ` Reason: ${input.reason}.` : ""}`
    : `${input.clubName}\n${input.when}\n${input.place}\n${roleLine}\n\nAgenda\n${agendaText || "Agenda to follow."}\n${input.url ? `\nView the meeting: ${input.url}` : ""}`;
  const agendaHtml = (input.agenda || [])
    .map((item) => `<li><strong>${item.title}</strong> · ${item.role}${item.assignee ? ` · <span style="color:#1e3a5f">${item.assignee}</span>` : ""}</li>`)
    .join("");
  const html = page(
    title,
    `<p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9a3412">${input.clubName}</p>
     <p>${input.when}<br/>${input.place}</p>
     ${input.cancelled && input.reason ? `<p>Reason: ${input.reason}</p>` : ""}
     ${input.cancelled ? "" : `<p>${roleLine}</p><ol>${agendaHtml}</ol>`}
     ${input.url ? `<p><a href="${input.url}">View the meeting details on the portal</a></p>` : ""}`,
  );
  await sendMail(input.to, title, text, html);
}

export async function sendMemberReminder(to: string, clubName: string, message: string) {
  const text = `${clubName}: ${message}`;
  return sendMail(to, `Reminder — ${clubName}`, text, page(clubName, `<p>${message.replace(/\n/g, "<br/>")}</p>`));
}

export async function sendCommitteeChange(to: string, clubName: string, changes: string[]) {
  const single = changes.length === 1;
  const subject = single ? `Officer update — ${clubName}` : `Committee update — ${clubName}`;
  const text = single
    ? `${clubName} updated one officer role.\n${changes[0]}`
    : `${clubName} updated the executive committee.\n${changes.join("\n")}`;
  return sendMail(to, subject, text, page(subject, `<ul>${changes.map((line) => `<li>${line}</li>`).join("")}</ul>`));
}

export async function sendAnnouncementMail(to: string, title: string, body: string) {
  return sendMail(to, title, body, page(title, `<p>${body.replace(/\n/g, "<br/>")}</p>`));
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
