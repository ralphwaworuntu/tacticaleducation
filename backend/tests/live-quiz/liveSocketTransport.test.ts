import http from 'http';
import type { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { describe, expect, it } from 'vitest';
import { isLiveSocketOriginAllowed } from '../../src/modules/live-quiz/liveSocketOrigin';

function listen(server: http.Server) {
  return new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

describe('origin Socket.IO produksi', () => {
  const production = { nodeEnv: 'production', frontendUrl: 'http://localhost:4173', appUrl: '' };

  it('mengizinkan https://app.tacticaleducation.id', () => {
    expect(isLiveSocketOriginAllowed('https://app.tacticaleducation.id', production)).toBe(true);
  });

  it('mengizinkan origin dari FRONTEND_URL meski ada garis miring di akhir', () => {
    expect(
      isLiveSocketOriginAllowed('https://kelas.example.id', {
        nodeEnv: 'production',
        frontendUrl: 'https://kelas.example.id/',
        appUrl: '',
      }),
    ).toBe(true);
  });

  it('menolak origin lain', () => {
    expect(isLiveSocketOriginAllowed('https://evil.example', production)).toBe(false);
  });
});

describe('transport Socket.IO', () => {
  it('polling tersambung ketika websocket ditolak, sedangkan websocket-first gagal', async () => {
    const httpServer = http.createServer();
    const io = new Server(httpServer, { transports: ['polling'], allowUpgrades: false });
    const port = await listen(httpServer);

    const websocketFirst = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 2000,
    });
    const websocketFailed = await new Promise<boolean>((resolve) => {
      websocketFirst.once('connect', () => resolve(false));
      websocketFirst.once('connect_error', () => resolve(true));
    });
    websocketFirst.close();

    const pollingFirst = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['polling', 'websocket'],
      reconnection: false,
      timeout: 4000,
    });
    await new Promise<void>((resolve, reject) => {
      pollingFirst.once('connect', () => resolve());
      pollingFirst.once('connect_error', (error) => reject(error));
    });

    expect(websocketFailed).toBe(true);
    expect(pollingFirst.connected).toBe(true);
    expect(pollingFirst.io.engine.transport.name).toBe('polling');

    pollingFirst.close();
    await io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('naik ke websocket setelah polling bila upgrade diizinkan', async () => {
    const httpServer = http.createServer();
    const io = new Server(httpServer, { transports: ['polling', 'websocket'], allowUpgrades: true });
    const port = await listen(httpServer);
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: false,
      timeout: 4000,
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', (error) => reject(error));
    });
    await new Promise<void>((resolve) => {
      if (socket.io.engine.transport.name === 'websocket') {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, 2000);
      socket.io.engine.once('upgrade', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    expect(socket.connected).toBe(true);
    expect(socket.io.engine.transport.name).toBe('websocket');
    socket.close();
    await io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });
});
