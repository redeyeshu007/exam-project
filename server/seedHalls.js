const Hall = require('./models/Hall');
const DEFAULT_HALLS = require('./seedData/defaultHalls');
const logger = require('./logger');

// Idempotent: only inserts when the Hall collection is completely empty
// (a genuinely fresh database). Once any hall exists — seeded or manually
// created — this is a permanent no-op, so deleting one of the defaults via
// Hall Designer's Delete Hall stays deleted on every future restart.
async function seedDefaultHalls() {
  const existing = await Hall.countDocuments();
  if (existing > 0) return;

  await Hall.insertMany(DEFAULT_HALLS.map(hallName => ({ hallName })));
  logger.info('Default halls seeded', { count: DEFAULT_HALLS.length });
}

module.exports = seedDefaultHalls;
