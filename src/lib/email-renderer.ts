/**
 * Email template renderer with branded HTML wrapper.
 * Works both client-side (preview) and server-side (API routes).
 */

export interface BrandingConfig {
  logo_url?: string | null;
  primary_color: string;
  secondary_color?: string | null;
  org_name: string;
}

// ============ LAYOUTS ============

export type EmailLayout = "classic" | "minimal" | "modern" | "elegant";

export interface LayoutDefinition {
  id: EmailLayout;
  label: string;
  description: string;
}

export const EMAIL_LAYOUTS: LayoutDefinition[] = [
  { id: "classic", label: "Classic", description: "Colored header bar with logo and name" },
  { id: "minimal", label: "Minimal", description: "Clean white design with thin color accent" },
  { id: "modern", label: "Modern", description: "Bold full-width hero with centered branding" },
  { id: "elegant", label: "Elegant", description: "Understated header with a colored divider" },
];

// ============ TEMPLATE TYPES & PRESETS ============

export interface PlaceholderDef {
  key: string;
  label: string;
  example: string;
}

export interface ContentPreset {
  id: string;
  label: string;
  subject: string;
  body: string;
}

export interface EmailTemplateType {
  type: string;
  label: string;
  description: string;
  placeholders: PlaceholderDef[];
  presets: ContentPreset[];
}

const GLOBAL_PLACEHOLDERS: PlaceholderDef[] = [
  { key: "recipient_name", label: "Recipient Name", example: "John" },
  { key: "org_name", label: "Organization Name", example: "Acme Construction" },
];

export const EMAIL_TEMPLATE_TYPES: EmailTemplateType[] = [
  {
    type: "invite",
    label: "Team Invitation",
    description: "Sent when inviting a new member to your organization",
    placeholders: [
      ...GLOBAL_PLACEHOLDERS,
      { key: "role", label: "Member Role", example: "worker" },
      { key: "invite_link", label: "Invite Link", example: "https://app.example.com/auth/confirm?..." },
    ],
    presets: [
      {
        id: "professional",
        label: "Professional",
        subject: "You've been invited to {{org_name}}",
        body: `Hi {{recipient_name}},

You've been invited to join **{{org_name}}** on ProjectStatus as a **{{role}}**.

Click below to set up your account and get started:

{{invite_link}}`,
      },
      {
        id: "friendly",
        label: "Friendly",
        subject: "Welcome aboard! Join {{org_name}} on ProjectStatus",
        body: `Hey {{recipient_name}}!

Great news — you've been added to the **{{org_name}}** team! We use ProjectStatus to keep projects on track, and you're now part of the crew.

Tap the button below to jump in:

{{invite_link}}

See you inside!`,
      },
      {
        id: "brief",
        label: "Brief",
        subject: "Your {{org_name}} invitation",
        body: `{{recipient_name}}, you've been invited to **{{org_name}}** as a {{role}}.

{{invite_link}}`,
      },
    ],
  },
  {
    type: "stage_complete",
    label: "Stage Completed",
    description: "Sent to clients when a project stage is completed",
    placeholders: [
      ...GLOBAL_PLACEHOLDERS,
      { key: "project_name", label: "Project Name", example: "Kitchen Renovation" },
      { key: "stage_name", label: "Stage Name", example: "Demolition" },
    ],
    presets: [
      {
        id: "professional",
        label: "Professional",
        subject: "Stage completed: {{stage_name}} — {{project_name}}",
        body: `Hi {{recipient_name}},

The stage **{{stage_name}}** in your project **{{project_name}}** has been marked as completed.

Log in to your dashboard to see the latest progress.`,
      },
      {
        id: "friendly",
        label: "Friendly",
        subject: "Great news! {{stage_name}} is done!",
        body: `Hi {{recipient_name}},

We're happy to let you know that **{{stage_name}}** on your **{{project_name}}** project has been completed!

Things are moving along nicely. Check your dashboard to see how everything is progressing.

Thanks for your patience!`,
      },
      {
        id: "detailed",
        label: "Detailed",
        subject: "Project update: {{stage_name}} completed — {{project_name}}",
        body: `Dear {{recipient_name}},

This is a progress update from **{{org_name}}** regarding your project **{{project_name}}**.

**Completed stage:** {{stage_name}}

Our team has finished this phase and the project is moving to the next step. You can view the full project timeline and status by logging in to your dashboard.

If you have any questions, don't hesitate to reach out.

Best regards,
The {{org_name}} Team`,
      },
    ],
  },
  {
    type: "worker_assigned",
    label: "Worker Assignment",
    description: "Sent to a worker when they are assigned to a stage",
    placeholders: [
      ...GLOBAL_PLACEHOLDERS,
      { key: "project_name", label: "Project Name", example: "Kitchen Renovation" },
      { key: "stage_name", label: "Stage Name", example: "Plumbing" },
    ],
    presets: [
      {
        id: "professional",
        label: "Professional",
        subject: "You've been assigned to: {{stage_name}} — {{project_name}}",
        body: `Hi {{recipient_name}},

You've been assigned to the stage **{{stage_name}}** in project **{{project_name}}**.

Log in to your dashboard to get started.`,
      },
      {
        id: "friendly",
        label: "Friendly",
        subject: "New task for you: {{stage_name}}!",
        body: `Hey {{recipient_name}},

Heads up — you've been assigned to **{{stage_name}}** on the **{{project_name}}** project.

Head to your dashboard when you're ready to jump in. Let's get it done!`,
      },
      {
        id: "brief",
        label: "Brief",
        subject: "Assigned: {{stage_name}} — {{project_name}}",
        body: `{{recipient_name}}, you've been assigned to **{{stage_name}}** on **{{project_name}}**. Check your dashboard for details.`,
      },
    ],
  },
];

// ============ INTERPOLATION ============

/**
 * Replace {{placeholder}} tokens in a string with values from the variables map.
 */
export function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

/**
 * Convert simple markdown-like formatting to HTML.
 * Supports **bold** and line breaks.
 */
function markdownToHtml(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br/>" : `<p style="margin:0 0 8px 0;">${line}</p>`))
    .join("\n");
}

/**
 * Get the default (first) preset for a given template type.
 */
export function getDefaultTemplate(type: string): { subject: string; body: string } | null {
  const tmpl = EMAIL_TEMPLATE_TYPES.find((t) => t.type === type);
  if (!tmpl || tmpl.presets.length === 0) return null;
  return { subject: tmpl.presets[0].subject, body: tmpl.presets[0].body };
}

// ============ LAYOUT RENDERERS ============

function renderInviteButton(
  inviteLink: string,
  buttonColor: string
): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr><td align="center">
      <a href="${inviteLink}" style="display:inline-block;padding:14px 32px;background:${buttonColor};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;">
        Get Started
      </a>
    </td></tr>
  </table>
  <p style="margin:0 0 8px 0;color:#666;font-size:13px;text-align:center;">Or copy this link: ${inviteLink}</p>`;
}

function processBody(
  renderedBody: string,
  variables: Record<string, string>,
  buttonColor: string
): string {
  const hasInviteLink = variables.invite_link && renderedBody.includes(variables.invite_link);
  if (!hasInviteLink) return renderedBody;

  return renderedBody.replace(
    new RegExp(`<p[^>]*>${escapeRegex(variables.invite_link)}</p>`),
    renderInviteButton(variables.invite_link, buttonColor)
  );
}

function layoutClassic(body: string, branding: BrandingConfig, color: string): string {
  return `<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
  <tr>
    <td style="background:${color};padding:24px 32px;border-radius:8px 8px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          ${branding.logo_url
            ? `<td style="vertical-align:middle;"><img src="${branding.logo_url}" alt="${branding.org_name}" style="max-height:40px;max-width:160px;" /></td>
               <td style="vertical-align:middle;padding-left:12px;"><span style="color:#ffffff;font-size:18px;font-weight:700;">${branding.org_name}</span></td>`
            : `<td><span style="color:#ffffff;font-size:20px;font-weight:700;">${branding.org_name}</span></td>`
          }
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="background:#ffffff;padding:32px;font-size:15px;line-height:1.6;color:#1a1a1a;">
      ${body}
    </td>
  </tr>
  <tr>
    <td style="background:#fafafa;padding:20px 32px;border-radius:0 0 8px 8px;border-top:1px solid #e4e4e7;">
      <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
        Sent by ${branding.org_name} via <a href="https://projectstatus.app" style="color:${color};text-decoration:none;">ProjectStatus</a>
      </p>
    </td>
  </tr>
</table>`;
}

function layoutMinimal(body: string, branding: BrandingConfig, color: string): string {
  return `<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
  <tr>
    <td style="height:4px;background:${color};border-radius:8px 8px 0 0;"></td>
  </tr>
  <tr>
    <td style="background:#ffffff;padding:32px 32px 16px 32px;text-align:center;">
      ${branding.logo_url
        ? `<img src="${branding.logo_url}" alt="${branding.org_name}" style="max-height:36px;max-width:180px;margin-bottom:4px;" /><br/>
           <span style="font-size:14px;color:#71717a;">${branding.org_name}</span>`
        : `<span style="font-size:22px;font-weight:700;color:#18181b;">${branding.org_name}</span>`
      }
    </td>
  </tr>
  <tr>
    <td style="background:#ffffff;padding:16px 32px 32px 32px;font-size:15px;line-height:1.6;color:#1a1a1a;">
      ${body}
    </td>
  </tr>
  <tr>
    <td style="background:#ffffff;padding:16px 32px;border-radius:0 0 8px 8px;border-top:1px solid #f4f4f5;">
      <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
        ${branding.org_name} &middot; <a href="https://projectstatus.app" style="color:${color};text-decoration:none;">ProjectStatus</a>
      </p>
    </td>
  </tr>
</table>`;
}

function layoutModern(body: string, branding: BrandingConfig, color: string): string {
  return `<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
  <tr>
    <td style="background:${color};padding:40px 32px;border-radius:8px 8px 0 0;text-align:center;">
      ${branding.logo_url
        ? `<img src="${branding.logo_url}" alt="${branding.org_name}" style="max-height:48px;max-width:200px;margin-bottom:8px;" /><br/>
           <span style="color:rgba(255,255,255,0.9);font-size:16px;font-weight:500;">${branding.org_name}</span>`
        : `<span style="color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">${branding.org_name}</span>`
      }
    </td>
  </tr>
  <tr>
    <td style="background:#ffffff;padding:32px;font-size:15px;line-height:1.6;color:#1a1a1a;">
      ${body}
    </td>
  </tr>
  <tr>
    <td style="background:${color};padding:16px 32px;border-radius:0 0 8px 8px;">
      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.7);text-align:center;">
        Sent by ${branding.org_name} via <a href="https://projectstatus.app" style="color:rgba(255,255,255,0.9);text-decoration:none;">ProjectStatus</a>
      </p>
    </td>
  </tr>
</table>`;
}

function layoutElegant(body: string, branding: BrandingConfig, color: string): string {
  return `<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;">
  <tr>
    <td style="padding:28px 32px 20px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          ${branding.logo_url
            ? `<td style="vertical-align:middle;"><img src="${branding.logo_url}" alt="${branding.org_name}" style="max-height:32px;max-width:140px;" /></td>
               <td style="vertical-align:middle;text-align:right;"><span style="font-size:14px;color:#71717a;">${branding.org_name}</span></td>`
            : `<td><span style="font-size:20px;font-weight:700;color:#18181b;">${branding.org_name}</span></td>`
          }
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px;">
      <div style="height:2px;background:linear-gradient(to right, ${color}, ${color}44);border-radius:1px;"></div>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px 32px 32px;font-size:15px;line-height:1.6;color:#1a1a1a;">
      ${body}
    </td>
  </tr>
  <tr>
    <td style="padding:16px 32px 20px 32px;border-top:1px solid #f4f4f5;">
      <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
        ${branding.org_name} &middot; Powered by <a href="https://projectstatus.app" style="color:${color};text-decoration:none;">ProjectStatus</a>
      </p>
    </td>
  </tr>
</table>`;
}

const LAYOUT_RENDERERS: Record<EmailLayout, (body: string, branding: BrandingConfig, color: string) => string> = {
  classic: layoutClassic,
  minimal: layoutMinimal,
  modern: layoutModern,
  elegant: layoutElegant,
};

// ============ MAIN RENDER ============

/**
 * Render a complete branded HTML email.
 */
export function renderEmail(
  subject: string,
  body: string,
  variables: Record<string, string>,
  branding: BrandingConfig,
  layout: EmailLayout = "classic"
): { subject: string; html: string } {
  const renderedSubject = interpolate(subject, variables);
  const renderedBody = markdownToHtml(interpolate(body, variables));

  const color = branding.primary_color || "#2563eb";
  const finalBody = processBody(renderedBody, variables, color);

  const layoutRenderer = LAYOUT_RENDERERS[layout] || LAYOUT_RENDERERS.classic;
  const innerHtml = layoutRenderer(finalBody, branding, color);

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

  return { subject: renderedSubject, html };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
