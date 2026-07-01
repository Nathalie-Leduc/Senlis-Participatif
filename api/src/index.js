import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🦌 Senlis Participatif API`);
  console.log(`   → http://localhost:${PORT}/api/v1/health`);
  console.log(`   → Environnement : ${process.env.NODE_ENV || 'development'}\n`);
});