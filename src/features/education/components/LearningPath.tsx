import { BookOpen, Compass, GraduationCap, Search } from "lucide-react";
import { MiniLessons } from "@/components/plan/MiniLessons";
import { KnowledgeLibrary } from "@/components/plan/KnowledgeLibrary";
import { InvestmentGuide } from "@/components/plan/InvestmentGuide";
import { FinancialGlossary } from "@/components/plan/FinancialGlossary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EducationHub } from "./EducationHub";
import { INTRODUCTORY_TOPIC_SLUGS, PRODUCT_REFERENCE_IDS } from "../learningPathContent";

export type LearningEntry = "start" | "glossary" | "products";

export function LearningPath({ entry = "start" }: { entry?: LearningEntry }) {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <GraduationCap className="h-6 w-6" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-foreground">Educação financeira</h1>
        </div>
        <p className="text-sm text-muted-foreground">Conteúdo educacional. Não constitui recomendação individual de investimento.</p>
      </header>

      <section aria-labelledby="learning-start" className="space-y-4">
        <StageHeading id="learning-start" number="01" title="Comece por aqui" icon={BookOpen} />
        <MiniLessons embedded />
      </section>

      <section aria-labelledby="learning-deepen" className="space-y-4 border-t border-border pt-6">
        <StageHeading id="learning-deepen" number="02" title="Aprofunde" icon={Compass} />
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
      </section>

      <section aria-labelledby="learning-reference" className="space-y-4 border-t border-border pt-6">
        <StageHeading id="learning-reference" number="03" title="Consulte" icon={Search} />
        <Tabs defaultValue={entry === "products" ? "products" : "glossary"}>
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
    </div>
  );
}

function StageHeading({ id, number, title, icon: Icon }: {
  id: string; number: string; title: string; icon: typeof BookOpen;
}) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="text-sm font-semibold text-muted-foreground">{number}</span>
      <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
      <h2 id={id} className="text-xl font-semibold">{title}</h2>
    </div>
  );
}