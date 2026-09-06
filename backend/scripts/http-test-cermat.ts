async function main() {
  const baseURL = process.env.API_URL ?? 'http://localhost:5000/api/v1';
  console.log('Using baseURL:', baseURL);
  const loginResponse = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'member@tacticaleducation.id', password: 'Member@123' }),
  });
  const login = (await loginResponse.json()) as { data: { accessToken: string } };
  const token = login.data.accessToken;

  const modes = ['NUMBER', 'LETTER'] as const;
  for (const mode of modes) {
    const startResponse = await fetch(`${baseURL}/exams/cermat/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mode }),
    });
    const data = (await startResponse.json()) as { status: string; data?: { mode: string; baseSet: string[] } };
    console.log(mode, data.status, data.data?.mode, data.data?.baseSet);
  }
}

main().catch((error) => {
  console.error(error);
});
