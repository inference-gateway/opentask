// DOM helpers for locating GitHub comment textareas, the '!' trigger, and the repo.

const COMMENT_SELECTOR = [
  "textarea.js-comment-field",
  'textarea[name="comment[body]"]',
  'textarea[name="issue[body]"]',
  'textarea[name="issue_comment[body]"]',
  'textarea[name="pull_request_review[body]"]',
  'textarea[aria-label*="comment" i]',
  'textarea[aria-label*="markdown" i]',
].join(",");

export function isCommentBox(el: EventTarget | null): el is HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement && (el.matches(COMMENT_SELECTOR) || nearMarkdownToolbar(el));
}

function nearMarkdownToolbar(el: HTMLTextAreaElement): boolean {
  if (el.id && document.querySelector(`markdown-toolbar[for="${CSS.escape(el.id)}"]`)) return true;
  return !!el.closest('.js-previewable-comment-form, [class*="MarkdownEditor"], [class*="CommentBox"]');
}

// Open the skill menu only at a word boundary: the trigger char at input start or
// after whitespace, followed by the (non-space) query typed so far. Defaults to
// '!' (GitHub comment boxes); the sidepanel passes '/'.
export function getTrigger(box: HTMLTextAreaElement, trigger = "!"): { index: number; query: string } | null {
  const pos = box.selectionStart ?? 0;
  const before = box.value.slice(0, pos);
  const m = before.match(new RegExp(`(^|\\s)\\${trigger}(\\S*)$`));
  if (!m) return null;
  return { index: m.index! + m[1].length, query: m[2] };
}

// Non-repo top-level GitHub paths, so we don't fire the Contents API on them.
const NON_REPO = new Set([
  "orgs", "settings", "notifications", "marketplace", "explore", "sponsors",
  "topics", "collections", "trending", "features", "about", "pricing", "login",
  "join", "new", "codespaces", "pulls", "issues", "dashboard", "search", "apps",
]);

export function repoFromUrl(): { owner: string; repo: string } | null {
  const m = location.pathname.match(/^\/([^/]+)\/([^/]+)(\/|$)/);
  if (!m) return null;
  const [, owner, repo] = m;
  if (NON_REPO.has(owner)) return null;
  return { owner, repo };
}

// The specific issue we're viewing, if any. Matches /owner/repo/issues/123 only - PRs
// (/pull/123) and repo pages return null. NON_REPO still excludes /issues/... at the root.
export function issueFromUrl(): { owner: string; repo: string; issue: number } | null {
  const m = location.pathname.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!m) return null;
  const [, owner, repo, n] = m;
  if (NON_REPO.has(owner)) return null;
  return { owner, repo, issue: Number(n) };
}
