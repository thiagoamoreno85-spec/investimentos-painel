import { Loader2, ShieldAlert, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FinancialDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemLabel: string;
  consequence: string;
  onConfirm: () => void;
  isPending?: boolean;
}

/**
 * Confirma exclusões que têm reflexo em dados financeiros ou patrimoniais.
 * A ação só é executada pelo botão explícito "Excluir definitivamente".
 */
export function FinancialDeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  itemLabel,
  consequence,
  onConfirm,
  isPending = false,
}: FinancialDeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 leading-relaxed">
            <span className="block">
              Você está prestes a excluir <strong className="text-foreground">{itemLabel}</strong>.
            </span>
            <span className="block">{consequence}</span>
            <span className="block text-amber-300">
              Revise o item antes de confirmar. Esta ação não possui desfazer automático.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir definitivamente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
