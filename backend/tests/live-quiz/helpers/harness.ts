/* eslint-disable @typescript-eslint/no-explicit-any */
import http from 'http';
import type { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { io as ioClient, type Socket } from 'socket.io-client';
import app from '../../../src/app';
import { env } from '../../../src/config/env';
import { prisma } from '../../../src/config/prisma';
import { attachLiveGateway } from '../../../src/modules/live-quiz/liveGateway';

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startHarness() {
  const server = http.createServer(app);
  const gateway = attachLiveGateway(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    base: `http://127.0.0.1:${port}`,
    close: async () => {
      await gateway.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

export async function cleanupLiveData() {
  await prisma.liveResult.deleteMany();
  await prisma.liveAnswer.deleteMany();
  await prisma.liveQuestionState.deleteMany();
  await prisma.livePlayer.deleteMany();
  await prisma.liveSession.deleteMany();
  await prisma.quizOption.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.quiz.deleteMany();
}

export async function deleteTestUsers() {
  await prisma.user.deleteMany({ where: { email: { startsWith: 'lq-test-' } } });
}

export async function createUserWithToken(role: 'ADMIN' | 'MEMBER', label: string) {
  const user = await prisma.user.create({
    data: {
      name: `LQ ${label}`,
      email: `lq-test-${label}-${Date.now()}@example.com`,
      passwordHash: 'x',
      role,
      isEmailVerified: true,
      referralCode: `LQ${label}${Date.now()}`.slice(0, 20).toUpperCase(),
    },
  });
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      referralCode: user.referralCode,
      isEmailVerified: true,
      sessionVersion: user.sessionVersion,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '1h' },
  );
  return { user, token };
}

export function createApi(base: string, token?: string) {
  return async (method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}) => {
    const response = await fetch(`${base}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    // Baca byte mentah: response.text() membuang BOM UTF-8, sedangkan tes CSV perlu memeriksanya.
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await response.arrayBuffer());
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: response.status, json, text, headers: response.headers };
  };
}

type LogEntry = { event: string; payload: any; at: number; used: boolean };

export class TestClient {
  readonly socket: Socket;
  readonly log: LogEntry[] = [];
  private waiters: Array<{ event: string; where?: (p: any) => boolean; resolve: (p: any) => void }> = [];

  constructor(base: string, auth: Record<string, unknown>) {
    this.socket = ioClient(`${base}/live`, {
      auth,
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    this.socket.onAny((event: string, payload: any) => {
      const entry: LogEntry = { event, payload, at: Date.now(), used: false };
      this.log.push(entry);
      const index = this.waiters.findIndex((w) => w.event === event && (!w.where || w.where(payload)));
      if (index >= 0) {
        const [waiter] = this.waiters.splice(index, 1);
        entry.used = true;
        waiter!.resolve(payload);
      }
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.once('connect', () => resolve());
      this.socket.once('connect_error', (error: Error) => reject(error));
    });
  }

  /** Menunggu event berikutnya yang belum dikonsumsi (urut), opsional dengan filter. */
  waitFor(event: string, where?: (p: any) => boolean, timeoutMs = 12000): Promise<any> {
    const existing = this.log.find((e) => !e.used && e.event === event && (!where || where(e.payload)));
    if (existing) {
      existing.used = true;
      return Promise.resolve(existing.payload);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error(`Timeout menunggu event "${event}" (log: ${this.log.map((l) => l.event).join(',')})`));
      }, timeoutMs);
      const waiter = {
        event,
        ...(where ? { where } : {}),
        resolve: (payload: any) => {
          clearTimeout(timer);
          resolve(payload);
        },
      };
      this.waiters.push(waiter);
    });
  }

  count(event: string, where?: (p: any) => boolean) {
    return this.log.filter((e) => e.event === event && (!where || where(e.payload))).length;
  }

  emitAck(event: string, payload?: unknown, timeoutMs = 8000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Ack timeout untuk ${event}`)), timeoutMs);
      this.socket.emit(event, payload, (response: any) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }

  close() {
    this.socket.disconnect();
  }
}
