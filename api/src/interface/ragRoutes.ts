import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { RagAskUseCase } from '../application/RagAsk';

const ragRoutes = new Hono();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required');

ragRoutes.use('*', jwt({ secret: jwtSecret, alg: 'HS256' }));

const ragAskUseCase = new RagAskUseCase();

ragRoutes.post('/ask', async (c) => {
  const payload = c.get('jwtPayload') as { sub: string };
  const body = await c.req.json();
  if (typeof body?.query !== 'string' || !body.query.trim()) {
    return c.json({ error: 'query is required' }, 400);
  }
  try {
    const result = await ragAskUseCase.execute(payload.sub, body.query.trim());
    return c.json(result);
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : 'Ask failed' }, 500);
  }
});

export default ragRoutes;
