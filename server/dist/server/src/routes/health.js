export async function healthRoutes(app) {
    app.get('/health', async (_request, reply) => {
        try {
            await app.store.getCollection('agents');
            return { data: { ok: true, service: 'vc_dash_api', db: 'ok' } };
        }
        catch {
            return reply.code(503).send({
                error: {
                    code: 'DB_UNAVAILABLE',
                    message: 'Database is unavailable.',
                },
            });
        }
    });
}
