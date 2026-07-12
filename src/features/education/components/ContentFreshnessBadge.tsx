import { Badge } from "@/components/ui/badge";
import { classifyContentFreshness } from "@/features/education/services/educationService";

interface Props {
  reviewStatus: string;
  lastVerifiedAt: string | null | undefined;
}

const LABELS: Record<string, string> = {
  current: "Atual",
  review_due: "Revisão recomendada",
  stale: "Desatualizado",
  unverified: "Não verificado",
  archived: "Arquivado",
};

export function ContentFreshnessBadge({ reviewStatus, lastVerifiedAt }: Props) {
  const state = classifyContentFreshness({ review_status: reviewStatus, last_verified_at: lastVerifiedAt });
  const variant = state === "current" ? "secondary" : state === "review_due" ? "outline" : "destructive";
  return <Badge variant={variant} className="text-[10px] uppercase tracking-wider">{LABELS[state]}</Badge>;
}