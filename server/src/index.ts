import { app } from "./app.js";

const port = Number(process.env.PORT ?? 8081);
app.listen(port, () => {
  console.log(`Notebook Road API listening on port ${port}`);
});