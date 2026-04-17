import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * ResponsiveModal — Drawer (bottom sheet) no mobile, Dialog no desktop.
 *
 * Padrão de uso recomendado para fluxos sensíveis ao toque
 * (deposito rápido, edição de ativos, formulários financeiros).
 *
 * Mantém API próxima ao Dialog para facilitar migração.
 */
interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /**
   * Largura máxima no desktop (Dialog). Default: max-w-md.
   */
  maxWidth?: string;
  /**
   * Classe extra aplicada ao container interno (Dialog ou Drawer).
   */
  contentClassName?: string;
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidth = "max-w-md",
  contentClassName,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(
            "max-h-[90vh] focus:outline-none",
            contentClassName,
          )}
        >
          {(title || description) && (
            <DrawerHeader className="text-left pb-2">
              {title && <DrawerTitle>{title}</DrawerTitle>}
              {description && <DrawerDescription>{description}</DrawerDescription>}
            </DrawerHeader>
          )}
          <div
            className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("glass-card-strong", maxWidth, contentClassName)}
      >
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
