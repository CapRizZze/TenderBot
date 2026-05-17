"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useKeywords } from "@/hooks/use-keywords";
import type { KeywordDto } from "@/types/keyword.dto";

interface KeywordEditorProps {
  initialKeywords: KeywordDto[];
}

export function KeywordEditor({ initialKeywords }: KeywordEditorProps) {
  const router = useRouter();
  const { keywords, isLoading, isSaving, errorMessage, saveKeywords } =
    useKeywords(initialKeywords);
  const [draft, setDraft] = useState(() =>
    initialKeywords.map((keyword) => keyword.value).join(", "),
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
        <Label htmlFor="keywords">
          Ключевые слова
        </Label>
        <Textarea
          className="resize-none"
          disabled={isLoading || isSaving}
          id="keywords"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="серверы, аналитика, поддержка"
          value={draft}
        />
      </div>

      {keywordValues.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {keywordValues.map((keyword) => (
            <span
              className="rounded-md border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
              key={keyword}
            >
              {keyword}
            </span>
          ))}
        </div>
      ) : null}

      {errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button className="h-9 gap-2" disabled={isSaving} size="sm" type="submit">
        <Save className="h-4 w-4" />
        <span>{isSaving ? "Сохранение" : "Сохранить"}</span>
      </Button>
    </form>
  );
}
