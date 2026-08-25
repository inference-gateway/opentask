import type { DependenciesConfig } from "../../shared/models";
import { DEPENDENCY_DEFS } from "../../shared/models";
import { Section, ToggleRow } from "./Section";
import { Input } from "@/ui/components/input";

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
            Pick language toolchains from the repo's GitHub language breakdown when the
            workflow is installed. While on, the language toggles below are ignored.{" "}
            <strong>Re-install the workflow</strong> after changing this.
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
            Toolchains available to the agent. Languages are installed by infer-action itself
            (its <code>languages:</code> input, respecting version files like{" "}
            <code>go.mod</code>); Task is a setup step before it.{" "}
            <strong>Re-install the workflow</strong> after changing these.
          </>
        }
      >
        {DEPENDENCY_DEFS.map((def) => (
          <ToggleRow
            key={def.id}
            checked={deps.items.find((x) => x.id === def.id)?.enabled ?? false}
            disabled={deps.autoDetect && !!def.lang}
            onChange={(v) => setItem(def.id, v)}
          >
            {def.label}
          </ToggleRow>
        ))}
      </Section>

      <Section
        title="APT packages"
        description={
          <>
            System packages infer-action installs before the agent runs (its{" "}
            <code>apt:</code> input), space-separated. Leave empty to omit.{" "}
            <strong>Re-install the workflow</strong> after changing these.
          </>
        }
      >
        <Input
          className="font-mono text-xs"
          placeholder="libxml2-dev libpq-dev"
          value={deps.apt}
          onChange={(e) => setDeps({ ...deps, apt: e.target.value })}
        />
      </Section>
    </>
  );
}
