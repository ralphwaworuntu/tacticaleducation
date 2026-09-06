import { env } from './config/env';
import app from './app';

const port = env.PORT;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Tactical Education API is running on port ${port}`);
});
