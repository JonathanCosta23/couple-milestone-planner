import { Loader2, Settings, LogOut, Cloud, HeartHandshake } from "lucide-react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { NavSection } from "@/components/plan/BottomNav";
import type { User } from "@supabase/supabase-js";

interface AppHeaderProps {
  user: User;
  syncing: boolean;
  navSection: NavSection;
  showDesktopNav: boolean;
  onChangeSection: (section: NavSection) => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

const SECTION_LABELS: Record<NavSection, string> = {
  inicio: "Início",
  execucao: "Execução",
  patrimonio: "Patrimônio",
  projecao: "Projeção",
  mais: "Mais",
};

const SECTION_SUBTITLES: Record<NavSection, string> = {
  inicio: "Cockpit do seu plano patrimonial",
  execucao: "Acompanhe seu mês e mantenha a disciplina",
  patrimonio: "Seus ativos, concentração e arquitetura",
  projecao: "Cenários e jornada do seu patrimônio",
  mais: "Educação, configurações e backup",
};

const SECTION_ORDER: NavSection[] = ["inicio", "execucao", "patrimonio", "projecao", "mais"];

export function AppHeader({
  user,
  syncing,
  navSection,
  showDesktopNav,
  onChangeSection,
  onOpenSettings,
  onSignOut,
}: AppHeaderProps) {
  const initial = (user.user_metadata?.full_name || user.email || "U")[0].toUpperCase();
  const fullName = user.user_metadata?.full_name || "Usuário";

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border/40">
      <div className="flex items-center justify-between h-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="flex flex-col min-w-0 leading-tight">
          <div
            role="heading"
            aria-level={2}
            className="text-sm font-bold text-gradient lg:text-base truncate"
          >
            Plano do Milhão, Planejamento Financeiro
          </div>
          <p className="hidden sm:block text-[10px] text-muted-foreground truncate">
            {SECTION_LABELS[navSection]} · {SECTION_SUBTITLES[navSection]}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/elo"
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
          >
            <HeartHandshake className="h-3.5 w-3.5" /> ELO Casal
          </Link>

          {syncing ? (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Salvando...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-primary">
              <Cloud className="w-3 h-3" />
              <span className="hidden sm:inline">Salvo</span>
            </div>
          )}

          {showDesktopNav && (
            <nav className="hidden lg:flex items-center gap-1">
              {SECTION_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => onChangeSection(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    navSection === s
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {SECTION_LABELS[s]}
                </button>
              ))}
            </nav>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Abrir menu do usuário (${fullName})`}
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold"
              >
                {initial}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="text-sm font-medium truncate">{fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/elo">
                  <HeartHandshake className="w-4 h-4 mr-2" /> ELO Casal
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenSettings}>
                <Settings className="w-4 h-4 mr-2" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
