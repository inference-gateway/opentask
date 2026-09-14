import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Approval-prompt shortcut (a = approve, d = deny), mirroring the desktop's
// Transcript.tsx binding: ignores auto-repeat and modifier combos, and no-ops
// when the key lands in an editable element so the composer keeps its keys.
// Returns true when handled, so the caller can preventDefault.
export function approvalShortcut(e: KeyboardEvent, respond: (action: "approve" | "reject") => void): boolean {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return false;
  const t = e.target as HTMLElement | null;
  if (t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName ?? "")) return false;
  const key = e.key.toLowerCase();
  if (key !== "a" && key !== "d") return false;
  respond(key === "a" ? "approve" : "reject");
  return true;
}
