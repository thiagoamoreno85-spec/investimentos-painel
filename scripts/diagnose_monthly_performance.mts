import { getMonthlyPerformance } from "../server/services/dailyPerformanceService";

const userId = Number(process.argv[2] ?? "1");
const performance = await getMonthlyPerformance(userId);
console.log(JSON.stringify(performance, null, 2));
process.exit(0);
