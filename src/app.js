import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import messageRoutes from './routes/message.routes.js';
import userRoutes from './routes/user.routes.js';
import { corsOrigin } from './config/cors.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigin() }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (req, res) => {
    res.json({ service: 'EcoHome Store API', status: 'ok', version: '3.0.0', realtime: 'socket.io', clients: ['react', 'flutter'] });
  });

  // Freno a fuerza bruta sobre signup/login (se desactiva en pruebas automáticas)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.nodeEnv === 'test',
    message: { error: 'Demasiados intentos. Intente de nuevo en unos minutos.' },
  });

  app.use('/auth', authLimiter, authRoutes);
  app.use('/products', productRoutes);
  app.use('/messages', messageRoutes);
  app.use('/users', userRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
