import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { portfolioRouter } from "./routers/portfolio";
import { dividendsRouter } from "./routers/dividends";
import { alertsRouter } from "./routers/alertsRouter";
import { buyAdvisorRouter } from "./routers/buyAdvisor";
import { marketRouter } from "./routers/market";
import { newsRouter } from "./routers/newsRouter";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  portfolio: portfolioRouter,
  dividends: dividendsRouter,
  alerts: alertsRouter,
  buyAdvisor: buyAdvisorRouter,
  market: marketRouter,
  news: newsRouter,
});

export type AppRouter = typeof appRouter;
