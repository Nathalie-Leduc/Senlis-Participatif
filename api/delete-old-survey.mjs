import prisma from './src/lib/prisma.js';

const result = await prisma.survey.deleteMany({
  where: { slug: 'stationnement-centre-historique' },
});
console.log('Supprimée :', result.count);
await prisma.$disconnect();
