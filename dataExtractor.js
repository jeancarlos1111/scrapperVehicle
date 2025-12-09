import * as cheerio from 'cheerio';

class DataExtractor {
  constructor() {
    // Marcas comunes de vehículos
    this.brands = [
      'toyota', 'honda', 'ford', 'chevrolet', 'nissan', 'volkswagen',
      'bmw', 'mercedes-benz', 'mercedes', 'audi', 'mazda', 'hyundai',
      'kia', 'subaru', 'jeep', 'dodge', 'ram', 'gmc', 'cadillac',
      'lexus', 'infiniti', 'acura', 'volvo', 'porsche', 'jaguar',
      'land rover', 'mini', 'fiat', 'peugeot', 'renault', 'seat',
      'skoda', 'opel', 'citroën', 'alfa romeo', 'mitsubishi', 'suzuki'
    ];

    // Modelos comunes (ejemplos)
    this.commonModels = [
      'civic', 'corolla', 'camry', 'accord', 'sentra', 'altima',
      'focus', 'fiesta', 'mustang', 'silverado', 'f-150', 'ram',
      'cr-v', 'rav4', 'pilot', 'highlander', 'pathfinder', 'explorer'
    ];
  }

  /**
   * Extrae información de vehículos de una página HTML
   */
  extractVehicles(html, url) {
    const $ = cheerio.load(html);
    const vehicles = [];
    const text = $('body').text().toLowerCase();

    // Buscar patrones de vehículos en el texto
    const vehiclePatterns = this.findVehiclePatterns($, text);

    // Si encontramos patrones claros, extraer datos estructurados
    if (vehiclePatterns.length > 0) {
      vehiclePatterns.forEach(pattern => {
        const vehicle = this.parseVehicleData($, pattern, url);
        if (vehicle && this.isValidVehicle(vehicle)) {
          vehicles.push(vehicle);
        }
      });
    } else {
      // Intentar extraer de elementos estructurados (listings, cards, etc.)
      const listings = this.extractFromListings($, url);
      vehicles.push(...listings);
    }

    return vehicles;
  }

  /**
   * Busca patrones de vehículos en el texto
   */
  findVehiclePatterns($, text) {
    const patterns = [];
    const yearPattern = /\b(19|20)\d{2}\b/g;
    const years = [...text.matchAll(yearPattern)].map(m => m[0]);

    // Buscar combinaciones de año + marca + modelo
    years.forEach(year => {
      this.brands.forEach(brand => {
        if (text.includes(brand)) {
          const brandIndex = text.indexOf(brand);
          const yearIndex = text.indexOf(year);
          
          // Si están cerca (dentro de 200 caracteres), es probable que sean relacionados
          if (Math.abs(brandIndex - yearIndex) < 200) {
            patterns.push({ year, brand, context: text.substring(
              Math.min(brandIndex, yearIndex) - 50,
              Math.max(brandIndex, yearIndex) + 200
            )});
          }
        }
      });
    });

    return patterns;
  }

  /**
   * Parsea datos de vehículo de un patrón encontrado
   */
  parseVehicleData($, pattern, url) {
    const context = pattern.context.toLowerCase();
    
    // Extraer año
    const yearMatch = context.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : null;

    // Extraer marca
    let brand = pattern.brand;
    for (const b of this.brands) {
      if (context.includes(b)) {
        brand = b;
        break;
      }
    }

    // Extraer modelo (buscar después de la marca)
    let model = null;
    const brandIndex = context.indexOf(brand);
    const afterBrand = context.substring(brandIndex + brand.length, brandIndex + 100);
    
    // Buscar palabras que podrían ser modelos
    for (const m of this.commonModels) {
      if (afterBrand.includes(m)) {
        model = m;
        break;
      }
    }

    // Si no encontramos modelo conocido, intentar extraer palabra después de la marca
    if (!model) {
      const words = afterBrand.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 0) {
        model = words[0];
      }
    }

    // Extraer condición
    let condition = null;
    if (context.includes('nuevo') || context.includes('new')) condition = 'nuevo';
    else if (context.includes('usado') || context.includes('used')) condition = 'usado';
    else if (context.includes('seminuevo') || context.includes('semi')) condition = 'seminuevo';

    // Extraer descripción (primer párrafo relevante)
    const description = $('p, .description, .desc, [class*="desc"]').first().text().trim().substring(0, 500);

    return {
      year,
      brand: brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : null,
      model: model ? model.charAt(0).toUpperCase() + model.slice(1) : null,
      condition,
      description: description || null
    };
  }

  /**
   * Extrae vehículos de elementos de lista estructurados
   */
  extractFromListings($, url) {
    const vehicles = [];
    
    // Buscar en elementos comunes de listings
    const selectors = [
      '.vehicle', '.car', '.listing', '.item',
      '[class*="vehicle"]', '[class*="car"]', '[class*="listing"]',
      'article', '.card', '.product'
    ];

    selectors.forEach(selector => {
      $(selector).each((i, elem) => {
        const $elem = $(elem);
        const text = $elem.text().toLowerCase();
        
        // Verificar si contiene información de vehículo
        const hasYear = /\b(19|20)\d{2}\b/.test(text);
        const hasBrand = this.brands.some(b => text.includes(b));
        
        if (hasYear && hasBrand) {
          const vehicle = this.parseVehicleData($, { 
            context: text,
            brand: this.brands.find(b => text.includes(b)),
            year: text.match(/\b(19|20)\d{2}\b/)?.[0]
          }, url);
          
          if (vehicle && this.isValidVehicle(vehicle)) {
            vehicles.push(vehicle);
          }
        }
      });
    });

    return vehicles;
  }

  /**
   * Extrae información de autopartes
   */
  extractParts(html, url) {
    const $ = cheerio.load(html);
    const parts = [];
    const text = $('body').text().toLowerCase();

    // Buscar elementos que puedan contener información de autopartes
    const partSelectors = [
      '.part', '.repuesto', '.refaccion', '.product',
      '.product-card', '.product-item', '.product-listing',
      '.producto', '.detalle-producto', '.card-product',
      '[class*="part"]', '[class*="repuesto"]', '[class*="product"]',
      'article', '.item'
    ];

    // Keywords extendidos para autopartes
    const partKeywords = [
      'freno', 'llanta', 'neumático', 'batería', 'filtro',
      'aceite', 'amortiguador', 'radiador', 'alternador', 'bujía',
      'pastilla', 'balata', 'disco', 'rotor', 'bomba', 'correa',
      'embrague', 'clutch', 'inyector', 'sensor', 'paragolpe',
      'defensa', 'espejo', 'faro', 'foco', 'led', 'limpiaparabrisas',
      'escape', 'silenciador', 'catalizador'
    ];

    partSelectors.forEach(selector => {
      $(selector).each((i, elem) => {
        const $elem = $(elem);
        const elemText = $elem.text().toLowerCase();
        
        // Verificar si es una autoparte
        const isPart = partKeywords.some(keyword => elemText.includes(keyword));
        
        if (isPart) {
          const part = this.parsePartData($elem, url);
          if (part && this.isValidPart(part)) {
            parts.push(part);
          }
        }
      });
    });

    return parts;
  }

  /**
   * Parsea datos de autoparte
   */
  parsePartData($elem, url) {
    const text = $elem.text();
    const textLower = text.toLowerCase();

    // Extraer nombre de la parte
    const partNameMatch =
      $elem.find('h1, h2, h3, .title, .product-title, [itemprop="name"]').first().text() ||
      text.match(/^[^\n]{6,120}/);
    const partName = (partNameMatch && typeof partNameMatch === 'string'
      ? partNameMatch
      : partNameMatch?.[0])?.trim() || null;

    // Extraer número de parte
    const partNumberMatch = text.match(/(?:part\s*number|n[úu]mero\s*de\s*parte|sku|ref|pn)[:\s]+([A-Z0-9-._]+)/i);
    const partNumber = partNumberMatch ? partNumberMatch[1] : null;

    // Extraer marca
    let brand = null;
    for (const b of this.brands) {
      if (textLower.includes(b)) {
        brand = b.charAt(0).toUpperCase() + b.slice(1);
        break;
      }
    }

    // Extraer vehículo compatible
    const compatibleMatch =
      text.match(/(?:compatible\s*con|para|fits?|aplica\s*para)[:\s]+([^\n,]{5,80})/i) ||
      text.match(/(?:para\s+veh[ií]culo[s]?)[:\s]+([^\n,]{5,80})/i);
    let compatibleVehicle = compatibleMatch ? compatibleMatch[1].trim() : null;

    // Si no se detectó, intentar derivar de marca+modelo en el texto
    if (!compatibleVehicle) {
      const brandFound = this.brands.find(b => textLower.includes(b));
      if (brandFound) {
        const modelMatch = textLower.match(/(?:\b[a-z0-9]{2,}\b)\s+(?:\d{4})/i);
        compatibleVehicle = [brandFound, modelMatch?.[0]].filter(Boolean).join(' ').trim() || null;
      }
    }

    // Extraer descripción
    const description = $elem.find('p, .description, .desc, [itemprop="description"]').first().text().trim() || 
                       text.substring(0, 500);

    return {
      partName: partName || 'Autoparte',
      partNumber,
      brand,
      compatibleVehicle,
      description: description || null
    };
  }

  /**
   * Valida si un vehículo tiene datos mínimos
   */
  isValidVehicle(vehicle) {
    return vehicle && (vehicle.brand || vehicle.model || vehicle.year);
  }

  /**
   * Valida si una autoparte tiene datos mínimos
   */
  isValidPart(part) {
    return part && part.partName;
  }

  /**
   * Extrae todos los enlaces de una página
   */
  extractLinks(html, baseUrl) {
    const $ = cheerio.load(html);
    const links = [];

    $('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      const text = $(elem).text().trim();
      links.push({ href, text });
    });

    return links;
  }
}

export default DataExtractor;

