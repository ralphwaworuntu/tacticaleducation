import http from 'http';
import { env } from './config/env';
import app from './app';
import { attachLiveGateway } from './modules/live-quiz/liveGateway';
import { liveEngine } from './modules/live-quiz/liveEngine';

const port = env.PORT;

// Express dibungkus http.Server agar Socket.IO (Live Quiz) berbagi port yang sama.
const server = http.createServer(app);
const gateway = attachLiveGateway(server);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Tactical Education API is running on port ${port}`);
  liveEngine
    .recover()
    .then((count) => {
      if (count > 0) {
        // eslint-disable-next-line no-console
        console.log(`[live-quiz] ${count} sesi aktif dipulihkan setelah restart.`);
      }
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('[live-quiz] pemulihan sesi gagal:', error);
    });
});

const shutdown = () => {
  void gateway.close().finally(() => server.close(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
