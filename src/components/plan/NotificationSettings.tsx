import { PlanData } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, CalendarCheck } from "lucide-react";

interface NotificationSettingsProps {
  settings: PlanData["notificationSettings"];
  onUpdate: (settings: PlanData["notificationSettings"]) => void;
}

export function NotificationSettings({ settings, onUpdate }: NotificationSettingsProps) {
  const s = settings || { monthlyReminder: true, annualReview: false };

  return (
    <Card className="glass-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">Lembretes (em breve)</h3>
      </div>
      <p className="text-xs text-muted-foreground">Configure lembretes para manter o hábito de investir. Em breve disponível com notificações push.</p>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="monthly" className="text-sm flex items-center gap-2 cursor-pointer">
            <Bell className="w-4 h-4 text-muted-foreground" />
            Lembrete mensal de investimento
          </Label>
          <Switch id="monthly" checked={s.monthlyReminder} onCheckedChange={(v) => onUpdate({ ...s, monthlyReminder: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="annual" className="text-sm flex items-center gap-2 cursor-pointer">
            <CalendarCheck className="w-4 h-4 text-muted-foreground" />
            Revisão anual do plano
          </Label>
          <Switch id="annual" checked={s.annualReview} onCheckedChange={(v) => onUpdate({ ...s, annualReview: v })} />
        </div>
      </div>
    </Card>
  );
}
