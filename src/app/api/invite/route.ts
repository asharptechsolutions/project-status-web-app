import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

    // Generate a magic link via admin API (no PKCE — avoids code verifier mismatch)
    // Redirect through callback → set-password page so new users can create a password
    const callbackUrl = `${origin}/auth/callback/?next=${encodeURIComponent("/auth/set-password/")}`;
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: callbackUrl },
    });

    if (linkError) {
      console.warn("[invite] Failed to generate magic link:", linkError.message);
    } else {
      // Send the magic link email via Resend
      const actionLink = linkData?.properties?.action_link;
      if (actionLink) {
        try {
          const resendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "ProjectStatus <noreply@projectstatus.app>",
              to: email,
              subject: `You've been invited to ProjectStatus`,
              html: `<h2>You've been invited!</h2>
<p>${name ? `Hi ${name}, you` : "You"} have been invited to collaborate on ProjectStatus.</p>
<p><a href="${actionLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Sign In to ProjectStatus</a></p>
<p style="color:#666;font-size:14px;">Or copy this link: ${actionLink}</p>`,
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
