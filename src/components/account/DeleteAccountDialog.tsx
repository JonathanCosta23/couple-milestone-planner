import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accountDeletionMessage, deleteAccountPermanently } from "@/lib/services/accountDeletionService";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  userEmail?: string;
}

export function DeleteAccountDialog({ open, onOpenChange, userId, userEmail }: DeleteAccountDialogProps) {
  const [typedEmail, setTypedEmail] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const normalizedAccountEmail = (userEmail ?? "").trim().toLowerCase();
  const confirmed = useMemo(
    () => Boolean(userId && normalizedAccountEmail && typedEmail.trim().toLowerCase() === normalizedAccountEmail && understood),
    [normalizedAccountEmail, typedEmail, understood, userId],
  );

  useEffect(() => {
    if (!open) {
      setTypedEmail("");
      setUnderstood(false);
      setDeleting(false);
    }
  }, [open]);

  const handleDelete = async () => {
    if (!confirmed || !userId || !userEmail) return;
    setDeleting(true);
    try {
      await deleteAccountPermanently(userId, userEmail);
      toast.success("Conta excluída permanentemente.");
      window.location.replace("/login?account_deleted=1");
    } catch (error) {
      toast.error(accountDeletionMessage(error));
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !deleting && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            Excluir conta permanentemente?
          </DialogTitle>
          <DialogDescription>
            Esta ação remove sua conta, plano, histórico financeiro, backups e dados de sincronização. Não existe recuperação.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <Trash2 className="h-4 w-4" aria-hidden />
          <AlertTitle>Exclusão definitiva</AlertTitle>
          <AlertDescription>Exporte um backup antes de continuar, caso precise preservar alguma informação.</AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="delete-account-email">Digite o e-mail da conta para confirmar</Label>
          <Input
            id="delete-account-email"
            type="email"
            autoComplete="off"
            value={typedEmail}
            onChange={(event) => setTypedEmail(event.target.value)}
            placeholder={userEmail ?? "seu@email.com"}
            disabled={deleting}
          />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="delete-account-understood"
            checked={understood}
            onCheckedChange={(value) => setUnderstood(value === true)}
            disabled={deleting}
          />
          <Label htmlFor="delete-account-understood" className="text-sm font-normal leading-snug">
            Entendo que a exclusão é permanente e que todos os dados serão removidos.
          </Label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!confirmed || deleting}>
            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="mr-2 h-4 w-4" aria-hidden />}
            Excluir minha conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
