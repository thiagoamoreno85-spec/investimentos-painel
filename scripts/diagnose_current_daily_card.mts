import { portfolioRouter } from "../server/routers/portfolio";

const context = {
  user: {
    id: 1,
    openId: "diagnostic-owner",
    name: "Diagnóstico",
    email: null,
    loginMethod: "manus",
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
};

const caller = portfolioRouter.createCaller(context as never);
const result = await caller.getDailyPerformance();
console.log(JSON.stringify(result, null, 2));
process.exit(0);
