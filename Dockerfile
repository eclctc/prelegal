FROM node:24-slim AS frontend-build
WORKDIR /build
COPY templates ./templates
COPY documents.json ./documents.json
COPY frontend ./frontend
WORKDIR /build/frontend
RUN npm ci && npm run build

FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/app ./app
COPY documents.json ./documents.json
COPY --from=frontend-build /build/frontend/out ./static
ENV DOCUMENTS_PATH=/app/documents.json
EXPOSE 8000
CMD ["uv", "run", "--no-dev", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
