import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LearningPath } from "../components/LearningPath";
import { INTRODUCTORY_TOPIC_SLUGS, PRODUCT_REFERENCE_IDS } from "../learningPathContent";
import { EDUCATION_TOPICS } from "@/lib/investmentEducation";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/hooks/useEducationProgress", () => ({
  useEducationProgress: () => ({
    isCompleted: () => false,
    isOpened: () => false,
    completedCount: 0,
    markOpened: vi.fn(),
    markCompleted: vi.fn(),
  }),
}));

vi.mock("@/hooks/useLearningProgress", () => ({
  useLearningProgress: () => ({
    byTopic: {},
    upsert: vi.fn(),
  }),
}));

vi.mock("@/hooks/useKnowledge", () => ({
  useKnowledgeTopics: () => ({
    topics: [
      { id: "t-res", slug: "reserva-emergencia", title: "Reserva de emergência", description: "Dup", category: "foundations", difficulty: "basic", sort_order: 1 },
      { id: "t-fgc", slug: "fgc", title: "FGC", description: "Dup", category: "protecao", difficulty: "basic", sort_order: 2 },
      { id: "t-inf", slug: "inflacao", title: "Inflação", description: "Poder de compra", category: "foundations", difficulty: "basic", sort_order: 3 },
      { id: "t-div", slug: "diversificacao", title: "Diversificação", description: "Reduzir risco", category: "estrategia", difficulty: "basic", sort_order: 4 },
    ],
    loading: false,
    error: null,
  }),
  useKnowledgeTopicDetail: () => ({
    articles: [],
    sourcesByArticle: {},
    loading: false,
  }),
}));

vi.mock("@/features/education/hooks/useEducation", () => ({
  useInvestmentSchools: () => ({ data: [], loading: false, error: null }),
  useInvestorReferences: () => ({ data: [], loading: false, error: null }),
  useAssetEducationCases: () => ({ data: [], loading: false, error: null }),
}));

describe("LearningPath", () => {
  it("exibe o caminho Comece por aqui -> Aprofunde -> Consulte começando por Comece por aqui", () => {
    render(<LearningPath />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "1. Comece por aqui",
      "2. Aprofunde",
      "3. Consulte",
    ]);
    expect(screen.getByRole("heading", { name: "Comece por aqui" })).toBeInTheDocument();
    expect(screen.getByText("Reserva de emergência: por que e como")).toBeInTheDocument();
  });

  it("não duplica tópicos introdutórios na Biblioteca de Aprofunde", async () => {
    const user = userEvent.setup();
    render(<LearningPath />);

    await user.click(screen.getByRole("tab", { name: /2\. Aprofunde/i }));

    expect(screen.getByText("Inflação")).toBeInTheDocument();
    expect(screen.getByText("Diversificação")).toBeInTheDocument();
    expect(screen.queryByText("Reserva de emergência")).not.toBeInTheDocument();
    expect(screen.queryByText("FGC")).not.toBeInTheDocument();
    expect(INTRODUCTORY_TOPIC_SLUGS).toEqual(
      expect.arrayContaining(["reserva-emergencia", "juros-compostos", "dividas-juros", "fgc"]),
    );
  });

  it("exibe apenas produtos e marcação a mercado em Consulte -> Produtos, sem repetir conceitos da biblioteca", async () => {
    const user = userEvent.setup();
    render(<LearningPath entry="products" />);

    expect(screen.getByRole("heading", { name: "Consulte" })).toBeInTheDocument();
    expect(screen.getByText("Tesouro Selic")).toBeInTheDocument();
    expect(screen.getByText("Marcação a Mercado")).toBeInTheDocument();
    expect(screen.queryByText("FGC — Fundo Garantidor de Créditos")).not.toBeInTheDocument();
    expect(screen.queryByText("Diversificação")).not.toBeInTheDocument();

    const keptIds = EDUCATION_TOPICS.filter((topic) =>
      (PRODUCT_REFERENCE_IDS as readonly string[]).includes(topic.id),
    ).map((topic) => topic.id);
    expect(keptIds).toEqual(["tesouro-selic", "tesouro-ipca", "cdb", "lci-lca", "mark-to-market"]);

    await user.click(screen.getByRole("tab", { name: "Glossário" }));
    expect(screen.getByPlaceholderText("Buscar termo...")).toBeInTheDocument();
  });
});