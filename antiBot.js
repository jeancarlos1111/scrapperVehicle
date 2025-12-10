/**
 * Módulo para evadir protecciones anti-bot
 */

class AntiBot {
  constructor() {
    // Pool de User Agents realistas y actualizados
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    ];

    // Headers comunes de navegadores reales
    this.commonHeaders = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };
  }

  /**
   * Obtiene un User Agent aleatorio
   */
  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Obtiene headers completos para una petición
   */
  getHeaders(referer = null) {
    const headers = { ...this.commonHeaders };
    if (referer) {
      headers['Referer'] = referer;
      headers['Sec-Fetch-Site'] = 'same-origin';
    }
    return headers;
  }

  /**
   * Configura una página para evadir detección
   */
  async setupPage(page, referer = null) {
    // User Agent aleatorio
    const userAgent = this.getRandomUserAgent();
    await page.setUserAgent(userAgent);

    // Headers adicionales
    const headers = this.getHeaders(referer);
    await page.setExtraHTTPHeaders(headers);

    // Viewport realista
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 }
    ];
    const viewport = viewports[Math.floor(Math.random() * viewports.length)];
    await page.setViewport(viewport);

    // Eliminar indicadores de automatización
    // Envolver en try-catch para manejar timeouts de protocolo
    try {
      await page.evaluateOnNewDocument(() => {
        // Ocultar webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        // Modificar permisos
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );

        // Modificar plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Modificar languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['es-MX', 'es', 'en-US', 'en'],
        });

        // Modificar chrome
        window.chrome = {
          runtime: {},
        };

        // Modificar permissions
        const originalQuery2 = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery2(parameters)
        );
      });
    } catch (error) {
      // Si falla evaluateOnNewDocument, continuar sin estas protecciones
      // No es crítico para el funcionamiento básico
      if (error.message.includes('timeout') || error.message.includes('ProtocolError') || error.message.includes('addScriptToEvaluateOnNewDocument')) {
        // Silenciosamente continuar sin estas protecciones
      } else {
        throw error;
      }
    }

    // Inyectar scripts para ocultar automatización
    try {
      await page.evaluateOnNewDocument(() => {
        // Ocultar que es headless
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Modificar getParameter para WebGL
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) {
            return 'Intel Inc.';
          }
          if (parameter === 37446) {
            return 'Intel Iris OpenGL Engine';
          }
          return getParameter.call(this, parameter);
        };
      });
    } catch (error) {
      // Si falla evaluateOnNewDocument, continuar sin estas protecciones
      if (error.message.includes('timeout') || error.message.includes('ProtocolError') || error.message.includes('addScriptToEvaluateOnNewDocument')) {
        // Silenciosamente continuar sin estas protecciones
      } else {
        throw error;
      }
    }
  }

  /**
   * Simula comportamiento humano en la página
   */
  async simulateHumanBehavior(page) {
    try {
      // Movimientos aleatorios del mouse
      await page.mouse.move(
        Math.random() * 800 + 100,
        Math.random() * 600 + 100,
        { steps: Math.floor(Math.random() * 10) + 5 }
      );

      // Pequeña pausa
      await this.randomDelay(200, 500);

      // Scroll humano (no instantáneo)
      const scrollAmount = Math.random() * 300 + 100;
      await page.evaluate((amount) => {
        window.scrollBy({
          top: amount,
          left: 0,
          behavior: 'smooth'
        });
      }, scrollAmount);

      await this.randomDelay(300, 600);

      // A veces hacer click en elementos no interactivos (comportamiento humano)
      if (Math.random() > 0.7) {
        const body = await page.$('body');
        if (body) {
          const box = await body.boundingBox();
          if (box) {
            await page.mouse.click(
              box.x + Math.random() * box.width,
              box.y + Math.random() * box.height,
              { delay: Math.random() * 100 + 50 }
            );
          }
        }
      }
    } catch (error) {
      // Ignorar errores de simulación
    }
  }

  /**
   * Delay aleatorio más humano
   */
  randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Detecta si hay un CAPTCHA o bloqueo
   */
  async detectBlocking(page) {
    try {
      const indicators = [
        'captcha',
        'cloudflare',
        'access denied',
        'blocked',
        'robot',
        'verify you are human',
        'verifica que eres humano',
        'too many requests'
      ];

      const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
      const pageTitle = await page.title().toLowerCase();
      const pageUrl = page.url().toLowerCase();

      for (const indicator of indicators) {
        if (pageText.includes(indicator) || 
            pageTitle.includes(indicator) || 
            pageUrl.includes(indicator)) {
          return true;
        }
      }

      // Verificar si hay iframes de CAPTCHA
      const captchaFrames = await page.$$('iframe[src*="recaptcha"], iframe[src*="captcha"]');
      if (captchaFrames.length > 0) {
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Maneja posibles bloqueos
   */
  async handleBlocking(page, url) {
    const isBlocked = await this.detectBlocking(page);
    
    if (isBlocked) {
      console.log(`   ⚠️  Posible bloqueo detectado en: ${url}`);
      console.log(`   💡 Intentando evadir...`);
      
      // Esperar más tiempo
      await this.randomDelay(5000, 10000);
      
      // Intentar recargar
      try {
        await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
        await this.randomDelay(3000, 6000);
      } catch (error) {
        console.log(`   ❌ No se pudo evadir el bloqueo`);
      }
    }
    
    return isBlocked;
  }
}

export default AntiBot;

