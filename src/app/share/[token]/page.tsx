"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, KeyRound, AlertTriangle, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";

const SMS_ENABLED = process.env.NEXT_PUBLIC_SMS_OTP_ENABLED === "true";

interface ShareInfo {
  projectId: string;
  projectName: string;
  orgName: string;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const goToTracking = useCallback((projectId: string) => {
    router.replace(`/track/?id=${projectId}`);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const res = await fetch(`/api/share/${token}/`);
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data: ShareInfo = await res.json();
        if (cancelled) return;
        setInfo(data);
        // Already logged in? Go straight to the tracking view —
        // /track + RLS enforce whether this account can actually see it.
        const { data: { session } } = await supabase.auth.getSession();
        if (session && !cancelled) {
          goToTracking(data.projectId);
          return;
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [token, supabase, goToTracking]);

  const handleSendCode = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      // shouldCreateUser: false — only emails already invited as client
      // contacts have accounts, so strangers can't mint one from the link
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: { shouldCreateUser: false },
      });
      if (error) {
        throw new Error(
          "We couldn't send a code to that email. Use the email address your project manager invited you with."
        );
      }
      setStep("code");
      toast.success("Verification code sent — check your email");
    } catch (err: any) {
      toast.error(err.message || "Failed to send code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim() || !info) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.toLowerCase().trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw new Error("Invalid or expired code. Please try again.");
      goToTracking(info.projectId);
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !info) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
            <p className="font-medium">Link not found</p>
            <p className="text-sm text-muted-foreground">
              This share link is invalid or has been disabled. Ask your project manager for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emailForm = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="share-email">Email address</Label>
        <Input
          id="share-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSendCode(); }}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Use the email your project manager has on file for you.
        </p>
      </div>
      <Button className="w-full h-11" onClick={handleSendCode} disabled={!email.trim() || submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
        Email me a code
      </Button>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle className="text-xl">{info.projectName}</CardTitle>
          <CardDescription>
            {info.orgName ? `${info.orgName} shared this project with you. ` : ""}
            Verify your identity with a one-time code to view its status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            SMS_ENABLED ? (
              <Tabs defaultValue="email">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="email"><Mail className="h-4 w-4 mr-1.5" /> Email</TabsTrigger>
                  <TabsTrigger value="sms"><Smartphone className="h-4 w-4 mr-1.5" /> Text message</TabsTrigger>
                </TabsList>
                <TabsContent value="email">{emailForm}</TabsContent>
                <TabsContent value="sms">
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Text message verification is coming soon. Please use email for now.
                  </p>
                </TabsContent>
              </Tabs>
            ) : (
              emailForm
            )
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="share-code">Verification code</Label>
                <Input
                  id="share-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  className="text-center text-lg tracking-[0.3em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  We sent a code to {maskEmail(email)}.
                </p>
              </div>
              <Button className="w-full h-11" onClick={handleVerify} disabled={code.trim().length < 6 || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                Verify &amp; view project
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => { setStep("email"); setCode(""); }} disabled={submitting}>
                Use a different email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
