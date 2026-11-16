import nodemailer from "nodemailer";

const BRAND_BLUE = "#1d4ed8";
const BRAND_YELLOW = "#eab308";
const BRAND_RED = "#dc2626";
const PORTAL_NAME = "Club portal";

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

export function mailConfigured() {
  return configured();
}

export async function verifyMailTransport() {
  if (!configured()) return false;
  await transport().verify();
  return true;
}

export async function sendMail(to: string, subject: string, text: string, html: string) {
  if (!configured()) {
    console.info(`[mail] skipped (Gmail not configured) to=${to} subject=${subject}\n${text}`);
    return false;
  }
  await transport().sendMail({ from: fromAddress(), to, subject, text, html });
  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br/>");
}

function actionButton(label: string, url: string) {
  const href = escapeHtml(url);
  const text = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 4px;">
    <tr>
      <td align="center" bgcolor="${BRAND_BLUE}" style="border-radius:8px;background-color:${BRAND_BLUE};">
        <a href="${href}" target="_blank" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:${BRAND_BLUE};border:1px solid ${BRAND_BLUE};border-radius:8px;">
          <span style="color:#ffffff;">${text}</span>
        </a>
      </td>
    </tr>
  </table>`;
}

function renderEmail(input: {
  orgName: string;
  title: string;
  bodyHtml: string;
  button?: { label: string; url: string } | null;
  noteHtml?: string;
}) {
  const org = escapeHtml(input.orgName || PORTAL_NAME);
  const title = escapeHtml(input.title);
  const from = escapeHtml(fromAddress());
  const note = input.noteHtml
    ? `<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${BRAND_RED};">${input.noteHtml}</p>`
    : "";
  const button = input.button?.url ? actionButton(input.button.label, input.button.url) : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f6fb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f6fb;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
          <tr>
            <td bgcolor="${BRAND_BLUE}" style="background-color:${BRAND_BLUE};padding:18px 24px;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.3;font-weight:bold;color:#ffffff;">
              ${org}
            </td>
          </tr>
          <tr>
            <td bgcolor="${BRAND_YELLOW}" style="background-color:${BRAND_YELLOW};height:6px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">
              <h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1.3;font-weight:bold;color:#111827;">${title}</h1>
              ${input.bodyHtml}
              ${note}
              ${button}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px 18px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#6b7280;">
              This message was sent by the club portal.<br/>
              From ${from}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendApplicationLink(to: string, clubName: string, url: string, kind: string) {
  const action = kind === "REINSTATE" ? "reinstate your membership" : "join";
  const text = `You are invited to ${action} ${clubName}. The form asks for the child's full name and date of birth, school and grade, and both parents' or guardians' names, mobile numbers, and email addresses, plus consent for photos, participation, and data handling. Open this page, complete the form, and pay the fee: ${url}`;
  await sendMail(
    to,
    `${clubName} membership`,
    text,
    renderEmail({
      orgName: clubName,
      title: kind === "REINSTATE" ? "Reinstate your membership" : "Join the club",
      bodyHtml: `<p style="margin:0 0 12px;">You are invited to ${escapeHtml(action)} ${escapeHtml(clubName)}.</p>
        <p style="margin:0 0 8px;">The registration form asks for:</p>
        <ul style="margin:0;padding-left:20px;">
          <li>The child's full name and date of birth</li>
          <li>School and grade</li>
          <li>Both parents' or guardians' names, mobile numbers, and email addresses</li>
          <li>Consent for photos, participation, and data handling</li>
        </ul>`,
      button: { label: "Open the membership form", url },
    }),
  );
}

export async function sendSetPassword(to: string, name: string, url: string) {
  const text = `Hello ${name}, set a password for your club portal account: ${url}`;
  return sendMail(
    to,
    "Set your password",
    text,
    renderEmail({
      orgName: PORTAL_NAME,
      title: "Set your password",
      bodyHtml: `<p style="margin:0;">Hello ${escapeHtml(name)}, set a password for your club portal account.</p>`,
      button: { label: "Set your password", url },
    }),
  );
}

export async function sendPasswordReset(to: string, url: string) {
  const text = `Reset your club portal password: ${url}. This link expires in one hour.`;
  await sendMail(
    to,
    "Reset your password",
    text,
    renderEmail({
      orgName: PORTAL_NAME,
      title: "Reset your password",
      bodyHtml: `<p style="margin:0;">Reset your club portal password. This link expires in one hour.</p>`,
      button: { label: "Reset your password", url },
    }),
  );
}

export async function sendMeetingNotice(input: {
  to: string;
  clubName: string;
  when: string;
  place: string;
  role: string | null;
  cancelled?: boolean;
  reason?: string | null;
  agenda?: { role: string; assignee: string | null }[];
  url?: string;
}) {
  const title = input.cancelled ? `Meeting cancelled — ${input.clubName}` : `Meeting agenda — ${input.clubName}`;
  const roleLine = input.role ? `Your role: ${input.role}.` : "You have no assigned role.";
  const agendaText = (input.agenda || []).map((item, index) => `${index + 1}. ${item.role}${item.assignee ? ` — ${item.assignee}` : ""}`).join("\n");
  const text = input.cancelled
    ? `The meeting on ${input.when} at ${input.place} has been cancelled.${input.reason ? ` Reason: ${input.reason}.` : ""}`
    : `${input.clubName}\n${input.when}\n${input.place}\n${roleLine}\n\nAgenda\n${agendaText || "Agenda to follow."}\n${input.url ? `\nView the meeting: ${input.url}` : ""}`;
  const agendaHtml = (input.agenda || [])
    .map((item) => `<li style="margin:0 0 6px;"><strong>${escapeHtml(item.role)}</strong>${item.assignee ? ` · <span style="color:${BRAND_BLUE};">${escapeHtml(item.assignee)}</span>` : ""}</li>`)
    .join("");
  const html = renderEmail({
    orgName: input.clubName,
    title: input.cancelled ? "Meeting cancelled" : "Meeting agenda",
    bodyHtml: `<p style="margin:0 0 12px;">${escapeHtml(input.when)}<br/>${escapeHtml(input.place)}</p>
      ${input.cancelled ? "" : `<p style="margin:0 0 12px;">${escapeHtml(roleLine)}</p><p style="margin:0 0 8px;font-weight:bold;">Agenda</p><ol style="margin:0;padding-left:20px;">${agendaHtml || "<li>Agenda to follow.</li>"}</ol>`}`,
    noteHtml: input.cancelled
      ? escapeHtml(input.reason ? `This meeting has been cancelled. Reason: ${input.reason}` : "This meeting has been cancelled.")
      : undefined,
    button: input.url ? { label: "View the meeting details", url: input.url } : null,
  });
  await sendMail(input.to, title, text, html);
}

export async function sendMemberReminder(to: string, clubName: string, message: string) {
  const text = `${clubName}: ${message}`;
  return sendMail(
    to,
    `Reminder — ${clubName}`,
    text,
    renderEmail({
      orgName: clubName,
      title: "Reminder",
      bodyHtml: `<p style="margin:0;">${paragraphs(message)}</p>`,
    }),
  );
}

export async function sendCommitteeChange(to: string, clubName: string, changes: string[]) {
  const single = changes.length === 1;
  const subject = single ? `Officer update — ${clubName}` : `Committee update — ${clubName}`;
  const text = single
    ? `${clubName} updated one officer role.\n${changes[0]}`
    : `${clubName} updated the executive committee.\n${changes.join("\n")}`;
  return sendMail(
    to,
    subject,
    text,
    renderEmail({
      orgName: clubName,
      title: single ? "Officer update" : "Committee update",
      bodyHtml: `<p style="margin:0 0 12px;">${single ? "One officer role was updated." : "The executive committee was updated."}</p>
        <ul style="margin:0;padding-left:20px;">${changes.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`,
    }),
  );
}

export async function sendAnnouncementMail(to: string, title: string, body: string) {
  return sendMail(
    to,
    title,
    body,
    renderEmail({
      orgName: PORTAL_NAME,
      title,
      bodyHtml: `<p style="margin:0;">${paragraphs(body)}</p>`,
    }),
  );
}

export async function sendRemovalRequested(to: string, clubName: string, memberName: string, reason: string) {
  const text = `${memberName} has a pending removal request in ${clubName}. Reason: ${reason}.`;
  await sendMail(
    to,
    `Removal request — ${clubName}`,
    text,
    renderEmail({
      orgName: clubName,
      title: "Removal request",
      bodyHtml: `<p style="margin:0;">${escapeHtml(memberName)} has a pending removal request in ${escapeHtml(clubName)}.</p>`,
      noteHtml: escapeHtml(`Reason: ${reason}`),
    }),
  );
}

export async function sendRemovalDecision(to: string, clubName: string, memberName: string, approved: boolean) {
  const text = approved
    ? `The removal of ${memberName} from ${clubName} was approved. Their other memberships are unchanged.`
    : `The removal request for ${memberName} in ${clubName} was rejected.`;
  await sendMail(
    to,
    approved ? "Removal approved" : "Removal rejected",
    text,
    renderEmail({
      orgName: clubName,
      title: "Removal decision",
      bodyHtml: `<p style="margin:0;">A decision was recorded for ${escapeHtml(memberName)}.</p>`,
      noteHtml: escapeHtml(text),
    }),
  );
}

export async function sendElectionOpened(to: string, clubName: string, url: string) {
  const text = `Nominations are open for the ${clubName} executive committee. You have 7 days to stand: ${url}`;
  await sendMail(
    to,
    `Election open — ${clubName}`,
    text,
    renderEmail({
      orgName: clubName,
      title: "Election open",
      bodyHtml: `<p style="margin:0;">Nominations are open for the ${escapeHtml(clubName)} executive committee. You have 7 days to stand.</p>`,
      button: { label: "Open nominations", url },
    }),
  );
}

export async function sendNewMemberAdminNote(input: {
  to: string;
  adminName: string;
  memberName: string;
  memberEmail: string;
  clubName: string;
  askedToSetPassword: boolean;
}) {
  const passwordLine = input.askedToSetPassword
    ? " They have been asked to set a password for the club portal."
    : " They already have an account and can sign in.";
  const text = `Hello ${input.adminName}, ${input.memberName} (${input.memberEmail}) has been added to ${input.clubName}.${passwordLine}`;
  return sendMail(
    input.to,
    `New member — ${input.clubName}`,
    text,
    renderEmail({
      orgName: input.clubName,
      title: "A new member has joined",
      bodyHtml: `<p style="margin:0;">Hello ${escapeHtml(input.adminName)},</p>
        <p style="margin:12px 0 0;">${escapeHtml(input.memberName)} (${escapeHtml(input.memberEmail)}) has been added to ${escapeHtml(input.clubName)}.${escapeHtml(passwordLine)}</p>`,
    }),
  );
}

export async function sendMemberJoinedNote(input: {
  to: string;
  adminName: string;
  memberName: string;
  memberEmail: string;
  clubName: string;
}) {
  const text = `Hello ${input.adminName}, ${input.memberName} (${input.memberEmail}) completed registration and payment for ${input.clubName}.`;
  return sendMail(
    input.to,
    `Registration complete — ${input.clubName}`,
    text,
    renderEmail({
      orgName: input.clubName,
      title: "Registration complete",
      bodyHtml: `<p style="margin:0;">Hello ${escapeHtml(input.adminName)},</p>
        <p style="margin:12px 0 0;">${escapeHtml(input.memberName)} (${escapeHtml(input.memberEmail)}) completed registration and payment for ${escapeHtml(input.clubName)}.</p>`,
    }),
  );
}

export async function sendMemberLeftNotice(input: {
  to: string;
  adminName: string;
  memberName: string;
  memberEmail: string;
  fromClubName: string;
  toClubName: string;
}) {
  const text = `Hello ${input.adminName}, ${input.memberName} (${input.memberEmail}) has left ${input.fromClubName} and moved to ${input.toClubName}.`;
  return sendMail(
    input.to,
    `Member moved — ${input.fromClubName}`,
    text,
    renderEmail({
      orgName: input.fromClubName,
      title: "A member has moved",
      bodyHtml: `<p style="margin:0;">Hello ${escapeHtml(input.adminName)},</p>
        <p style="margin:12px 0 0;">${escapeHtml(input.memberName)} (${escapeHtml(input.memberEmail)}) has left ${escapeHtml(input.fromClubName)} and moved to ${escapeHtml(input.toClubName)}.</p>`,
    }),
  );
}

export async function sendMemberJoinedFromNotice(input: {
  to: string;
  adminName: string;
  memberName: string;
  memberEmail: string;
  fromClubName: string;
  toClubName: string;
}) {
  const text = `Hello ${input.adminName}, ${input.memberName} (${input.memberEmail}) has joined ${input.toClubName} from ${input.fromClubName}.`;
  return sendMail(
    input.to,
    `Member joined — ${input.toClubName}`,
    text,
    renderEmail({
      orgName: input.toClubName,
      title: "A member has joined",
      bodyHtml: `<p style="margin:0;">Hello ${escapeHtml(input.adminName)},</p>
        <p style="margin:12px 0 0;">${escapeHtml(input.memberName)} (${escapeHtml(input.memberEmail)}) has joined ${escapeHtml(input.toClubName)} from ${escapeHtml(input.fromClubName)}.</p>`,
    }),
  );
}

export async function sendElectionResults(to: string, clubName: string, summary: string) {
  const text = `The ${clubName} election has closed.\n${summary}`;
  await sendMail(
    to,
    `Election results — ${clubName}`,
    text,
    renderEmail({
      orgName: clubName,
      title: "Election results",
      bodyHtml: `<p style="margin:0 0 12px;">The ${escapeHtml(clubName)} election has closed.</p><p style="margin:0;">${paragraphs(summary)}</p>`,
    }),
  );
}
