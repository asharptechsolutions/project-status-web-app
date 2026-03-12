"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Workflow, Chrome } from "lucide-react";

const supabase = createClient();

interface AuthFormProps {
  mode: "signin" | "signup";
  onToggle: () => void;
  onBack?: () => void;
  /** Render just the card without full-page wrapper */
  compact?: boolean;
  /** Whether to show the sign-up toggle (default true) */
  showSignUp?: boolean;
  /** URL to redirect to after OAuth/email auth */
  redirectUrl?: string;
}

export function AuthForm({
  mode,
  onToggle,
  onBack,
  compact = false,
  showSignUp = true,
  redirectUrl,
}: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const callbackUrl = redirectUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback/`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (mode === "signup") {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl },
      });
      if (err) {
        if (err.message.toLowerCase().includes("already registered") || err.message.toLowerCase().includes("already been registered")) {
          setError("An account with this email already exists. You may have been invited — check your email for an invitation link, or sign in and use 'Forgot password' if needed.");
        } else {
          setError(err.message);
        }
      } else {
        setMessage("Check your email for a confirmation link!");
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
  };

  const card = (
    <>
      <Card className="shadow-lg border-border/50">
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-xl font-semibold text-center tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-muted-foreground text-center -mt-2">
            {mode === "signin" ? "Sign in to continue to your dashboard" : "Get started with ProjectStatus for free"}
          </p>

          <Button variant="outline" className="w-full rounded-lg h-11" onClick={handleGoogleSignIn}>
            <Chrome className="h-4 w-4 mr-2" />
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="rounded-lg h-10" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="rounded-lg h-10" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
            <Button type="submit" className="w-full rounded-lg h-11" disabled={loading}>
              {loading ? "Loading..." : mode === "signin" ? "Sign In" : "Sign Up"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {showSignUp && (
        <p className="text-sm text-center text-muted-foreground mt-4">
          {mode === "signin" ? (
            <>Don&apos;t have an account?{" "}
              <button className="text-primary font-medium hover:underline" onClick={onToggle}>Sign Up</button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button className="text-primary font-medium hover:underline" onClick={onToggle}>Sign In</button>
            </>
          )}
          {onBack && (
            <>
              {" · "}
              <button className="text-primary font-medium hover:underline" onClick={onBack}>Back</button>
            </>
          )}
        </p>
      )}
      {!showSignUp && onBack && (
        <p className="text-sm text-center text-muted-foreground mt-4">
          <button className="text-primary font-medium hover:underline" onClick={onBack}>Back</button>
        </p>
      )}
    </>
  );

  if (compact) {
    return <div className="w-full max-w-md">{card}</div>;
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 -left-32 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 -right-32 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>
      <div className="w-full max-w-md relative z-10 opacity-0 animate-scale-in">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Workflow className="h-5 w-5 text-primary" />
          </div>
          <span className="text-2xl font-bold tracking-tight">ProjectStatus</span>
        </div>
        {card}
      </div>
    </div>
  );
}
