import { getMonthlyPerformanceDetails } from "../server/services/dailyPerformanceService";

const details = await getMonthlyPerformanceDetails(Number(process.argv[2] ?? "1"));
console.log(JSON.stringify({
  monthStart: details.monthStart,
  today: details.today,
  summary: details.summary,
  days: details.days.map((day) => ({
    date: day.date,
    source: day.source,
    returnPct: day.returnPct,
    returnValue: day.returnValue,
    assetCount: day.byAsset.length,
    sample: day.byAsset.slice(0, 3),
  })),
}, null, 2));
process.exit(0);
