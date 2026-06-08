import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import clientesRoutes from "./routes/clientes";
import catalogoRoutes from "./routes/catalogo";
import orcamentosRoutes from "./routes/orcamentos";
import pedidosRoutes from "./routes/pedidos";
import estoqueRoutes from "./routes/estoque";
import entregasRoutes from "./routes/entregas";
import financeiroRoutes from "./routes/financeiro";
import fiscalRoutes from "./routes/fiscal";

const app = express();

// Segurança
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

// Health check - Must be defined BEFORE rate limiter to avoid throttling
// This endpoint is used by load balancers, orchestrators, and monitoring systems
// and must always be available for service health checks
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Global Rate Limiter Configuration
 *
 * Purpose: Protect API from abuse, DDoS attacks, and excessive load
 *
 * Configuration Rationale:
 * - Window: 15 minutes (standard for API rate limiting)
 * - Max requests: 500 per window per IP
 * - Expected production hit rate: ~33 req/min per user under normal usage
 * - Design assumes typical user sessions with 5-10 concurrent operations
 *
 * Excluded endpoints:
 * - /health: Must remain available for infrastructure monitoring
 *
 * Per-route overrides:
 * - /auth/login: max 10 requests per 15min (stricter to prevent brute force)
 *
 * Monitoring:
 * - Rate limit events are logged with IP, path, and timestamp
 * - Consider integrating with your observability system (Datadog, New Relic, etc.)
 * - Metric: rate_limit_exceeded_total (counter)
 */
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições. Tente novamente em 15 minutos." },
    // Skip rate limiting for health and metrics endpoints
    skip: (req) => {
      return req.path === "/health" || req.path === "/metrics";
    },
    // Handler to log and emit metrics when rate limit is exceeded
    handler: (req, res, _next, options) => {
      const rateLimitInfo = {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get("user-agent"),
        limit: options.max,
        window: `${options.windowMs}ms`,
      };

      // Log rate limit event for observability
      console.warn("[RATE_LIMIT_EXCEEDED]", JSON.stringify(rateLimitInfo));

      // TODO: Emit metric to observability system
      // Example integrations:
      // - Datadog: statsd.increment('rate_limit.exceeded', 1, [`path:${req.path}`])
      // - New Relic: newrelic.recordMetric('Custom/RateLimit/Exceeded', 1)
      // - Prometheus: rateLimitCounter.labels(req.path).inc()

      res.status(options.statusCode).json(options.message);
    },
  }),
);

/**
 * Auth Login Rate Limiter Override
 *
 * Purpose: Prevent brute force attacks on authentication endpoint
 *
 * Configuration:
 * - Max requests: 10 per 15min (much stricter than global limit)
 * - Applies specifically to /auth/login
 * - Logs all rate limit events for security monitoring
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  },
  handler: (req, res, _next, options) => {
    const rateLimitInfo = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get("user-agent"),
      limit: options.max,
      window: `${options.windowMs}ms`,
      severity: "HIGH", // Login attempts are security-critical
    };

    console.warn("[RATE_LIMIT_EXCEEDED][AUTH]", JSON.stringify(rateLimitInfo));

    // TODO: Emit security metric for login rate limit events
    // Consider triggering alerts for repeated violations from same IP

    res.status(options.statusCode).json(options.message);
  },
});
app.use("/auth/login", loginLimiter);

// Routes
app.use("/auth", authRoutes);
app.use("/clientes", clientesRoutes);
app.use("/catalogo", catalogoRoutes);
app.use("/orcamentos", orcamentosRoutes);
app.use("/pedidos", pedidosRoutes);
app.use("/estoque", estoqueRoutes);
app.use("/pedidos", entregasRoutes);
app.use("/financeiro", financeiroRoutes);
app.use("/fiscal", fiscalRoutes);

export default app;
