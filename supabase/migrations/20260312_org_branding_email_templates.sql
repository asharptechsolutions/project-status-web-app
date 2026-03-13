-- Org branding: logo, colors per team
CREATE TABLE org_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#2563eb',
  secondary_color text,
  accent_color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

ALTER TABLE org_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own org branding"
  ON org_branding FOR SELECT
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Owners can manage org branding"
  ON org_branding FOR ALL
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'owner'))
  WITH CHECK (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'owner'));

-- Email templates: customizable email content per team per type
CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, template_type)
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own org email templates"
  ON email_templates FOR SELECT
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Owners can manage email templates"
  ON email_templates FOR ALL
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'owner'))
  WITH CHECK (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'owner'));

-- Create storage bucket for org logos
INSERT INTO storage.buckets (id, name, public) VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view org logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-logos');

CREATE POLICY "Authenticated users can upload org logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'org-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update org logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'org-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete org logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'org-logos' AND auth.role() = 'authenticated');
