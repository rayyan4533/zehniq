import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";

const app = express();
const port = Number(process.env.PORT ?? 8081);

app.use(cors(
  {
    origin: process.env.CLIENT_URL,
    credentials: true
  }
));

app.all("/api/auth/*splat", toNodeHandler(auth));

// Mount body-parsing middleware after the Better Auth handler.
app.use(express.json());

app.get('/health', (req, res) => {
  res.send({ message: "health 200" })
})

app.listen(port, () => {
  console.log(`Better Auth app listening on port ${port}`);
});