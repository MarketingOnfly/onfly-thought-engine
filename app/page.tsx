import Link from "next/link";
import { ArrowRight, Brain, Compass, FileText, MessageSquareQuote, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-brand-300/40 blur-3xl" />
        <div className="absolute -bottom-40 left-10 h-[420px] w-[420px] rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[320px] w-[320px] rounded-full bg-amber-100/40 blur-3xl" />
      </div>

      <header className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-2 font-display text-xl tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          Onfly Thought Engine
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href="/login">Começar</Link>
          </Button>
        </div>
      </header>

      <section className="container pb-20 pt-12 md:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Para líderes da Onfly
          </span>
          <h1 className="mt-6 font-display text-5xl tracking-tight md:text-6xl">
            Thought leadership que <span className="gradient-text">soa como você</span>, em escala.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            Plug your voice, suas referências e seus documentos. O motor gera posts e artigos
            com a sua opinião, sem freelancer e sem cheirar a IA.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href="/login">
                Conectar como líder
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#como-funciona">Como funciona</Link>
            </Button>
          </div>
        </div>

        <div id="como-funciona" className="mx-auto mt-24 grid max-w-5xl gap-6 md:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="glow-card relative overflow-hidden p-6 transition-transform hover:-translate-y-1"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 text-brand-700">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-xl tracking-tight">{f.title}</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-20 max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h2 className="font-display text-2xl tracking-tight">Como o motor pensa</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><span className="font-medium text-foreground">1. Cadastro do líder.</span> Cargo, área, audiência, objetivo, tom de voz, exemplos.</li>
            <li><span className="font-medium text-foreground">2. Referências.</span> Perfis para estudar estilo de hook, fontes de pauta, documentos de base.</li>
            <li><span className="font-medium text-foreground">3. Descoberta.</span> O motor varre suas fontes e devolve ideias ranqueadas.</li>
            <li><span className="font-medium text-foreground">4. Geração.</span> Post de LinkedIn ou artigo de autoridade, com a sua voz e as guidelines da Onfly.</li>
            <li><span className="font-medium text-foreground">5. Revisão.</span> Você pede ajustes em linguagem natural até estar pronto pra publicar.</li>
          </ol>
        </div>
      </section>

      <footer className="container py-10 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>Onfly Thought Engine • interno</span>
          <span>Construído sobre Claude</span>
        </div>
      </footer>
    </main>
  );
}

const features = [
  {
    icon: Brain,
    title: "Sua voz, em estado puro",
    body:
      "Você descreve o tom, dá exemplos do que escreveria e do que NUNCA escreveria. O motor calibra cada saída pra parecer escrita por você.",
  },
  {
    icon: Compass,
    title: "Discovery de pauta",
    body:
      "Aponta seus substacks, newsletters e portais favoritos. O motor lê, rankeia e devolve ideias autorais — com o seu ângulo, não com a opinião do veículo.",
  },
  {
    icon: FileText,
    title: "Posts e artigos prontos",
    body:
      "Dois formatos: post de LinkedIn afiado ou artigo de autoridade pra imprensa. Markdown, copy-paste e está em pé.",
  },
  {
    icon: MessageSquareQuote,
    title: "Revisão em linguagem natural",
    body:
      "Não gostou do hook? Quer mais bastidor? Pede em uma frase. O motor reescreve mantendo a sua identidade.",
  },
];
