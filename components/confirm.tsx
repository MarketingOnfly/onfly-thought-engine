"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Treat as a destructive action (red confirm + warning icon). */
  destructive?: boolean;
};

type Pending = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = React.useContext(ConfirmContext);
  if (!fn) {
    throw new Error("useConfirm must be used within <ConfirmProvider>");
  }
  return fn;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);

  const confirm = React.useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const settle = (value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  };

  const open = !!pending;
  const opts = pending?.options;

  const Icon = opts?.destructive ? AlertTriangle : HelpCircle;
  const iconColor = opts?.destructive ? "text-destructive" : "text-brand-600";
  const iconBg = opts?.destructive ? "bg-destructive/10" : "bg-brand-50";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) settle(false);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
            )}
          />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-background p-6 shadow-xl",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
            )}
            onEscapeKeyDown={() => settle(false)}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  iconBg
                )}
                aria-hidden
              >
                <Icon className={cn("h-5 w-5", iconColor)} />
              </div>
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="font-display text-lg tracking-tight">
                  {opts?.title}
                </DialogPrimitive.Title>
                {opts?.description && (
                  <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                    {opts.description}
                  </DialogPrimitive.Description>
                )}
              </div>
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => settle(false)}>
                {opts?.cancelText ?? "Cancelar"}
              </Button>
              <Button
                variant={opts?.destructive ? "destructive" : "primary"}
                size="sm"
                onClick={() => settle(true)}
                autoFocus
              >
                {opts?.confirmText ?? (opts?.destructive ? "Apagar" : "Confirmar")}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ConfirmContext.Provider>
  );
}
