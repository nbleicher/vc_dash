const AUTH_COOKIE = 'vcdash_token';
export function cookieName() {
    return AUTH_COOKIE;
}
export async function requireAuth(request, reply) {
    try {
        await request.jwtVerify();
    }
    catch {
        reply.code(401).send({
            error: {
                code: 'AUTH_REQUIRED',
                message: 'Authentication required.',
            },
        });
    }
}
export function isValidAdmin(username, password, env) {
    return username === env.adminUsername && password === env.adminPassword;
}
