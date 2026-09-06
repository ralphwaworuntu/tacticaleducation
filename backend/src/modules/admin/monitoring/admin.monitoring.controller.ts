import { Request, Response } from 'express';
import os from 'os';

export async function getSystemMetrics(req: Request, res: Response) {
  const freeMemory = os.freemem();
  const totalMemory = os.totalmem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;

  const cpus = os.cpus();
  const cpuUsage = cpus.map((cpu, i) => {
    const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
    const idle = cpu.times.idle;
    const active = total - idle;
    return {
      core: i,
      model: cpu.model,
      speed: cpu.speed,
      usage: (active / total) * 100,
    };
  });

  const uptime = os.uptime();

  res.json({
    memory: {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      usage: memoryUsage,
    },
    cpu: cpuUsage,
    uptime,
  });
}
