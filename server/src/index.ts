import express from "express";
import dotenv from "dotenv";
dotenv.config();
const PORT = process.env.PORT 


const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/health", (req, res) => {
  res.send("Server is healthy!");
})


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


export default app;