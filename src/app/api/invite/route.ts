import { NextRequest, NextResponse } from "next/server";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "sk_test_LIsoTTHB4mPaBhw3PQ4Ris4Xu4ff03P9GbB5FeZQ04";

export async function POST(req: NextRequest) {
  try {
    const { email, role, orgId } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const inviteRole = role === "member" ? "org:member" : "org:member";
    // Clerk org invitations use org roles: org:admin or org:member
    // Clients and members both join as org:member; we differentiate in Supabase

    const res = await fetch(`https://api.clerk.com/v1/organizations/${orgId}/invitations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        role: inviteRole,
        public_metadata: { appRole: role || "client" },
        redirect_url: "https://projectstatus.app/",
      }),
    });

    if (res.status === 422) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.errors?.[0]?.message || "Already has an account or pending invitation";
      return NextResponse.json({ message: msg }, { status: 200 });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.errors?.[0]?.message || "Failed to send invitation" },
        { status: res.status }
      );
    }

    return NextResponse.json({ message: "Invitation sent" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
