// Content-script controller. Owns all state for the inline skill menu and drives
// React purely as a view (root.render on each change). The textarea keeps focus, so
// keyboard nav for the skill menu is intercepted here, not in React.
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./ui/App";
import { InstallPanel } from "./ui/InstallPanel";
import { SkillsPanel } from "./ui/SkillsPanel";
import { InitPanel } from "./ui/InitPanel";
import type { View, SkillResult } from "./ui/types";
import { isCommentBox, getTrigger, repoFromUrl, issueFromUrl } from "./lib/dom";
import { DEFAULT_REFINE, isRefineConfig } from "./shared/models";
import { caretPosition } from "./lib/caret";
import { fuzzyFilter } from "./lib/fuzzy";
import { replaceRange } from "./lib/insert";
import * as storage from "./shared/storage";
import { mergePrompts, type Prompt } from "./shared/prompts";
import type { Skill } from "./shared/messages";

let root: Root | null = null;
let view: View = null;
let lastBox: HTMLTextAreaElement | null = null;

// --- React root (resilient to GitHub's Turbo body swaps) ---
function ensureRoot(): Root {
  let host = document.getElementById("igw-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "igw-root";
    document.body.appendChild(host);
    root = createRoot(host);
  } else if (!root) {
    root = createRoot(host);
  }
  return root!;
}

function render(): void {
  ensureRoot().render(createElement(App, { view }));
}

// --- Inline skill menu ---
type SkillState = {
  box: HTMLTextAreaElement;
  triggerIndex: number;
  all: Skill[];
  results: SkillResult[];
  active: number;
};
let skill: SkillState | null = null;

function fetchSkills(owner: string, repo: string): Promise<Skill[]> {
  return new Promise((resolve) => {
    if (!chrome.runtime?.id) return resolve([]);
    chrome.runtime.sendMessage({ type: "skills", owner, repo }, (resp) => {
      if (chrome.runtime?.lastError || !resp || resp.error) return resolve([]);
      resolve(resp.items ?? []);
    });
  });
}

async function onInput(box: HTMLTextAreaElement): Promise<void> {
  const trig = getTrigger(box);
  if (!trig) return closeSkill();

  if (!skill || skill.box !== box || skill.triggerIndex !== trig.index) {
    const repo = repoFromUrl();
    if (!repo) return closeSkill();
    const all = await fetchSkills(repo.owner, repo.repo);
    const now = getTrigger(box);
    if (!now || now.index !== trig.index) return;
    if (all.length === 0) return closeSkill();
    skill = { box, triggerIndex: trig.index, all, results: [], active: 0 };
  }

  const q = getTrigger(box);
  if (!q) return closeSkill();
  skill.results = fuzzyFilter(skill.all, q.query, (s) => s.name).map((r) => ({
    item: r.item,
    positions: r.positions,
  }));
  skill.active = 0;
  updateSkillView();
}

function updateSkillView(): void {
  if (!skill) return;
  view = {
    kind: "skill",
    results: skill.results,
    activeIndex: skill.active,
    pos: caretPosition(skill.box, skill.triggerIndex),
    onHover: (i) => {
      if (skill) {
        skill.active = i;
        updateSkillView();
      }
    },
    onSelect: (i) => {
      if (skill) {
        skill.active = i;
        commitSkill();
      }
    },
  };
  render();
}

function commitSkill(): void {
  if (!skill || skill.results.length === 0) return closeSkill();
  const chosen = skill.results[skill.active];
  if (chosen) {
    // Replace the typed '!query' with the skill invocation.
    replaceRange(
      skill.box,
      skill.triggerIndex,
      skill.box.selectionStart ?? skill.triggerIndex,
      `/${chosen.item.name} `
    );
  }
  closeSkill();
}

function closeSkill(): void {
  if (!skill) return;
  skill = null;
  view = null;
  render();
}

// --- Quick-prompt palette ---
async function openPalette(box: HTMLTextAreaElement): Promise<void> {
  closeSkill();
  lastBox = box;
  const prompts = mergePrompts(await storage.get<Prompt[]>("prompts"));
  view = {
    kind: "palette",
    prompts,
    pos: caretPosition(box, box.selectionStart ?? box.value.length),
    onPick: (p) => {
      const el = lastBox;
      if (el) replaceRange(el, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, p.insert);
      closePalette();
    },
    onClose: closePalette,
  };
  render();
}

function closePalette(): void {
  view = null;
  render();
  lastBox?.focus();
}

// --- Event wiring (delegation, so it survives SPA navigation) ---
document.addEventListener("input", (e) => {
  if (isCommentBox(e.target)) void onInput(e.target);
});

document.addEventListener("focusin", (e) => {
  if (isCommentBox(e.target)) {
    lastBox = e.target;
    tryInjectButton(e.target);
  }
});

// Close the inline menu when focus leaves the box (menu clicks preventDefault, so
// they don't blur it).
document.addEventListener("focusout", (e) => {
  if (skill && e.target === skill.box) closeSkill();
});

document.addEventListener(
  "keydown",
  (e) => {
    // Skill menu navigation (intercept before GitHub's own handlers).
    if (skill && view?.kind === "skill") {
      const len = skill.results.length;
      if (e.key === "ArrowDown" && len) {
        e.preventDefault();
        skill.active = (skill.active + 1) % len;
        updateSkillView();
      } else if (e.key === "ArrowUp" && len) {
        e.preventDefault();
        skill.active = (skill.active - 1 + len) % len;
        updateSkillView();
      } else if ((e.key === "Enter" || e.key === "Tab") && len) {
        e.preventDefault();
        commitSkill();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeSkill();
      }
      return;
    }
    // Palette shortcut: Ctrl/Cmd+Shift+P while a comment box is focused.
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "P" || e.key === "p")) {
      if (isCommentBox(document.activeElement)) {
        e.preventDefault();
        void openPalette(document.activeElement as HTMLTextAreaElement);
      }
    }
  },
  true
);

// ponytail: best-effort toolbar button - GitHub's markdown toolbar markup churns, so
// this is allowed to find nothing; the keyboard shortcut is the reliable path.
const buttoned = new WeakSet<Element>();
function tryInjectButton(box: HTMLTextAreaElement): void {
  try {
    const md = box.id ? document.querySelector<HTMLElement>(`markdown-toolbar[for="${CSS.escape(box.id)}"]`) : null;
    if (!md) return;
    const toolbar = md.offsetParent ? md : md.parentElement?.querySelector<HTMLElement>('[class*="ActionBar"]');
    if (!toolbar || buttoned.has(toolbar)) return;
    buttoned.add(toolbar);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "igw-palette-btn";
    btn.title = "Quick prompts (Ctrl/Cmd+Shift+P)";
    btn.textContent = "⚡"; // lightning
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      void openPalette(box);
    });
    toolbar.appendChild(btn);
  } catch {
    // ignore - the shortcut still works
  }
}

// --- "Tasks" repo-nav item + install popover (integrated into GitHub's own nav) ---
// We never hardcode GitHub's hashed CSS-module class names (e.g. ...UnderlineItem-7fP-n) -
// those change between deploys. Instead we clone a live nav item, inheriting whatever
const TASKS_NAV_ID = "igw-tasks-nav";
const SKILLS_NAV_ID = "igw-skills-nav";
const INIT_NAV_ID = "igw-init-nav";
// Verified octicon paths (octicon-* classes are stable, unlike CSS modules).
const TASKS_ICON =
  "M5.75 2.5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM2 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z";
const SKILLS_ICON =
  "M8.878.392a1.75 1.75 0 0 0-1.756 0l-5.25 3.045A1.75 1.75 0 0 0 1 4.951v6.098c0 .624.332 1.2.872 1.514l5.25 3.045a1.75 1.75 0 0 0 1.756 0l5.25-3.045c.54-.313.872-.89.872-1.514V4.951a1.75 1.75 0 0 0-.872-1.514L8.878.392ZM7.875 1.69a.25.25 0 0 1 .25 0l4.63 2.685L8 7.133 3.245 4.375l4.63-2.685ZM2.5 5.677v5.372c0 .09.047.171.125.216l4.625 2.683V8.432L2.5 5.677Zm6.25 8.271 4.625-2.683a.25.25 0 0 0 .125-.216V5.677L8.75 8.432v5.516Z";
const INIT_ICON =
  "M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z";

// One popover at a time, shared by both nav buttons. openId tracks which nav opened it, so
// clicking the same button toggles it closed.
let panelRoot: Root | null = null;
let panelHost: HTMLElement | null = null;
let openId: string | null = null;

function closePanel(): void {
  document.removeEventListener("click", onDocClick, true);
  panelRoot?.unmount();
  panelHost?.remove();
  panelRoot = null;
  panelHost = null;
  openId = null;
}

function onDocClick(e: MouseEvent): void {
  const t = e.target as Element | null;
  if (panelHost && !panelHost.contains(t) && !t?.closest?.(`#${TASKS_NAV_ID}, #${SKILLS_NAV_ID}, #${INIT_NAV_ID}`))
    closePanel();
}

function openPanel(id: string, anchor: HTMLElement, make: (owner: string, repo: string) => ReactElement): void {
  if (openId === id) return closePanel(); // toggle off
  closePanel();
  const repo = repoFromUrl();
  if (!repo) return;
  const r = anchor.getBoundingClientRect();
  const host = document.createElement("div");
  host.style.cssText = `position:absolute;z-index:2147483000;top:${Math.round(r.bottom + window.scrollY + 6)}px;left:${Math.round(r.left + window.scrollX)}px;`;
  document.body.appendChild(host);
  panelHost = host;
  openId = id;
  panelRoot = createRoot(host);
  panelRoot.render(make(repo.owner, repo.repo));
  // Defer so the click that opened it isn't the one that closes it.
  setTimeout(() => document.addEventListener("click", onDocClick, true), 0);
}

// Clone a live nav item so we inherit GitHub's current (hashed) classes, then relabel via
// the stable data-content attribute and swap in a stable octicon.
function makeNavItem(sample: HTMLElement, id: string, label: string, iconPath: string): HTMLElement | null {
  const li = sample.cloneNode(true) as HTMLElement;
  const anchor = li.querySelector("a");
  if (!anchor) return null;
  li.id = id;
  for (const attr of [
    "href",
    "data-tab-item",
    "data-react-nav",
    "data-turbo-frame",
    "data-discover",
    "data-hotkey",
    "aria-current",
  ]) {
    anchor.removeAttribute(attr);
  }
  anchor.setAttribute("role", "button");
  anchor.style.cursor = "pointer";
  const labelEl = anchor.querySelector("[data-content]");
  if (labelEl) {
    labelEl.setAttribute("data-content", label);
    labelEl.textContent = label;
  }
  const icon = anchor.querySelector("svg");
  if (icon) {
    icon.setAttribute("class", "octicon");
    icon.innerHTML = `<path d="${iconPath}"></path>`;
  }
  anchor.querySelectorAll("[class*='Counter'], .Counter, [data-component='counter']").forEach((el) => el.remove());
  return li;
}

// ponytail: best-effort nav injection, re-run on GitHub's Turbo/React re-renders via a
// MutationObserver. getElementById makes each call cheap and idempotent, so it can't loop.
function tryInjectNav(): void {
  try {
    if (!repoFromUrl()) return;
    const list = document.querySelector('nav[aria-label="Repository"] ul, nav[aria-label="Repository navigation"] ul');
    if (!list) return;
    const items = [...list.querySelectorAll("li")];
    const agents = items.find((li) => /^Agents$/i.test(li.querySelector("a")?.textContent?.trim() ?? ""));
    // Clone Agents when present (nice placement); otherwise any item that carries a label.
    const sample = (agents ?? items.find((li) => li.querySelector("a [data-content]"))) as HTMLElement | undefined;
    if (!sample) return;
    let after: Element = agents ?? items[items.length - 1];

    const defs: { id: string; label: string; icon: string; make: (o: string, r: string) => ReactElement }[] = [
      {
        id: TASKS_NAV_ID,
        label: "Tasks",
        icon: TASKS_ICON,
        make: (o, r) => createElement(InstallPanel, { owner: o, repo: r, onClose: closePanel }),
      },
      {
        id: SKILLS_NAV_ID,
        label: "Skills",
        icon: SKILLS_ICON,
        make: (o, r) => createElement(SkillsPanel, { owner: o, repo: r, onClose: closePanel }),
      },
      {
        id: INIT_NAV_ID,
        label: "Init",
        icon: INIT_ICON,
        make: (o, r) => createElement(InitPanel, { owner: o, repo: r, onClose: closePanel }),
      },
    ];
    for (const def of defs) {
      const existing = document.getElementById(def.id);
      if (existing) {
        after = existing;
        continue;
      }
      const li = makeNavItem(sample, def.id, def.label, def.icon);
      if (!li) continue;
      li.querySelector("a")?.addEventListener("click", (e) => {
        e.preventDefault();
        openPanel(def.id, li, def.make);
      });
      after.after(li);
      after = li;
    }
  } catch {
    // best-effort; GitHub markup churns
  }
}

// --- Refine an issue (header button + auto-refine on native issue creation) ---
let refineCfg = DEFAULT_REFINE;
void storage.get<unknown>("refine").then((r) => {
  if (isRefineConfig(r)) refineCfg = r;
  tryInjectRefine();
});
// Reflect an options toggle without a page reload.
chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area === "local" && changes.refine && isRefineConfig(changes.refine.newValue)) {
    refineCfg = changes.refine.newValue;
    tryInjectRefine();
  }
});

const REFINE_BTN_ID = "igw-refine-btn";
const REFINE_PENDING = "igw-refine-pending";
let refined = false;

// ponytail: best-effort injection like tryInjectButton - GitHub's issue-header markup is
// hashed and churns, so anchoring off the stable kebab octicon is allowed to find nothing.
function tryInjectRefine(): void {
  try {
    if (!refineCfg.manual) return void document.getElementById(REFINE_BTN_ID)?.remove();
    const loc = issueFromUrl();
    if (!loc || document.getElementById(REFINE_BTN_ID)) return;
    const kebab = document.querySelector<SVGElement>(".octicon-kebab-horizontal");
    const anchor = kebab?.closest("button, summary, a") as HTMLElement | null;
    if (!anchor?.parentElement) return;
    const btn = document.createElement("button");
    btn.id = REFINE_BTN_ID;
    btn.type = "button";
    btn.className = "igw-palette-btn";
    btn.textContent = "Refine";
    btn.title = "Refine this issue with the OpenTask agent";
    if (refined) {
      btn.disabled = true;
      btn.textContent = "Submitted ✓";
    }
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      refineNow(btn, loc);
    });
    anchor.parentElement.insertBefore(btn, anchor);
  } catch {
    // best-effort; GitHub markup churns
  }
}

function refineNow(btn: HTMLButtonElement, loc: { owner: string; repo: string; issue: number }): void {
  if (!chrome.runtime?.id || refined) return;
  btn.disabled = true;
  btn.textContent = "Refining…";
  chrome.runtime.sendMessage({ type: "refine-issue", ...loc }, (resp) => {
    if (chrome.runtime?.lastError || !resp || resp.error) {
      btn.disabled = false;
      btn.textContent = "Refine failed";
      setTimeout(() => {
        btn.textContent = "Refine";
      }, 3000);
      return;
    }
    refined = true;
    btn.textContent = "Submitted ✓";
  });
}

// ponytail: best-effort native-issue-creation detection - flag the "Create" click, then
// dispatch once we land on the new issue. A submit that fails validation leaves a stale
// flag; the 15s TTL + consume-once caps it. Upgrade to a real form hook only if it misfires.
document.addEventListener(
  "click",
  (e) => {
    if (!refineCfg.auto || !location.pathname.includes("/issues/new")) return;
    const label = (e.target as Element | null)?.closest("button")?.textContent?.trim() ?? "";
    if (/^(Create|Submit new issue)$/i.test(label)) {
      try {
        sessionStorage.setItem(REFINE_PENDING, String(Date.now()));
      } catch {
        /* ignore */
      }
    }
  },
  true
);

function maybeAutoRefine(): void {
  if (!refineCfg.auto) return;
  const loc = issueFromUrl();
  if (!loc || !chrome.runtime?.id) return;
  let ts = 0;
  try {
    const raw = sessionStorage.getItem(REFINE_PENDING);
    if (!raw) return;
    ts = Number(raw);
    sessionStorage.removeItem(REFINE_PENDING);
  } catch {
    return;
  }
  if (!ts || Date.now() - ts > 15000) return;
  chrome.runtime.sendMessage({ type: "refine-issue", ...loc }, () => {
    /* fire-and-forget */
  });
}

new MutationObserver(() => {
  tryInjectNav();
  tryInjectRefine();
  maybeAutoRefine();
}).observe(document.body, { childList: true, subtree: true });
tryInjectNav();
maybeAutoRefine();
