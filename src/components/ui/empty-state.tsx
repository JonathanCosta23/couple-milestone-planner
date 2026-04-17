import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "secondary";
}

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  children?: ReactNode;
  className?: string;
  /** Visual size. `compact` = inline within a section, `default` = standalone card. */
  size?: "compact" | "default";
}

/**
 * Padronização de estados vazios em todo o app.
 * Sempre comunica: o que falta + por que importa + próxima ação.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  children,
  className,
  size = "default",
}: EmptyStateProps) {
  const isCompact = size === "compact";
  return (
    <Card
      className={cn(
        "glass-card text-center space-y-3",
        isCompact ? "p-4" : "p-6 lg:p-8",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "mx-auto rounded-full bg-muted/50 flex items-center justify-center",
            isCompact ? "w-10 h-10" : "w-14 h-14",
          )}
          aria-hidden="true"
        >
          <Icon className={cn("text-muted-foreground", isCompact ? "w-5 h-5" : "w-7 h-7")} />
        </div>
      )}
      <div className="space-y-1.5">
        <h3 className={cn("font-semibold text-foreground", isCompact ? "text-sm" : "text-base")}>
          {title}
        </h3>
        {description && (
          <p
            className={cn(
              "text-muted-foreground leading-relaxed mx-auto",
              isCompact ? "text-xs max-w-xs" : "text-sm max-w-md",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {children}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
          {action && (
            <Button
              size={isCompact ? "sm" : "default"}
              variant={action.variant ?? "default"}
              onClick={action.onClick}
              className="rounded-xl"
            >
              {action.icon && <action.icon className="w-4 h-4 mr-2" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              size={isCompact ? "sm" : "default"}
              variant={secondaryAction.variant ?? "outline"}
              onClick={secondaryAction.onClick}
              className="rounded-xl"
            >
              {secondaryAction.icon && <secondaryAction.icon className="w-4 h-4 mr-2" />}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
