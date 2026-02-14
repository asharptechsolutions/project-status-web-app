import { NextRequest, NextResponse } from "next/server";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "sk_test_LIsoTTHB4mPaBhw3PQ4Ris4Xu4ff03P9GbB5FeZQ04";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const res = await fetch("https://api.clerk.com/v1/invitations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        public_metadata: { role: "client" },
        redirect_url: "https://projectstatus.app/sign-up",
      }),
    });

    if (res.status === 422) {
      // Already has account or already invited
      return NextResponse.json({ message: "Client already has an account or invitation" }, { status: 200 });
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
