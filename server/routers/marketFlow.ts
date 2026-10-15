import { protectedProcedure, router } from "../_core/trpc";
import { getMarketFlowDashboard, refreshMarketFlowSnapshot } from "../services/marketFlowService";

export const marketFlowRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    return getMarketFlowDashboard(ctx.user.id);
  }),

  refresh: protectedProcedure.mutation(async ({ ctx }) => {
    return refreshMarketFlowSnapshot(ctx.user.id);
  }),
});
