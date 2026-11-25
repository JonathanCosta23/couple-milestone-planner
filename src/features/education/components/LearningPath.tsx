import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Compass, GraduationCap, Search } from "lucide-react";
import { MiniLessons } from "@/components/plan/MiniLessons";
import { KnowledgeLibrary } from "@/components/plan/KnowledgeLibrary";
import { InvestmentGuide } from "@/components/plan/InvestmentGuide";
import { FinancialGlossary } from "@/components/plan/FinancialGlossary";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EducationHub } from "./EducationHub";
import { INTRODUCTORY_TOPIC_SLUGS, PRODUCT_REFERENCE_IDS } from "../learningPathContent";

export type LearningEntry = "start" | "glossary" | "products";
type LearningStage = "start" | "deepen" | "reference";
type ReferenceTab = "glossary" | "products" | "assets";

export function LearningPath({ entry = "start" }: { entry?: LearningEntry }) {
  const [stage, setStage] = useState<LearningStage>(entry === "start" ? "start" : "reference");
  const [referenceTab, setReferenceTab] = useState<ReferenceTab>(
    entry === "products" ? "products" : "glossary",
  );

  useEffect(() => {
    if (entry === "glossary") {
      setStage("reference");
      setReferenceTab("glossary");
    } else if (entry === "products") {
      setStage("reference");
      setReferenceTab("products");
    } else {
      setStage("start");
    }
  }, [entry]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <GraduationCap className="h-6 w-6" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-foreground">Educação financeira</h1>
        </div>
        <p className="text-sm text-muted-foreground">Conteúdo educacional. Não constitui recomendação individual de investimento.</p>
      </header>

      <Tabs value={stage} onValueChange={(value) => setStage(value as LearningStage)} className="space-y-6">
        <TabsList aria-label="Caminho de aprendizagem" className="grid h-auto w-full grid-cols-3 gap-1 p-1">
          <TabsTrigger value="start" className="flex flex-col items-center gap-1 px-2 py-2.5 text-center whitespace-normal sm:flex-row sm:justify-center sm:gap-2">
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-xs sm:text-sm">1. Comece por aqui</span>
          </TabsTrigger>
          <TabsTrigger value="deepen" className="flex flex-col items-center gap-1 px-2 py-2.5 text-center whitespace-normal sm:flex-row sm:justify-center sm:gap-2">
            <Compass className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-xs sm:text-sm">2. Aprofunde</span>
          </TabsTrigger>
          <TabsTrigger value="reference" className="flex flex-col items-center gap-1 px-2 py-2.5 text-center whitespace-normal sm:flex-row sm:justify-center sm:gap-2">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-xs sm:text-sm">3. Consulte</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="start" className="mt-0 space-y-5">
          <section aria-labelledby="learning-start" className="space-y-4">
            <div className="space-y-1">
              <h2 id="learning-start" className="text-lg font-semibold">Comece por aqui</h2>
              <p className="text-sm text-muted-foreground">Lições curtas com os fundamentos essenciais antes de avançar.</p>
            </div>
            <MiniLessons embedded />
            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setStage("deepen")}>
                Próximo passo: Aprofunde <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="deepen" className="mt-0 space-y-5">
          <section aria-labelledby="learning-deepen" className="space-y-4">
            <div className="space-y-1">
              <h2 id="learning-deepen" className="text-lg font-semibold">Aprofunde</h2>
              <p className="text-sm text-muted-foreground">Conceitos complementares, escolas de pensamento e investidores de referência.</p>
            </div>
            <Tabs defaultValue="library">
              <TabsList aria-label="Conteúdos para aprofundar" className="grid h-auto w-full grid-cols-3">
                <TabsTrigger value="library" className="px-2">Biblioteca</TabsTrigger>
                <TabsTrigger value="schools" className="px-2">Escolas</TabsTrigger>
                <TabsTrigger value="investors" className="px-2">Investidores</TabsTrigger>
              </TabsList>
              <TabsContent value="library" className="mt-4"><KnowledgeLibrary embedded excludeSlugs={INTRODUCTORY_TOPIC_SLUGS} /></TabsContent>
              <TabsContent value="schools" className="mt-4"><EducationHub embedded section="schools" /></TabsContent>
              <TabsContent value="investors" className="mt-4"><EducationHub embedded section="investors" /></TabsContent>
            </Tabs>
            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setStage("reference")}>
                Próximo passo: Consulte <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="reference" className="mt-0 space-y-5">
          <section aria-labelledby="learning-reference" className="space-y-4">
            <div className="space-y-1">
              <h2 id="learning-reference" className="text-lg font-semibold">Consulte</h2>
              <p className="text-sm text-muted-foreground">Referência rápida de termos, produtos de renda fixa e fichas educacionais de ativos.</p>
            </div>
            <Tabs value={referenceTab} onValueChange={(value) => setReferenceTab(value as ReferenceTab)}>
              <TabsList aria-label="Materiais de consulta" className="grid h-auto w-full grid-cols-3">
                <TabsTrigger value="glossary" className="px-2">Glossário</TabsTrigger>
                <TabsTrigger value="products" className="px-2">Produtos</TabsTrigger>
                <TabsTrigger value="assets" className="px-2 whitespace-normal">Fichas de ativos</TabsTrigger>
              </TabsList>
              <TabsContent value="glossary" className="mt-4"><FinancialGlossary embedded /></TabsContent>
              <TabsContent value="products" className="mt-4"><InvestmentGuide embedded topicIds={PRODUCT_REFERENCE_IDS} /></TabsContent>
              <TabsContent value="assets" className="mt-4"><EducationHub embedded section="assets" /></TabsContent>
            </Tabs>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}