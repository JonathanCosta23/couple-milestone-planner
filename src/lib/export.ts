import { PlanConfig, MonthRecord, ProjectionRow, generateMonthKeys, monthKeyToLabel, formatBRL, EMPTY_DEPOSIT } from "./types";

function downloadCSV(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportProjectionCSV(rows: ProjectionRow[]) {
  const header = "Mês,Data,Saldo Selic,Saldo CDB,Saldo Total,Total Depositado,Total Juros,Depósito no Mês";
  const lines = rows.map((r) =>
    [r.monthIndex, monthKeyToLabel(r.date), formatBRL(r.selicBalance), formatBRL(r.cdbBalance), formatBRL(r.totalBalance), formatBRL(r.totalDeposited), formatBRL(r.totalInterest), formatBRL(r.depositThisMonth)].join(",")
  );
  downloadCSV("projecao-plano-milhao.csv", [header, ...lines].join("\n"));
}

export function exportTrackerCSV(config: PlanConfig, monthRecords: MonthRecord[], startDate: string) {
  const [c0, c1] = config.contributors;
  const header = [
    "Mês",
    `Selic Plan ${c0.name}`, `Selic Real ${c0.name}`,
    `CDB Plan ${c0.name}`, `CDB Real ${c0.name}`,
    `Selic Plan ${c1.name}`, `Selic Real ${c1.name}`,
    `CDB Plan ${c1.name}`, `CDB Real ${c1.name}`,
    "Concluído", "Notas"
  ].join(",");

  const allKeys = generateMonthKeys(startDate, config.years * 12);
  const lines = allKeys.map((key) => {
    const rec = monthRecords.find((r) => r.monthKey === key);
    const d0 = rec?.deposits[0] || EMPTY_DEPOSIT;
    const d1 = rec?.deposits[1] || EMPTY_DEPOSIT;
    const complete = rec ? config.contributors.every((c, i) => {
      const d = rec.deposits[i] || EMPTY_DEPOSIT;
      return (c.plannedSelic <= 0 || d.actualSelic >= c.plannedSelic) && (c.plannedCDB <= 0 || d.actualCDB >= c.plannedCDB);
    }) : false;
    return [
      monthKeyToLabel(key),
      c0.plannedSelic, d0.actualSelic,
      c0.plannedCDB, d0.actualCDB,
      c1.plannedSelic, d1.actualSelic,
      c1.plannedCDB, d1.actualCDB,
      complete ? "Sim" : "Não",
      `"${rec?.notes || ""}"`
    ].join(",");
  });
  downloadCSV("acompanhamento-plano-milhao.csv", [header, ...lines].join("\n"));
}
