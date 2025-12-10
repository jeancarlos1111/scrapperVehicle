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
      defaultViewport: null,
      protocolTimeout: 600000 // 600 segundos (10 minutos) para evitar timeouts en páginas complejas
    });
    console.log('✅ Navegador iniciado con modo stealth');
  }

  async start(seedUrls = [], resumeFromPending = true) {
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

    // Si se permite reanudar, cargar URLs pendientes primero
    if (resumeFromPending) {
      const pendingUrls = await this.database.getPendingUrls(100);
      if (pendingUrls.length > 0) {
        console.log(`📋 Encontradas ${pendingUrls.length} URLs pendientes de procesar`);
        for (const url of pendingUrls) {
          if (!this.visitedUrls.has(url)) {
            this.urlQueue.push({ url, depth: 1 }); // Profundidad 1 para URLs pendientes
          }
        }
      }
    }

    // Agregar URLs semilla a la cola (solo si no fueron visitadas)
    for (const url of seedUrls) {
      if (!await this.database.isUrlVisited(url) && !this.visitedUrls.has(url)) {
        this.urlQueue.push({ url, depth: 0 });
      }
    }

    console.log(`📋 Iniciando crawler con ${this.urlQueue.length} URLs en cola`);

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
        try {
          await this.antiBot.randomDelay(
            this.delay,
            this.delay * 2
          );
        } catch (delayError) {
          // Si falla el delay, continuar de todas formas
          console.log(`   ⚠️  Error en delay (ignorado): ${delayError?.message || 'Error desconocido'}`);
        }
      } catch (error) {
        // Asegurarse de capturar cualquier error, incluso si no tiene message
        const errorMessage = error?.message || error?.toString() || 'Error desconocido';
        console.error(`❌ Error al procesar ${url}: ${errorMessage}`);
        // Si hay error, esperar más antes de continuar
        try {
          await this.antiBot.randomDelay(5000, 10000);
        } catch (delayError) {
          // Si falla el delay, continuar de todas formas
          console.log(`   ⚠️  Error en delay después de error (ignorado): ${delayError?.message || 'Error desconocido'}`);
        }
        // Continuar con la siguiente URL - NO lanzar el error
      }
    }

    console.log(`\n✅ Crawling completado. Páginas visitadas: ${this.pagesVisited}`);
  }

  async crawlPage(url, depth) {
    // Verificar si ya fue visitada exitosamente
    if (await this.database.isUrlVisited(url)) {
      console.log(`   ⏭️  URL ya visitada, saltando: ${url}`);
      return;
    }

    // Verificar si está marcada como inválida (y no reintentar si tiene muchos intentos)
    const invalidUrl = await this.database.isUrlInvalid(url);
    if (invalidUrl) {
      if (invalidUrl.retry_count >= 3) {
        console.log(`   🚫 URL marcada como inválida (${invalidUrl.retry_count} intentos), saltando: ${url}`);
        return;
      }
      console.log(`   🔄 Reintentando URL previamente inválida (intento ${invalidUrl.retry_count + 1}): ${url}`);
    }

    // Agregar a visitedUrls temporalmente (solo en memoria)
    this.visitedUrls.add(url);
    this.pagesVisited++;

    console.log(`\n🔍 [${this.pagesVisited}/${this.maxPages}] Profundidad ${depth}: ${url}`);

    let page;
    try {
      // Pequeño delay antes de crear nueva página para evitar sobrecarga
      if (this.pagesVisited > 1) {
        await this.antiBot.randomDelay(500, 1500);
      }
      
      // Crear nueva página con retry en caso de timeout
      let retries = 3;
      let pageCreationFailed = false;
      while (retries > 0 && !pageCreationFailed) {
        try {
          // Pequeño delay antes de crear página para evitar sobrecarga del protocolo
          if (retries < 3) {
            await this.antiBot.randomDelay(3000, 6000);
          }
          // Intentar crear página con timeout explícito
          page = await Promise.race([
            this.browser.newPage(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Page creation timeout')), 120000)
            )
          ]);
          break;
        } catch (pageError) {
          retries--;
          const isProtocolError = pageError.message.includes('timeout') || 
                                  pageError.message.includes('ProtocolError') || 
                                  pageError.message.includes('addScriptToEvaluateOnNewDocument') ||
                                  pageError.message.includes('Page creation timeout');
          
          if (isProtocolError) {
            if (retries > 0) {
              console.log(`   ⚠️  Timeout/ProtocolError al crear página, reintentando... (${retries} intentos restantes)`);
              // Delay más largo cuando hay errores de protocolo
              await this.antiBot.randomDelay(10000, 20000);
            } else {
              console.error(`   ❌ No se pudo crear página después de 3 intentos: ${pageError.message}`);
              pageCreationFailed = true;
              // Marcar URL como inválida por protocol error
              try {
                await this.database.markUrlInvalid(url, 'protocol_error', `Error al crear página: ${pageError.message}`);
              } catch (dbError) {
                console.error(`   ⚠️  Error al marcar URL como inválida: ${dbError.message}`);
              }
              // No lanzar error, simplemente retornar para continuar con siguiente URL
              this.visitedUrls.delete(url);
              this.pagesVisited--;
              return;
            }
          } else {
            // Para otros errores, también intentar continuar
            console.error(`   ⚠️  Error inesperado al crear página: ${pageError.message}`);
            if (retries > 0) {
              await this.antiBot.randomDelay(5000, 10000);
            } else {
              pageCreationFailed = true;
              try {
                await this.database.markUrlInvalid(url, 'unknown_error', `Error al crear página: ${pageError.message}`);
              } catch (dbError) {
                console.error(`   ⚠️  Error al marcar URL como inválida: ${dbError.message}`);
              }
              this.visitedUrls.delete(url);
              this.pagesVisited--;
              return;
            }
          }
        }
      }
      
      // Si no se pudo crear la página después de todos los intentos
      if (pageCreationFailed || !page) {
        return;
      }
      
      // Configurar timeouts más largos para páginas dinámicas
      page.setDefaultNavigationTimeout(60000);
      page.setDefaultTimeout(60000);
      
      // Configurar protección anti-bot con manejo de errores
      try {
        await this.antiBot.setupPage(page, this.lastUrl);
      } catch (setupError) {
        if (setupError.message.includes('timeout') || setupError.message.includes('ProtocolError') || setupError.message.includes('addScriptToEvaluateOnNewDocument')) {
          console.log(`   ⚠️  Timeout en setupPage, continuando sin algunas protecciones...`);
          // Continuar sin algunas protecciones si hay timeout
          await page.setUserAgent(this.antiBot.getRandomUserAgent());
          await page.setViewport({ width: 1920, height: 1080 });
        } else {
          throw setupError;
        }
      }

      // Navegar a la página con múltiples estrategias de espera
      let navigationFailed = false;
      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 60000
        });
      } catch (navErr) {
        console.log(`   ⚠️  Reintentando navegación (fallback load) por error: ${navErr.message}`);
        try {
          // Reintento con waitUntil 'load' y timeout más alto
          await page.goto(url, {
            waitUntil: 'load',
            timeout: 90000
          });
        } catch (retryErr) {
          // Si el reintento también falla, marcar como inválida y lanzar error
          navigationFailed = true;
          await this.database.markUrlInvalid(url, 'navigation_timeout', retryErr.message);
          // Cerrar página antes de lanzar error
          if (page) {
            try {
              await page.close();
            } catch (e) {}
          }
          throw retryErr;
        }
      }

      // Verificar si hay bloqueo
      const isBlocked = await this.antiBot.handleBlocking(page, url);
      if (isBlocked) {
        console.log(`   ⚠️  Página bloqueada, marcando como inválida...`);
        await this.database.markUrlInvalid(url, 'blocked', 'Página bloqueada por protección anti-bot');
        this.visitedUrls.delete(url);
        this.pagesVisited--;
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

      // Marcar URL como visitada SOLO si se procesó exitosamente
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
          // Verificar que no esté visitada, no sea inválida, y sea prometedora
          const isInvalid = await this.database.isUrlInvalid(link);
          const shouldSkip = isInvalid && isInvalid.retry_count >= 3;
          
          if (!this.visitedUrls.has(link) && 
              !await this.database.isUrlVisited(link) &&
              !shouldSkip &&
              this.relevanceDetector.isPromisingUrl(link)) {
            this.urlQueue.push({ url: link, depth: depth + 1 });
          }
        }

        console.log(`   🔗 Encontrados ${promisingLinks.length} enlaces prometedores`);
      }

      // Guardar URL actual como referer para la siguiente
      this.lastUrl = url;

    } catch (error) {
      // Asegurarse de capturar cualquier error, incluso si no tiene message
      const errorMessage = error?.message || error?.toString() || 'Error desconocido';
      console.error(`   ❌ Error procesando página: ${errorMessage}`);
      
      // Verificar si ya fue marcada como inválida (para evitar doble marcado)
      let alreadyInvalid = false;
      try {
        alreadyInvalid = await this.database.isUrlInvalid(url);
      } catch (dbError) {
        console.error(`   ⚠️  Error al verificar URL inválida: ${dbError.message}`);
      }
      
      if (!alreadyInvalid) {
        // Determinar tipo de error
        let errorType = 'unknown_error';
        const errorStr = errorMessage.toLowerCase();
        if (errorStr.includes('protocolerror') || errorStr.includes('addscripttoevaluateonnewdocument')) {
          errorType = 'protocol_error';
        } else if (errorStr.includes('timeout') && !errorStr.includes('navigation_timeout')) {
          errorType = 'timeout';
        } else if (errorStr.includes('net::err') || errorStr.includes('navigation failed')) {
          errorType = 'network_error';
        } else if (errorStr.includes('blocked') || errorStr.includes('captcha')) {
          errorType = 'blocked';
        } else if (errorStr.includes('404') || errorStr.includes('not found')) {
          errorType = 'not_found';
        }
        
        // Marcar como inválida según el tipo de error (solo si no fue marcada antes)
        try {
          await this.database.markUrlInvalid(url, errorType, errorMessage);
        } catch (dbError) {
          console.error(`   ⚠️  Error al marcar URL como inválida: ${dbError.message}`);
        }
      }
      
      // NO marcar como visitada si falló - permitirá reintento
      this.visitedUrls.delete(url); // Remover del Set para permitir reintento
      this.pagesVisited--; // Descontar el contador
      
      const errorStr = errorMessage.toLowerCase();
      if (errorStr.includes('timeout') || errorStr.includes('protocolerror') || errorStr.includes('addscripttoevaluateonnewdocument')) {
        console.log(`   ⚠️  Timeout/ProtocolError detectado, esperando antes de continuar...`);
        // Delay más largo para errores de protocolo
        try {
          await this.antiBot.randomDelay(10000, 20000);
        } catch (delayError) {
          // Si falla el delay, continuar de todas formas
          console.error(`   ⚠️  Error en delay: ${delayError.message}`);
        }
      }
    } finally {
      // Asegurarse de cerrar la página siempre, incluso si hay errores
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          // Ignorar errores al cerrar página
          console.log(`   ⚠️  Error al cerrar página (ignorado): ${closeError?.message || 'Error desconocido'}`);
        }
      }
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
      let bodyHeight = await page.evaluate(() => document.body.scrollHeight);
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

