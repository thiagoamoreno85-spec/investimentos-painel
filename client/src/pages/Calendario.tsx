import DashboardLayout from "@/components/DashboardLayout";
import { EventCalendar } from "@/components/EventCalendar";

export default function Calendario() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Calendário de Eventos</h2>
          <p className="text-muted-foreground mt-1">
            Acompanhe datas de earnings, dividendos e eventos corporativos dos seus ativos.
          </p>
        </div>

        <EventCalendar />
      </div>
    </DashboardLayout>
  );
}
