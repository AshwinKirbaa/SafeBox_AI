# SafeBox AI cinematic UI

React + Vite + Three.js + Framer Motion + GSAP + Tailwind. Preserves the midnight design, diamond cursor and combined GhostFibers/AeroShards background.

```sh
npm ci
npm run dev
npm test
npm run build
```

Read BACKEND_INTEGRATION.md before connecting to the supplied FastAPI backend. Development /api requests proxy to http://127.0.0.1:8000. The public hosted preview does not run your Python backend.

The application includes health/readiness, provider connection CRUD, model discovery and probing, registered test execution, paginated run exploration, detailed evidence, Docker-worker launch and activity logs. Backend-owned settings are read-only in the UI. No credentials or runtime data are bundled.

Some original UI blocks are adaptations of supplied concepts. GhostFibers adapts the user-supplied shader source; AeroShards is an original compatible implementation. Browser GPU and real-provider end-to-end verification remain outstanding.
