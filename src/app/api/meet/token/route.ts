import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Mints a Daily.co room + meeting token for an appointment's video call.
// The PM (owner/admin) joins as the room owner (moderator); the client and
// any workers join as regular participants. Uses the secret DAILY_API_KEY, so
// this must run server-side. Room names are derived from the appointment id so
// every participant lands in the same room.
const DAILY_API = "https://api.daily.co/v1";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Video calling isn't configured yet. Add DAILY_API_KEY to the environment." },
        { status: 503 }
      );
    }

    const { appointmentId } = await request.json();
    if (!appointmentId) {
      return NextResponse.json({ error: "Missing appointmentId" }, { status: 400 });
    }

    // Verify the caller's session.
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Load the appointment (with its slot for call timing).
    const { data: appt } = await admin
      .from("appointments")
      .select("*, slot:availability_slots(*)")
      .eq("id", appointmentId)
      .single();
    if (!appt || appt.status === "cancelled") {
      return NextResponse.json({ error: "Appointment not available" }, { status: 404 });
    }

    // Authorize: caller must be staff on the appointment's team, or the
    // specific client the call was booked with.
    const { data: membership } = await admin
      .from("team_members")
      .select("role")
      .eq("team_id", appt.team_id)
      .eq("user_id", user.id)
      .maybeSingle();
    const role = membership?.role;
    const isStaff = role === "owner" || role === "admin" || role === "worker";
    const isBookedClient = user.id === appt.client_id;
    if (!isStaff && !isBookedClient) {
      return NextResponse.json({ error: "Not authorized for this call" }, { status: 403 });
    }

    // The PM (owner/admin) hosts the call. Workers and the client are guests.
    const isOwner = role === "owner" || role === "admin";

    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const userName =
      profile?.display_name || profile?.email || (isBookedClient ? appt.client_name : "Guest");

    // Keep the room alive through the call plus a buffer, then auto-expire so
    // rooms don't accumulate. Never set an expiry in the past.
    const slotEndMs = appt.slot?.end_time
      ? new Date(appt.slot.end_time).getTime()
      : Date.now() + 60 * 60 * 1000;
    const exp = Math.floor(Math.max(slotEndMs + 2 * 60 * 60 * 1000, Date.now() + 60 * 60 * 1000) / 1000);

    // Deterministic, unguessable room name (uuid without dashes keeps it short).
    const roomName = `appt${String(appointmentId).replace(/-/g, "")}`;

    const dailyHeaders = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // Ensure the room exists (idempotent: reuse if present, recreate if expired).
    let roomUrl: string;
    const getRoom = await fetch(`${DAILY_API}/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (getRoom.ok) {
      roomUrl = (await getRoom.json()).url;
    } else if (getRoom.status === 404) {
      const createRoom = await fetch(`${DAILY_API}/rooms`, {
        method: "POST",
        headers: dailyHeaders,
        body: JSON.stringify({
          name: roomName,
          privacy: "private",
          properties: { exp, eject_at_room_exp: true, enable_screenshare: true },
        }),
      });
      if (!createRoom.ok) {
        return NextResponse.json(
          { error: `Failed to create room: ${await createRoom.text()}` },
          { status: 502 }
        );
      }
      roomUrl = (await createRoom.json()).url;
    } else {
      return NextResponse.json(
        { error: `Daily error: ${await getRoom.text()}` },
        { status: 502 }
      );
    }

    // Mint a per-participant meeting token. is_owner grants moderator powers
    // (mute/eject others) to the PM only.
    const tokenResp = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: dailyHeaders,
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: userName,
          user_id: user.id,
          is_owner: isOwner,
          exp,
        },
      }),
    });
    if (!tokenResp.ok) {
      return NextResponse.json(
        { error: `Failed to mint token: ${await tokenResp.text()}` },
        { status: 502 }
      );
    }
    const { token } = await tokenResp.json();

    return NextResponse.json({ url: roomUrl, token, isOwner });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
