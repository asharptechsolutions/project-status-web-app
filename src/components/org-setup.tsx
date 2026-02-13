"use client";
import { CreateOrganization } from "@clerk/clerk-react";
import { Workflow } from "lucide-react";

export function OrgSetup() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="flex items-center gap-2 mb-6">
        <Workflow className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold">ProjectStatus</span>
      </div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold mb-2">Create Your Organization</h2>
        <p className="text-muted-foreground max-w-md">
          Set up your organization to start managing projects and inviting team members.
        </p>
      </div>
      <CreateOrganization
        afterCreateOrganizationUrl="/"
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
      />
    </div>
  );
}
