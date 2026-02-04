// API endpoint for history/audit log
// GET /api/runs/[slug]/history - returns filtered history events
// Supports query params: eventTypes, laneIds, since, until, limit, offset, format

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import os from "os";
import { readHistoryEventsFiltered, exportHistoryAsJson, HistoryFilter } from "@/lib/history";
import { HistoryEventType } from "@/lib/plan-schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );

    // Parse query params
    const searchParams = request.nextUrl.searchParams;

    // Event type filtering (comma-separated)
    const eventTypesParam = searchParams.get("eventTypes");
    const eventTypes = eventTypesParam
      ? (eventTypesParam.split(",") as HistoryEventType[])
      : undefined;

    // Lane ID filtering (comma-separated)
    const laneIdsParam = searchParams.get("laneIds");
    const laneIds = laneIdsParam ? laneIdsParam.split(",") : undefined;

    // Time range filtering
    const since = searchParams.get("since") || undefined;
    const until = searchParams.get("until") || undefined;

    // Pagination
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Export format
    const format = searchParams.get("format") || "json";

    // Build filter
    const filter: HistoryFilter = {
      eventTypes,
      laneIds,
      since,
      until,
      limit,
      offset,
    };

    // Export as raw JSON file if requested
    if (format === "export") {
      const jsonContent = exportHistoryAsJson(runDir);
      return new NextResponse(jsonContent, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="history-${slug}.json"`,
        },
      });
    }

    // Read filtered events
    const { events, total } = readHistoryEventsFiltered(runDir, filter);

    return NextResponse.json({
      success: true,
      runSlug: slug,
      events,
      total,
      limit,
      offset,
      hasMore: offset + events.length < total,
    });
  } catch (error) {
    console.error("History API error:", error);
    return NextResponse.json(
      { error: "Failed to read history" },
      { status: 500 }
    );
  }
}
