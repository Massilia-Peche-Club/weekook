import { env } from './config/env.js';
import prisma from './lib/prisma.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import { startBookingCompletionCron } from './cron/bookingCompletion.js';
import authRoutes from './routes/auth.js';
import kookersRoutes from './routes/kookers.js';
import servicesRoutes from './routes/services.js';
import bookingsRoutes from './routes/bookings.js';
import reviewsRoutes from './routes/reviews.js';
import favoritesRoutes from './routes/favorites.js';
import availabilityRoutes from './routes/availability.js';
import messagesRoutes from './routes/messages.js';
import testimonialsRoutes from './routes/testimonials.js';
import usersRoutes from './routes/users.js';
import uploadRoutes from './routes/upload.js';
import adminRoutes from './routes/admin.js';
import stripeRoutes from './routes/stripe.js';
import metricsRoutes from './routes/metrics.js';

import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// ── Security headers (Helmet with 13 security headers) ──
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://js.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', "https://*.stripe.com"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  })
);

// ── CORS ──
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

// ── Stripe webhook raw body (must be before json parser) ──
app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }));

// ── Body parsing ──
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// ── Static files (uploads) ──
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

// ── API routes ──
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/kookers', kookersRoutes);
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/bookings', bookingsRoutes);
app.use('/api/v1/reviews', reviewsRoutes);
app.use('/api/v1/favorites', favoritesRoutes);
app.use('/api/v1/availability', availabilityRoutes);
app.use('/api/v1/messages', messagesRoutes);
app.use('/api/v1/testimonials', testimonialsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/stripe', stripeRoutes);
app.use('/api/v1/metrics', metricsRoutes);

// ── Error handler ──
app.use(errorHandler);

// ── Config seed defaults ──
const CONFIG_DEFAULTS: Record<string, unknown> = {
  specialties: ['Provençale', 'Méditerranéenne', 'Pâtisserie', 'Grillades', 'Végétarien', 'Fruits de mer', 'Italienne', 'Asiatique'],
  cities: ['Marseille', 'Aix-en-Provence', 'Cassis', 'La Ciotat', 'Toulon', 'Nice', 'Arles', 'Avignon'],
  allergens: ['Gluten', 'Crustacés', 'Œufs', 'Poisson', 'Arachides', 'Soja', 'Lait', 'Fruits à coque', 'Céleri', 'Moutarde', 'Sésame', 'Sulfites', 'Lupin', 'Mollusques'],
  serviceTypes: ['KOOK', 'KOURS'],
  units: ['g', 'kg', 'mL', 'L', 'pièce(s)', 'unité(s)', 'c. à soupe', 'c. à café', 'pincée', 'tranche(s)', 'brin(s)', 'feuille(s)', 'gousse(s)', 'portion(s)'],
  platformCommission: 20,
  commissionKours: 20,
  commissionKook: 20,
  kookBaseGuests: 6,
  tooltipFruitsDesMer: "produits de la mer à l'exception des poissons",
  tooltipCommission: "La commission Weekook est prélevée sur chaque réservation. Elle couvre les frais de la plateforme, le paiement sécurisé et l'assistance client.",
  ingredientsChoiceEnabled: true,
  ingredientsChoiceDefault: "client",
};

async function seedConfig() {
  await Promise.all(
    Object.entries(CONFIG_DEFAULTS).map(([key, value]) =>
      prisma.config.upsert({
        where: { key },
        update: {},
        create: { key, value: JSON.stringify(value) },
      })
    )
  );
}

// ── Start server ──
app.listen(env.PORT, async () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
  // Warmup : single ping to verify DB connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection ready');
    await seedConfig();
    startBookingCompletionCron();
  } catch (e) {
    console.error('Database connection failed:', e);
  }

  // Keepalive : single ping toutes les 60s pour maintenir la connexion
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      console.error('DB keepalive failed:', e);
    }
  }, 60_000);
});

export default app;
