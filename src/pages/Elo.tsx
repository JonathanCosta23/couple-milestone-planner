import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  Copy,
  Dumbbell,
  HeartHandshake,
  Loader2,
  MoonStar,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Target,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type TabId = "hoje" | "agenda" | "treino" | "sono" | "carreira" | "config";
type Owner = "Jonathan" | "Isabella" | "Casal";
type EventStatus = "planejado" | "concluido" | "remarcado" | "cancelado";
type WorkoutProfile = "curto" | "medio" | "longo" | "extra";

type EloEvent = {
  id: string;
  date: string;
  title: string;
  owner: Owner;
  category: "trabalho" | "ingles" | "academia" | "casal" | "curso" | "carreira" | "casa" | "outro";
  flexibility: "fixo" | "semiflexivel" | "flexivel";
  priority: "alta" | "media" | "baixa";
  start: string;
  durationMinutes: number;
  workoutProfile?: WorkoutProfile;
  actualStart?: string;
  actualEnd?: string;
  status: EventStatus;
  notes?: string;
};

type SleepLog = {
  id: string;
  date: string;
  person: "Jonathan" | "Isabella" | "Casal";
  bedtime: string;
  wakeTime: string;
  quality: number;
};

type CareerTask = {
  id: string;
  date: string;
  pillar: "curso" | "candidatura" | "networking" | "portfolio" | "entrevista";
  title: string;
  target: number;
  actual: number;
  unit: "horas" | "candidaturas" | "contatos" | "entregas";
  status: EventStatus;
};

type EloSettings = {
  sleepGoalHours: number;
  wakeWeekday: string;
  wakeWeekend: string;
  workStart: string;
  workEnd: string;
  englishStart: string;
  englishEnd: string;
  gymStart: string;
  postWorkoutMinutes: number;
  coupleMinutes: number;
  windDownMinutes: number;
  workoutProfiles: Record<WorkoutProfile, number>;
};

type EloState = {
  schemaVersion: 1;
  settings: EloSettings;
  events: EloEvent[];
  sleepLogs: SleepLog[];
  careerTasks: CareerTask[];
};

type Workspace = {
  id: string;
  name: string;
  inviteCode: string;
};

type Member = {
  id: string;
  user_id: string;
  display_name: string;
  role: "owner" | "member";
};

const INPUT = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const CARD = "rounded-2xl border border-border/60 bg-card p-4 shadow-sm";

const PROFILE_LABELS: Record<WorkoutProfile, string> = {
  curto: "Curto",
  medio: "Médio",
  longo: "Longo",
  extra: "Extra",
};

const STATUS_LABELS: Record<EventStatus, string> = {
  planejado: "Planejado",
  concluido: "Concluído",
  remarcado: "Remarcado",
  cancelado: "Cancelado",
};

function id() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localDate(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

function minutesBetween(start?: string, end?: string) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let result = eh * 60 + em - (sh * 60 + sm);
  if (result < 0) result += 24 * 60;
  return result;
}

function addMinutesToTime(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = (hours * 60 + mins + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function buildDefaultState(): EloState {
  const settings: EloSettings = {
    sleepGoalHours: 8,
    wakeWeekday: "06:30",
    wakeWeekend: "08:30",
    workStart: "08:00",
    workEnd: "17:00",
    englishStart: "18:00",
    englishEnd: "19:00",
    gymStart: "19:30",
    postWorkoutMinutes: 45,
    coupleMinutes: 30,
    windDownMinutes: 30,
    workoutProfiles: {
      curto: 120,
      medio: 135,
      longo: 150,
      extra: 180,
    },
  };

  const events: EloEvent[] = [];
  const profileByWeekday: WorkoutProfile[] = ["medio", "curto", "longo", "curto", "longo"];
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });

  for (let day = 0; day < 42; day += 1) {
    const date = addDays(start, day);
    const weekday = date.getDay();
    const dateKey = localDate(date);

    if (weekday >= 1 && weekday <= 5) {
      events.push({
        id: id(),
        date: dateKey,
        title: "Jornada profissional",
        owner: "Jonathan",
        category: "trabalho",
        flexibility: "fixo",
        priority: "alta",
        start: settings.workStart,
        durationMinutes: minutesBetween(settings.workStart, settings.workEnd),
        status: "planejado",
      });
      events.push({
        id: id(),
        date: dateKey,
        title: "Aula de inglês",
        owner: "Casal",
        category: "ingles",
        flexibility: "fixo",
        priority: "alta",
        start: settings.englishStart,
        durationMinutes: minutesBetween(settings.englishStart, settings.englishEnd),
        status: "planejado",
      });
      const profile = profileByWeekday[weekday - 1];
      events.push({
        id: id(),
        date: dateKey,
        title: "Treino do casal",
        owner: "Casal",
        category: "academia",
        flexibility: "semiflexivel",
        priority: "alta",
        start: settings.gymStart,
        durationMinutes: settings.workoutProfiles[profile],
        workoutProfile: profile,
        status: "planejado",
        notes: "A duração varia conforme a ficha, volume, descanso e lotação da academia.",
      });
    }

    if (weekday === 0) {
      events.push({
        id: id(),
        date: dateKey,
        title: "Planejamento da semana",
        owner: "Casal",
        category: "casal",
        flexibility: "semiflexivel",
        priority: "alta",
        start: "18:00",
        durationMinutes: 60,
        status: "planejado",
        notes: "Revisar agenda, refeições, finanças, cursos e compromissos.",
      });
    }
  }

  const careerTasks: CareerTask[] = [];
  for (let day = 0; day < 30; day += 1) {
    const date = addDays(new Date(), day);
    const weekday = date.getDay();
    if (weekday >= 1 && weekday <= 5) {
      const dateKey = localDate(date);
      careerTasks.push(
        {
          id: id(),
          date: dateKey,
          pillar: "curso",
          title: "Curso ou certificação prioritária",
          target: 3,
          actual: 0,
          unit: "horas",
          status: "planejado",
        },
        {
          id: id(),
          date: dateKey,
          pillar: "candidatura",
          title: "Candidaturas qualificadas",
          target: 5,
          actual: 0,
          unit: "candidaturas",
          status: "planejado",
        },
        {
          id: id(),
          date: dateKey,
          pillar: weekday === 3 ? "portfolio" : "networking",
          title: weekday === 3 ? "Evoluir portfólio" : "Networking e LinkedIn",
          target: weekday === 3 ? 1 : 2,
          actual: 0,
          unit: weekday === 3 ? "entregas" : "contatos",
          status: "planejado",
        },
      );
    }
  }

  return {
    schemaVersion: 1,
    settings,
    events,
    sleepLogs: [],
    careerTasks,
  };
}

function normalizeState(value: unknown): EloState {
  if (!value || typeof value !== "object" || !(value as EloState).settings) {
    return buildDefaultState();
  }
  return value as EloState;
}

function statusClass(status: EventStatus) {
  if (status === "concluido") return "bg-emerald-500/10 text-emerald-600";
  if (status === "remarcado") return "bg-amber-500/10 text-amber-600";
  if (status === "cancelado") return "bg-destructive/10 text-destructive";
  return "bg-primary/10 text-primary";
}

export default function Elo() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [state, setState] = useState<EloState>(() => buildDefaultState());
  const [tab, setTab] = useState<TabId>("hoje");
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [createName, setCreateName] = useState("ELO, Jonathan e Isabella");
  const [displayName, setDisplayName] = useState("Jonathan");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("Isabella");

  const loadWorkspace = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const memberResult = await db
        .from("elo_members")
        .select("id, household_id, user_id, display_name, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberResult.error) throw memberResult.error;
      if (!memberResult.data) {
        setWorkspace(null);
        setMembers([]);
        return;
      }

      const householdId = memberResult.data.household_id;
      const [householdResult, membersResult, stateResult] = await Promise.all([
        db.from("elo_households").select("id, name, invite_code").eq("id", householdId).single(),
        db.from("elo_members").select("id, user_id, display_name, role").eq("household_id", householdId).order("created_at"),
        db.from("elo_state").select("data").eq("household_id", householdId).single(),
      ]);

      if (householdResult.error) throw householdResult.error;
      if (membersResult.error) throw membersResult.error;
      if (stateResult.error) throw stateResult.error;

      const normalized = normalizeState(stateResult.data?.data);
      setWorkspace({
        id: householdResult.data.id,
        name: householdResult.data.name,
        inviteCode: householdResult.data.invite_code,
      });
      setMembers(membersResult.data ?? []);
      setState(normalized);

      if (!stateResult.data?.data?.settings) {
        await db
          .from("elo_state")
          .update({ data: normalized, updated_by: user.id })
          .eq("household_id", householdId);
      }
    } catch (error: any) {
      console.error(error);
      toast.error("Não foi possível carregar o ELO", {
        description: error?.message ?? "Verifique se a migração do banco foi aplicada.",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) void loadWorkspace();
  }, [authLoading, user, loadWorkspace]);

  useEffect(() => {
    if (!workspace || !user) return;
    const channel = db
      .channel(`elo-state-${workspace.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "elo_state",
          filter: `household_id=eq.${workspace.id}`,
        },
        (payload: any) => {
          if (payload.new?.updated_by !== user.id) {
            setState(normalizeState(payload.new?.data));
            toast.success("Agenda atualizada pelo casal");
          }
        },
      )
      .subscribe();

    return () => {
      void db.removeChannel(channel);
    };
  }, [workspace, user]);

  const persist = useCallback(
    async (next: EloState) => {
      if (!workspace || !user) return;
      setState(next);
      setSyncing(true);
      const { error } = await db
        .from("elo_state")
        .update({ data: next, updated_by: user.id })
        .eq("household_id", workspace.id);
      setSyncing(false);
      if (error) {
        toast.error("Falha ao sincronizar", { description: error.message });
        await loadWorkspace();
      }
    },
    [workspace, user, loadWorkspace],
  );

  const createWorkspace = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await db.rpc("elo_create_household", {
      p_name: createName,
      p_display_name: displayName,
    });
    if (error) {
      toast.error("Não foi possível criar o espaço", { description: error.message });
      setLoading(false);
      return;
    }
    toast.success("Espaço do casal criado");
    await loadWorkspace();
  };

  const joinWorkspace = async () => {
    if (!joinCode.trim()) {
      toast.error("Informe o código de convite");
      return;
    }
    setLoading(true);
    const { error } = await db.rpc("elo_join_household", {
      p_invite_code: joinCode.trim(),
      p_display_name: joinName,
    });
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      setLoading(false);
      return;
    }
    toast.success("Você entrou no espaço do casal");
    await loadWorkspace();
  };

  const selectedEvents = useMemo(
    () => state.events.filter((event) => event.date === selectedDate).sort((a, b) => a.start.localeCompare(b.start)),
    [state.events, selectedDate],
  );

  const workout = useMemo(
    () => state.events.find((event) => event.date === selectedDate && event.category === "academia"),
    [state.events, selectedDate],
  );

  const sleepLog = useMemo(
    () => state.sleepLogs.find((log) => log.date === selectedDate && log.person === "Casal"),
    [state.sleepLogs, selectedDate],
  );

  const careerTasks = useMemo(
    () => state.careerTasks.filter((task) => task.date === selectedDate),
    [state.careerTasks, selectedDate],
  );

  const todayEvents = useMemo(
    () => state.events.filter((event) => event.date === localDate()).sort((a, b) => a.start.localeCompare(b.start)),
    [state.events],
  );

  const weekRange = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = addDays(start, 6);
    return { start: localDate(start), end: localDate(end) };
  }, []);

  const weeklyEvents = useMemo(
    () => state.events.filter((event) => event.date >= weekRange.start && event.date <= weekRange.end),
    [state.events, weekRange],
  );

  const weeklyCompletion = weeklyEvents.length
    ? Math.round((weeklyEvents.filter((event) => event.status === "concluido").length / weeklyEvents.length) * 100)
    : 0;

  const weeklyCareer = useMemo(
    () => state.careerTasks.filter((task) => task.date >= weekRange.start && task.date <= weekRange.end),
    [state.careerTasks, weekRange],
  );

  const applicationsDone = weeklyCareer
    .filter((task) => task.pillar === "candidatura")
    .reduce((sum, task) => sum + task.actual, 0);
  const courseHoursDone = weeklyCareer
    .filter((task) => task.pillar === "curso")
    .reduce((sum, task) => sum + task.actual, 0);

  const workoutEnd = workout ? addMinutesToTime(workout.start, workout.durationMinutes) : "21:30";
  const projectedBedtime = addMinutesToTime(
    workoutEnd,
    state.settings.postWorkoutMinutes + state.settings.coupleMinutes + state.settings.windDownMinutes,
  );
  const wakeTime = new Date(`${selectedDate}T00:00:00`).getDay() === 0 || new Date(`${selectedDate}T00:00:00`).getDay() === 6
    ? state.settings.wakeWeekend
    : state.settings.wakeWeekday;
  const projectedSleep = minutesBetween(projectedBedtime, wakeTime) / 60;

  const updateEvent = (eventId: string, patch: Partial<EloEvent>) => {
    void persist({
      ...state,
      events: state.events.map((event) => (event.id === eventId ? { ...event, ...patch } : event)),
    });
  };

  const addEvent = () => {
    const nextEvent: EloEvent = {
      id: id(),
      date: selectedDate,
      title: "Novo compromisso",
      owner: "Casal",
      category: "outro",
      flexibility: "flexivel",
      priority: "media",
      start: "12:00",
      durationMinutes: 60,
      status: "planejado",
    };
    void persist({ ...state, events: [...state.events, nextEvent] });
  };

  const deleteEvent = (eventId: string) => {
    void persist({ ...state, events: state.events.filter((event) => event.id !== eventId) });
  };

  const ensureWorkout = () => {
    if (workout) return workout;
    const profile: WorkoutProfile = "medio";
    const next: EloEvent = {
      id: id(),
      date: selectedDate,
      title: "Treino do casal",
      owner: "Casal",
      category: "academia",
      flexibility: "semiflexivel",
      priority: "alta",
      start: state.settings.gymStart,
      durationMinutes: state.settings.workoutProfiles[profile],
      workoutProfile: profile,
      status: "planejado",
    };
    void persist({ ...state, events: [...state.events, next] });
    return next;
  };

  const setWorkoutProfile = (profile: WorkoutProfile) => {
    const target = ensureWorkout();
    updateEvent(target.id, {
      workoutProfile: profile,
      durationMinutes: state.settings.workoutProfiles[profile],
    });
  };

  const updateSleep = (patch: Partial<SleepLog>) => {
    const existing = sleepLog;
    const nextLog: SleepLog = existing
      ? { ...existing, ...patch }
      : {
          id: id(),
          date: selectedDate,
          person: "Casal",
          bedtime: projectedBedtime,
          wakeTime,
          quality: 3,
          ...patch,
        };
    const nextLogs = existing
      ? state.sleepLogs.map((log) => (log.id === existing.id ? nextLog : log))
      : [...state.sleepLogs, nextLog];
    void persist({ ...state, sleepLogs: nextLogs });
  };

  const updateCareerTask = (taskId: string, patch: Partial<CareerTask>) => {
    void persist({
      ...state,
      careerTasks: state.careerTasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    });
  };

  const addCareerTask = () => {
    const task: CareerTask = {
      id: id(),
      date: selectedDate,
      pillar: "curso",
      title: "Nova atividade de recolocação",
      target: 1,
      actual: 0,
      unit: "horas",
      status: "planejado",
    };
    void persist({ ...state, careerTasks: [...state.careerTasks, task] });
  };

  const saveSettings = (patch: Partial<EloSettings>) => {
    void persist({ ...state, settings: { ...state.settings, ...patch } });
  };

  const copyInvite = async () => {
    if (!workspace) return;
    await navigator.clipboard.writeText(workspace.inviteCode);
    toast.success("Código de convite copiado");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando ELO...
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!workspace) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/60 bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sair</Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <HeartHandshake className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">ELO Casal</h1>
            <p className="mt-2 text-muted-foreground">
              Agenda compartilhada, treino adaptativo, sono, recolocação profissional e gestão da vida a dois.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <section className={CARD}>
              <h2 className="text-lg font-semibold">Criar nosso espaço</h2>
              <p className="mt-1 text-sm text-muted-foreground">Você cria o ambiente e envia o código para Isabella.</p>
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-medium">
                  Nome do espaço
                  <input className={`${INPUT} mt-1`} value={createName} onChange={(e) => setCreateName(e.target.value)} />
                </label>
                <label className="block text-sm font-medium">
                  Seu nome
                  <input className={`${INPUT} mt-1`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </label>
                <Button className="w-full" onClick={() => void createWorkspace()}>
                  <HeartHandshake className="mr-2 h-4 w-4" /> Criar ELO
                </Button>
              </div>
            </section>

            <section className={CARD}>
              <h2 className="text-lg font-semibold">Entrar com convite</h2>
              <p className="mt-1 text-sm text-muted-foreground">Use esta opção no login da segunda pessoa.</p>
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-medium">
                  Código de convite
                  <input className={`${INPUT} mt-1 uppercase`} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
                </label>
                <label className="block text-sm font-medium">
                  Seu nome
                  <input className={`${INPUT} mt-1`} value={joinName} onChange={(e) => setJoinName(e.target.value)} />
                </label>
                <Button className="w-full" variant="secondary" onClick={() => void joinWorkspace()}>
                  <Users className="mr-2 h-4 w-4" /> Entrar no ELO
                </Button>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  const tabs: Array<{ id: TabId; label: string; icon: typeof CalendarDays }> = [
    { id: "hoje", label: "Hoje", icon: Target },
    { id: "agenda", label: "Agenda", icon: CalendarDays },
    { id: "treino", label: "Treino", icon: Dumbbell },
    { id: "sono", label: "Sono", icon: MoonStar },
    { id: "carreira", label: "Isabella", icon: BriefcaseBusiness },
    { id: "config", label: "Ajustes", icon: Settings2 },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Voltar ao módulo financeiro">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <HeartHandshake className="h-5 w-5 text-primary" />
                <h1 className="truncate font-bold">{workspace.name}</h1>
              </div>
              <p className="truncate text-[11px] text-muted-foreground">
                {syncing ? "Sincronizando..." : "Sincronizado na nuvem"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void copyInvite()}
              className="hidden items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs font-medium sm:flex"
            >
              <Copy className="h-3.5 w-3.5" /> {workspace.inviteCode}
            </button>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Cloud className="h-4 w-4 text-primary" />}
            <ThemeToggle />
          </div>
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-1 px-4 pb-2 lg:flex">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  tab === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {tab !== "hoje" && tab !== "config" && (
          <DateSelector value={selectedDate} onChange={setSelectedDate} />
        )}

        {tab === "hoje" && (
          <div className="space-y-6">
            <section>
              <p className="text-sm font-medium text-primary">Cockpit do casal</p>
              <h2 className="mt-1 text-2xl font-bold">Hoje, {format(new Date(), "d 'de' MMMM", { locale: ptBR })}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Visão operacional da rotina, recuperação e evolução profissional.</p>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric icon={CalendarDays} label="Compromissos hoje" value={String(todayEvents.length)} note={`${todayEvents.filter((event) => event.status === "concluido").length} concluídos`} />
              <Metric icon={Dumbbell} label="Treino previsto" value={durationLabel(state.events.find((event) => event.date === localDate() && event.category === "academia")?.durationMinutes ?? 0)} note="Bloco adaptativo" />
              <Metric icon={MoonStar} label="Sono projetado" value={`${projectedSleep.toFixed(1)}h`} note={projectedSleep >= state.settings.sleepGoalHours ? "Dentro da meta" : "Abaixo da meta"} alert={projectedSleep < state.settings.sleepGoalHours} />
              <Metric icon={BriefcaseBusiness} label="Candidaturas na semana" value={String(applicationsDone)} note={`${courseHoursDone.toFixed(1)}h de cursos`} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
              <section className={CARD}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Linha do dia</h3>
                    <p className="text-sm text-muted-foreground">Compromissos em ordem de execução.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedDate(localDate()); setTab("agenda"); }}>
                    Abrir agenda
                  </Button>
                </div>
                <div className="space-y-3">
                  {todayEvents.map((event) => (
                    <EventRow key={event.id} event={event} onUpdate={updateEvent} compact />
                  ))}
                  {!todayEvents.length && <Empty text="Nenhum compromisso para hoje." />}
                </div>
              </section>

              <section className={CARD}>
                <h3 className="font-semibold">Performance semanal</h3>
                <p className="mt-1 text-sm text-muted-foreground">Execução da agenda compartilhada.</p>
                <div className="mt-5 text-4xl font-bold text-primary">{weeklyCompletion}%</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${weeklyCompletion}%` }} />
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Eventos da semana</span><strong>{weeklyEvents.length}</strong></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Cursos Isabella</span><strong>{courseHoursDone.toFixed(1)}h</strong></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Membros conectados</span><strong>{members.length}/2</strong></div>
                </div>
              </section>
            </div>
          </div>
        )}

        {tab === "agenda" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Agenda adaptativa</h2>
                <p className="text-sm text-muted-foreground">Horários fixos convivem com treino e blocos flexíveis.</p>
              </div>
              <Button onClick={addEvent}><Plus className="mr-2 h-4 w-4" /> Novo compromisso</Button>
            </div>
            <div className="space-y-3">
              {selectedEvents.map((event) => (
                <EventEditor key={event.id} event={event} onUpdate={updateEvent} onDelete={deleteEvent} />
              ))}
              {!selectedEvents.length && <Empty text="Nenhum compromisso nesta data." />}
            </div>
          </div>
        )}

        {tab === "treino" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold">Treino adaptativo</h2>
              <p className="text-sm text-muted-foreground">O bloco se ajusta ao volume real de cada ficha, sem forçar um término fixo.</p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
              <section className={CARD}>
                <h3 className="font-semibold">Perfil de duração</h3>
                <p className="mt-1 text-sm text-muted-foreground">Piso operacional de duas horas, com margem para dias longos.</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(Object.keys(PROFILE_LABELS) as WorkoutProfile[]).map((profile) => (
                    <button
                      key={profile}
                      onClick={() => setWorkoutProfile(profile)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        workout?.workoutProfile === profile ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-semibold">{PROFILE_LABELS[profile]}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{durationLabel(state.settings.workoutProfiles[profile])}</div>
                    </button>
                  ))}
                </div>

                {workout ? (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">Início previsto<input type="time" className={`${INPUT} mt-1`} value={workout.start} onChange={(e) => updateEvent(workout.id, { start: e.target.value })} /></label>
                    <label className="text-sm font-medium">Fim previsto<input type="time" className={`${INPUT} mt-1`} value={addMinutesToTime(workout.start, workout.durationMinutes)} readOnly /></label>
                    <label className="text-sm font-medium">Início real<input type="time" className={`${INPUT} mt-1`} value={workout.actualStart ?? ""} onChange={(e) => updateEvent(workout.id, { actualStart: e.target.value })} /></label>
                    <label className="text-sm font-medium">Fim real<input type="time" className={`${INPUT} mt-1`} value={workout.actualEnd ?? ""} onChange={(e) => updateEvent(workout.id, { actualEnd: e.target.value })} /></label>
                  </div>
                ) : (
                  <Button className="mt-5" onClick={() => void ensureWorkout()}><Plus className="mr-2 h-4 w-4" /> Adicionar treino neste dia</Button>
                )}

                {workout?.actualStart && workout?.actualEnd && (
                  <div className="mt-5 rounded-xl bg-muted/60 p-4 text-sm">
                    Duração real: <strong>{durationLabel(minutesBetween(workout.actualStart, workout.actualEnd))}</strong>
                  </div>
                )}
              </section>

              <section className={CARD}>
                <h3 className="font-semibold">Impacto na noite</h3>
                <div className="mt-5 space-y-4">
                  <Timeline label="Fim do treino" value={workoutEnd} />
                  <Timeline label="Banho e refeição" value={`${state.settings.postWorkoutMinutes} min`} />
                  <Timeline label="Tempo do casal" value={`${state.settings.coupleMinutes} min`} />
                  <Timeline label="Desaceleração" value={`${state.settings.windDownMinutes} min`} />
                  <Timeline label="Dormir projetado" value={projectedBedtime} strong />
                  <Timeline label="Acordar" value={wakeTime} />
                </div>
                <div className={`mt-5 rounded-2xl p-4 ${projectedSleep >= state.settings.sleepGoalHours ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
                  <div className="text-sm font-medium">Sono disponível</div>
                  <div className="mt-1 text-3xl font-bold">{projectedSleep.toFixed(1)}h</div>
                  <p className="mt-1 text-xs">Meta configurada: {state.settings.sleepGoalHours}h.</p>
                </div>
              </section>
            </div>
          </div>
        )}

        {tab === "sono" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold">Sono e recuperação</h2>
              <p className="text-sm text-muted-foreground">O objetivo é enxergar o custo real da rotina noturna.</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
              <section className={CARD}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">Horário real de dormir<input type="time" className={`${INPUT} mt-1`} value={sleepLog?.bedtime ?? projectedBedtime} onChange={(e) => updateSleep({ bedtime: e.target.value })} /></label>
                  <label className="text-sm font-medium">Horário real de acordar<input type="time" className={`${INPUT} mt-1`} value={sleepLog?.wakeTime ?? wakeTime} onChange={(e) => updateSleep({ wakeTime: e.target.value })} /></label>
                  <label className="text-sm font-medium sm:col-span-2">Qualidade do sono, 1 a 5<input type="range" min="1" max="5" className="mt-3 w-full" value={sleepLog?.quality ?? 3} onChange={(e) => updateSleep({ quality: Number(e.target.value) })} /></label>
                </div>
                <div className="mt-5 flex justify-end"><Button variant="outline" onClick={() => updateSleep({})}><Save className="mr-2 h-4 w-4" /> Registrar</Button></div>
              </section>
              <SleepSummary log={sleepLog} goal={state.settings.sleepGoalHours} projectedBedtime={projectedBedtime} wakeTime={wakeTime} />
            </div>
          </div>
        )}

        {tab === "carreira" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Sprint de recolocação da Isabella</h2>
                <p className="text-sm text-muted-foreground">Capacitação, candidatura, marca profissional e entrevistas.</p>
              </div>
              <Button onClick={addCareerTask}><Plus className="mr-2 h-4 w-4" /> Nova atividade</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric icon={BriefcaseBusiness} label="Candidaturas na semana" value={String(applicationsDone)} note="Meta sugerida: 25" />
              <Metric icon={Clock3} label="Cursos na semana" value={`${courseHoursDone.toFixed(1)}h`} note="Meta sugerida: 15h" />
              <Metric icon={Target} label="Atividades do dia" value={String(careerTasks.length)} note={`${careerTasks.filter((task) => task.status === "concluido").length} concluídas`} />
            </div>
            <div className="space-y-3">
              {careerTasks.map((task) => (
                <CareerEditor key={task.id} task={task} onUpdate={updateCareerTask} />
              ))}
              {!careerTasks.length && <Empty text="Nenhuma atividade de recolocação nesta data." />}
            </div>
          </div>
        )}

        {tab === "config" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold">Configurações do casal</h2>
              <p className="text-sm text-muted-foreground">Parâmetros usados nas projeções da agenda, treino e sono.</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <section className={CARD}>
                <h3 className="font-semibold">Rotina fixa</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <SettingTime label="Trabalho, início" value={state.settings.workStart} onChange={(value) => saveSettings({ workStart: value })} />
                  <SettingTime label="Trabalho, fim" value={state.settings.workEnd} onChange={(value) => saveSettings({ workEnd: value })} />
                  <SettingTime label="Inglês, início" value={state.settings.englishStart} onChange={(value) => saveSettings({ englishStart: value })} />
                  <SettingTime label="Inglês, fim" value={state.settings.englishEnd} onChange={(value) => saveSettings({ englishEnd: value })} />
                  <SettingTime label="Academia, início" value={state.settings.gymStart} onChange={(value) => saveSettings({ gymStart: value })} />
                  <SettingTime label="Acordar, dias úteis" value={state.settings.wakeWeekday} onChange={(value) => saveSettings({ wakeWeekday: value })} />
                </div>
              </section>

              <section className={CARD}>
                <h3 className="font-semibold">Recuperação</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <SettingNumber label="Meta de sono, horas" value={state.settings.sleepGoalHours} onChange={(value) => saveSettings({ sleepGoalHours: value })} />
                  <SettingNumber label="Pós treino, minutos" value={state.settings.postWorkoutMinutes} onChange={(value) => saveSettings({ postWorkoutMinutes: value })} />
                  <SettingNumber label="Tempo do casal, minutos" value={state.settings.coupleMinutes} onChange={(value) => saveSettings({ coupleMinutes: value })} />
                  <SettingNumber label="Desaceleração, minutos" value={state.settings.windDownMinutes} onChange={(value) => saveSettings({ windDownMinutes: value })} />
                </div>
              </section>

              <section className={CARD}>
                <h3 className="font-semibold">Duração dos treinos</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {(Object.keys(PROFILE_LABELS) as WorkoutProfile[]).map((profile) => (
                    <SettingNumber
                      key={profile}
                      label={`${PROFILE_LABELS[profile]}, minutos`}
                      value={state.settings.workoutProfiles[profile]}
                      onChange={(value) => saveSettings({ workoutProfiles: { ...state.settings.workoutProfiles, [profile]: value } })}
                    />
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">A base do Hevy mostrou média recente próxima de 92 minutos, mas o planejamento respeita o piso de duas horas informado pelo casal.</p>
              </section>

              <section className={CARD}>
                <h3 className="font-semibold">Espaço compartilhado</h3>
                <div className="mt-4 rounded-2xl bg-muted/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Código para Isabella</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <strong className="text-2xl tracking-[0.2em]">{workspace.inviteCode}</strong>
                    <Button size="sm" variant="outline" onClick={() => void copyInvite()}><Copy className="mr-2 h-4 w-4" /> Copiar</Button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                      <span>{member.display_name}</span>
                      <span className="text-xs text-muted-foreground">{member.role === "owner" ? "Administrador" : "Membro"}</span>
                    </div>
                  ))}
                </div>
                <Button className="mt-5 w-full" variant="outline" onClick={() => void loadWorkspace()}><RefreshCw className="mr-2 h-4 w-4" /> Atualizar dados</Button>
              </section>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-6 gap-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setTab(item.id)} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium ${tab === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                <Icon className="h-4 w-4" /> {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function DateSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const date = new Date(`${value}T12:00:00`);
  return (
    <div className="mb-6 flex items-center justify-between rounded-2xl border border-border/60 bg-card p-2">
      <Button variant="ghost" size="icon" onClick={() => onChange(localDate(addDays(date, -1)))}><ChevronLeft className="h-4 w-4" /></Button>
      <div className="text-center">
        <div className="font-semibold capitalize">{format(date, "EEEE", { locale: ptBR })}</div>
        <div className="text-xs text-muted-foreground">{format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</div>
      </div>
      <Button variant="ghost" size="icon" onClick={() => onChange(localDate(addDays(date, 1)))}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
}

function Metric({ icon: Icon, label, value, note, alert = false }: { icon: typeof CalendarDays; label: string; value: string; note: string; alert?: boolean }) {
  return (
    <div className={`${CARD} ${alert ? "border-destructive/30" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${alert ? "text-destructive" : "text-primary"}`} />
      </div>
      <div className={`mt-3 text-2xl font-bold ${alert ? "text-destructive" : ""}`}>{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function EventRow({ event, onUpdate, compact = false }: { event: EloEvent; onUpdate: (id: string, patch: Partial<EloEvent>) => void; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
      <button onClick={() => onUpdate(event.id, { status: event.status === "concluido" ? "planejado" : "concluido" })} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${event.status === "concluido" ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"}`}>
        {event.status === "concluido" && <Check className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-medium ${event.status === "concluido" ? "line-through opacity-60" : ""}`}>{event.title}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(event.status)}`}>{STATUS_LABELS[event.status]}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{event.start} até {addMinutesToTime(event.start, event.durationMinutes)}, {event.owner}, {durationLabel(event.durationMinutes)}</div>
      </div>
      {!compact && <Clock3 className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
}

function EventEditor({ event, onUpdate, onDelete }: { event: EloEvent; onUpdate: (id: string, patch: Partial<EloEvent>) => void; onDelete: (id: string) => void }) {
  return (
    <section className={CARD}>
      <div className="grid gap-3 md:grid-cols-[1.5fr_0.65fr_0.65fr_0.7fr]">
        <label className="text-xs font-medium text-muted-foreground">Compromisso<input className={`${INPUT} mt-1 text-foreground`} value={event.title} onChange={(e) => onUpdate(event.id, { title: e.target.value })} /></label>
        <label className="text-xs font-medium text-muted-foreground">Início<input type="time" className={`${INPUT} mt-1 text-foreground`} value={event.start} onChange={(e) => onUpdate(event.id, { start: e.target.value })} /></label>
        <label className="text-xs font-medium text-muted-foreground">Duração, min<input type="number" min="5" step="5" className={`${INPUT} mt-1 text-foreground`} value={event.durationMinutes} onChange={(e) => onUpdate(event.id, { durationMinutes: Number(e.target.value) })} /></label>
        <label className="text-xs font-medium text-muted-foreground">Responsável<select className={`${INPUT} mt-1 text-foreground`} value={event.owner} onChange={(e) => onUpdate(event.id, { owner: e.target.value as Owner })}><option>Jonathan</option><option>Isabella</option><option>Casal</option></select></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_LABELS) as EventStatus[]).map((status) => (
            <button key={status} onClick={() => onUpdate(event.id, { status })} className={`rounded-full px-3 py-1 text-xs font-medium ${event.status === status ? statusClass(status) : "bg-muted text-muted-foreground"}`}>{STATUS_LABELS[status]}</button>
          ))}
        </div>
        <button className="text-xs font-medium text-destructive" onClick={() => onDelete(event.id)}>Excluir</button>
      </div>
    </section>
  );
}

function CareerEditor({ task, onUpdate }: { task: CareerTask; onUpdate: (id: string, patch: Partial<CareerTask>) => void }) {
  return (
    <section className={CARD}>
      <div className="grid gap-3 md:grid-cols-[1.5fr_0.7fr_0.65fr_0.65fr]">
        <label className="text-xs font-medium text-muted-foreground">Atividade<input className={`${INPUT} mt-1 text-foreground`} value={task.title} onChange={(e) => onUpdate(task.id, { title: e.target.value })} /></label>
        <label className="text-xs font-medium text-muted-foreground">Pilar<select className={`${INPUT} mt-1 text-foreground`} value={task.pillar} onChange={(e) => onUpdate(task.id, { pillar: e.target.value as CareerTask["pillar"] })}><option value="curso">Curso</option><option value="candidatura">Candidatura</option><option value="networking">Networking</option><option value="portfolio">Portfólio</option><option value="entrevista">Entrevista</option></select></label>
        <label className="text-xs font-medium text-muted-foreground">Meta<input type="number" min="0" step="0.5" className={`${INPUT} mt-1 text-foreground`} value={task.target} onChange={(e) => onUpdate(task.id, { target: Number(e.target.value) })} /></label>
        <label className="text-xs font-medium text-muted-foreground">Realizado<input type="number" min="0" step="0.5" className={`${INPUT} mt-1 text-foreground`} value={task.actual} onChange={(e) => onUpdate(task.id, { actual: Number(e.target.value), status: Number(e.target.value) >= task.target ? "concluido" : "planejado" })} /></label>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Unidade: {task.unit}</span>
        <span className={`rounded-full px-2 py-1 font-medium ${statusClass(task.status)}`}>{STATUS_LABELS[task.status]}</span>
      </div>
    </section>
  );
}

function Timeline({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><span className={strong ? "font-bold text-primary" : "font-semibold"}>{value}</span></div>;
}

function SleepSummary({ log, goal, projectedBedtime, wakeTime }: { log?: SleepLog; goal: number; projectedBedtime: string; wakeTime: string }) {
  const bedtime = log?.bedtime ?? projectedBedtime;
  const wake = log?.wakeTime ?? wakeTime;
  const hours = minutesBetween(bedtime, wake) / 60;
  const deficit = goal - hours;
  return (
    <section className={CARD}>
      <h3 className="font-semibold">Resumo da recuperação</h3>
      <div className={`mt-5 rounded-2xl p-5 ${hours >= goal ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
        <div className={`text-4xl font-bold ${hours >= goal ? "text-emerald-700" : "text-destructive"}`}>{hours.toFixed(1)}h</div>
        <p className="mt-1 text-sm text-muted-foreground">Sono calculado entre {bedtime} e {wake}.</p>
      </div>
      <div className="mt-5 space-y-3 text-sm">
        <Timeline label="Meta" value={`${goal}h`} />
        <Timeline label="Saldo" value={deficit > 0 ? `Faltam ${deficit.toFixed(1)}h` : `Superávit de ${Math.abs(deficit).toFixed(1)}h`} strong />
        <Timeline label="Qualidade" value={`${log?.quality ?? 3}/5`} />
      </div>
    </section>
  );
}

function SettingTime({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-medium">{label}<input type="time" className={`${INPUT} mt-1`} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function SettingNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="text-sm font-medium">{label}<input type="number" min="0" step="1" className={`${INPUT} mt-1`} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
