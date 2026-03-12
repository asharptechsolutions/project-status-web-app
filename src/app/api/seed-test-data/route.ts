import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * POST /api/seed-test-data
 *
 * Creates test accounts (admin, worker, client), a test org with sample data.
 * Idempotent — safe to run multiple times.
 * Only works in development.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const adminEmail = process.env.TEST_ADMIN_EMAIL;
  const workerEmail = process.env.TEST_WORKER_EMAIL;
  const clientEmail = process.env.TEST_CLIENT_EMAIL;
  const sharedPassword = process.env.TEST_SHARED_PASSWORD;

  if (!adminEmail || !workerEmail || !clientEmail || !sharedPassword) {
    return NextResponse.json(
      { error: "Missing TEST_ADMIN_EMAIL, TEST_WORKER_EMAIL, TEST_CLIENT_EMAIL, or TEST_SHARED_PASSWORD env vars" },
      { status: 500 }
    );
  }

  const admin = createAdminClient();
  const results: string[] = [];

  try {
    // ── 1. Create or find test users ──────────────────────────────
    async function ensureUser(email: string, name: string) {
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (existing) {
        results.push(`User ${email} already exists (${existing.id})`);
        // Ensure password is set
        await admin.auth.admin.updateUserById(existing.id, { password: sharedPassword });
        return existing.id;
      }

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: sharedPassword,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (error) throw new Error(`Failed to create ${email}: ${error.message}`);
      results.push(`Created user ${email} (${data.user.id})`);
      return data.user.id;
    }

    const adminUserId = await ensureUser(adminEmail, "Test Admin");
    const workerUserId = await ensureUser(workerEmail, "Test Worker");
    const clientUserId = await ensureUser(clientEmail, "Test Client");

    // ── 2. Ensure profiles exist ──────────────────────────────────
    for (const { id, name, email } of [
      { id: adminUserId, name: "Test Admin", email: adminEmail },
      { id: workerUserId, name: "Test Worker", email: workerEmail },
      { id: clientUserId, name: "Test Client", email: clientEmail },
    ]) {
      await admin.from("profiles").upsert(
        { id, display_name: name, email: email.toLowerCase() },
        { onConflict: "id" }
      );
    }

    // ── 3. Create or find test organization ───────────────────────
    const testOrgName = "Test Organization";
    const { data: existingOrgs } = await admin
      .from("teams")
      .select("id")
      .eq("name", testOrgName)
      .limit(1);

    let orgId: string;
    if (existingOrgs && existingOrgs.length > 0) {
      orgId = existingOrgs[0].id;
      results.push(`Org "${testOrgName}" already exists (${orgId})`);
    } else {
      const { data: newOrg, error: orgError } = await admin
        .from("teams")
        .insert({ name: testOrgName, created_by: adminUserId })
        .select("id")
        .single();
      if (orgError) throw new Error(`Failed to create org: ${orgError.message}`);
      orgId = newOrg.id;
      results.push(`Created org "${testOrgName}" (${orgId})`);
    }

    // ── 4. Add members to org ─────────────────────────────────────
    const members = [
      { user_id: adminUserId, role: "owner", team_id: orgId },
      { user_id: workerUserId, role: "worker", team_id: orgId },
      { user_id: clientUserId, role: "client", team_id: orgId },
    ];

    for (const m of members) {
      const { error } = await admin
        .from("team_members")
        .upsert(
          { ...m, joined_at: new Date().toISOString() },
          { onConflict: "team_id,user_id" }
        );
      if (error) throw new Error(`Failed to add member ${m.role}: ${error.message}`);
      results.push(`Ensured ${m.role} membership`);
    }

    // ── 5. Create a test company ──────────────────────────────────
    const { data: existingCompanies } = await admin
      .from("companies")
      .select("id")
      .eq("team_id", orgId)
      .eq("name", "Acme Corp")
      .limit(1);

    let companyId: string;
    if (existingCompanies && existingCompanies.length > 0) {
      companyId = existingCompanies[0].id;
      results.push(`Company "Acme Corp" already exists`);
    } else {
      const { data: newCompany, error: companyError } = await admin
        .from("companies")
        .insert({
          team_id: orgId,
          name: "Acme Corp",
          email: "contact@acmecorp.com",
          phone: "(555) 123-4567",
          address: "123 Main St, Springfield, IL 62701",
        })
        .select("id")
        .single();
      if (companyError) throw new Error(`Failed to create company: ${companyError.message}`);
      companyId = newCompany.id;
      results.push(`Created company "Acme Corp" (${companyId})`);
    }

    // Link client to company
    await admin
      .from("team_members")
      .update({ company_id: companyId })
      .eq("team_id", orgId)
      .eq("user_id", clientUserId);

    // ── 6. Create sample projects ─────────────────────────────────
    const projectDefs = [
      {
        name: "Website Redesign",
        description: "Complete redesign of the corporate website with modern UI/UX",
        status: "active" as const,
        stages: [
          { name: "Discovery & Research", status: "completed" as const, position: 0 },
          { name: "Wireframes", status: "completed" as const, position: 1 },
          { name: "Visual Design", status: "in_progress" as const, position: 2 },
          { name: "Development", status: "pending" as const, position: 3 },
          { name: "QA & Testing", status: "pending" as const, position: 4 },
          { name: "Launch", status: "pending" as const, position: 5 },
        ],
      },
      {
        name: "Mobile App MVP",
        description: "First version of the iOS/Android mobile application",
        status: "active" as const,
        stages: [
          { name: "Requirements", status: "completed" as const, position: 0 },
          { name: "UI/UX Design", status: "completed" as const, position: 1 },
          { name: "Backend API", status: "in_progress" as const, position: 2 },
          { name: "Frontend Build", status: "in_progress" as const, position: 3 },
          { name: "Testing", status: "pending" as const, position: 4 },
          { name: "App Store Submit", status: "pending" as const, position: 5 },
        ],
      },
      {
        name: "Brand Identity Package",
        description: "Logo, color palette, typography, and brand guidelines",
        status: "completed" as const,
        stages: [
          { name: "Brand Audit", status: "completed" as const, position: 0 },
          { name: "Concept Development", status: "completed" as const, position: 1 },
          { name: "Logo Design", status: "completed" as const, position: 2 },
          { name: "Brand Guidelines", status: "completed" as const, position: 3 },
          { name: "Asset Delivery", status: "completed" as const, position: 4 },
        ],
      },
    ];

    for (const pDef of projectDefs) {
      // Check if project already exists
      const { data: existingProjects } = await admin
        .from("projects")
        .select("id")
        .eq("team_id", orgId)
        .eq("name", pDef.name)
        .limit(1);

      let projectId: string;
      if (existingProjects && existingProjects.length > 0) {
        projectId = existingProjects[0].id;
        results.push(`Project "${pDef.name}" already exists`);
      } else {
        const { data: newProject, error: projectError } = await admin
          .from("projects")
          .insert({
            team_id: orgId,
            name: pDef.name,
            description: pDef.description,
            status: pDef.status,
            client_name: "Test Client",
            client_email: clientEmail,
            client_phone: "",
            created_by: adminUserId,
            company_id: companyId,
          })
          .select("id")
          .single();
        if (projectError) throw new Error(`Failed to create project "${pDef.name}": ${projectError.message}`);
        projectId = newProject.id;
        results.push(`Created project "${pDef.name}" (${projectId})`);

        // Create stages
        const now = new Date();
        for (const sDef of pDef.stages) {
          const stageData: Record<string, unknown> = {
            project_id: projectId,
            name: sDef.name,
            status: sDef.status,
            position: sDef.position,
          };
          if (sDef.status === "completed") {
            stageData.completed_at = new Date(now.getTime() - (pDef.stages.length - sDef.position) * 3 * 86400000).toISOString();
          }
          if (sDef.status === "in_progress") {
            stageData.started_at = new Date(now.getTime() - 2 * 86400000).toISOString();
            stageData.assigned_to = workerUserId;
          }
          // Set estimated_completion for non-completed stages
          if (sDef.status !== "completed") {
            stageData.estimated_completion = new Date(now.getTime() + (sDef.position + 1) * 7 * 86400000)
              .toISOString()
              .split("T")[0];
          }

          const { error: stageError } = await admin.from("project_stages").insert(stageData);
          if (stageError) throw new Error(`Failed to create stage "${sDef.name}": ${stageError.message}`);
        }

        // Assign worker and client to project
        const { data: workerMember } = await admin
          .from("team_members")
          .select("id")
          .eq("team_id", orgId)
          .eq("user_id", workerUserId)
          .single();

        const { data: clientMember } = await admin
          .from("team_members")
          .select("id")
          .eq("team_id", orgId)
          .eq("user_id", clientUserId)
          .single();

        if (workerMember) {
          await admin
            .from("project_assignments")
            .upsert(
              { project_id: projectId, member_id: workerMember.id },
              { onConflict: "project_id,member_id" }
            );
        }

        if (clientMember) {
          await admin
            .from("project_clients")
            .upsert(
              { project_id: projectId, client_id: clientMember.id },
              { onConflict: "project_id,client_id" }
            );
        }
      }
    }

    // ── 7. Create a sample template ─────────────────────────────
    const { data: existingTemplates } = await admin
      .from("templates")
      .select("id")
      .eq("team_id", orgId)
      .eq("name", "Standard Web Project")
      .limit(1);

    if (!existingTemplates || existingTemplates.length === 0) {
      await admin.from("templates").insert({
        team_id: orgId,
        name: "Standard Web Project",
        description: "A typical web development workflow from discovery to launch",
        stages: [
          { name: "Discovery", position: 0 },
          { name: "Design", position: 1 },
          { name: "Development", position: 2 },
          { name: "Testing", position: 3 },
          { name: "Launch", position: 4 },
        ],
        created_by: adminUserId,
      });
      results.push(`Created template "Standard Web Project"`);
    }

    return NextResponse.json({ success: true, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, results }, { status: 500 });
  }
}
