async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cseexamcell2023@gmail.com', password: 'psna@admin2025' })
    });
    const data = await res.json();
    console.log(res.status, data);
  } catch (err) {
    console.log("ERROR:", err.message);
  }
}
test();
