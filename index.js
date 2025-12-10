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
    crawler.maxPages = 100; // Número máximo de páginas a visitar
    crawler.maxDepth = 5;  // Profundidad máxima de navegación
    crawler.delay = 5000;  // Delay entre requests (ms)

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
    console.log(`🚫 URLs inválidas: ${stats.invalidUrls}`);
    console.log(`\n💾 Base de datos: vehicles.db`);

  } catch (error) {
    const errorMessage = error?.message || error?.toString() || 'Error desconocido';
    console.error('❌ Error fatal:', errorMessage);
    console.error('   Stack:', error?.stack || 'No disponible');
    // NO salir inmediatamente - intentar cerrar recursos primero
    try {
      await crawler.close();
    } catch (closeError) {
      console.error('   ⚠️  Error al cerrar crawler:', closeError?.message || 'Error desconocido');
    }
    try {
      await db.close();
    } catch (closeError) {
      console.error('   ⚠️  Error al cerrar base de datos:', closeError?.message || 'Error desconocido');
    }
    // Solo salir si es absolutamente necesario
    process.exit(1);
  } finally {
    try {
      await crawler.close();
    } catch (closeError) {
      console.error('   ⚠️  Error al cerrar crawler en finally:', closeError?.message || 'Error desconocido');
    }
    try {
      await db.close();
    } catch (closeError) {
      console.error('   ⚠️  Error al cerrar base de datos en finally:', closeError?.message || 'Error desconocido');
    }
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

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  const errorMessage = reason?.message || reason?.toString() || 'Error desconocido';
  console.error('❌ Error no manejado (unhandledRejection):', errorMessage);
  console.error('   Promise:', promise);
  // NO salir - solo registrar el error y continuar
});

process.on('uncaughtException', (error) => {
  const errorMessage = error?.message || error?.toString() || 'Error desconocido';
  console.error('❌ Excepción no capturada (uncaughtException):', errorMessage);
  console.error('   Stack:', error?.stack || 'No disponible');
  // Para errores críticos del sistema, sí salir
  if (errorMessage.includes('ENOENT') || errorMessage.includes('EACCES') || errorMessage.includes('EADDRINUSE')) {
    console.error('   💀 Error crítico del sistema, saliendo...');
    process.exit(1);
  }
  // Para otros errores, continuar
  console.error('   ⚠️  Continuando a pesar del error...');
});

// Ejecutar
main().catch((error) => {
  const errorMessage = error?.message || error?.toString() || 'Error desconocido';
  console.error('❌ Error en main():', errorMessage);
  console.error('   Stack:', error?.stack || 'No disponible');
  // NO salir - el error ya fue manejado en el try-catch de main()
});

