// Quick-prompt palette defaults: infer-action directives. Editable in the options page.
export type Prompt = { id: string; label: string; description: string; insert: string };

export const DEFAULT_PROMPTS: Prompt[] = [
  { id: "opentask", label: "@opentask", description: "Trigger the OpenTask agent", insert: "@opentask " },
  {
    id: "opentask-review",
    label: "Review PR",
    description: "Ask the OpenTask agent to review this PR",
    insert: "@opentask review this pull request for correctness and simplification.",
  },
  {
    id: "opentask-fix",
    label: "Fix issue",
    description: "Ask the OpenTask agent to fix this issue",
    insert: "@opentask fix this issue.",
  },
  {
    id: "opentask-work",
    label: "Work on issue",
    description: "Ask the OpenTask agent to work on this issue",
    insert: "@opentask can you work on this?",
  },
];

// Merge stored prompts with defaults, appending any default the user hasn't
// customized (by id). Lets new defaults appear on reload without wiping edits.
export function mergePrompts(stored: Prompt[] | undefined | null): Prompt[] {
  if (!stored || !stored.length) return DEFAULT_PROMPTS;
  return [...stored, ...DEFAULT_PROMPTS.filter((d) => !stored.some((c) => c.id === d.id))];
}
