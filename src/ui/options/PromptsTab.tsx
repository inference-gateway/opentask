import { Section } from "./Section";
import { Textarea } from "@/ui/components/textarea";

const JSON_CLASS = "font-mono text-xs min-h-48";

export function PromptsTab({
  promptsText,
  setPromptsText,
  instructions,
  setInstructions,
  refinePromptText,
  setRefinePromptText,
}: {
  promptsText: string;
  setPromptsText: (v: string) => void;
  instructions: string;
  setInstructions: (v: string) => void;
  refinePromptText: string;
  setRefinePromptText: (v: string) => void;
}) {
  return (
    <>
      <Section
        title="Quick prompts"
        description={
          <>
            A JSON array of <code>{"{ id, label, description, insert }"}</code>. Shown in the palette.
          </>
        }
      >
        <Textarea
          className={JSON_CLASS}
          spellCheck={false}
          value={promptsText}
          onChange={(e) => setPromptsText(e.target.value)}
        />
      </Section>

      <Section
        title="System instructions"
        description={
          <>
            Extra guidance baked into the workflow's <code>custom-instructions</code> when you install
            or re-install it. Use it to steer agent behavior (e.g. "post the full review in a single
            comment covering every changed file"). <strong>Re-install the workflow</strong> after
            editing; leave blank to omit the block.
          </>
        }
      >
        <Textarea
          className="text-xs min-h-48"
          spellCheck={false}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </Section>

      <Section
        title="Refine prompt"
        description={
          <>
            The prompt dispatched when you click <strong>Refine</strong> on an issue. Placeholders{" "}
            <code>{"{owner}"}</code>, <code>{"{repo}"}</code>, and <code>{"{issue}"}</code> are
            substituted at dispatch time. Steer how issues get rewritten (e.g. instruct the agent to
            read the code first and follow your <code>.github/ISSUE_TEMPLATE</code> structure).
          </>
        }
      >
        <Textarea
          className="text-xs min-h-48"
          spellCheck={false}
          value={refinePromptText}
          onChange={(e) => setRefinePromptText(e.target.value)}
        />
      </Section>
    </>
  );
}
