import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import clientesRoutes from "./routes/clientes";
import catalogoRoutes from "./routes/catalogo";

const app = express();

// Segurança
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

// Rate limiting global
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições. Tente novamente em 15 minutos." },
  }),
);

// Rate limiting mais restritivo no login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  },
});
app.use("/auth/login", loginLimiter);

// Routes
app.use("/auth", authRoutes);
app.use("/clientes", clientesRoutes);
app.use("/catalogo", catalogoRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
