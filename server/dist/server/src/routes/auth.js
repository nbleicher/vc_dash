import { z } from 'zod';
import { cookieName, isValidAdmin } from '../auth.js';
const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});
export async function authRoutes(app, env) {
    app.post('/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
        const parse = loginSchema.safeParse(request.body);
        if (!parse.success) {
            return reply.code(400).send({
                error: {
                    code: 'INVALID_BODY',
                    message: 'Invalid login payload.',
                    details: parse.error.flatten(),
                },
            });
        }
        if (!isValidAdmin(parse.data.username, parse.data.password, env)) {
            return reply.code(401).send({
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid credentials.',
                },
            });
        }
        const token = app.jwt.sign({ sub: 'admin', role: 'admin' }, { expiresIn: '12h' });
        reply.setCookie(cookieName(), token, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
        });
        return reply.send({ data: { loggedIn: true, role: 'admin' } });
    });
    app.post('/auth/logout', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (_request, reply) => {
        reply.clearCookie(cookieName(), { path: '/' });
        return reply.send({ data: { loggedIn: false } });
    });
    app.get('/auth/me', { preHandler: [app.authenticate] }, async (_request, reply) => {
        return reply.send({ data: { loggedIn: true, role: 'admin' } });
    });
}
