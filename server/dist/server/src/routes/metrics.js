export async function metricsRoutes(app) {
    app.get('/metrics/summary', { preHandler: [app.authenticate] }, async (_request, reply) => {
        const state = await app.store.getState();
        const totalSales = state.perfHistory.reduce((acc, row) => acc + row.sales, 0);
        const totalCalls = state.perfHistory.reduce((acc, row) => acc + row.billableCalls, 0);
        const qaPassRate = state.qaRecords.length === 0
            ? null
            : state.qaRecords.filter((x) => x.decision === 'Good Sale').length / state.qaRecords.length;
        return reply.send({
            data: {
                totalSales,
                totalCalls,
                qaPassRate,
                openAuditCount: state.auditRecords.filter((x) => !(x.mgmtNotified && x.outreachMade)).length,
            },
        });
    });
}
