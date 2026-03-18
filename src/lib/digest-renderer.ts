/**
 * Renders weekly digest email HTML with project infographics.
 * All styles are inline for email client compatibility.
 */

import type { BrandingConfig, EmailLayout } from "./email-renderer";

export interface DigestProject {
  name: string;
  totalStages: number;
  completedStages: number;
  inProgressStages: number;
  recentlyCompleted: string[]; // stage names completed this week
  currentStage: string | null; // name of the active stage
}

export interface DigestData {
  recipientName: string;
  orgName: string;
  reportPeriod: string;
  projects: DigestProject[];
  trackingUrl: string;
}

function progressBar(percent: number, color: string): string {
  const width = Math.max(0, Math.min(100, percent));
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0;">
    <tr>
      <td style="padding:0;">
        <div style="background:#e4e4e7;border-radius:4px;height:10px;overflow:hidden;">
          <div style="background:${color};width:${width}%;height:10px;border-radius:4px;"></div>
        </div>
      </td>
      <td style="padding:0 0 0 10px;width:45px;text-align:right;">
        <span style="font-size:13px;font-weight:700;color:#18181b;">${width}%</span>
      </td>
    </tr>
  </table>`;
}

function statBox(value: string, label: string, bgColor: string, textColor: string): string {
  return `<td style="padding:0 6px;">
    <div style="background:${bgColor};border-radius:8px;padding:14px 12px;text-align:center;">
      <div style="font-size:24px;font-weight:800;color:${textColor};line-height:1;">${value}</div>
      <div style="font-size:11px;color:#71717a;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
    </div>
  </td>`;
}

function projectCard(project: DigestProject, color: string): string {
  const percent = project.totalStages > 0
    ? Math.round((project.completedStages / project.totalStages) * 100)
    : 0;

  const recentHtml = project.recentlyCompleted.length > 0
    ? `<div style="margin-top:10px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#71717a;margin-bottom:6px;">Completed this week</div>
        ${project.recentlyCompleted.map((s) =>
          `<div style="font-size:13px;color:#16a34a;padding:2px 0;">&#10003; ${s}</div>`
        ).join("")}
      </div>`
    : "";

  const currentHtml = project.currentStage
    ? `<div style="margin-top:8px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#71717a;margin-bottom:4px;">In progress</div>
        <div style="font-size:13px;color:${color};font-weight:600;">&#9654; ${project.currentStage}</div>
      </div>`
    : "";

  return `<div style="border:1px solid #e4e4e7;border-radius:10px;padding:20px;margin-bottom:16px;background:#ffffff;">
    <div style="font-size:16px;font-weight:700;color:#18181b;margin-bottom:2px;">${project.name}</div>
    <div style="font-size:13px;color:#71717a;margin-bottom:8px;">${project.completedStages} of ${project.totalStages} stages complete</div>
    ${progressBar(percent, color)}
    ${recentHtml}
    ${currentHtml}
  </div>`;
}

export function renderDigestContent(data: DigestData, color: string): string {
  const totalProjects = data.projects.length;
  const totalCompleted = data.projects.reduce((sum, p) => sum + p.recentlyCompleted.length, 0);
  const avgProgress = data.projects.length > 0
    ? Math.round(data.projects.reduce((sum, p) =>
        sum + (p.totalStages > 0 ? (p.completedStages / p.totalStages) * 100 : 0), 0) / data.projects.length)
    : 0;

  // Summary stats
  const statsHtml = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr>
      ${statBox(String(totalProjects), "Active Projects", "#f4f4f5", color)}
      ${statBox(String(totalCompleted), "Stages Done", "#f0fdf4", "#16a34a")}
      ${statBox(`${avgProgress}%`, "Avg Progress", `${color}12`, color)}
    </tr>
  </table>`;

  // Project cards
  const projectsHtml = data.projects.map((p) => projectCard(p, color)).join("");

  // CTA button
  const ctaHtml = data.trackingUrl
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;">
        <tr><td align="center">
          <a href="${data.trackingUrl}" style="display:inline-block;padding:14px 32px;background:${color};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
            View Your Dashboard
          </a>
        </td></tr>
      </table>`
    : "";

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <p style="margin:0 0 4px 0;font-size:15px;color:#18181b;">Hi ${data.recipientName || "there"},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#52525b;">Here's your weekly project update from <strong>${data.orgName}</strong>.</p>

    <div style="background:#fafafa;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#71717a;margin-bottom:4px;">Report Period</div>
      <div style="font-size:15px;font-weight:600;color:#18181b;">${data.reportPeriod}</div>
    </div>

    ${statsHtml}

    <div style="font-size:14px;font-weight:700;color:#18181b;margin:24px 0 12px 0;text-transform:uppercase;letter-spacing:0.5px;">Your Projects</div>

    ${projectsHtml}

    ${ctaHtml}

    <p style="margin:16px 0 0 0;font-size:13px;color:#a1a1aa;text-align:center;">
      You're receiving this because you're a client of ${data.orgName}.
    </p>
  </div>`;
}

/**
 * Render the full digest email wrapped in the org's branded layout.
 */
export function renderDigestEmail(
  data: DigestData,
  branding: BrandingConfig,
  layout: EmailLayout = "classic"
): { subject: string; html: string } {
  // Import layout renderers inline to avoid circular deps
  const color = branding.primary_color || "#2563eb";
  const digestContent = renderDigestContent(data, color);

  // Build layout wrapper manually (same structure as email-renderer.ts)
  const innerHtml = buildLayout(digestContent, branding, color, layout);

  const subject = `Weekly Project Update — ${data.reportPeriod}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        ${innerHtml}
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function buildLayout(body: string, branding: BrandingConfig, color: string, layout: EmailLayout): string {
  const logoHtml = branding.logo_url
    ? `<img src="${branding.logo_url}" alt="${branding.org_name}" style="max-height:40px;max-width:160px;" />`
    : "";

  switch (layout) {
    case "modern":
      return `<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:${color};padding:28px 32px;border-radius:8px 8px 0 0;text-align:center;">
            ${logoHtml ? `${logoHtml}<br/><span style="color:rgba(255,255,255,0.9);font-size:14px;font-weight:500;">${branding.org_name}</span>`
                       : `<span style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">${branding.org_name}</span>`}
          </td>
        </tr>
        <tr><td style="background:#ffffff;padding:28px 32px;font-size:15px;line-height:1.6;color:#1a1a1a;">${body}</td></tr>
        <tr><td style="background:${color};padding:14px 32px;border-radius:0 0 8px 8px;">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.7);text-align:center;">Sent by ${branding.org_name} via <a href="https://projectstatus.app" style="color:rgba(255,255,255,0.9);text-decoration:none;">ProjectStatus</a></p>
        </td></tr>
      </table>`;

    case "minimal":
      return `<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr><td style="height:4px;background:${color};border-radius:8px 8px 0 0;"></td></tr>
        <tr><td style="background:#ffffff;padding:28px 32px 16px 32px;text-align:center;">
          ${logoHtml ? `${logoHtml}<br/><span style="font-size:14px;color:#71717a;">${branding.org_name}</span>`
                     : `<span style="font-size:22px;font-weight:700;color:#18181b;">${branding.org_name}</span>`}
        </td></tr>
        <tr><td style="background:#ffffff;padding:8px 32px 28px 32px;font-size:15px;line-height:1.6;color:#1a1a1a;">${body}</td></tr>
        <tr><td style="background:#ffffff;padding:14px 32px;border-radius:0 0 8px 8px;border-top:1px solid #f4f4f5;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">${branding.org_name} &middot; <a href="https://projectstatus.app" style="color:${color};text-decoration:none;">ProjectStatus</a></p>
        </td></tr>
      </table>`;

    case "elegant":
      return `<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;">
        <tr><td style="padding:24px 32px 16px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            ${logoHtml ? `<td style="vertical-align:middle;">${logoHtml}</td><td style="vertical-align:middle;text-align:right;"><span style="font-size:14px;color:#71717a;">${branding.org_name}</span></td>`
                       : `<td><span style="font-size:20px;font-weight:700;color:#18181b;">${branding.org_name}</span></td>`}
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 32px;"><div style="height:2px;background:${color};border-radius:1px;"></div></td></tr>
        <tr><td style="padding:20px 32px 28px 32px;font-size:15px;line-height:1.6;color:#1a1a1a;">${body}</td></tr>
        <tr><td style="padding:14px 32px 18px 32px;border-top:1px solid #f4f4f5;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">${branding.org_name} &middot; Powered by <a href="https://projectstatus.app" style="color:${color};text-decoration:none;">ProjectStatus</a></p>
        </td></tr>
      </table>`;

    default: // classic
      return `<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:${color};padding:20px 32px;border-radius:8px 8px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              ${logoHtml
                ? `<td style="vertical-align:middle;">${logoHtml}</td><td style="vertical-align:middle;padding-left:12px;"><span style="color:#ffffff;font-size:18px;font-weight:700;">${branding.org_name}</span></td>`
                : `<td><span style="color:#ffffff;font-size:20px;font-weight:700;">${branding.org_name}</span></td>`}
            </tr></table>
          </td>
        </tr>
        <tr><td style="background:#ffffff;padding:28px 32px;font-size:15px;line-height:1.6;color:#1a1a1a;">${body}</td></tr>
        <tr><td style="background:#fafafa;padding:14px 32px;border-radius:0 0 8px 8px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">Sent by ${branding.org_name} via <a href="https://projectstatus.app" style="color:${color};text-decoration:none;">ProjectStatus</a></p>
        </td></tr>
      </table>`;
  }
}
