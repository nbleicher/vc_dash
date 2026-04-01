import { z } from 'zod';
const keySchema = z.enum([
    'agents',
    'snapshots',
    'perfHistory',
    'qaRecords',
    'auditRecords',
    'attendance',
    'spiffRecords',
    'attendanceSubmissions',
    'intraSubmissions',
    'weeklyTargets',
    'transfers',
    'shadowLogs',
    'vaultMeetings',
    'vaultDocs',
    'eodReports',
]);
export async function stateRoutes(app) {
    app.get('/state', async (_request, reply) => {
        reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
        reply.header('Pragma', 'no-cache');
        return reply.send({ data: await app.store.getState() });
    });
    app.get('/state/:key', async (request, reply) => {
        const parse = keySchema.safeParse(request.params.key);
        if (!parse.success) {
            return reply.code(400).send({
                error: {
                    code: 'INVALID_RESOURCE',
                    message: 'Unknown state resource.',
                },
            });
        }
        return reply.send({ data: await app.store.getCollection(parse.data) });
    });
    app.put('/state/:key', async (request, reply) => {
        const parse = keySchema.safeParse(request.params.key);
        if (!parse.success) {
            return reply.code(400).send({
                error: {
                    code: 'INVALID_RESOURCE',
                    message: 'Unknown state resource.',
                },
            });
        }
        const rows = request.body;
        const next = await app.store.replaceCollection(parse.data, rows);
        return reply.send({ data: next });
    });
    app.post('/state/last-policies-bot-run', async (request, reply) => {
        const body = request.body;
        const timestamp = typeof body?.timestamp === 'string' ? body.timestamp.trim() : null;
        if (!timestamp) {
            return reply.code(400).send({
                error: { code: 'VALIDATION_ERROR', message: 'Body must include timestamp (ISO string).' },
            });
        }
        await app.store.setLastPoliciesBotRun(timestamp);
        return reply.send({ data: { ok: true } });
    });
    app.post('/state/house-marketing', async (request, reply) => {
        const body = request.body;
        const dateKey = typeof body?.dateKey === 'string' ? body.dateKey.trim() : null;
        const amount = typeof body?.amount === 'number' && Number.isFinite(body.amount) ? body.amount : Number(body?.amount);
        if (!dateKey || !Number.isFinite(amount)) {
            return reply.code(400).send({
                error: { code: 'VALIDATION_ERROR', message: 'Body must include dateKey (string) and amount (number).' },
            });
        }
        await app.store.setHouseMarketing(dateKey, amount);
        return reply.send({ data: { ok: true } });
    });
}
