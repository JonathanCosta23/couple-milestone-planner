import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { PlanConfig, MonthRecord, MonthDeposit, MonthStatus, EMPTY_DEPOSIT, formatBRL, generateMonthKeys, monthKeyToLabel, getCurrentMonthKey } from "@/lib/types";
import { getMonthStatus, calculateStreak, calculateCompletionRate, calculateYearCompletion } from "@/lib/calculator";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2, Circle, AlertCircle, Flame, Percent, ChevronLeft, ChevronRight,
  Filter, StickyNote, Wand2, ChevronDown, ChevronUp, Copy,
} from "lucide-react";
import { toast } from "sonner";

interface TrackerProps {
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  onUpdateMonth: (monthKey: string, contributorIndex: number, deposit: MonthDeposit, notes?: string) => void;
  onUpdateNotes: (monthKey: string, notes: string) => void;
  onToggleCompleted: (monthKey: string) => void;
  onGenerateAutoPlan: () => void;
}

// Progress Ring SVG component
function ProgressRing({ value, size = 80, stroke = 6, label }: { value: number; size?: number; stroke?: number; label: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - value * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="hsl(var(--primary))" strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-sm font-bold">{(value * 100).toFixed(0)}%</span>
        <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: MonthStatus }) {
  const cfg = {
    pending: { icon: Circle, text: "Pendente", cls: "bg-muted text-muted-foreground" },
    partial: { icon: AlertCircle, text: "Parcial", cls: "bg-warning/15 text-warning border-warning/30" },
    completed: { icon: CheckCircle2, text: "Concluído", cls: "bg-primary/15 text-primary border-primary/30" },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.text}
    </span>
  );
}

const BATCH_SIZE = 12;

export function MonthlyTracker({
  config, monthRecords, startDate,
  onUpdateMonth, onUpdateNotes, onToggleCompleted, onGenerateAutoPlan,
}: TrackerProps) {
  const currentMonth = getCurrentMonthKey();
  const allKeys = useMemo(() => generateMonthKeys(startDate, config.years * 12), [startDate, config.years]);

  // Year navigation
  const years = useMemo(() => {
    const s = new Set(allKeys.map((k) => k.split("-")[0]));
    return Array.from(s).sort();
  }, [allKeys]);
  const currentYearIdx = years.findIndex((y) => currentMonth.startsWith(y));
  const [yearIdx, setYearIdx] = useState(Math.max(0, currentYearIdx));
  const selectedYear = years[yearIdx] || years[0];

  const [filterMode, setFilterMode] = useState<"all" | "pending">("all");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(currentMonth);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // Reset visible count when year changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [selectedYear, filterMode]);

  const monthsInYear = useMemo(() => allKeys.filter((k) => k.startsWith(selectedYear)), [allKeys, selectedYear]);
  const filteredMonths = useMemo(() => {
    if (filterMode === "pending") {
      return monthsInYear.filter((k) => getMonthStatus(config, monthRecords, k) !== "completed");
    }
    return monthsInYear;
  }, [monthsInYear, filterMode, config, monthRecords]);

  const visibleMonths = filteredMonths.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMonths.length;

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredMonths.length));
        }
      },
      { threshold: 0.1 }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, filteredMonths.length]);

  // Stats
  const streak = useMemo(() => calculateStreak(config, monthRecords, startDate), [config, monthRecords, startDate]);
  const completion12 = useMemo(() => calculateCompletionRate(config, monthRecords, startDate), [config, monthRecords, startDate]);
  const yearCompletion = useMemo(() => calculateYearCompletion(config, monthRecords, selectedYear), [config, monthRecords, selectedYear]);

  const hasAutoPlan = monthRecords.length >= allKeys.length * 0.9;

  function getRecord(key: string): MonthRecord | undefined {
    return monthRecords.find((r) => r.monthKey === key);
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        <Card className="glass-card p-3 flex items-center gap-2">
          <div className="flex -space-x-0.5">
            {Array.from({ length: Math.min(Math.max(1, streak), 3) }).map((_, i) => (
              <span key={i} className="text-base" style={{ opacity: streak > 0 ? 1 : 0.3 }}>🔥</span>
            ))}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sequência</p>
            <p className="text-lg font-bold leading-tight">{streak}</p>
          </div>
        </Card>
        <Card className="glass-card p-3 flex items-center gap-3">
          <Percent className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">12 meses</p>
            <p className="text-lg font-bold leading-tight">{(completion12 * 100).toFixed(0)}%</p>
          </div>
        </Card>
        <Card className="glass-card p-3 flex items-center justify-center">
          <ProgressRing value={yearCompletion} size={64} stroke={5} label={selectedYear} />
        </Card>
      </div>

      {/* Auto-generate button */}
      {!hasAutoPlan && (
        <Button
          variant="outline"
          className="w-full border-dashed border-primary/40 text-primary hover:bg-primary/10"
          onClick={() => {
            onGenerateAutoPlan();
            toast.success("Plano 2026–2046 gerado! Todos os meses preenchidos com aportes planejados.");
          }}
        >
          <Wand2 className="w-4 h-4 mr-2" />
          Gerar plano automático 2026–2046
        </Button>
      )}

      {/* Year nav + filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={yearIdx === 0} onClick={() => setYearIdx(yearIdx - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-lg min-w-[4ch] text-center">{selectedYear}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={yearIdx >= years.length - 1} onClick={() => setYearIdx(yearIdx + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant={filterMode === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterMode(filterMode === "all" ? "pending" : "all")}
          className="text-xs h-8"
        >
          <Filter className="w-3 h-3 mr-1" />
          {filterMode === "pending" ? "Pendentes" : "Todos"}
        </Button>
      </div>

      {/* Month cards — infinite scroll */}
      <div className="space-y-3">
        {visibleMonths.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {filterMode === "pending" ? "Nenhum mês pendente neste ano 🎉" : "Nenhum mês neste ano."}
          </p>
        )}

        {visibleMonths.map((key) => (
          <MonthCard
            key={key}
            monthKey={key}
            config={config}
            record={getRecord(key)}
            status={getMonthStatus(config, monthRecords, key)}
            isCurrent={key === currentMonth}
            isFuture={key > currentMonth}
            isExpanded={expandedMonth === key}
            onToggleExpand={() => setExpandedMonth(expandedMonth === key ? null : key)}
            onUpdateDeposit={onUpdateMonth}
            onUpdateNotes={onUpdateNotes}
            onToggleCompleted={onToggleCompleted}
          />
        ))}

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

// Individual month card
interface MonthCardProps {
  monthKey: string;
  config: PlanConfig;
  record: MonthRecord | undefined;
  status: MonthStatus;
  isCurrent: boolean;
  isFuture: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdateDeposit: (monthKey: string, idx: number, deposit: MonthDeposit, notes?: string) => void;
  onUpdateNotes: (monthKey: string, notes: string) => void;
  onToggleCompleted: (monthKey: string) => void;
}

function MonthCard({
  monthKey, config, record, status, isCurrent, isFuture, isExpanded,
  onToggleExpand, onUpdateDeposit, onUpdateNotes, onToggleCompleted,
}: MonthCardProps) {
  const totalPlanned = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const totalActual = config.contributors.reduce((s, c, i) => {
    const d = record?.deposits[i] || EMPTY_DEPOSIT;
    return s + d.actualSelic + d.actualCDB;
  }, 0);

  return (
    <Card
      className={`glass-card overflow-hidden transition-all ${
        isCurrent ? "ring-2 ring-primary/50" : ""
      } ${status === "completed" ? "border-primary/30" : ""}`}
    >
      {/* Card header */}
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/10 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col items-center min-w-[44px]">
            <span className="text-lg font-bold leading-none">{monthKey.split("-")[1]}</span>
            <span className="text-[10px] text-muted-foreground">{monthKey.split("-")[0]}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{monthKeyToLabel(monthKey)}</span>
              {isCurrent && (
                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">ATUAL</span>
              )}
              {isFuture && (
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">FUTURO</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatBRL(totalActual)} / {formatBRL(totalPlanned)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded card body */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4 animate-fade-in-up">
          {/* Contributor sections */}
          {config.contributors.map((c, cIdx) => {
            const dep = record?.deposits[cIdx] || EMPTY_DEPOSIT;
            const hasSelic = c.plannedSelic > 0;
            const hasCDB = c.plannedCDB > 0;
            const hasName = c.name.trim().length > 0;
            if (!hasSelic && !hasCDB && !hasName) return null;
            if (!hasSelic && !hasCDB) return null;

            const dotColors = ["bg-primary", "bg-accent", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

            return (
              <div key={cIdx} className="rounded-xl bg-muted/30 p-3 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${dotColors[cIdx % dotColors.length]}`} />
                  {c.name || `Pessoa ${cIdx + 1}`}
                </p>

                {/* Planned row */}
                <div className="grid grid-cols-2 gap-2">
                  {hasSelic && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Selic planejado</span>
                      <p className="font-medium">{formatBRL(c.plannedSelic)}</p>
                    </div>
                  )}
                  {hasCDB && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">CDB planejado</span>
                      <p className="font-medium">{formatBRL(c.plannedCDB)}</p>
                    </div>
                  )}
                </div>

                {/* Actual inputs */}
                <div className="grid grid-cols-2 gap-2">
                  {hasSelic && (
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Selic real</Label>
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={dep.actualSelic || ""}
                        placeholder="0"
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          onUpdateDeposit(monthKey, cIdx, { ...dep, actualSelic: val });
                        }}
                        className={`text-right text-sm h-9 ${
                          dep.actualSelic >= c.plannedSelic && dep.actualSelic > 0 ? "border-primary/50 bg-primary/5" : ""
                        }`}
                      />
                    </div>
                  )}
                  {hasCDB && (
                    <div>
                      <Label className="text-[11px] text-muted-foreground">CDB real</Label>
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={dep.actualCDB || ""}
                        placeholder="0"
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          onUpdateDeposit(monthKey, cIdx, { ...dep, actualCDB: val });
                        }}
                        className={`text-right text-sm h-9 ${
                          dep.actualCDB >= c.plannedCDB && dep.actualCDB > 0 ? "border-primary/50 bg-primary/5" : ""
                        }`}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Completed toggle + Copy */}
          <div className="flex items-center justify-between py-2 px-1">
            <Label htmlFor={`toggle-${monthKey}`} className="text-sm font-medium cursor-pointer flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${record?.completed ? "text-primary" : "text-muted-foreground"}`} />
              Mês concluído
            </Label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  const lines = config.contributors
                    .filter((c) => c.plannedSelic > 0 || c.plannedCDB > 0)
                    .map((c) => {
                      const parts: string[] = [];
                      if (c.plannedSelic > 0) parts.push(`Selic: ${formatBRL(c.plannedSelic)}`);
                      if (c.plannedCDB > 0) parts.push(`CDB: ${formatBRL(c.plannedCDB)}`);
                      return `${c.name}: ${parts.join(" | ")}`;
                    });
                  navigator.clipboard.writeText(lines.join("\n"));
                  toast.success("Valores copiados!");
                }}
              >
                <Copy className="w-3 h-3 mr-1" /> Copiar
              </Button>
              <Switch
                id={`toggle-${monthKey}`}
                checked={!!record?.completed}
                onCheckedChange={() => onToggleCompleted(monthKey)}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <StickyNote className="w-3 h-3" /> Notas
            </Label>
            <Textarea
              placeholder="Observações do mês..."
              value={record?.notes || ""}
              onChange={(e) => onUpdateNotes(monthKey, e.target.value)}
              className="text-sm min-h-[50px] mt-1"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
