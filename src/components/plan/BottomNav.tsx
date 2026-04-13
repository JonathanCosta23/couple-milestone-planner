import { Home, Target, CalendarDays, User } from "lucide-react";

export type NavSection = "home" | "plano" | "historico" | "perfil";

interface Props {
  active: NavSection;
  onChange: (section: NavSection) => void;
}

const NAV_ITEMS: { id: NavSection; icon: React.ElementType; label: string }[] = [
  { id: "home", icon: Home, label: "Início" },
  { id: "plano", icon: Target, label: "Plano" },
  { id: "historico", icon: CalendarDays, label: "Histórico" },
  { id: "perfil", icon: User, label: "Perfil" },
];

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-lg border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16 px-2">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl transition-all duration-150 touch-target active:scale-95 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={`w-[22px] h-[22px] ${isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
              <span className={`text-[11px] leading-none ${isActive ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
