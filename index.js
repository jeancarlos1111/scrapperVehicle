import Database from './database.js';
import AutonomousCrawler from './crawler.js';

async function main() {
  console.log('🚗 Scraper Autónomo de Vehículos y Autopartes\n');
  console.log('=' .repeat(50));

  const db = new Database();
  const crawler = new AutonomousCrawler(db);

  try {
    // Inicializar base de datos
    await db.init();

    // Inicializar crawler
    await crawler.init();

    // Configurar parámetros del crawler
    crawler.maxPages = 50; // Número máximo de páginas a visitar
    crawler.maxDepth = 2;  // Profundidad máxima de navegación
    crawler.delay = 2000;  // Delay entre requests (ms)

    // Opción 1: Usar URLs semilla específicas
    const seedUrls = [
      'https://www.mercadolibre.com.mx/c/autos-motos-y-otros',
      'https://www.autocosmos.com.mx',
    ];

    console.log('\n📌 Iniciando crawling con URLs semilla...\n');
    await crawler.start(seedUrls);

    // Opción 2: Búsqueda autónoma (descomentar para usar)
    // const searchTerms = [
    //   'toyota corolla 2020',
    //   'honda civic usado',
    //   'autopartes ford',
    //   'repuestos nissan'
    // ];
    // await crawler.searchAndCrawl(searchTerms);

    // Mostrar estadísticas finales
    console.log('\n' + '='.repeat(50));
    console.log('📊 ESTADÍSTICAS FINALES');
    console.log('='.repeat(50));
    
    const stats = await db.getStats();
    console.log(`✅ URLs visitadas: ${stats.urls}`);
    console.log(`🚗 Vehículos extraídos: ${stats.vehicles}`);
    console.log(`🔧 Autopartes extraídas: ${stats.parts}`);
    console.log(`\n💾 Base de datos: vehicles.db`);

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await crawler.close();
    await db.close();
  }
}

// Manejar señales de terminación
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Interrupción recibida. Cerrando...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n⚠️  Terminación recibida. Cerrando...');
  process.exit(0);
});

// Ejecutar
main().catch(console.error);

