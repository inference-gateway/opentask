import { SkillsTab } from "./SkillsTab";

// Popover for the "Skills" repo-nav button - its own panel, sibling to the Tasks popover.
export function SkillsPanel({ owner, repo, onClose }: { owner: string; repo: string; onClose: () => void }) {
  return (
    <div className="igw-tasks-panel">
      <div className="igw-tasks-header">
        <button className="igw-tasks-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="igw-tasks-body">
        <p className="igw-tasks-repo">
          {owner}/{repo}
        </p>
        <SkillsTab owner={owner} repo={repo} />
      </div>
    </div>
  );
}
