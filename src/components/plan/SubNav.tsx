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
    <div className="-mx-4 relative">
      {/* Fade hint on right edge */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-l from-background to-transparent" />
      <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide snap-scroll-x px-4">
        {items.map(item => (
          <Button
            key={item.id}
            size="sm"
            variant={active === item.id ? "default" : "outline"}
            className={`text-xs shrink-0 h-9 rounded-full px-3.5 touch-target transition-all ${
              active === item.id
                ? "shadow-sm"
                : "bg-card/60 hover:bg-card"
            }`}
            onClick={() => onChange(item.id)}
          >
            {item.icon && <span className="mr-1 text-sm">{item.icon}</span>}
            {item.label}
          </Button>
        ))}
        {/* Spacer to prevent last item clipping */}
        <div className="shrink-0 w-2" aria-hidden="true" />
      </div>
    </div>
  );
}
