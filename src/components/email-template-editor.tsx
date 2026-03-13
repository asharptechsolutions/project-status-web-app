"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { getEmailTemplates, upsertEmailTemplate } from "@/lib/data";
import {
  EMAIL_TEMPLATE_TYPES,
  EMAIL_LAYOUTS,
  renderEmail,
  getDefaultTemplate,
} from "@/lib/email-renderer";
import type { EmailTemplate } from "@/lib/types";
import type { BrandingConfig, EmailLayout } from "@/lib/email-renderer";
import type { LiveBranding } from "@/components/branding-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Save,
  Eye,
  RotateCcw,
  Mail,
  ChevronDown,
  ChevronRight,
  LayoutTemplate,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EmailTemplateEditorProps {
  liveBranding?: LiveBranding | null;
}

export function EmailTemplateEditor({ liveBranding }: EmailTemplateEditorProps) {
  const { orgId, orgName } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Edited state per template type
  const [editedSubjects, setEditedSubjects] = useState<Record<string, string>>({});
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});
  const [editedLayouts, setEditedLayouts] = useState<Record<string, EmailLayout>>({});
  const [editedActive, setEditedActive] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const t = await getEmailTemplates(orgId);
        setTemplates(t);

        const subjects: Record<string, string> = {};
        const bodies: Record<string, string> = {};
        const layouts: Record<string, EmailLayout> = {};
        const active: Record<string, boolean> = {};
        for (const tmpl of t) {
          subjects[tmpl.template_type] = tmpl.subject;
          bodies[tmpl.template_type] = tmpl.body;
          layouts[tmpl.template_type] = (tmpl.layout || "classic") as EmailLayout;
          active[tmpl.template_type] = tmpl.is_active;
        }
        setEditedSubjects(subjects);
        setEditedBodies(bodies);
        setEditedLayouts(layouts);
        setEditedActive(active);
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  const getSubject = (type: string) =>
    editedSubjects[type] ?? getDefaultTemplate(type)?.subject ?? "";
  const getBody = (type: string) =>
    editedBodies[type] ?? getDefaultTemplate(type)?.body ?? "";
  const getLayout = (type: string): EmailLayout =>
    editedLayouts[type] ?? "classic";
  const getActive = (type: string) =>
    editedActive[type] ?? true;

  const emailColor = liveBranding?.email_accent_color || liveBranding?.primary_color || "#2563eb";

  const brandingConfig: BrandingConfig = useMemo(
    () => ({
      logo_url: liveBranding?.logo_url ?? null,
      primary_color: emailColor,
      secondary_color: liveBranding?.secondary_color || null,
      org_name: orgName || "Your Company",
    }),
    [liveBranding, emailColor, orgName]
  );

  const handleSave = async (type: string) => {
    if (!orgId) return;
    setSaving(type);
    try {
      await upsertEmailTemplate({
        team_id: orgId,
        template_type: type,
        subject: getSubject(type),
        body: getBody(type),
        layout: getLayout(type),
        is_active: getActive(type),
      });
      toast.success("Template saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    } finally {
      setSaving(null);
    }
  };

  const handleSelectPreset = (type: string, presetId: string) => {
    const tmplDef = EMAIL_TEMPLATE_TYPES.find((t) => t.type === type);
    const preset = tmplDef?.presets.find((p) => p.id === presetId);
    if (!preset) return;
    setEditedSubjects((prev) => ({ ...prev, [type]: preset.subject }));
    setEditedBodies((prev) => ({ ...prev, [type]: preset.body }));
    toast.success(`Applied "${preset.label}" preset`);
  };

  const handleSelectLayout = (type: string, layout: EmailLayout) => {
    setEditedLayouts((prev) => ({ ...prev, [type]: layout }));
  };

  const handleReset = (type: string) => {
    const defaults = getDefaultTemplate(type);
    if (!defaults) return;
    setEditedSubjects((prev) => ({ ...prev, [type]: defaults.subject }));
    setEditedBodies((prev) => ({ ...prev, [type]: defaults.body }));
    setEditedLayouts((prev) => ({ ...prev, [type]: "classic" }));
    toast.success("Reset to default template");
  };

  const renderPreview = (type: string) => {
    const tmplDef = EMAIL_TEMPLATE_TYPES.find((t) => t.type === type);
    if (!tmplDef) return null;

    const variables: Record<string, string> = {};
    for (const p of tmplDef.placeholders) {
      variables[p.key] = p.example;
    }
    variables.org_name = orgName || "Your Company";

    const { html } = renderEmail(
      getSubject(type),
      getBody(type),
      variables,
      brandingConfig,
      getLayout(type)
    );
    return html;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Email Templates
          </CardTitle>
          <CardDescription>
            Customize the emails sent to your team members and clients. Pick a layout, choose a
            preset, then edit the content. Use {"{{placeholders}}"} for dynamic content.
          </CardDescription>
        </CardHeader>
      </Card>

      {EMAIL_TEMPLATE_TYPES.map((tmplDef) => {
        const isExpanded = expandedType === tmplDef.type;
        const isPreviewing = previewType === tmplDef.type;
        const savedTmpl = templates.find((t) => t.template_type === tmplDef.type);
        const isCustomized = !!savedTmpl;
        const currentLayout = getLayout(tmplDef.type);

        return (
          <Card key={tmplDef.type}>
            <CardContent className="pt-4 pb-4">
              {/* Header row */}
              <button
                className="flex items-center justify-between w-full text-left"
                onClick={() => setExpandedType(isExpanded ? null : tmplDef.type)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{tmplDef.label}</p>
                    <p className="text-sm text-muted-foreground">{tmplDef.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCustomized && (
                    <Badge variant="outline" className="text-xs">
                      Customized
                    </Badge>
                  )}
                  <div onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={getActive(tmplDef.type)}
                      onCheckedChange={(checked) =>
                        setEditedActive((prev) => ({ ...prev, [tmplDef.type]: checked }))
                      }
                    />
                  </div>
                </div>
              </button>

              {/* Expanded editor */}
              {isExpanded && (
                <div className="mt-4 space-y-5 pl-7">
                  {/* Layout selector */}
                  <div>
                    <Label className="flex items-center gap-1.5 mb-2">
                      <LayoutTemplate className="h-3.5 w-3.5" /> Layout
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {EMAIL_LAYOUTS.map((layout) => (
                        <button
                          key={layout.id}
                          type="button"
                          onClick={() => handleSelectLayout(tmplDef.type, layout.id)}
                          className={cn(
                            "relative flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all text-center",
                            currentLayout === layout.id
                              ? "border-primary bg-primary/5"
                              : "border-muted hover:border-muted-foreground/30"
                          )}
                        >
                          {currentLayout === layout.id && (
                            <div className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                          <LayoutThumbnail layout={layout.id} color={emailColor} />
                          <span className="text-xs font-medium mt-1">{layout.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content presets */}
                  <div>
                    <Label className="mb-2 block">Content Presets</Label>
                    <div className="flex flex-wrap gap-2">
                      {tmplDef.presets.map((preset) => (
                        <Button
                          key={preset.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectPreset(tmplDef.type, preset.id)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select a preset to populate the fields below. You can edit freely after.
                    </p>
                  </div>

                  {/* Available placeholders */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Available placeholders</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {tmplDef.placeholders.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          className="text-xs font-mono bg-muted rounded px-1.5 py-0.5 hover:bg-muted-foreground/20 transition-colors"
                          onClick={() => {
                            navigator.clipboard.writeText(`{{${p.key}}}`);
                            toast.success(`Copied {{${p.key}}}`);
                          }}
                          title={`${p.label} — e.g. "${p.example}". Click to copy.`}
                        >
                          {`{{${p.key}}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Subject</Label>
                    <Input
                      value={getSubject(tmplDef.type)}
                      onChange={(e) =>
                        setEditedSubjects((prev) => ({
                          ...prev,
                          [tmplDef.type]: e.target.value,
                        }))
                      }
                      placeholder={tmplDef.presets[0]?.subject}
                    />
                  </div>

                  <div>
                    <Label>Body</Label>
                    <Textarea
                      value={getBody(tmplDef.type)}
                      onChange={(e) =>
                        setEditedBodies((prev) => ({
                          ...prev,
                          [tmplDef.type]: e.target.value,
                        }))
                      }
                      placeholder={tmplDef.presets[0]?.body}
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports **bold** text. For invite emails, include {"{{invite_link}}"} on its
                      own line to render as a button.
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(tmplDef.type)}
                      disabled={saving === tmplDef.type}
                    >
                      {saving === tmplDef.type ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPreviewType(isPreviewing ? null : tmplDef.type)
                      }
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {isPreviewing ? "Hide Preview" : "Preview"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReset(tmplDef.type)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                  </div>

                  {/* Preview */}
                  {isPreviewing && (
                    <div className="border rounded-lg overflow-hidden mt-2">
                      <div className="bg-muted px-3 py-2 text-xs text-muted-foreground font-medium border-b">
                        Email Preview (with example data)
                      </div>
                      <iframe
                        srcDoc={renderPreview(tmplDef.type) || ""}
                        className="w-full bg-white"
                        style={{ height: 450, border: "none" }}
                        title={`${tmplDef.label} preview`}
                        sandbox="allow-same-origin"
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============ LAYOUT THUMBNAILS ============

function LayoutThumbnail({ layout, color }: { layout: EmailLayout; color: string }) {
  const w = 48;
  const h = 36;

  switch (layout) {
    case "classic":
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
          <rect x="0" y="0" width={w} height="10" rx="2" fill={color} />
          <rect x="3" y="3" width="12" height="4" rx="1" fill="rgba(255,255,255,0.8)" />
          <rect x="0" y="10" width={w} height="22" fill="white" stroke="#e4e4e7" strokeWidth="0.5" />
          <rect x="4" y="14" width="28" height="2" rx="1" fill="#d4d4d8" />
          <rect x="4" y="18" width="20" height="2" rx="1" fill="#d4d4d8" />
          <rect x="0" y="32" width={w} height="4" rx="0" fill="#fafafa" />
        </svg>
      );
    case "minimal":
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
          <rect x="0" y="0" width={w} height="3" rx="1.5" fill={color} />
          <rect x="0" y="3" width={w} height="33" fill="white" stroke="#e4e4e7" strokeWidth="0.5" />
          <rect x="14" y="7" width="20" height="3" rx="1" fill="#d4d4d8" />
          <rect x="4" y="14" width="28" height="2" rx="1" fill="#e4e4e7" />
          <rect x="4" y="18" width="20" height="2" rx="1" fill="#e4e4e7" />
        </svg>
      );
    case "modern":
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
          <rect x="0" y="0" width={w} height="14" rx="2" fill={color} />
          <rect x="14" y="4" width="20" height="3" rx="1" fill="rgba(255,255,255,0.8)" />
          <rect x="16" y="9" width="16" height="2" rx="1" fill="rgba(255,255,255,0.5)" />
          <rect x="0" y="14" width={w} height="18" fill="white" stroke="#e4e4e7" strokeWidth="0.5" />
          <rect x="4" y="18" width="28" height="2" rx="1" fill="#d4d4d8" />
          <rect x="0" y="32" width={w} height="4" rx="0" fill={color} opacity="0.9" />
        </svg>
      );
    case "elegant":
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
          <rect x="0" y="0" width={w} height={h} rx="2" fill="white" stroke="#e4e4e7" strokeWidth="0.5" />
          <rect x="4" y="4" width="12" height="4" rx="1" fill="#d4d4d8" />
          <rect x="30" y="5" width="14" height="2" rx="1" fill="#e4e4e7" />
          <rect x="4" y="11" width="40" height="1.5" rx="0.75" fill={color} />
          <rect x="4" y="16" width="28" height="2" rx="1" fill="#e4e4e7" />
          <rect x="4" y="20" width="20" height="2" rx="1" fill="#e4e4e7" />
        </svg>
      );
  }
}
