// Halls every fresh deployment should have available by default. Only
// names — capacity/rows/cols/etc. come from the Hall schema's own
// defaults on creation. Bench layouts are never seeded; each hall stays
// layout-less until designed in Hall Designer.
module.exports = [
  'CS104', 'CS105', 'CS201', 'CS202', 'CS205', 'CS206', 'CS208', 'CS209', 'CS210', 'CS211',
  'CS301', 'CS302', 'CS305', 'CS306', 'CS308', 'CS309', 'CS310', 'CS311', 'CS313', 'CS314',
  'FF LAB', 'GF LAB', 'SF LAB',
];
