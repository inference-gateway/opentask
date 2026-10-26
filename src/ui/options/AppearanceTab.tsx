import type { Theme } from "../../shared/theme";
import { Section } from "./Section";
import { Label } from "@/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/ui/components/radio-group";

const CHOICES: { value: Theme; label: string }[] = [
  { value: "system", label: "System default" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function AppearanceTab({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <Section title="Theme" description="Choose how the options page and toolbar popup are displayed.">
      <RadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
        {CHOICES.map(({ value, label }) => (
          <div key={value} className="flex items-center gap-2">
            <RadioGroupItem value={value} id={`theme-${value}`} />
            <Label htmlFor={`theme-${value}`} className="cursor-pointer">
              {label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </Section>
  );
}
