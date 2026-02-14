// Redirects to the main /api/invite route — kept for backward compat
import { NextRequest, NextResponse } from "next/server";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "sk_live_8QI7MICx80p84Nz1hRQHurO0E895H9qbqbFmOMBMsX";

export async function POST(req: NextRequest) {
  try {
    const { email, orgId } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const res = await fetch(`https://api.clerk.com/v1/organizations/${orgId}/invitations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        role: "org:member",
        public_metadata: { appRole: "client" },
        redirect_url: "https://projectstatus.app/",
      }),
    });

    if (res.status === 422) {
      return NextResponse.json({ message: "Already has an account or invitation" }, { status: 200 });
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
