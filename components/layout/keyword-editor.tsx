"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useKeywords } from "@/hooks/use-keywords";
import type { KeywordDto } from "@/types/keyword.dto";

interface KeywordEditorProps {
  initialKeywords: KeywordDto[];
  availableRequestNames: string[];
}

export function KeywordEditor({
  initialKeywords,
  availableRequestNames,
}: KeywordEditorProps) {
  const router = useRouter();
  const { keywords, isLoading, isSaving, errorMessage, saveKeywords } =
    useKeywords(initialKeywords);
  const [draft, setDraft] = useState(() =>
    initialKeywords.map((keyword) => keyword.value).join(", "),
  );
  const placeholder = useMemo(
    () => availableRequestNames.join(", "),
    [availableRequestNames],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const values = draft
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    const savedKeywords = await saveKeywords(values);

    if (savedKeywords) {
      setDraft(savedKeywords.map((keyword) => keyword.value).join(", "));
      router.refresh();
    }
  }

  const keywordValues = keywords.map((keyword) => keyword.value);

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="keywords">Список RequestName для отслеживания</Label>
        <p className="text-xs text-muted-foreground">
          Указывайте только реальные RequestName из конфигурации Saby через запятую.
          Сейчас доступны: {availableRequestNames.join(", ")}.
        </p>
        <Textarea
          className="resize-none"
          disabled={isLoading || isSaving}
          id="keywords"
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          value={draft}
        />
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button className="h-9 gap-2" disabled={isSaving} size="sm" type="submit">
        <Save className="h-4 w-4" />
        <span>{isSaving ? "Сохранение" : "Сохранить"}</span>
      </Button>

      {keywordValues.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Сейчас сохранено: {keywordValues.join(", ")}
        </p>
      ) : null}
    </form>
  );
}
