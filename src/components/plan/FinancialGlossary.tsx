import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GLOSSARY, GlossaryTerm, searchGlossary } from "@/lib/educationContent";
import { BookOpen, Search } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  all: "Todos",
  basic: "Básico",
  investment: "Investimento",
  risk: "Risco",
  tax: "Impostos",
  behavior: "Comportamento",
};

export function FinancialGlossary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = ["all", "basic", "investment", "risk", "tax", "behavior"];
  let filtered = query ? searchGlossary(query) : GLOSSARY;
  if (category !== "all") filtered = filtered.filter(t => t.category === category);

  return (
    <div className="space-y-4">
      <Card className="glass-card-strong p-4 text-center">
        <BookOpen className="w-6 h-6 text-primary mx-auto mb-2" />
        <h3 className="font-bold">Glossário</h3>
        <p className="text-xs text-muted-foreground mt-1">Os termos que você vai encontrar por aqui — explicados sem enrolação</p>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar termo..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map(cat => (
          <Button key={cat} size="sm" variant={category === cat ? "default" : "outline"}
            className="text-xs shrink-0 h-7" onClick={() => setCategory(cat)}>
            {CATEGORY_LABELS[cat]}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(term => (
          <Card key={term.id} className="glass-card overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === term.id ? null : term.id)}
              className="w-full p-3 text-left hover:bg-muted/30 transition-colors"
            >
              <p className="text-sm font-semibold">{term.term}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{term.definition}</p>
            </button>
            {expandedId === term.id && (
              <div className="px-3 pb-3 space-y-2 animate-fade-in-up">
                <p className="text-sm text-muted-foreground leading-relaxed">{term.definition}</p>
                {term.example && (
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-xs text-primary"><strong>Exemplo:</strong> {term.example}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum termo encontrado para "{query}"</p>
        )}
      </div>
    </div>
  );
}
