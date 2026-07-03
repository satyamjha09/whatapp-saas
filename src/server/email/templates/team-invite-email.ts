function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildTeamInviteEmail({
  companyName,
  expiresAt,
  invitedByEmail,
  invitedByName,
  inviteUrl,
  role,
}: {
  companyName: string;
  invitedByName?: string | null;
  invitedByEmail: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
}) {
  const safeCompanyName = escapeHtml(companyName);
  const safeInvitedBy = escapeHtml(invitedByName || invitedByEmail);
  const safeRole = escapeHtml(role);
  const safeInviteUrl = escapeHtml(inviteUrl);
  const expiryText = expiresAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  const subject = `You're invited to join ${companyName} on metawhat`;
  const text = [
    `You have been invited to join ${companyName} on metawhat.`,
    `Invited by: ${invitedByName || invitedByEmail}`,
    `Role: ${role}`,
    `Accept invite: ${inviteUrl}`,
    `This invite expires on ${expiryText}.`,
  ].join("\n");
  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 10px;">
                <div style="font-size:14px;font-weight:700;color:#2563eb;">metawhat</div>
                <h1 style="margin:12px 0 0;font-size:24px;line-height:32px;color:#0f172a;">Join ${safeCompanyName}</h1>
                <p style="margin:12px 0 0;font-size:15px;line-height:24px;color:#475569;">${safeInvitedBy} invited you to join their workspace on metawhat.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px;">
                  <p style="margin:0;font-size:13px;color:#64748b;">Workspace</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0f172a;">${safeCompanyName}</p>
                  <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Role</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0f172a;">${safeRole}</p>
                  <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Expires</p>
                  <p style="margin:4px 0 0;font-size:14px;color:#0f172a;">${expiryText}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 28px 28px;">
                <a href="${safeInviteUrl}" style="display:block;background:#2563eb;color:#ffffff;text-decoration:none;text-align:center;border-radius:12px;padding:14px 18px;font-size:15px;font-weight:700;">Accept Invite</a>
                <p style="margin:18px 0 0;font-size:12px;line-height:18px;color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>
                <p style="word-break:break-all;margin:8px 0 0;font-size:12px;line-height:18px;color:#2563eb;">${safeInviteUrl}</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">This invite was sent from metawhat.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject,
    text,
    html,
  };
}
