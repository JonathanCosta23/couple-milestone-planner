import { useState, useMemo } from "react";
import { PlanConfig, MonthRecord, ProjectionRow, formatBRL, formatPercent, monthKeyToLabel, MILESTONES } from "@/lib/types";
import { generateProjection, getReachedMilestones } from "@/lib/calculator";
import { exportProjectionCSV, exportTrackerCSV } from "@/lib/export";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Calendar, Target, Download, ToggleLeft, ToggleRight, Trophy } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";

interface DashboardProps {
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color: string }) {
  return (
    <Card className="glass-card p-4 lg:p-5">
      <div className="flex items-start gap-3">
        <div className={`p-2 lg:p-2.5 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
          <p className="text-lg lg:text-xl font-bold">{value}</p>
          {sub && <p className="text-xs sm:text-sm text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

export function Dashboard({ config, monthRecords, startDate }: DashboardProps) {
  const [showActual, setShowActual] = useState(false);

  const planned = useMemo(() => generateProjection(config, "planned", monthRecords, startDate), [config, monthRecords, startDate]);
  const actual = useMemo(() => generateProjection(config, "actual", monthRecords, startDate), [config, monthRecords, startDate]);

  const projection = showActual ? actual : planned;
  const lastRow = projection[projection.length - 1];
  const totalMonthly = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const reachedPlanned = getReachedMilestones(planned, MILESTONES);
  const reachedActual = getReachedMilestones(actual, MILESTONES);

  const currentActualIdx = monthRecords.length > 0 ? Math.min(monthRecords.length, actual.length) - 1 : -1;
  const currentBalance = currentActualIdx >= 0 ? actual[currentActualIdx].totalBalance : config.initialAmount;

  const yearsToGoal = lastRow && lastRow.totalBalance >= config.targetAmount
    ? Math.ceil(projection.findIndex((r) => r.totalBalance >= config.targetAmount) / 12)
    : config.years;

  const sampleRate = planned.length > 120 ? Math.ceil(planned.length / 60) : 1;
  const chartData = useMemo(() => {
    const result: any[] = [];
    for (let i = 0; i < planned.length; i += sampleRate) {
      result.push({
        name: monthKeyToLabel(planned[i].date),
        Planejado: Math.round(planned[i].totalBalance),
        Real: Math.round(actual[i].totalBalance),
      });
    }
    return result;
  }, [planned, actual, sampleRate]);

  const tableRows = useMemo(() => {
    return projection.filter((_, i) => (i + 1) % 12 === 0 || i === projection.length - 1);
  }, [projection]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          icon={DollarSign}
          label="Onde você está"
          value={formatBRL(currentBalance)}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Aporte mensal"
          value={formatBRL(totalMonthly)}
          sub={config.contributors.filter(c => c.plannedSelic > 0 || c.plannedCDB > 0).map(c => `${c.name || "Pessoa"}: ${formatBRL(c.plannedSelic + c.plannedCDB)}`).join(" | ")}
          color="bg-accent/10 text-accent"
        />
        <StatCard
          icon={Calendar}
          label="Tempo estimado"
          value={`${yearsToGoal} anos`}
          sub={`${yearsToGoal * 12} meses para a meta`}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          icon={Target}
          label="Sua meta"
          value={formatBRL(config.targetAmount)}
          sub={lastRow ? `Projeção final: ${formatBRL(lastRow.totalBalance)}` : undefined}
          color="bg-accent/10 text-accent"
        />
      </div>

      {/* Milestones badges */}
      {reachedPlanned.length > 0 && (
        <div className="flex flex-wrap gap-2 lg:gap-3">
          {MILESTONES.map((m) => {
            const reachedP = reachedPlanned.includes(m);
            const reachedA = reachedActual.includes(m);
            return (
              <div
                key={m}
                className={`inline-flex items-center gap-1.5 px-3 lg:px-4 py-1 lg:py-1.5 rounded-full text-xs lg:text-sm font-semibold border ${
                  reachedA
                    ? "bg-primary/20 border-primary/30 text-primary"
                    : reachedP
                    ? "bg-accent/10 border-accent/20 text-accent"
                    : "bg-muted border-border text-muted-foreground"
                }`}
              >
                <Trophy className="w-3 h-3 lg:w-4 lg:h-4" />
                {formatBRL(m)}
                {reachedA && " ✓"}
              </div>
            );
          })}
        </div>
      )}

      {/* Chart */}
      <Card className="glass-card p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold lg:text-lg">Como seu patrimônio cresce</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowActual(!showActual)}
            className="text-xs lg:text-sm"
          >
            {showActual ? <ToggleRight className="w-4 h-4 mr-1" /> : <ToggleLeft className="w-4 h-4 mr-1" />}
            {showActual ? "Valores reais" : "Valores planejados"}
          </Button>
        </div>
        <div className="h-64 sm:h-72 md:h-80 lg:h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradPlanned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152, 69%, 40%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(152, 69%, 40%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 18%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={30} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <RTooltip
                contentStyle={{ background: "hsl(224, 28%, 11%)", border: "1px solid hsl(220, 20%, 18%)", borderRadius: "8px" }}
                formatter={(v: number) => formatBRL(v)}
              />
              <Legend />
              <Area type="monotone" dataKey="Planejado" stroke="hsl(199, 89%, 48%)" fill="url(#gradPlanned)" strokeWidth={2} />
              <Area type="monotone" dataKey="Real" stroke="hsl(152, 69%, 40%)" fill="url(#gradActual)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Table */}
      <Card className="glass-card overflow-hidden">
        <div className="p-4 lg:p-5 border-b border-border/50">
          <h3 className="font-semibold lg:text-lg">Evolução ano a ano</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm lg:text-base">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left p-3 lg:p-4 whitespace-nowrap">Período</th>
                <th className="text-right p-3 lg:p-4 whitespace-nowrap">Selic</th>
                <th className="text-right p-3 lg:p-4 whitespace-nowrap">CDB</th>
                <th className="text-right p-3 lg:p-4 whitespace-nowrap">Total</th>
                <th className="text-right p-3 lg:p-4 whitespace-nowrap">Juros acumulados</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.monthIndex} className="border-t border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="p-3 lg:p-4 text-muted-foreground whitespace-nowrap">{monthKeyToLabel(row.date)}</td>
                  <td className="p-3 lg:p-4 text-right whitespace-nowrap">{formatBRL(row.selicBalance)}</td>
                  <td className="p-3 lg:p-4 text-right whitespace-nowrap">{formatBRL(row.cdbBalance)}</td>
                  <td className="p-3 lg:p-4 text-right font-semibold whitespace-nowrap">{formatBRL(row.totalBalance)}</td>
                  <td className="p-3 lg:p-4 text-right text-primary whitespace-nowrap">{formatBRL(row.totalInterest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Exports */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" className="lg:text-sm" onClick={() => exportProjectionCSV(projection)}>
          <Download className="w-4 h-4 mr-1" /> Baixar projeção (CSV)
        </Button>
        <Button variant="outline" size="sm" className="lg:text-sm" onClick={() => exportTrackerCSV(config, monthRecords, startDate)}>
          <Download className="w-4 h-4 mr-1" /> Baixar acompanhamento (CSV)
        </Button>
      </div>
    </div>
  );
}
