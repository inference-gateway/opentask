import type { InitConfig } from "./models";

const TRIGGER = /@opentask\b/i;

export function taskBody(prompt: string): string {
  const text = prompt.trim();
  return TRIGGER.test(text) ? text : `@opentask\n\n${text}`;
}

export function taskTitle(prompt: string): string {
  const first =
    prompt
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  const cleaned = first
    .replace(TRIGGER, "")
    .replace(/^[\s:\u2013\u2014-]+/, "")
    .trim();
  const base = cleaned || "OpenTask task";
  return base.length > 80 ? `${base.slice(0, 79)}…` : base;
}

// Default direct-prompt for a workflow_dispatch refine run: read one existing issue and
// rewrite its body in place. Uses {owner}/{repo}/{issue} placeholders so it can be edited in
// the options Prompts tab; refinePrompt() substitutes them. Names the issue explicitly since
// dispatch runs have no issue event context.
export const DEFAULT_REFINE_PROMPT = [
  `Refine GitHub issue #{issue} in {owner}/{repo}.`,
  `Read it with \`gh issue view {issue}\`, then explore the repository code relevant to`,
  `the issue so the refinement is grounded in how the project actually works.`,
  `This is an in-place edit of the issue only: do NOT create a branch, commit, or pull`,
  `request, and do not modify any files.`,
  `Check \`.github/ISSUE_TEMPLATE/\` for a template matching the issue's kind; if one exists,`,
  `follow that template exactly - adopt whatever title prefix its \`title:\` front-matter`,
  `defines (do not invent your own, and do not use a \`feat:\`/\`fix:\` prefix), mirror the`,
  `template's own body section headings and order, and apply the \`labels\` it declares with`,
  `\`gh issue edit --add-label\`. If no template exists, follow your own default issue`,
  `conventions.`,
  `Produce a clear, concise title, a well-structured summary, and explicit acceptance`,
  `criteria, without changing the issue's intent or scope.`,
  `If anything is ambiguous or you have open questions, append an \`## Open questions\``,
  `section listing them so the user can edit their answers directly under each question`,
  `and re-click Refine; keep any existing answered questions in that section.`,
  `Apply the result in place with \`gh issue edit {issue} --title "<new title>" --body "<new body>"\`.`,
].join(" ");

// Full replacement for infer-action's bundled direct-prompt system prompt on refine runs.
// The bundled default is an entirely git/branch/commit/PR workflow; refine only edits an
// issue in place, so we swap in this issue-focused prompt (passed via the system_prompt
// dispatch input). Regular tasks send no override and keep the bundled default.
export const REFINE_SYSTEM_PROMPT = [
  "# Refine Agent (manual run)",
  "",
  "You are running in CI from a manual dispatch to refine ONE GitHub issue in place. There is",
  "no code to change and no pull request to open. Your result is the edited issue plus the",
  "workflow job summary.",
  "",
  "## Working style",
  "",
  "Explore the repository to ground the refinement in how the project actually works: read",
  "files with the Read tool or `gh api repos/<owner>/<repo>/contents/<path>`, and read the",
  "issue and any templates with `gh issue view` / `gh api`.",
  "",
  "Do NOT create a branch, commit, push, or open/touch a pull request, and do NOT modify any",
  "files in the checkout. Your ONLY write is editing the issue itself with `gh issue edit`.",
  "",
  "If a tool or CLI call fails, the action did NOT happen - re-read, fix, and retry; never",
  'report success on a failed call. If a CLI call fails with "unknown flag", the usage text in',
  "the error is the authoritative flag list.",
  "",
  "## Output",
  "",
  "Your final message is the ONLY thing posted to the workflow job summary - end with a short",
  "summary of what you changed on the issue.",
].join("\n");

export function refinePrompt(owner: string, repo: string, issue: number, template = DEFAULT_REFINE_PROMPT): string {
  return template
    .replace(/\{owner\}/g, owner)
    .replace(/\{repo\}/g, repo)
    .replace(/\{issue\}/g, String(issue));
}

// Direct-prompt for a workflow_dispatch init run: generate an AGENTS.md for the repo and
// open a PR, plus optional extras per the toggles. The agent runs in Linux CI, so it can
// create real symlinks with `ln -s`.
export function initPrompt(owner: string, repo: string, cfg: InitConfig): string {
  const parts = [
    `Initialize ${owner}/${repo} for agent workflows.`,
    `Explore the repository, then write an \`AGENTS.md\` at the root: a concise contributor`,
    `guide covering project structure, build/test/dev commands, coding style, and`,
    `commit/PR conventions - tailored to what this repo actually uses.`,
  ];
  if (cfg.githooks) {
    parts.push(
      `Also add an executable \`.githooks/pre-commit\` that runs this repo's typecheck/tests`,
      `before a commit, and document \`git config core.hooksPath .githooks\` in AGENTS.md so`,
      `contributors activate it (the committed hook is inert until they run that).`
    );
  }
  if (cfg.claudeSymlink) {
    parts.push(
      `Also create a symlink \`CLAUDE.md\` -> \`AGENTS.md\` (a real symlink, e.g. \`ln -s AGENTS.md CLAUDE.md\`, not a copy).`
    );
  }
  if (cfg.skillsSymlink) {
    parts.push(
      `Also create a symlink \`.claude/skills\` -> \`.agents/skills\` (create the \`.claude/\` directory first, then \`ln -s ../.agents/skills .claude/skills\`).`
    );
  }
  parts.push(`Open a pull request with all of these changes.`);
  return parts.join(" ");
}
