import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createBunWebSocket, serveStatic } from 'hono/bun'
import { verify, jwt } from 'hono/jwt'
import { randomUUID } from 'crypto'
import { join } from 'path'
import noteRoutes from './interface/routes'
import authRoutes from './interface/authRoutes'
import { wsEvents } from './infrastructure/websocket'

const app = new Hono()
const { upgradeWebSocket, websocket } = createBunWebSocket()

app.use('*', cors())

// Validate required environment variables
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required')
}

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
                    ; (ws.raw as any).subscribe(`user_${userId}`)
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

// Serve uploaded files
app.use('/uploads/*', serveStatic({ root: './' }))

// File upload validation constants
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Authenticated upload endpoint
app.post('/upload', jwt({ secret: jwtSecret, alg: 'HS256' }), async (c) => {
    try {
        const body = await c.req.parseBody()
        const file = body['file'] as File

        if (!file) {
            return c.json({ error: 'No file uploaded' }, 400)
        }

        // Validate file type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            return c.json({ 
                error: 'Invalid file type. Allowed: JPEG, PNG, WebP' 
            }, 400)
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
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

        const baseUrl = process.env.API_URL || 'http://localhost:3001'
        return c.json({
            url: `${baseUrl}/uploads/${fileName}`
        })
    } catch (error) {
        return c.json({ error: 'Upload failed' }, 500)
    }
})

// Start the Bun server (Bun --watch will naturally handle restarts)
const server = Bun.serve({
    port: Number(process.env.PORT) || 3001,
    fetch: app.fetch,
    websocket,
})

// Clear old event listeners to prevent memory leaks during hot-reload
wsEvents.removeAllListeners('broadcast');

// Listen for notifications from routes and broadcast to subscribers
wsEvents.on('broadcast', ({ userId, type, noteId }) => {
    server.publish(`user_${userId}`, JSON.stringify({ type, noteId }));
});
