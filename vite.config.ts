import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@workspace/api-client-react": path.resolve(__dirname, "src/api-client"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5000,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
    watch: {
      ignored: ["**/.local/**", "**/node_modules/**", "**/dataset/**", "**/output/**"],
    },
  },
});
