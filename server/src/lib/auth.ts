import "dotenv/config";
import { betterAuth } from "better-auth";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.CLIENT_URL ?? "http://localhost:3000"],

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});
