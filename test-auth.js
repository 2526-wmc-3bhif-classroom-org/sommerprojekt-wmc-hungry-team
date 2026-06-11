async function run() {
  const email = 'test3@example.com';
  const password = 'password123';
  const name = 'Test User';
  const apiBase = 'http://localhost:3000';

  try {
    console.log("Registering...");
    let res = await fetch(`${apiBase}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    console.log(await res.text());

    console.log("Logging in...");
    let loginRes = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    console.log(await loginRes.text());
    let cookie = loginRes.headers.get('set-cookie');
    console.log("Cookie:", cookie);

    console.log("Logging out...");
    let logoutRes = await fetch(`${apiBase}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie }
    });
    console.log(await logoutRes.text());
    console.log("Logout Cookie:", logoutRes.headers.get('set-cookie'));

    console.log("Logging in again...");
    let login2Res = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    console.log(await login2Res.text());
    console.log("Cookie 2:", login2Res.headers.get('set-cookie'));

  } catch (e) {
    console.error("Error:", e);
  }
}
run();
