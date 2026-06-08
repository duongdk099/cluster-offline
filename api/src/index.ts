import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createBunWebSocket, serveStatic } from 'hono/bun'
import { verify, jwt } from 'hono/jwt'
import { randomUUID } from 'crypto'
import { join } from 'path'
import noteRoutes from './interface/routes'
import authRoutes from './interface/authRoutes'
import ragRoutes from './interface/ragRoutes'
import { wsEvents } from './infrastructure/websocket'
import { config } from './config'

const app = new Hono()
const { upgradeWebSocket, websocket } = createBunWebSocket()

type SubscribableSocket = {
    subscribe: (channel: string) => void;
}

const allowedCorsOrigins = config.corsOrigin
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

function isOriginAllowed(origin: string): boolean {
    if (allowedCorsOrigins.length === 0) {
        return !config.isProduction
    }

    return allowedCorsOrigins.some((allowed) => {
        if (allowed === origin) return true

        // Support wildcard host pattern such as https://*.app.github.dev
        if (allowed.includes('*')) {
            try {
                const originUrl = new URL(origin)
                const allowedUrl = new URL(allowed.replace('*.', 'placeholder.'))
                if (originUrl.protocol !== allowedUrl.protocol) return false
                const suffix = allowedUrl.hostname.replace('placeholder.', '')
                return originUrl.hostname === suffix || originUrl.hostname.endsWith(`.${suffix}`)
            } catch {
                return false
            }
        }

        return false
    })
}

app.use('*', cors({
    origin: (origin) => {
        if (!origin) return origin
        if (isOriginAllowed(origin)) return origin
        return null
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}))

const jwtSecret = config.jwtSecret

app.get('/', (c) => {
    return c.text('Hello from NotesAides API!')
})

// WebSocket handler for real-time sync
app.get(
    '/ws',
    upgradeWebSocket(async (c) => {
        const token = c.req.query('token')

        if (!token) return { status: 4001, reason: 'Token required' }

        try {
            const payload = await verify(token, jwtSecret, 'HS256')
            const userId = payload.sub as string

            return {
                onOpen(evt, ws) {
                    (ws.raw as SubscribableSocket).subscribe(`user_${userId}`)
                },
                onClose() {
                    // Connection closed
                },
            }
        } catch (err) {
            return { status: 4001, reason: 'Invalid token' }
        }
    })
)

app.route('/notes', noteRoutes)
app.route('/auth', authRoutes)
app.route('/rag', ragRoutes)

// Serve uploaded files
app.use('/uploads/*', serveStatic({ root: './' }))

// Authenticated upload endpoint
app.post('/upload', jwt({ secret: jwtSecret, alg: 'HS256' }), async (c) => {
    try {
        const body = await c.req.parseBody()
        const file = body['file'] as File

        if (!file) {
            return c.json({ error: 'No file uploaded' }, 400)
        }

        // Validate file type
        if (!config.allowedUploadMimeTypes.includes(file.type)) {
            return c.json({
                error: 'Invalid file type. Allowed: JPEG, PNG, WebP'
            }, 400)
        }

        // Validate file size
        if (file.size > config.maxUploadFileBytes) {
            return c.json({
                error: 'File too large. Maximum size: 10MB'
            }, 400)
        }

        const extension = file.name.split('.').pop()
        const fileName = `${randomUUID()}.${extension}`
        const filePath = join('uploads', fileName)

        // Using Bun.write for efficient file saving
        const bytes = await file.arrayBuffer()
        await Bun.write(filePath, bytes)

        const requestUrl = new URL(c.req.url)
        const forwardedProto = config.trustProxyHeaders
            ? c.req.header('x-forwarded-proto')?.split(',')[0]?.trim()
            : undefined
        const forwardedHost = config.trustProxyHeaders
            ? c.req.header('x-forwarded-host')?.split(',')[0]?.trim()
            : undefined
        const inferredBaseUrl = forwardedHost
            ? `${forwardedProto || requestUrl.protocol.replace(':', '')}://${forwardedHost}`
            : `${requestUrl.protocol}//${requestUrl.host}`
        const baseUrl = config.apiUrl || inferredBaseUrl
        return c.json({
            url: `${baseUrl}/uploads/${fileName}`
        })
    } catch (error) {
        return c.json({ error: 'Upload failed' }, 500)
    }
})

// Start the Bun server only when this file is run directly as the entrypoint.
// Importing the app (e.g. from tests) must not bind a port.
if (import.meta.main) {
    // Bun --watch will naturally handle restarts
    const server = Bun.serve({
        port: config.port,
        fetch: app.fetch,
        websocket,
    })

    // Clear old event listeners to prevent memory leaks during hot-reload
    wsEvents.removeAllListeners('broadcast');

    // Listen for notifications from routes and broadcast to subscribers
    wsEvents.on('broadcast', ({ userId, type, noteId }) => {
        server.publish(`user_${userId}`, JSON.stringify({ type, noteId }));
    });
}

// Named (not default) export: a default export that looks like a server
// config makes Bun auto-serve it, which would double-bind the port alongside
// the explicit Bun.serve above. Tests import { app } and call app.request().
export { app }
