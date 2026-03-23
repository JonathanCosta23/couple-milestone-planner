import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MINI_LESSONS, MiniLesson, GLOSSARY } from "@/lib/educationContent";
import { GraduationCap, ChevronDown, ChevronUp, Clock, Lightbulb } from "lucide-react";

export function MiniLessons() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card className="glass-card-strong p-4 text-center">
        <GraduationCap className="w-6 h-6 text-primary mx-auto mb-2" />
        <h3 className="font-bold">Mini Aulas</h3>
        <p className="text-xs text-muted-foreground mt-1">Aprenda o essencial em 2-3 minutos por lição</p>
      </Card>

      <div className="space-y-2">
        {MINI_LESSONS.map(lesson => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            expanded={expandedId === lesson.id}
            onToggle={() => setExpandedId(expandedId === lesson.id ? null : lesson.id)}
          />
        ))}
      </div>
    </div>
  );
}

function LessonCard({ lesson, expanded, onToggle }: { lesson: MiniLesson; expanded: boolean; onToggle: () => void }) {
  return (
    <Card className="glass-card overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors">
        <span className="text-2xl">{lesson.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{lesson.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{lesson.duration}</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> :
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in-up">
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
