import { Home, CalendarDays, Gem, LineChart, MoreHorizontal } from "lucide-react";

export type NavSection = "inicio" | "execucao" | "patrimonio" | "projecao" | "mais";

interface Props {
  active: NavSection;
  onChange: (section: NavSection) => void;
}

const NAV_ITEMS: { id: NavSection; icon: React.ElementType; label: string }[] = [
  { id: "inicio", icon: Home, label: "Início" },
  { id: "execucao", icon: CalendarDays, label: "Execução" },
  { id: "patrimonio", icon: Gem, label: "Patrimônio" },
  { id: "projecao", icon: LineChart, label: "Projeção" },
  { id: "mais", icon: MoreHorizontal, label: "Mais" },
];

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-lg border-t border-border/50 safe-area-bottom lg:hidden">
      <div className="grid grid-cols-5 max-w-lg mx-auto h-16 px-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 mx-0.5 rounded-xl transition-all duration-150 touch-target active:scale-95 min-w-0 ${
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? "stroke-[2.4]" : "stroke-[1.8]"}`} />
              <span className={`text-[10px] leading-tight truncate max-w-full px-0.5 ${isActive ? "font-semibold" : "font-medium"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
