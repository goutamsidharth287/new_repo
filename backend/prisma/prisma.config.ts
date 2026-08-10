import { defineConfig } from "@prisma/internals";

export default defineConfig({
  datasources: {
    db: {
      adapter: process.env.DATABASE_ADAPTER || "postgresql",
    },
  },
});
