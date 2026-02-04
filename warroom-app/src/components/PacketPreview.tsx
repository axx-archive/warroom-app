"use client";

import { useState } from "react";

interface PacketPreviewProps {
  laneId: string;
  content: string;
  onClose: () => void;
}

export function PacketPreview({ laneId, content, onClose }: PacketPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal max-w-3xl">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "rgba(124, 58, 237, 0.15)", border: "1px solid rgba(124, 58, 237, 0.3)" }}>
              <svg className="w-4 h-4" style={{ color: "var(--accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="h3" style={{ color: "var(--text)" }}>
                {laneId}
              </h3>
              <p className="label">
                WARROOM_PACKET.md
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={copied ? "btn btn--success" : "btn btn--secondary"}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="btn btn--icon"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="modal-body max-h-[60vh] overflow-auto">
          <pre className="code-block small whitespace-pre-wrap">
            {content}
          </pre>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div className="flex items-center gap-2 small" style={{ color: "var(--muted)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Copy this packet and paste into Claude Code in the lane&apos;s Cursor window</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline expandable version for the plan viewer
interface PacketExpanderProps {
  laneId: string;
  content: string;
}

export function PacketExpander({ laneId, content }: PacketExpanderProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="overflow-hidden" style={{ border: "1px solid var(--border)", borderRadius: "3px" }}>
      {/* Toggle Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left group"
        style={{ background: "var(--panel)", transition: "all var(--duration-fast) var(--ease)" }}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            style={{ color: "var(--muted)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="mono small group-hover:text-[var(--text)]" style={{ color: "var(--muted)", transition: "color var(--duration-fast)" }}>
            {laneId}
          </span>
          <span className="label">Packet</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={copied ? "badge badge--success" : "badge badge--idle"}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="max-h-64 overflow-auto" style={{ background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
          <pre className="p-4 mono small whitespace-pre-wrap" style={{ color: "var(--muted)" }}>
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
