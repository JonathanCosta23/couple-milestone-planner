import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EDUCATION_TOPICS, EducationTopic } from "@/lib/investmentEducation";
import { BookOpen, ChevronDown, ChevronUp, AlertTriangle, Star } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  basics: "Fundamentos",
  products: "Produtos",
  strategy: "Estratégia",
  risks: "Riscos",
  advanced: "Avançado",
};

export function InvestmentGuide() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = ["all", ...new Set(EDUCATION_TOPICS.map(t => t.category))];
  const filtered = activeCategory === "all" ? EDUCATION_TOPICS : EDUCATION_TOPICS.filter(t => t.category === activeCategory);

  return (
    <div className="space-y-4">
      <Card className="glass-card-strong p-4 text-center">
        <BookOpen className="w-6 h-6 text-primary mx-auto mb-2" />
        <h3 className="font-bold">Entenda seus investimentos</h3>
        <p className="text-xs text-muted-foreground mt-1">Cada tipo de investimento explicado de forma simples — sem jargão, sem complicação</p>
      </Card>

      {/* Category Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map(cat => (
          <Button key={cat} size="sm" variant={activeCategory === cat ? "default" : "outline"}
            className="text-xs shrink-0 h-7" onClick={() => setActiveCategory(cat)}>
            {cat === "all" ? "Todos" : CATEGORY_LABELS[cat] || cat}
          </Button>
        ))}
      </div>

      {/* Topics */}
      <div className="space-y-2">
        {filtered.map(topic => (
          <TopicCard key={topic.id} topic={topic} expanded={expandedId === topic.id}
            onToggle={() => setExpandedId(expandedId === topic.id ? null : topic.id)} />
        ))}
      </div>
    </div>
  );
}

function TopicCard({ topic, expanded, onToggle }: { topic: EducationTopic; expanded: boolean; onToggle: () => void }) {
  return (
    <Card className="glass-card overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors">
        <span className="text-2xl">{topic.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{topic.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{topic.summary}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> :
         <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in-up">
          <div className="space-y-2 pl-1">
            {topic.content.map((line, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>
            ))}
          </div>

          {topic.highlights && topic.highlights.length > 0 && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-1.5">
              {topic.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Star className="w-3 h-3 text-primary shrink-0 mt-1" />
                  <span className="text-primary font-medium">{h}</span>
                </div>
              ))}
            </div>
          )}

          {topic.warnings && topic.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10 space-y-1.5">
              {topic.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-1" />
                  <span className="text-destructive/80">{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
