import { startCermatSession } from '../src/modules/exams/cermat.service';

async function main() {
  const session = await startCermatSession('cmjo4i85u0001xr7f5s4ahp0o', 'LETTER');
  console.log(session.mode, session.baseSet);
}

main().catch((error) => console.error(error));
