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
    <div className="-mx-4 sm:-mx-6 lg:mx-0 relative">
      {/* Fade hint on right edge — mobile only */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-l from-background to-transparent lg:hidden" />
      <div className="flex gap-1.5 lg:gap-2 overflow-x-auto lg:overflow-x-visible pb-2 scrollbar-hide snap-scroll-x px-4 sm:px-6 lg:px-0 lg:flex-wrap">
        {items.map(item => (
          <Button
            key={item.id}
            size="sm"
            variant={active === item.id ? "default" : "outline"}
            className={`text-xs lg:text-sm shrink-0 lg:shrink h-9 lg:h-10 rounded-full px-3.5 lg:px-5 touch-target transition-all ${
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
        {/* Spacer to prevent last item clipping on mobile */}
        <div className="shrink-0 w-2 lg:hidden" aria-hidden="true" />
      </div>
    </div>
  );
}
