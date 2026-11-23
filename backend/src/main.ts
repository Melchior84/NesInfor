import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Confia no proxy reverso do Railway (necessario para rate limit por IP real)
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Uploads persistentes (em producao no Railway, monte um Volume em UPLOADS_DIR)
  const uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
  mkdirSync(join(uploadsDir, 'capsulas'), { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // Healthcheck simples para Railway / load balancers
  const http = app.getHttpAdapter().getInstance();
  http.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', app: 'Cafezinho Infor' });
  });

  // Em producao (Docker/Railway), serve tambem o build do frontend (public/)
  const publicDir = join(process.cwd(), 'public');
  const indexHtml = join(publicDir, 'index.html');
  if (existsSync(indexHtml)) {
    app.useStaticAssets(publicDir);
    http.use((req: Request, res: Response, next: NextFunction) => {
      if (
        req.method === 'GET' &&
        !req.path.startsWith('/api') &&
        !req.path.startsWith('/uploads')
      ) {
        return res.sendFile(indexHtml);
      }
      return next();
    });
  }

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: (
      process.env.CORS_ORIGIN ??
      process.env.FRONTEND_URL ??
      'http://localhost:5173,http://localhost:4200'
    )
      .split(',')
      .map((o) => o.trim()),
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API Cafezinho Infor em http://0.0.0.0:${port}/api`);
}
bootstrap();
