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
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-scroll-x -mx-1 px-1 pr-6">
      {items.map(item => (
        <Button
          key={item.id}
          size="sm"
          variant={active === item.id ? "default" : "outline"}
          className={`text-xs shrink-0 h-9 rounded-full px-4 touch-target transition-all ${
            active === item.id 
              ? "shadow-sm" 
              : "bg-card/60 hover:bg-card"
          }`}
          onClick={() => onChange(item.id)}
        >
          {item.icon && <span className="mr-1.5 text-sm">{item.icon}</span>}
          {item.label}
        </Button>
      ))}
    </div>
  );
}
