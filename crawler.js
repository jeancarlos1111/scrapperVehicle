import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AnonymizeUAPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import DataExtractor from './dataExtractor.js';
import RelevanceDetector from './relevanceDetector.js';
import AntiBot from './antiBot.js';

// Configurar plugins anti-detección
puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUAPlugin());

class AutonomousCrawler {
  constructor(database) {
    this.database = database;
    this.dataExtractor = new DataExtractor();
    this.relevanceDetector = new RelevanceDetector();
    this.antiBot = new AntiBot();
    this.browser = null;
    this.visitedUrls = new Set();
    this.urlQueue = [];
    this.maxDepth = 3;
    this.maxPages = 100;
    this.pagesVisited = 0;
    this.delay = 2000; // 2 segundos entre requests
    this.lastUrl = null; // Para usar como referer
  }

  async init() {
    console.log('🚀 Iniciando navegador con protección anti-bot...');
    this.browser = await puppeteer.launch({
      headless: 'new', // Usar nuevo modo headless más difícil de detectar
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--window-size=1920,1080',
        '--start-maximized',
        '--disable-infobars',
        '--disable-extensions',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--lang=es-MX,es'
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: null
    });
    console.log('✅ Navegador iniciado con modo stealth');
  }

  async start(seedUrls = []) {
    if (seedUrls.length === 0) {
      // URLs semilla por defecto - sitios conocidos de vehículos
      seedUrls = [
        'https://www.mercadolibre.com.mx/c/autos-motos-y-otros',
        'https://www.autocosmos.com.mx',
        'https://www.seminuevos.com',
        'https://www.autotrader.com',
        'https://www.cars.com'
      ];
    }

    // Agregar URLs semilla a la cola
    for (const url of seedUrls) {
      if (!await this.database.isUrlVisited(url)) {
        this.urlQueue.push({ url, depth: 0 });
      }
    }

    console.log(`📋 Iniciando crawler con ${this.urlQueue.length} URLs semilla`);

    while (this.urlQueue.length > 0 && this.pagesVisited < this.maxPages) {
      const { url, depth } = this.urlQueue.shift();

      if (depth > this.maxDepth) {
        continue;
      }

      if (this.visitedUrls.has(url) || await this.database.isUrlVisited(url)) {
        continue;
      }

      try {
        await this.crawlPage(url, depth);
        // Delay aleatorio más humano entre requests
        await this.antiBot.randomDelay(
          this.delay,
          this.delay * 2
        );
      } catch (error) {
        console.error(`❌ Error al procesar ${url}:`, error.message);
        // Si hay error, esperar más antes de continuar
        await this.antiBot.randomDelay(5000, 10000);
      }
    }

    console.log(`\n✅ Crawling completado. Páginas visitadas: ${this.pagesVisited}`);
  }

  async crawlPage(url, depth) {
    this.visitedUrls.add(url);
    this.pagesVisited++;

    console.log(`\n🔍 [${this.pagesVisited}/${this.maxPages}] Profundidad ${depth}: ${url}`);

    const page = await this.browser.newPage();
    
    try {
      // Configurar protección anti-bot
      await this.antiBot.setupPage(page, this.lastUrl);
      
      // Configurar timeouts más largos para páginas dinámicas
      page.setDefaultNavigationTimeout(60000);
      page.setDefaultTimeout(60000);

      // Navegar a la página con múltiples estrategias de espera
      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 60000
        });
      } catch (navErr) {
        console.log(`   ⚠️  Reintentando navegación (fallback load) por error: ${navErr.message}`);
        // Reintento con waitUntil 'load' y timeout más alto
        await page.goto(url, {
          waitUntil: 'load',
          timeout: 90000
        });
      }

      // Verificar si hay bloqueo
      const isBlocked = await this.antiBot.handleBlocking(page, url);
      if (isBlocked) {
        console.log(`   ⚠️  Página bloqueada, saltando...`);
        this.lastUrl = url;
        return;
      }

      // Simular comportamiento humano antes de extraer
      await this.antiBot.simulateHumanBehavior(page);

      // Esperar a que el contenido dinámico se cargue (React/Vue/Angular)
      await this.waitForDynamicContent(page);

      // Obtener HTML y título
      const html = await page.content();
      const title = await page.title();

      // Analizar relevancia
      const bodyText = await page.evaluate(() => document.body.innerText);
      const relevance = this.relevanceDetector.calculateRelevanceScore(
        bodyText,
        url,
        title
      );

      console.log(`   📊 Relevancia: ${relevance.score} (${relevance.contentType})`);

      // Marcar URL como visitada
      const urlId = await this.database.markUrlVisited(
        url,
        relevance.score,
        relevance.contentType
      );

      // Si la página es relevante, extraer datos
      if (relevance.score > 3) {
        if (relevance.contentType === 'vehicle' || relevance.contentType === 'mixed') {
          const vehicles = this.dataExtractor.extractVehicles(html, url);
          for (const vehicle of vehicles) {
            await this.database.saveVehicle({ ...vehicle, urlId });
          }
        }

        if (relevance.contentType === 'part' || relevance.contentType === 'mixed') {
          const parts = this.dataExtractor.extractParts(html, url);
          for (const part of parts) {
            await this.database.savePart({ ...part, urlId });
          }
        }
      }

      // Si no hemos alcanzado la profundidad máxima, buscar más enlaces
      if (depth < this.maxDepth && relevance.score > 2) {
        // Hacer scroll para cargar contenido lazy-loaded
        await this.scrollPage(page);
        
        const links = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a[href]'));
          return anchors.map(a => ({
            href: a.href,
            text: a.textContent.trim()
          }));
        });

        // Filtrar y agregar enlaces prometedores a la cola
        const promisingLinks = this.relevanceDetector.filterPromisingLinks(links, url);
        
        for (const link of promisingLinks) {
          if (!this.visitedUrls.has(link) && 
              !await this.database.isUrlVisited(link) &&
              this.relevanceDetector.isPromisingUrl(link)) {
            this.urlQueue.push({ url: link, depth: depth + 1 });
          }
        }

        console.log(`   🔗 Encontrados ${promisingLinks.length} enlaces prometedores`);
      }

      // Guardar URL actual como referer para la siguiente
      this.lastUrl = url;

    } catch (error) {
      console.error(`   ❌ Error procesando página: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  /**
   * Busca páginas usando búsquedas web (simuladas)
   */
  async searchAndCrawl(searchTerms) {
    console.log('🔎 Iniciando búsqueda autónoma...');
    
    // Generar URLs de búsqueda para diferentes sitios
    const searchUrls = [];
    
    for (const term of searchTerms) {
      // MercadoLibre
      searchUrls.push(`https://listado.mercadolibre.com.mx/${encodeURIComponent(term)}`);
      
      // Google (usando búsqueda de sitios específicos)
      const googleSearch = `https://www.google.com/search?q=${encodeURIComponent(term + ' site:autocosmos.com.mx OR site:seminuevos.com')}`;
      // Nota: Google puede bloquear, pero intentamos
      
      // Otros sitios
      searchUrls.push(`https://www.autocosmos.com.mx/buscar?q=${encodeURIComponent(term)}`);
    }

    // Agregar URLs de búsqueda a la cola
    for (const url of searchUrls) {
      if (!await this.database.isUrlVisited(url)) {
        this.urlQueue.push({ url, depth: 0 });
      }
    }

    await this.start([]);
  }

  /**
   * Espera a que el contenido dinámico se cargue (React/Vue/Angular)
   */
  async waitForDynamicContent(page) {
    try {
      // Esperar a que el body tenga contenido
      await page.waitForSelector('body', { timeout: 10000 });
      
      // Esperar a que React/Vue/Angular hayan renderizado
      // Buscar elementos comunes de SPAs
      const selectors = [
        '[data-reactroot]',           // React antiguo
        '#root',                      // React/Vue común
        '#app',                       // Vue común
        '[ng-app]',                   // Angular
        '[data-ng-app]',              // Angular
        '.main-content',              // Contenido principal genérico
        'main',                       // HTML5 main
        'article',                    // HTML5 article
        '[class*="container"]',       // Contenedores comunes
        '[class*="content"]'          // Contenido genérico
      ];

      // Intentar esperar por alguno de estos selectores
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          break;
        } catch (e) {
          // Continuar con el siguiente selector
        }
      }

      // Esperar a que el JavaScript haya terminado de ejecutarse
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', resolve);
            // Timeout de seguridad
            setTimeout(resolve, 2000);
          }
        });
      });

      // Esperar adicional para contenido asíncrono
      await this.sleep(2000);

      // Esperar a que no haya más cambios en el DOM (SPAs dinámicos)
      await page.evaluate(() => {
        return new Promise((resolve) => {
          let lastHeight = document.body.scrollHeight;
          let stableCount = 0;
          
          const checkStability = () => {
            const currentHeight = document.body.scrollHeight;
            if (currentHeight === lastHeight) {
              stableCount++;
              if (stableCount >= 2) {
                resolve();
                return;
              }
            } else {
              stableCount = 0;
              lastHeight = currentHeight;
            }
            setTimeout(checkStability, 500);
          };
          
          checkStability();
          // Timeout de seguridad
          setTimeout(resolve, 5000);
        });
      });

    } catch (error) {
      // Si falla, continuar de todas formas después de un delay
      console.log(`   ⚠️  Espera de contenido dinámico: ${error.message}`);
      await this.sleep(3000);
    }
  }

  /**
   * Hace scroll en la página para cargar contenido lazy-loaded
   */
  async scrollPage(page) {
    try {
      // Obtener altura de la página
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      
      // Hacer scroll progresivo
      let currentPosition = 0;
      const scrollStep = viewportHeight * 0.8;
      
      while (currentPosition < bodyHeight) {
        await page.evaluate((position) => {
          window.scrollTo(0, position);
        }, currentPosition);
        
        await this.sleep(500); // Esperar a que cargue contenido lazy
        
        currentPosition += scrollStep;
        
        // Verificar nueva altura (puede haber crecido con lazy loading)
        const newHeight = await page.evaluate(() => document.body.scrollHeight);
        if (newHeight > bodyHeight) {
          bodyHeight = newHeight;
        }
      }
      
      // Volver al inicio
      await page.evaluate(() => window.scrollTo(0, 0));
      await this.sleep(500);
      
    } catch (error) {
      console.log(`   ⚠️  Error al hacer scroll: ${error.message}`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('✅ Navegador cerrado');
    }
  }
}

export default AutonomousCrawler;

