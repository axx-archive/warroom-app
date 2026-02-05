"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface DeleteRunButtonProps {
  slug: string;
}

export function DeleteRunButton({ slug }: DeleteRunButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/runs/${slug}/delete`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/runs");
      } else {
        const data = await response.json();
        console.error("Delete failed:", data.error);
        setDeleting(false);
        setShowConfirm(false);
      }
    } catch (err) {
      console.error("Delete error:", err);
      setDeleting(false);
      setShowConfirm(false);
    }
  }, [showConfirm, slug, router]);

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1.5 text-xs font-mono bg-[var(--status-danger)] text-[var(--void)] rounded hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Confirm Delete"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="px-3 py-1.5 text-xs font-mono text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleDelete}
      className="btn-ghost text-[var(--text-tertiary)] hover:text-[var(--status-danger)] hover:border-[var(--status-danger-dim)]"
      title="Delete mission"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      Delete
    </button>
  );
}
