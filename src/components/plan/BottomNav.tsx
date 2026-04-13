import { Home, Wallet, BarChart3, GraduationCap, Settings } from "lucide-react";

export type NavSection = "home" | "financas" | "inteligencia" | "aprender" | "config";

interface Props {
  active: NavSection;
  onChange: (section: NavSection) => void;
}

const NAV_ITEMS: { id: NavSection; icon: React.ElementType; label: string }[] = [
  { id: "home", icon: Home, label: "Início" },
  { id: "financas", icon: Wallet, label: "Finanças" },
  { id: "inteligencia", icon: BarChart3, label: "Análise" },
  { id: "aprender", icon: GraduationCap, label: "Aprender" },
  { id: "config", icon: Settings, label: "Mais" },
];

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/60 safe-area-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16 px-2">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-xl transition-all duration-200 min-h-[48px] ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
              <span className={`text-[10px] leading-tight ${isActive ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
