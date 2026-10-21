import * as React from "react";
import { Button } from "@/components/ui/button";

type IconButtonProps = Omit<React.ComponentProps<typeof Button>, "aria-label"> & {
  "aria-label": string;
};

/**
 * Botão destinado a ações representadas somente por ícone.
 * O rótulo acessível é obrigatório para leitores de tela.
 */
export function IconButton({ size = "icon", ...props }: IconButtonProps) {
  return <Button size={size} {...props} />;
}
