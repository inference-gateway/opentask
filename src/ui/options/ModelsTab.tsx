import { Section } from "./Section";
import { Textarea } from "@/ui/components/textarea";

const JSON_CLASS = "font-mono text-xs min-h-48";

export function ModelsTab({
  modelsText,
  setModelsText,
}: {
  modelsText: string;
  setModelsText: (v: string) => void;
}) {
  return (
    <>
      <Section
        title="Install models"
        description={
          <>
            A JSON array of <code>{"{ model, keyInput, secret }"}</code>. Offered in the toolbar popup's
            Install dropdown; the first entry is the default. <code>keyInput</code> is the infer-action
            provider-key input (e.g. <code>anthropic-api-key</code>) and <code>secret</code> is the repo
            secret it reads. Add custom models here.
          </>
        }
      >
        <Textarea
          className={JSON_CLASS}
          spellCheck={false}
          value={modelsText}
          onChange={(e) => setModelsText(e.target.value)}
        />
      </Section>
    </>
  );
}
