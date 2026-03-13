"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { getOrgBranding, upsertOrgBranding, uploadOrgLogo } from "@/lib/data";
import { extractColors } from "@/lib/color-extract";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Trash2, Save, Palette, Wand2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface LiveBranding {
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  email_accent_color: string;
}

interface BrandingSettingsProps {
  onBrandingChange?: (branding: LiveBranding) => void;
}

export function BrandingSettings({ onBrandingChange }: BrandingSettingsProps) {
  const { orgId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [emailAccentColor, setEmailAccentColor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [savedState, setSavedState] = useState({
    logoUrl: null as string | null,
    primaryColor: "#2563eb",
    secondaryColor: "",
    accentColor: "",
    emailAccentColor: "",
  });

  // Emit live branding state to parent whenever any value changes
  useEffect(() => {
    if (loading) return;
    onBrandingChange?.({
      logo_url: logoUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      email_accent_color: emailAccentColor || primaryColor,
    });
  }, [logoUrl, primaryColor, secondaryColor, accentColor, emailAccentColor, loading, onBrandingChange]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const b = await getOrgBranding(orgId);
        if (b) {
          setLogoUrl(b.logo_url);
          setPrimaryColor(b.primary_color);
          setSecondaryColor(b.secondary_color || "");
          setAccentColor(b.accent_color || "");
          setEmailAccentColor(b.email_accent_color || "");
          setSavedState({
            logoUrl: b.logo_url,
            primaryColor: b.primary_color,
            secondaryColor: b.secondary_color || "",
            accentColor: b.accent_color || "",
            emailAccentColor: b.email_accent_color || "",
          });
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  const isDirty =
    logoUrl !== savedState.logoUrl ||
    primaryColor !== savedState.primaryColor ||
    secondaryColor !== savedState.secondaryColor ||
    accentColor !== savedState.accentColor ||
    emailAccentColor !== savedState.emailAccentColor;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadOrgLogo(orgId, file);
      setLogoUrl(url);
      toast.success("Logo uploaded");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload logo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleExtractColors = async () => {
    if (!logoUrl) return;
    setExtracting(true);
    try {
      const colors = await extractColors(logoUrl, 3);
      if (colors[0]) setPrimaryColor(colors[0]);
      if (colors[1]) setSecondaryColor(colors[1]);
      if (colors[2]) setAccentColor(colors[2]);
      toast.success("Colors extracted from logo");
    } catch {
      toast.error("Failed to extract colors from logo");
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      await upsertOrgBranding({
        team_id: orgId,
        logo_url: logoUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor || null,
        accent_color: accentColor || null,
        email_accent_color: emailAccentColor || null,
      });
      setSavedState({ logoUrl, primaryColor, secondaryColor, accentColor, emailAccentColor });
      toast.success("Branding saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save branding");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Build list of available brand colors for email accent picker
  const emailColorOptions = [
    { color: primaryColor, label: "Primary" },
    ...(secondaryColor ? [{ color: secondaryColor, label: "Secondary" }] : []),
    ...(accentColor ? [{ color: accentColor, label: "Accent" }] : []),
  ];
  const activeEmailColor = emailAccentColor || primaryColor;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization Logo</CardTitle>
          <CardDescription>
            Upload your company logo. It will appear in email headers and branded communications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoUrl && (
            <div className="flex items-center gap-4">
              <div className="border rounded-lg p-3 bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Logo" className="max-h-16 max-w-[200px] object-contain" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogoUrl(null)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Remove
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading ? "Uploading..." : logoUrl ? "Replace Logo" : "Upload Logo"}
            </Button>

            {logoUrl && (
              <Button
                variant="outline"
                onClick={handleExtractColors}
                disabled={extracting}
              >
                {extracting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                {extracting ? "Extracting..." : "Auto-detect Colors"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" /> Brand Colors
          </CardTitle>
          <CardDescription>
            These colors are used in email templates. Upload a logo and click &ldquo;Auto-detect Colors&rdquo; to set them automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Primary Color</Label>
              <div className="flex gap-2 mt-1.5">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer bg-transparent"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#2563eb"
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label>Secondary Color</Label>
              <div className="flex gap-2 mt-1.5">
                <input
                  type="color"
                  value={secondaryColor || "#6b7280"}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer bg-transparent"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="Optional"
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label>Accent Color</Label>
              <div className="flex gap-2 mt-1.5">
                <input
                  type="color"
                  value={accentColor || "#f59e0b"}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer bg-transparent"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="Optional"
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          {/* Color preview */}
          <div className="flex gap-2 mt-2">
            <div className="h-8 flex-1 rounded" style={{ backgroundColor: primaryColor }} />
            {secondaryColor && (
              <div className="h-8 flex-1 rounded" style={{ backgroundColor: secondaryColor }} />
            )}
            {accentColor && (
              <div className="h-8 flex-1 rounded" style={{ backgroundColor: accentColor }} />
            )}
          </div>

          {/* Email accent color picker */}
          <div className="pt-2">
            <Label>Email Accent Color</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Choose which brand color to use as the accent in your emails.
            </p>
            <div className="flex gap-3">
              {emailColorOptions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setEmailAccentColor(opt.color === primaryColor ? "" : opt.color)}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-2.5 transition-all",
                    activeEmailColor === opt.color
                      ? "border-foreground"
                      : "border-transparent hover:border-muted-foreground/30"
                  )}
                >
                  <div
                    className="w-10 h-10 rounded-full border shadow-sm"
                    style={{ backgroundColor: opt.color }}
                  />
                  {activeEmailColor === opt.color && (
                    <div className="absolute -top-1 -right-1 bg-foreground text-background rounded-full w-4 h-4 flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving || !isDirty}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Branding
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
