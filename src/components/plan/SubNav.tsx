import { Button } from "@/components/ui/button";

interface SubNavItem {
  id: string;
  label: string;
  icon?: string;
}

interface Props {
  items: SubNavItem[];
  active: string;
  onChange: (id: string) => void;
}

export function SubNav({ items, active, onChange }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1 pr-4">
      {items.map(item => (
        <Button
          key={item.id}
          size="sm"
          variant={active === item.id ? "default" : "outline"}
          className={`text-xs shrink-0 h-8 rounded-full px-3.5 ${
            active === item.id ? "" : "bg-card/60"
          }`}
          onClick={() => onChange(item.id)}
        >
          {item.icon && <span className="mr-1">{item.icon}</span>}
          {item.label}
        </Button>
      ))}
    </div>
  );
}
