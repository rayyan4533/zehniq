import { app } from "./app.js";

const port = Number(process.env.PORT ?? 8081);
app.listen(port, () => {
  console.log(`zehniq. API listening on port ${port}`);
});
