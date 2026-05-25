import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-widest text-brand-600">404</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O link expirou, foi removido, ou nunca existiu.
        </p>
        <Button asChild variant="primary" className="mt-6">
          <Link href="/dashboard">Voltar ao dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
