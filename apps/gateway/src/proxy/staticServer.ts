import express, { type Express } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';

const POS_DEV_PORT = Number(process.env.POS_DEV_PORT ?? 5174);
const KDS_DEV_PORT = Number(process.env.KDS_DEV_PORT ?? 5175);
const USE_DEV_PROXY = process.env.GATEWAY_DEV_PROXY !== 'false';

export function mountStaticOrProxy(app: Express): void {
  if (USE_DEV_PROXY) {
    app.use(
      '/pos',
      createProxyMiddleware({
        target: `http://localhost:${POS_DEV_PORT}`,
        changeOrigin: true,
        ws: true,
        pathRewrite: { '^/pos': '' },
      }),
    );

    app.use(
      '/kds',
      createProxyMiddleware({
        target: `http://localhost:${KDS_DEV_PORT}`,
        changeOrigin: true,
        ws: true,
        pathRewrite: { '^/kds': '' },
      }),
    );

    return;
  }

  const posDist = path.join(__dirname, '../../../pos/dist');
  const kdsDist = path.join(__dirname, '../../../kds/dist');

  app.use('/pos', express.static(posDist));
  app.use('/kds', express.static(kdsDist));
}
