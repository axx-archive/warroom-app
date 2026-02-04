import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { PlanTemplate } from "@/lib/plan-schema";

const TEMPLATES_DIR = path.join(
  os.homedir(),
  ".openclaw/workspace/warroom/templates"
);

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/templates/[id] - Get a specific template
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const templatePath = path.join(TEMPLATES_DIR, `${id}.json`);

    try {
      const content = await fs.readFile(templatePath, "utf-8");
      const template = JSON.parse(content) as PlanTemplate;
      return NextResponse.json({ success: true, template });
    } catch {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Get template error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get template" },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const templatePath = path.join(TEMPLATES_DIR, `${id}.json`);

    try {
      await fs.unlink(templatePath);
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Delete template error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
