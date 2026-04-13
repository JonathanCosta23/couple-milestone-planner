import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { AppData } from "@/lib/models";
import { PlanConfig, MonthRecord } from "@/lib/types";
import { getContextualLessonSuggestions, MINI_LESSONS, GLOSSARY, ContextualSuggestion } from "@/lib/educationContent";
import { GraduationCap, ChevronDown, ChevronUp, Lightbulb, Clock } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  context: "home" | "diagnostic" | "simulator";
  maxSuggestions?: number;
  simulatorRate?: number;
}

export function ContextualEducation({ appData, config, monthRecords, startDate, context, maxSuggestions = 2, simulatorRate }: Props) {
  const suggestions = useMemo(
    () => getContextualLessonSuggestions(appData, config, monthRecords, startDate, context, simulatorRate),
    [appData, config, monthRecords, startDate, context, simulatorRate]
  );

  const top = suggestions.slice(0, maxSuggestions);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (top.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <GraduationCap className="w-3.5 h-3.5 text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {context === "home" ? "Aprenda agora" : context === "diagnostic" ? "Leitura recomendada" : "Entenda melhor"}
        </p>
      </div>
      {top.map(suggestion => (
        <SuggestionCard
          key={suggestion.lessonId}
          suggestion={suggestion}
          expanded={expandedId === suggestion.lessonId}
          onToggle={() => setExpandedId(expandedId === suggestion.lessonId ? null : suggestion.lessonId)}
        />
      ))}
    </div>
  );
}

function SuggestionCard({ suggestion, expanded, onToggle }: { suggestion: ContextualSuggestion; expanded: boolean; onToggle: () => void }) {
  const lesson = MINI_LESSONS.find(l => l.id === suggestion.lessonId);
  if (!lesson) return null;

  return (
    <Card className="glass-card overflow-hidden">
      <button onClick={onToggle} className="w-full p-3.5 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors touch-target">
        <span className="text-xl shrink-0">{lesson.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{lesson.title}</p>
          <p className="text-[10px] text-primary font-medium mt-0.5">{suggestion.reason}</p>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        }
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3 animate-fade-in-up">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-[10px]">{lesson.duration}</span>
          </div>

          <div className="space-y-2">
            {lesson.content.map((line, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-primary uppercase font-bold mb-0.5">Ponto-chave</p>
                <p className="text-sm text-primary font-medium">{lesson.takeaway}</p>
              </div>
            </div>
          </div>

          {lesson.relatedTerms.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lesson.relatedTerms.map(termId => {
                const term = GLOSSARY.find(g => g.id === termId);
                return term ? (
                  <span key={termId} className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                    {term.term}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
