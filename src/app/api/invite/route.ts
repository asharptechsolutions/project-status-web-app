import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { renderEmail, getDefaultTemplate } from "@/lib/email-renderer";
import type { BrandingConfig, EmailLayout } from "@/lib/email-renderer";

export async function POST(request: NextRequest) {
  try {
    const { email, name, role, teamId, phone, companyId } = await request.json();

    if (!email || !role || !teamId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["owner", "worker", "client"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Derive app URL from request headers (works on localhost and production)
    const origin = request.headers.get("origin")
      || `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("host")}`;

    // Verify the caller is authenticated and is an owner of the team
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerMember } = await supabase
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("team_id", teamId)
      .single();

    if (!callerMember || callerMember.role !== "owner") {
      return NextResponse.json({ error: "Only team owners can invite members" }, { status: 403 });
    }

    const adminClient = createAdminClient();

    // Check if user already exists in auth
    const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUsers.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create user with admin API — gives us the definitive user ID
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: name, team_id: teamId, role },
      });

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      if (!newUser.user) {
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
      }

      userId = newUser.user.id;
    }

    // Generate a magic link via admin API
    // We use generateLink to get a token_hash, then build our own /auth/confirm URL
    // to bypass PKCE (server-generated links have no code_verifier on the client)
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError) {
      console.warn("[invite] Failed to generate magic link:", linkError.message);
    } else {
      const actionLink = linkData?.properties?.action_link;
      if (actionLink) {
        // Parse the Supabase action_link to extract token_hash and type
        const actionUrl = new URL(actionLink);
        const tokenHash = actionUrl.searchParams.get("token");
        const linkType = actionUrl.searchParams.get("type") || "magiclink";

        // Build app-domain URL that goes through our /auth/confirm route handler
        const confirmUrl = `${origin}/auth/confirm?token_hash=${tokenHash}&type=${linkType}&next=${encodeURIComponent("/auth/set-password/")}`;

        // Load branding and custom invite template
        const [brandingRow, templateRow, teamRow] = await Promise.all([
          adminClient.from("org_branding").select("*").eq("team_id", teamId).single(),
          adminClient.from("email_templates").select("*").eq("team_id", teamId).eq("template_type", "invite").eq("is_active", true).single(),
          adminClient.from("teams").select("name").eq("id", teamId).single(),
        ]);

        const orgName = teamRow.data?.name || "ProjectStatus";
        const emailColor = brandingRow.data?.email_accent_color || brandingRow.data?.primary_color || "#2563eb";
        const branding: BrandingConfig = {
          logo_url: brandingRow.data?.logo_url || null,
          primary_color: emailColor,
          secondary_color: brandingRow.data?.secondary_color || null,
          org_name: orgName,
        };

        // Use custom template or defaults
        const defaults = getDefaultTemplate("invite");
        const emailSubject = templateRow.data?.subject || defaults?.subject || "You've been invited";
        const emailBody = templateRow.data?.body || defaults?.body || "";
        const layout: EmailLayout = (templateRow.data?.layout || "classic") as EmailLayout;

        const variables: Record<string, string> = {
          recipient_name: name || "",
          org_name: orgName,
          role: role,
          invite_link: confirmUrl,
        };

        const { subject, html } = renderEmail(emailSubject, emailBody, variables, branding, layout);

        try {
          const resendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `${orgName} <noreply@projectstatus.app>`,
              to: email,
              subject,
              html,
            }),
          });
          if (!resendRes.ok) {
            const err = await resendRes.json();
            console.warn("[invite] Resend error:", err);
          } else {
            console.log("[invite] Invite email sent to:", email);
          }
        } catch (err) {
          console.warn("[invite] Failed to send email:", err);
        }
      }
    }

    // Update profile with name/email/phone
    if (name || phone) {
      await adminClient.from("profiles").upsert({
        id: userId,
        display_name: name || undefined,
        email: email.toLowerCase(),
        ...(phone ? { phone } : {}),
      }, { onConflict: "id" });
    }

    // Add to team_members (upsert to handle existing members)
    // Don't set joined_at here — auth-context sets it on actual login
    const { error: memberError } = await adminClient
      .from("team_members")
      .upsert(
        {
          team_id: teamId,
          user_id: userId,
          role,
          ...(companyId ? { company_id: companyId } : {}),
        },
        { onConflict: "team_id,user_id" }
      );

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      userId,
      invited: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
