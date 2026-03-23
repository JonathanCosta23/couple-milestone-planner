import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { CONTEXTUAL_TIPS } from "@/lib/educationContent";
import { HelpCircle } from "lucide-react";

interface Props {
  tipKey: string;
  children?: React.ReactNode;
}

export function EducationalTooltip({ tipKey, children }: Props) {
  const tip = CONTEXTUAL_TIPS[tipKey];
  if (!tip) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            {children}
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary transition-colors" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
