import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // In dev the browser calls /api on the Vite server, which forwards to the
  // local Api worker (alchemy dev serves it on :1337). Deployed builds call
  // the Api worker's URL directly (VITE_API_URL, injected by alchemy.run.ts).
  server: {
    allowedHosts: true,
    proxy: { "/api": process.env.API_DEV_URL ?? "http://localhost:1337" },
  },
});
