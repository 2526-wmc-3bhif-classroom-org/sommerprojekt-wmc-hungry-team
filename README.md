# Smarthub

- Arthur Dirnberger
- Matthias Darabosch
- Benjamin Stoica
- Almir Hadzic

[Proj Summary](docs/smarthub.md)

## Important Commands

## Docker (Prod)

```bash
cp .env.example .env
# Edit .env (Neo4j + Google API key)
unzip -o data/LINZ_AG_GTFS_2026.zip -d data/LINZ_AG_GTFS_2026

docker compose up -d neo4j
docker compose --profile tools run --rm neo4j-loader
docker compose up -d
```

- Backend: http://localhost:3000
- Frontend: http://localhost:3001

Set `NUXT_PUBLIC_API_BASE_URL` in `.env` if clients access the server from another host.

## Docker (Dev)

```bash
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up
```

## Docker (Maintenance)

```bash
# Re-run GTFS import (after updating data)
docker compose --profile tools run --rm neo4j-loader

# View logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f neo4j

# Rebuild images
docker compose build backend frontend

# Stop everything
docker compose down
```

## Local (No Docker)

```bash
# Backend
cd _backend
npm install
npm run dev

# Frontend (new terminal)
cd _frontend/smarthub
npm install
NUXT_PUBLIC_API_BASE_URL=http://localhost:3000 npm run dev
```