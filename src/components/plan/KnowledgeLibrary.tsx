/**
 * KnowledgeLibrary — biblioteca educacional alimentada pela base
 * `knowledge_*`. Renderiza tópicos, artigos com modos simples/detalhado
 * e fontes. Progressive disclosure: nada de excesso de cards.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, Info } from "lucide-react";
import { useKnowledgeTopics, useKnowledgeTopicDetail } from "@/hooks/useKnowledge";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { useAuth } from "@/hooks/useAuth";
import {
  KnowledgeArticle,
  KnowledgeSource,
  effectiveReviewStatus,
} from "@/lib/services/knowledgeService";

type Mode = "simple" | "detailed";

export function KnowledgeLibrary() {
  const { topics, loading, error } = useKnowledgeTopics();
  const { user } = useAuth();
  const { byTopic, upsert } = useLearningProgress(user?.id);
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const openTopic = useMemo(() => topics.find((t) => t.id === openTopicId) ?? null, [topics, openTopicId]);

  if (loading) return <p className="text-sm text-muted-foreground text-center py-6">Carregando biblioteca...</p>;
  if (error) return <p className="text-sm text-muted-foreground text-center py-6">{error}</p>;
  if (topics.length === 0) {
    return (
      <Card className="glass-card p-6 text-center space-y-1">
        <p className="text-sm font-medium">Biblioteca em preparação</p>
        <p className="text-xs text-muted-foreground">Assim que os primeiros conteúdos forem revisados, eles aparecerão aqui.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="glass-card-strong p-4 text-center">
        <BookOpen className="w-6 h-6 text-primary mx-auto mb-2" />
        <h3 className="font-bold">Biblioteca de conhecimento</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Conteúdo educacional. Não constitui recomendação de investimento.
        </p>
      </Card>

      <div className="space-y-2">
        {topics.map((topic) => {
          const progress = byTopic[topic.id];
          const isOpen = openTopicId === topic.id;
          return (
            <Card key={topic.id} className="glass-card overflow-hidden">
              <button
                onClick={() => {
                  const next = isOpen ? null : topic.id;
                  setOpenTopicId(next);
                  if (next) void upsert(topic.id, { status: "in_progress" });
                }}
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{topic.title}</p>
                    {progress?.status === "completed" && (
                      <Badge variant="secondary" className="text-[10px]">Concluído</Badge>
                    )}
                  </div>
                  {topic.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{topic.description}</p>
                  )}
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
              </button>
              {isOpen && openTopic && (
                <TopicDetail
                  topicId={topic.id}
                  onComplete={() => upsert(topic.id, { status: "completed", progress: 100 })}
                />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TopicDetail({ topicId, onComplete }: { topicId: string; onComplete: () => void }) {
  const { articles, sourcesByArticle, loading } = useKnowledgeTopicDetail(topicId);
  const [mode, setMode] = useState<Mode>("simple");

  if (loading) return <p className="px-4 pb-4 text-xs text-muted-foreground">Carregando conteúdo...</p>;
  if (articles.length === 0) {
    return <p className="px-4 pb-4 text-xs text-muted-foreground">Conteúdo em revisão. Volte em breve.</p>;
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      <div className="flex gap-1.5">
        <Button size="sm" variant={mode === "simple" ? "default" : "outline"} className="text-xs h-8" onClick={() => setMode("simple")}>Modo simples</Button>
        <Button size="sm" variant={mode === "detailed" ? "default" : "outline"} className="text-xs h-8" onClick={() => setMode("detailed")}>Modo detalhado</Button>
      </div>
      {articles.map((article) => (
        <ArticleBlock key={article.id} article={article} sources={sourcesByArticle[article.id] ?? []} mode={mode} />
      ))}
      <Button size="sm" variant="secondary" className="w-full" onClick={onComplete}>Marcar como concluído</Button>
    </div>
  );
}

function ArticleBlock({ article, sources, mode }: { article: KnowledgeArticle; sources: KnowledgeSource[]; mode: Mode }) {
  const effectiveStatus = effectiveReviewStatus(article, sources);
  const isUnverified = effectiveStatus === "unverified" || effectiveStatus === "in_review";
  const simple = article.content.simple ?? {};
  const detailed = article.content.detailed ?? {};

  return (
    <div className="space-y-3">
      {isUnverified && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted border border-border">
          <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground">Conteúdo em revisão. Trate como referência inicial, não como fonte final.</p>
        </div>
      )}

      {mode === "simple" ? (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          {simple.what && <p><strong className="text-foreground">O que é:</strong> {simple.what}</p>}
          {simple.why && <p><strong className="text-foreground">Por que importa:</strong> {simple.why}</p>}
          {simple.example && <p><strong className="text-foreground">Exemplo:</strong> {simple.example}</p>}
          {simple.nextAction && (
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs text-primary"><strong>Próxima ação:</strong> {simple.nextAction}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          {detailed.concept && <p><strong className="text-foreground">Conceito:</strong> {detailed.concept}</p>}
          {detailed.howToCalculate && <p><strong className="text-foreground">Como calcular:</strong> {detailed.howToCalculate}</p>}
          {detailed.assumptions && <p><strong className="text-foreground">Premissas:</strong> {detailed.assumptions}</p>}
          {detailed.limitations && <p><strong className="text-foreground">Limitações:</strong> {detailed.limitations}</p>}
          {detailed.commonMistake && <p><strong className="text-foreground">Erro comum:</strong> {detailed.commonMistake}</p>}
          {detailed.whenNotToUse && <p><strong className="text-foreground">Quando não usar:</strong> {detailed.whenNotToUse}</p>}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground space-y-0.5">
        <p>Versão {article.version} · jurisdição {article.jurisdiction}</p>
        {article.last_verified_at && (
          <p>Última revisão: {new Date(article.last_verified_at).toLocaleDateString("pt-BR")}</p>
        )}
      </div>

      {sources.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Fontes</p>
          <ul className="space-y-1">
            {sources.map((s) => (
              <li key={s.id} className="text-xs">
                {s.source_url ? (
                  <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    {s.source_name} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">{s.source_name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground italic">{article.educational_disclaimer}</p>
    </div>
  );
}