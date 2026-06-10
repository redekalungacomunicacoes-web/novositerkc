import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Domínio próprio (kalungacomunicacoes.org) => base tem que ser "/"
  base: "/",

  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tanstack/react-query": path.resolve(__dirname, "./src/shims/react-query.tsx"),
      "@dnd-kit/core": path.resolve(__dirname, "./src/shims/dnd-core.tsx"),
      "@dnd-kit/sortable": path.resolve(__dirname, "./src/shims/dnd-sortable.tsx"),
      "@dnd-kit/utilities": path.resolve(__dirname, "./src/shims/dnd-utilities.ts"),
    },
  },

  assetsInclude: ["**/*.svg", "**/*.csv"],
});
