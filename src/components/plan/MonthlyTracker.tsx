import { useState, useMemo } from "react";
import { PlanConfig, MonthRecord, MonthDeposit, EMPTY_DEPOSIT, formatBRL, generateMonthKeys, monthKeyToLabel, getCurrentMonthKey } from "@/lib/types";
import { isMonthComplete, calculateStreak, calculateCompletionRate } from "@/lib/calculator";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Circle, Flame, Percent, ChevronLeft, ChevronRight, Filter, StickyNote } from "lucide-react";

interface TrackerProps {
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  onUpdateMonth: (monthKey: string, contributorIndex: 0 | 1, deposit: MonthDeposit, notes?: string) => void;
  onUpdateNotes: (monthKey: string, notes: string) => void;
}

export function MonthlyTracker({ config, monthRecords, startDate, onUpdateMonth, onUpdateNotes }: TrackerProps) {
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

  const [filterPending, setFilterPending] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(currentMonth);

  const monthsInYear = allKeys.filter((k) => k.startsWith(selectedYear));
  const filteredMonths = filterPending
    ? monthsInYear.filter((k) => !isMonthComplete(config, monthRecords, k) && k <= currentMonth)
    : monthsInYear;

  const streak = useMemo(() => calculateStreak(config, monthRecords, startDate), [config, monthRecords, startDate]);
  const completion = useMemo(() => calculateCompletionRate(config, monthRecords, startDate), [config, monthRecords, startDate]);

  function getRecord(key: string): MonthRecord | undefined {
    return monthRecords.find((r) => r.monthKey === key);
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="glass-card p-4 flex items-center gap-3">
          <Flame className="w-6 h-6 text-warning" />
          <div>
            <p className="text-xs text-muted-foreground">Sequência</p>
            <p className="text-xl font-bold">{streak} {streak === 1 ? "mês" : "meses"}</p>
          </div>
        </Card>
        <Card className="glass-card p-4 flex items-center gap-3">
          <Percent className="w-6 h-6 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Conclusão (12m)</p>
            <p className="text-xl font-bold">{(completion * 100).toFixed(0)}%</p>
          </div>
        </Card>
      </div>

      {/* Year nav + filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" disabled={yearIdx === 0} onClick={() => setYearIdx(yearIdx - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-lg min-w-[4ch] text-center">{selectedYear}</span>
          <Button variant="ghost" size="icon" disabled={yearIdx >= years.length - 1} onClick={() => setYearIdx(yearIdx + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant={filterPending ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterPending(!filterPending)}
          className="text-xs"
        >
          <Filter className="w-3 h-3 mr-1" />
          {filterPending ? "Pendentes" : "Todos"}
        </Button>
      </div>

      {/* Month cards */}
      <div className="space-y-3">
        {filteredMonths.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum mês pendente neste ano 🎉</p>
        )}
        {filteredMonths.map((key) => {
          const record = getRecord(key);
          const complete = isMonthComplete(config, monthRecords, key);
          const isCurrent = key === currentMonth;
          const isExpanded = expandedMonth === key;
          const isFuture = key > currentMonth;

          return (
            <Card
              key={key}
              className={`glass-card overflow-hidden transition-all ${isCurrent ? "ring-2 ring-primary/50" : ""} ${
                complete ? "border-primary/30" : ""
              }`}
            >
              {/* Header */}
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
                onClick={() => setExpandedMonth(isExpanded ? null : key)}
              >
                <div className="flex items-center gap-3">
                  {complete ? (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                  <div>
                    <span className="font-semibold">{monthKeyToLabel(key)}</span>
                    {isCurrent && (
                      <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">atual</span>
                    )}
                    {isFuture && (
                      <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">futuro</span>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {record && !complete && "Em andamento"}
                  {complete && <span className="text-primary font-medium">Concluído ✓</span>}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4 animate-fade-in-up">
                  {config.contributors.map((c, cIdx) => {
                    const dep = record?.deposits[cIdx as 0 | 1] || EMPTY_DEPOSIT;
                    const selicOk = c.plannedSelic <= 0 || dep.actualSelic >= c.plannedSelic;
                    const cdbOk = c.plannedCDB <= 0 || dep.actualCDB >= c.plannedCDB;

                    return (
                      <div key={cIdx} className="space-y-2">
                        <p className="text-sm font-medium">{c.name}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {c.plannedSelic > 0 && (
                            <div>
                              <Label className="text-xs">
                                Selic{" "}
                                <span className="text-muted-foreground">(plan: {formatBRL(c.plannedSelic)})</span>
                                {selicOk && dep.actualSelic > 0 && " ✓"}
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                step={100}
                                value={dep.actualSelic || ""}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  onUpdateMonth(key, cIdx as 0 | 1, { ...dep, actualSelic: val });
                                }}
                                className={`text-right text-sm ${selicOk && dep.actualSelic > 0 ? "border-primary/50" : ""}`}
                              />
                            </div>
                          )}
                          {c.plannedCDB > 0 && (
                            <div>
                              <Label className="text-xs">
                                CDB{" "}
                                <span className="text-muted-foreground">(plan: {formatBRL(c.plannedCDB)})</span>
                                {cdbOk && dep.actualCDB > 0 && " ✓"}
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                step={100}
                                value={dep.actualCDB || ""}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  onUpdateMonth(key, cIdx as 0 | 1, { ...dep, actualCDB: val });
                                }}
                                className={`text-right text-sm ${cdbOk && dep.actualCDB > 0 ? "border-primary/50" : ""}`}
                              />
                            </div>
                          )}
                          {c.plannedSelic <= 0 && c.plannedCDB <= 0 && (
                            <p className="text-xs text-muted-foreground col-span-2">Sem aporte planejado</p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Notes */}
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <StickyNote className="w-3 h-3" /> Notas
                    </Label>
                    <Textarea
                      placeholder="Observações do mês..."
                      value={record?.notes || ""}
                      onChange={(e) => onUpdateNotes(key, e.target.value)}
                      className="text-sm min-h-[60px]"
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
