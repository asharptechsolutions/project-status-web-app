const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

exports.sendVerificationCode = onCall(
  { secrets: [RESEND_API_KEY], cors: true },
  async (request) => {
    const email = (request.data.email || "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "Valid email required");
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    // Store in Firestore
    await db.collection("wfz_access_codes").add({
      email,
      code,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      used: false,
    });

    // Send email via Resend
    const { Resend } = require("resend");
    const resend = new Resend(RESEND_API_KEY.value());

    await resend.emails.send({
      from: "Workflowz <noreply@workflowz.app>",
      to: email,
      subject: "Your Workflowz Verification Code",
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Workflowz Verification</h2>
          <p>Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 16px 0;">
            ${code}
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 15 minutes.</p>
        </div>
      `,
    });

    return { success: true };
  }
);
