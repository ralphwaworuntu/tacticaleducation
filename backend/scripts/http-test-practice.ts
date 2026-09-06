async function main() {
  const baseURL = process.env.API_URL ?? 'http://localhost:5000/api/v1';
  const loginResponse = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'member@tacticaleducation.id', password: 'Member@123' }),
  });
  const login = (await loginResponse.json()) as { data: { accessToken: string } };
  const token = login.data.accessToken;

  const slug = process.argv[2] ?? 'latihan-matematika-dasar';
  const practiceResponse = await fetch(`${baseURL}/exams/practice/${slug}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const practice = (await practiceResponse.json()) as unknown;
  console.log(practiceResponse.status, practice);
}

main().catch((error) => {
  console.error(error);
});
