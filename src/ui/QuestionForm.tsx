// The form of an input_required interrupt: the AskUserQuestion tool's
// questions, each with its options (radios, or checkboxes when multiSelect)
// plus an "other" text box. Submit answers every question in one go.
import { useState } from "react";
import { Button } from "@/ui/components/button";
import { Input } from "@/ui/components/input";
import type { Answer, Question } from "../shared/agui";

export function QuestionForm({ questions, onSubmit, onCancel }: { questions: Question[]; onSubmit: (answers: Answer[]) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState<string[][]>(questions.map(() => []));
  const [other, setOther] = useState<string[]>(questions.map(() => ""));

  function toggle(qi: number, label: string, multi: boolean) {
    setSelected((all) => all.map((labels, i) => {
      if (i !== qi) return labels;
      if (!multi) return [label];
      return labels.includes(label) ? labels.filter((l) => l !== label) : [...labels, label];
    }));
  }

  function submit() {
    onSubmit(questions.map((q, i) => ({ header: q.header, question: q.question, selectedLabels: selected[i], otherText: other[i] })));
  }

  const answered = questions.every((_, i) => selected[i].length > 0 || other[i].trim() !== "");
  return (
    <div className="border-t border-indigo-500/30 bg-indigo-500/5 p-3">
      <div className="space-y-3 rounded-xl border border-indigo-500/40 bg-card p-3 shadow-sm">
        {questions.map((q, qi) => (
          <fieldset key={qi} className="space-y-1.5">
            <legend className="text-sm font-semibold">
              {q.header && <span className="mr-1 rounded bg-indigo-500/15 px-1 font-mono text-[0.8em] text-indigo-600 dark:text-indigo-400">{q.header}</span>}
              {q.question}
            </legend>
            {q.options.map((opt) => (
              <label key={opt.label} className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type={q.multiSelect ? "checkbox" : "radio"}
                  name={`q${qi}`}
                  className="mt-0.5"
                  checked={selected[qi].includes(opt.label)}
                  onChange={() => toggle(qi, opt.label, q.multiSelect)}
                />
                <span>
                  <span className="font-medium">{opt.label}</span>
                  {opt.description && <span className="text-muted-foreground"> — {opt.description}</span>}
                </span>
              </label>
            ))}
            <Input
              placeholder="Other…"
              className="h-7 text-xs"
              value={other[qi]}
              onChange={(e) => setOther((all) => all.map((v, i) => (i === qi ? e.target.value : v)))}
            />
          </fieldset>
        ))}
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={!answered} onClick={submit}>
            Answer
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={onCancel}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
