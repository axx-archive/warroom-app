import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { PlanTemplate, WarRoomPlan, TemplateLane } from "@/lib/plan-schema";

const TEMPLATES_DIR = path.join(
  os.homedir(),
  ".openclaw/workspace/warroom/templates"
);

// GET /api/templates - List all templates
export async function GET() {
  try {
    // Ensure templates directory exists
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });

    // Read all template files
    const files = await fs.readdir(TEMPLATES_DIR);
    const templateFiles = files.filter((f) => f.endsWith(".json"));

    const templates: PlanTemplate[] = [];
    for (const file of templateFiles) {
      try {
        const content = await fs.readFile(
          path.join(TEMPLATES_DIR, file),
          "utf-8"
        );
        const template = JSON.parse(content) as PlanTemplate;
        templates.push(template);
      } catch (error) {
        console.error(`Failed to read template ${file}:`, error);
        // Skip invalid templates
      }
    }

    // Sort by creation date (newest first)
    templates.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ success: true, templates });
  } catch (error) {
    console.error("List templates error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list templates" },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create a new template from a plan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, name, description, tags } = body as {
      plan: WarRoomPlan;
      name: string;
      description?: string;
      tags?: string[];
    };

    if (!plan || !name) {
      return NextResponse.json(
        { success: false, error: "Plan and name are required" },
        { status: 400 }
      );
    }

    // Convert plan lanes to template lanes (strip repo-specific paths)
    const templateLanes: TemplateLane[] = plan.lanes.map((lane) => ({
      laneId: lane.laneId,
      agent: lane.agent,
      dependsOn: lane.dependsOn,
      autonomy: lane.autonomy,
      verify: lane.verify,
      foundation: lane.foundation,
      allowedPaths: lane.allowedPaths,
    }));

    const template: PlanTemplate = {
      id: uuidv4(),
      name,
      description: description || `Template created from ${plan.runSlug}`,
      lanes: templateLanes,
      mergeMethod: plan.merge.method,
      mergeNotes: plan.merge.notes,
      createdAt: new Date().toISOString(),
      sourceRunSlug: plan.runSlug,
      tags: tags || [],
    };

    // Ensure templates directory exists
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });

    // Save template to file
    const templatePath = path.join(TEMPLATES_DIR, `${template.id}.json`);
    await fs.writeFile(templatePath, JSON.stringify(template, null, 2));

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error("Create template error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create template" },
      { status: 500 }
    );
  }
}
