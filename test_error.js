const http = require('http');

async function test() {
  const req = http.request('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const token = JSON.parse(data).token;
      
      const payload = JSON.stringify({
        examName: 'VERIFICATION TEST',
        academicYear: '2025-2026',
        semesterType: 'ODD',
        yearSemester: 'III / VI',
        session: 'FN',
        sessionTime: 'FN & 09.30 AM - 11.30 AM',
        fromDate: '2025-01-01',
        toDate: '2025-01-10',
        block: 'CSE Block',
        sections: [
          { name: 'A', strength: 61 },
          { name: 'B', strength: 64 },
          { name: 'C', strength: 62 },
          { name: 'D', strength: 62 }
        ],
        totalStrength: 249,
        halls: [
          { hallName: 'CS209', capacity: 25 },
          { hallName: 'CS210', capacity: 25 },
          { hallName: 'CS211', capacity: 25 },
          { hallName: 'CS104', capacity: 30 },
          { hallName: 'CS105', capacity: 30 },
          { hallName: 'SF LAB', capacity: 30 },
          { hallName: 'FF LAB', capacity: 30 },
          { hallName: 'CS308', capacity: 25 },
          { hallName: 'CS313', capacity: 15 },
          { hallName: 'CS314', capacity: 14 }
        ]
      });

      const allocReq = http.request('http://localhost:5000/api/allocations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }, r2 => {
        let d2 = '';
        r2.on('data', chunk => d2 += chunk);
        r2.on('end', () => console.log('STATUS:', r2.statusCode, '\nBODY:', d2));
      });
      allocReq.write(payload);
      allocReq.end();
    });
  });
  req.write(JSON.stringify({ email: 'admin@psna.ac.in', password: 'psna@admin2025' }));
  req.end();
}
test();
