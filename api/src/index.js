import app from './app.js';
import { assertValidEnv } from './lib/validateEnv.js';

// Échoue vite et fort si la config est incomplète/incohérente —
// plutôt qu'un serveur qui démarre "normalement" mais dont les
// emails échouent silencieusement en coulisses (voir validateEnv.js).
assertValidEnv();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🦌 Senlis Participatif API`);
  console.log(`   → http://localhost:${PORT}/api/v1/health`);
  console.log(`   → Environnement : ${process.env.NODE_ENV || 'development'}\n`);
});