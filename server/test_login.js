require('dotenv').config();

async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    });
    const data = await res.json();
    console.log(res.status, data);
  } catch (err) {
    console.log("ERROR:", err.message);
  }
}
test();
