import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import customerRoutes from "./routes/customers";
import productRoutes from "./routes/products";
import challanRoutes from "./routes/challans";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/customers", customerRoutes);
app.use("/products", productRoutes);
app.use("/challans", challanRoutes);

app.use(errorHandler);

export default app;
