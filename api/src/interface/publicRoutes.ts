import { Hono } from 'hono';
import { client } from '../infrastructure/db';

const publicRoutes = new Hono();

publicRoutes.get('/:token', async (c) => {
  const token = c.req.param('token');
  if (!token) return c.json({ error: 'Token required' }, 400);

  const rows = await client`
    SELECT n.id, n.title, n.content, n.content_text AS "contentText",
           n.created_at AS "createdAt", n.updated_at AS "updatedAt"
    FROM share_tokens st
    INNER JOIN notes n ON n.id = st.note_id
    WHERE st.token = ${token} AND n.deleted_at IS NULL
    LIMIT 1
  `;
  if (rows.length === 0) {
    return c.json({ error: 'Share link not found' }, 404);
  }
  return c.json(rows[0]);
});

export default publicRoutes;
