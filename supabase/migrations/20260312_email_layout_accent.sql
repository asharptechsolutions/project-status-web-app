-- Add layout choice per email template
ALTER TABLE email_templates ADD COLUMN layout text NOT NULL DEFAULT 'classic';

-- Add global email accent color selection (picks from brand colors)
ALTER TABLE org_branding ADD COLUMN email_accent_color text;
