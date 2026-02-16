/**
 * Regression test: Ensures schema SQL uses uuid types (not text) for all
 * identity columns that reference Supabase Auth or teams.
 *
 * This test would have caught the text-vs-uuid type mismatch bug where
 * tables used TEXT columns for IDs that should be uuid.
 */

import { readFileSync } from "fs";
import { join } from "path";

describe("Schema type consistency - text vs uuid regression", () => {
  const schemaPath = join(__dirname, "../../../supabase-schema.sql");
  let schema: string;

  beforeAll(() => {
    schema = readFileSync(schemaPath, "utf-8");
  });

  const uuidColumns = [
    { table: "projects", column: "team_id", type: "uuid" },
    { table: "projects", column: "created_by", type: "uuid" },
    { table: "templates", column: "team_id", type: "uuid" },
    { table: "templates", column: "created_by", type: "uuid" },
    { table: "preset_stages", column: "team_id", type: "uuid" },
    { table: "preset_stages", column: "created_by", type: "uuid" },
    { table: "messages", column: "sender_id", type: "uuid" },
    { table: "files", column: "uploaded_by", type: "uuid" },
    { table: "clients", column: "team_id", type: "uuid" },
    { table: "clients", column: "created_by", type: "uuid" },
  ];

  it("should not use TEXT type for identity columns that hold Supabase Auth uuids", () => {
    // The schema should NOT contain patterns like "team_id TEXT" or "created_by TEXT"
    // for tables that reference auth users or teams
    const textIdPatterns = [
      /org_id\s+TEXT/i,
      /clerk_user_id\s+TEXT/i,
      /team_id\s+TEXT/i,
      /created_by\s+TEXT/i,
      /sender_id\s+TEXT/i,
      /uploaded_by\s+TEXT/i,
      /started_by\s+TEXT/i,
    ];

    for (const pattern of textIdPatterns) {
      expect(schema).not.toMatch(pattern);
    }
  });

  it("should use uuid type for all identity columns", () => {
    for (const { table, column, type } of uuidColumns) {
      // Find the CREATE TABLE block for this table and verify column type
      const tableRegex = new RegExp(
        `CREATE TABLE[^;]*?${table}\\s*\\([^;]*?${column}\\s+(\\w+)`,
        "is"
      );
      const match = schema.match(tableRegex);
      expect(match).not.toBeNull();
      if (match) {
        expect(match[1].toLowerCase()).toBe(type);
      }
    }
  });

  it("should not reference legacy organizations table in FK constraints", () => {
    // After migration, no FK should reference organizations(id)
    expect(schema).not.toMatch(/REFERENCES\s+organizations/i);
  });

  it("should reference teams table for team-based FKs", () => {
    expect(schema).toMatch(/REFERENCES\s+public\.teams\(id\)/i);
  });

  it("should not use ::text casts in RLS policies (indicates type mismatch workaround)", () => {
    // If RLS policies need ::text casts, it means columns have mismatched types
    const rlsPolicies = schema.match(/CREATE POLICY[\s\S]*?;/g) || [];
    for (const policy of rlsPolicies) {
      expect(policy).not.toMatch(/::text/);
    }
  });
});
