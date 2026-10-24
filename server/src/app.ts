import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { registerRoutes } from "./router/index.js";
import { errorHandler } from "./middleware/error-handler.middleware.js";

import { serve } from "inngest/express";
import { inngest } from "./inngest/client.js";
import { functions } from "./inngest/index.js";

export const app = express();

app.use(cors(
  {
    origin: process.env.CLIENT_URL,
    exposedHeaders: ["X-Conversation-Id"],
    credentials: true
  }
));

app.all("/api/auth/*splat", toNodeHandler(auth));

// Mount body-parsing middleware after the Better Auth handler.
app.use(express.json());
app.use("/api/inngest", serve({ client: inngest, functions }));

app.get('/health', (req, res) => {
  res.send({ message: "health 200" })
})

registerRoutes(app);
app.use(errorHandler);

