# NotesAides

NotesAides is a modern full-stack application built with Bun, Hono, Next.js, and PostgreSQL.

## Recommended Development Workflow (Hybrid Approach)

For the best developer experience (fastest hot-reloading and easiest debugging), we recommend running the database in Docker and the frontend/API directly on your local machine.

### 1. Start the Database
Keep your database isolated and clean by running it via Docker:
```bash
# From the root directory (NotesAides)
docker-compose up -d db
```



```bash
# From the root directory (NotesAides)
cd api
bun run db:generate
bun run db:push
```


### 2. Start the API
Run the backend natively using Bun for instant reloads:
```bash
# Open a new terminal
cd api
bun run dev
```

*(Note: If you make changes to the database schema in `api/src/infrastructure/db/schema.ts`, apply them using `bun run db:generate` followed by `bun run db:push` in the `api` folder).*

### 3. Start the Frontend
Run the React application locally using Next.js:
```bash
# Open another new terminal
cd front
pnpm run dev
```

### Accessing the App
- **Frontend** is available at: [http://localhost:3000](http://localhost:3000)
- **API** is running at: `http://localhost:3001`
- **Database GUI** can be launched via: `cd api && bun run drizzle-kit studio`
