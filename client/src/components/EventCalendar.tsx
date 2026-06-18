import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Plus, Calendar, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Event {
  id: number;
  ticker: string;
  eventType: string;
  eventDate: Date;
  description?: string;
  expectedValue?: string;
  status: string;
}

export function EventCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [eventType, setEventType] = useState("earnings");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [expectedValue, setExpectedValue] = useState("");

  const utils = trpc.useUtils();
  const { data: assets } = trpc.portfolio.getAssets.useQuery();
  const { data: events = [] } = trpc.portfolio.getEvents.useQuery();
  const createEventMutation = trpc.portfolio.createEvent.useMutation({
    onSuccess: () => {
      toast.success("Evento criado com sucesso!");
      utils.portfolio.getEvents.invalidate();
      setShowForm(false);
      setDescription("");
      setExpectedValue("");
      setEventDate(new Date().toISOString().split("T")[0]);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleCreateEvent = async () => {
    if (!selectedAssetId) {
      toast.error("Selecione um ativo");
      return;
    }

    const asset = assets?.find((a) => a.id === selectedAssetId);
    if (!asset) return;

    await createEventMutation.mutateAsync({
      assetId: selectedAssetId,
      ticker: asset.ticker,
      eventType: eventType as any,
      description: description || undefined,
      eventDate: new Date(eventDate),
      expectedValue: expectedValue || undefined,
    });
  };

  // Gerar dias do mês com offset da semana
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Calcular offset do primeiro dia da semana (0 = domingo)
  const firstDayOfWeek = monthStart.getDay();
  
  // Gerar array com dias vazios no início e dias do mês
  const daysWithPadding = [
    ...Array(firstDayOfWeek).fill(null),
    ...daysInMonth,
  ];
  
  // Completar a última semana com dias vazios
  const totalCells = Math.ceil(daysWithPadding.length / 7) * 7;
  const calendarDays = [
    ...daysWithPadding,
    ...Array(totalCells - daysWithPadding.length).fill(null),
  ];

  // Agrupar eventos por dia
  const eventsByDay: Record<string, Event[]> = {};
  events.forEach((event: any) => {
    const dayKey = format(new Date(event.eventDate), "yyyy-MM-dd");
    if (!eventsByDay[dayKey]) eventsByDay[dayKey] = [];
    eventsByDay[dayKey].push(event);
  });

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "earnings":
        return "bg-blue-500/20 text-blue-400 border-blue-500/50";
      case "dividendo":
        return "bg-green-500/20 text-green-400 border-green-500/50";
      case "split":
        return "bg-purple-500/20 text-purple-400 border-purple-500/50";
      case "ipo":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/50";
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "earnings":
        return "📊";
      case "dividendo":
        return "💰";
      case "split":
        return "📈";
      case "ipo":
        return "🚀";
      default:
        return "📅";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header com navegação */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Calendário de Eventos</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => setShowForm(!showForm)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Evento
          </Button>
        </CardHeader>
      </Card>

      {/* Formulário de criação */}
      {showForm && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Ativo</Label>
                <Select
                  value={selectedAssetId?.toString() || ""}
                  onValueChange={(v) => setSelectedAssetId(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um ativo" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets?.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id.toString()}>
                        {asset.ticker} - {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tipo de Evento</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earnings">Earnings</SelectItem>
                    <SelectItem value="dividendo">Dividendo</SelectItem>
                    <SelectItem value="split">Split</SelectItem>
                    <SelectItem value="ipo">IPO</SelectItem>
                    <SelectItem value="desdobramento">Desdobramento</SelectItem>
                    <SelectItem value="agrupamento">Agrupamento</SelectItem>
                    <SelectItem value="evento_corporativo">Evento Corporativo</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data do Evento</Label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>

              <div>
                <Label>Valor Esperado (opcional)</Label>
                <Input
                  type="text"
                  placeholder="Ex: 1.50"
                  value={expectedValue}
                  onChange={(e) => setExpectedValue(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  type="text"
                  placeholder="Detalhes adicionais..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateEvent}
                disabled={createEventMutation.isPending}
              >
                {createEventMutation.isPending ? "Criando..." : "Criar Evento"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendário */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Cabeçalho da semana */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Dias do mês */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, idx) => {
              if (!day) {
                return (
                  <div key={`empty-${idx}`} className="min-h-24 p-2 rounded-lg bg-muted/20 border border-border/20" />
                );
              }
              const dayKey = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDay[dayKey] || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={dayKey}
                  className={`min-h-24 p-2 rounded-lg border transition-colors ${
                    isCurrentMonth
                      ? isToday
                        ? "bg-primary/10 border-primary"
                        : "bg-background border-border/50"
                      : "bg-muted/30 border-border/30"
                  }`}
                >
                  <div className={`text-sm font-semibold mb-1 ${!isCurrentMonth ? "text-muted-foreground" : ""}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs px-2 py-1 rounded border ${getEventColor(event.eventType)} truncate`}
                        title={`${event.ticker} - ${event.description || event.eventType}`}
                      >
                        {getEventIcon(event.eventType)} {event.ticker}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-muted-foreground px-2">
                        +{dayEvents.length - 2} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lista de próximos eventos */}
      {events && events.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Próximos Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {events
                .slice(0, 5)
                .map((event: any) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getEventIcon(event.eventType)}</span>
                      <div>
                        <p className="font-semibold text-sm">{event.ticker}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.eventDate), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium capitalize">{event.eventType}</p>
                      {event.expectedValue && (
                        <p className="text-xs text-muted-foreground">{event.expectedValue}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
