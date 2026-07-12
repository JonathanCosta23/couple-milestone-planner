import type { EducationSource } from "@/features/education/types";

export function SourceList({ sources, sourceDate }: { sources: EducationSource[]; sourceDate?: string | null }) {
  if (!sources || sources.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem fontes registradas nesta versão.</p>;
  }
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Fontes</p>
      <ul className="text-xs text-muted-foreground space-y-1">
        {sources.map((s, i) => (
          <li key={i}>
            {s.source_url ? (
              <a href={s.source_url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">
                {s.source_name}
              </a>
            ) : (
              <span>{s.source_name}</span>
            )}
            {s.publication_date ? <span> · {s.publication_date}</span> : null}
            {s.reporting_period ? <span> · {s.reporting_period}</span> : null}
          </li>
        ))}
      </ul>
      {sourceDate ? <p className="text-[10px] text-muted-foreground">Última referência: {sourceDate}</p> : null}
    </div>
  );
}