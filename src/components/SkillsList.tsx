"use client";

import { useState } from "react";
import type { SkillInfo } from "@/lib/fs-utils";

interface SkillsListProps {
  skills: SkillInfo[];
}

export function SkillsList({ skills }: SkillsListProps) {
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  if (skills.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No skills found in .claude/skills/
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {skills.map((skill) => (
        <div
          key={skill.path}
          className="border border-gray-200 rounded-md overflow-hidden"
        >
          <button
            onClick={() =>
              setExpandedSkill(expandedSkill === skill.name ? null : skill.name)
            }
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{skill.name}</span>
              {skill.hasSkillFile && (
                <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                  SKILL.md
                </span>
              )}
            </div>
            <span className="text-gray-400 text-xs">
              {expandedSkill === skill.name ? "[-]" : "[+]"}
            </span>
          </button>

          {expandedSkill === skill.name && skill.content && (
            <div className="px-3 py-2 bg-white border-t border-gray-200">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
                {skill.content.slice(0, 2000)}
                {skill.content.length > 2000 && "..."}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
