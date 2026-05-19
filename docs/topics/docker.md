# Docker

## Summary

The project is fully dockerized:

- **neo4j**: graph database for routing
- **neo4j-loader**: one-shot GTFS importer (runs on demand)
- **backend**: Express API
- **frontend**: Nuxt UI

## Production

```bash
cp .env.example .env
unzip -o data/LINZ_AG_GTFS_2026.zip -d data/LINZ_AG_GTFS_2026

docker compose up -d neo4j
docker compose --profile tools run --rm neo4j-loader
docker compose up -d
```

### Ports
- Backend: `http://localhost:3000`
- Frontend: `http://localhost:3001`
- Neo4j: Bolt `${NEO4J_BOLT_PORT:-7687}`, HTTP `${NEO4J_HTTP_PORT:-7474}`

### Frontend API URL
Set `NUXT_PUBLIC_API_BASE_URL` in `.env` to the **server address** clients will use
(e.g., `http://192.168.0.10:3000`).

## Development

Use the dev override for live reload:

```bash
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up
```

This runs:
- `tsx watch` for the backend
- `nuxt dev` for the frontend

## Neo4j Loader

The loader is under a **tools profile** so it does not run on every `up`.
Run it explicitly when GTFS data changes:

```bash
docker compose --profile tools run --rm neo4j-loader
```
