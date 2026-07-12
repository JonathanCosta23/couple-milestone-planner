import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2 } from "lucide-react";
import type { AssetEducationCase } from "@/features/education/types";
import { ContentFreshnessBadge } from "./ContentFreshnessBadge";

export function AssetEducationCard({ asset, onOpen }: { asset: AssetEducationCase; onOpen: (a: AssetEducationCase) => void }) {
  return (
    <Card className="glass-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {asset.company_name}
              {asset.ticker ? <span className="ml-1 text-muted-foreground text-xs">({asset.ticker})</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">{asset.sector}{asset.subsector ? ` · ${asset.subsector}` : ""}</p>
          </div>
        </div>
        <ContentFreshnessBadge reviewStatus={asset.review_status} lastVerifiedAt={asset.last_verified_at} />
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{asset.business_model}</p>
      <Button variant="outline" size="sm" className="w-full justify-between rounded-xl" onClick={() => onOpen(asset)}>
        <span>Entender a empresa</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </Card>
  );
}