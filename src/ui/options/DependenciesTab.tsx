import type { DependenciesConfig } from "../../shared/models";
import { DEPENDENCY_DEFS } from "../../shared/models";
import { Section, ToggleRow } from "./Section";
import { Textarea } from "@/ui/components/textarea";

export function DependenciesTab({
  deps,
  setDeps,
}: {
  deps: DependenciesConfig;
  setDeps: (d: DependenciesConfig) => void;
}) {
  const setItem = (id: string, enabled: boolean) =>
    setDeps({ ...deps, items: deps.items.map((x) => (x.id === id ? { ...x, enabled } : x)) });

  return (
    <>
      <Section
        title="Auto-detect"
        description={
          <>
            Install each language runtime only when the repo contains its manifest (
            <code>go.mod</code>, <code>Cargo.toml</code>, <code>package.json</code>,{" "}
            <code>pyproject.toml</code>/<code>requirements.txt</code>), via an{" "}
            <code>if: hashFiles(...)</code> guard. While on, the language toggles below are
            ignored. <strong>Re-install the workflow</strong> after changing this.
          </>
        }
      >
        <ToggleRow checked={deps.autoDetect} onChange={(v) => setDeps({ ...deps, autoDetect: v })}>
          Auto-detect language runtimes
        </ToggleRow>
      </Section>

      <Section
        title="Dependencies"
        description={
          <>
            Tools the installed workflow sets up before the agent runs, between checkout and
            infer-action. <strong>Re-install the workflow</strong> after changing these.
          </>
        }
      >
        {DEPENDENCY_DEFS.map((def) => (
          <ToggleRow
            key={def.id}
            checked={deps.items.find((x) => x.id === def.id)?.enabled ?? false}
            disabled={deps.autoDetect && !!def.detect}
            onChange={(v) => setItem(def.id, v)}
          >
            {def.label}
          </ToggleRow>
        ))}
      </Section>

      <Section
        title="Custom steps"
        description={
          <>
            Raw YAML steps to inject between checkout and infer-action, after the toggled deps
            above. Paste complete <code>- uses:</code>/<code>- run:</code> blocks at the
            workflow indentation (6 spaces). Leave empty to omit.{" "}
            <strong>Re-install the workflow</strong> after changing these.
          </>
        }
      >
        <Textarea
          className="min-h-[120px] font-mono text-xs"
          placeholder={`- uses: actions/setup-go@v7.0.0\n  with:\n    go-version: stable`}
          value={deps.customSteps}
          onChange={(e) => setDeps({ ...deps, customSteps: e.target.value })}
        />
      </Section>
    </>
  );
}
