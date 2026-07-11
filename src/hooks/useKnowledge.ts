import { useCallback, useEffect, useState } from "react";
import {
  KnowledgeArticle,
  KnowledgeSource,
  KnowledgeTopic,
  listActiveTopics,
  listArticlesByTopic,
  listSourcesByArticle,
} from "@/lib/services/knowledgeService";
import { logger } from "@/lib/logger";

export function useKnowledgeTopics() {
  const [topics, setTopics] = useState<KnowledgeTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listActiveTopics()
      .then((rows) => { if (!cancelled) setTopics(rows); })
      .catch((e) => {
        if (!cancelled) {
          logger.warn("knowledge.topics.fail", {}, (e as Error)?.message);
          setError("Não foi possível carregar os tópicos.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { topics, loading, error };
}

export function useKnowledgeTopicDetail(topicId: string | null) {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [sourcesByArticle, setSourcesByArticle] = useState<Record<string, KnowledgeSource[]>>({});
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!topicId) { setArticles([]); setSourcesByArticle({}); return; }
    setLoading(true);
    try {
      const rows = await listArticlesByTopic(topicId);
      setArticles(rows);
      const bundles = await Promise.all(rows.map(a => listSourcesByArticle(a.id).then(s => [a.id, s] as const)));
      const next: Record<string, KnowledgeSource[]> = {};
      for (const [id, s] of bundles) next[id] = s;
      setSourcesByArticle(next);
    } catch (e) {
      logger.warn("knowledge.topic.detail.fail", { topicId }, (e as Error)?.message);
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => { void reload(); }, [reload]);

  return { articles, sourcesByArticle, loading, reload };
}