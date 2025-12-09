class RelevanceDetector {
  constructor() {
    // Palabras clave relacionadas con vehículos
    this.vehicleKeywords = [
      'auto', 'carro', 'vehículo', 'automóvil', 'coche',
      'marca', 'modelo', 'año', 'kilometraje', 'km',
      'toyota', 'honda', 'ford', 'chevrolet', 'nissan', 'volkswagen',
      'bmw', 'mercedes', 'audi', 'mazda', 'hyundai', 'kia',
      'precio', 'venta', 'usado', 'nuevo', 'seminuevo',
      'motor', 'transmisión', 'combustible', 'gasolina', 'diésel',
      'sedan', 'suv', 'pickup', 'hatchback', 'coupe'
    ];

    // Palabras clave relacionadas con autopartes
    this.partsKeywords = [
      'autoparte', 'repuesto', 'refacción', 'pieza',
      'freno', 'llanta', 'neumático', 'batería', 'filtro',
      'aceite', 'amortiguador', 'radiador', 'alternador',
      'bujía', 'pastilla', 'disco', 'bomba', 'correa',
      'part number', 'número de parte', 'compatible con'
    ];

    // Patrones para detectar años
    this.yearPattern = /\b(19|20)\d{2}\b/g;
    
    // Patrones para detectar precios
    this.pricePattern = /\$\s*[\d,]+|\d+[\d,]*\s*(pesos|dólares|usd|mxn)/gi;
  }

  /**
   * Calcula un score de relevancia para una página
   */
  calculateRelevanceScore(text, url, title = '') {
    const fullText = `${title} ${text}`.toLowerCase();
    let score = 0;
    let vehicleScore = 0;
    let partsScore = 0;

    // Contar keywords de vehículos
    this.vehicleKeywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi');
      const matches = fullText.match(regex);
      if (matches) {
        vehicleScore += matches.length;
      }
    });

    // Contar keywords de autopartes
    this.partsKeywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi');
      const matches = fullText.match(regex);
      if (matches) {
        partsScore += matches.length;
      }
    });

    // Detectar años (indicio de vehículos)
    const yearMatches = fullText.match(this.yearPattern);
    if (yearMatches) {
      vehicleScore += yearMatches.length * 2;
    }

    // Detectar precios (indicio de contenido comercial)
    const priceMatches = fullText.match(this.pricePattern);
    if (priceMatches) {
      score += priceMatches.length;
    }

    // Bonus por URLs que contienen palabras clave
    const urlLower = url.toLowerCase();
    if (urlLower.includes('auto') || urlLower.includes('carro') || 
        urlLower.includes('vehiculo') || urlLower.includes('coche')) {
      score += 5;
    }
    if (urlLower.includes('parte') || urlLower.includes('repuesto') || 
        urlLower.includes('refaccion')) {
      partsScore += 3;
    }

    // Calcular score total
    score += vehicleScore * 1.5;
    score += partsScore * 1.2;

    // Determinar tipo de contenido
    let contentType = 'unknown';
    if (vehicleScore > partsScore && vehicleScore > 3) {
      contentType = 'vehicle';
    } else if (partsScore > vehicleScore && partsScore > 2) {
      contentType = 'part';
    } else if (score > 5) {
      contentType = 'mixed';
    }

    return {
      score: Math.round(score * 10) / 10,
      contentType,
      vehicleScore,
      partsScore
    };
  }

  /**
   * Determina si una URL es prometedora para explorar
   */
  isPromisingUrl(url) {
    const urlLower = url.toLowerCase();
    const promisingPatterns = [
      'auto', 'carro', 'vehiculo', 'coche', 'car',
      'parte', 'repuesto', 'refaccion', 'part',
      'venta', 'compra', 'usado', 'nuevo',
      'marca', 'modelo', 'year'
    ];

    return promisingPatterns.some(pattern => urlLower.includes(pattern));
  }

  /**
   * Filtra enlaces prometedores de una lista
   */
  filterPromisingLinks(links, baseUrl) {
    return links
      .filter(link => {
        if (!link || !link.href) return false;
        
        const href = link.href.toLowerCase();
        
        // Excluir tipos de archivo no relevantes
        const excludedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', 
                                   '.zip', '.rar', '.exe', '.mp4', '.avi'];
        if (excludedExtensions.some(ext => href.endsWith(ext))) {
          return false;
        }

        // Excluir enlaces comunes no relevantes
        const excludedPatterns = ['mailto:', 'tel:', 'javascript:', '#', 
                                 'facebook', 'twitter', 'instagram', 'youtube',
                                 'login', 'register', 'signup', 'logout'];
        if (excludedPatterns.some(pattern => href.includes(pattern))) {
          return false;
        }

        return true;
      })
      .map(link => {
        try {
          // Convertir URLs relativas a absolutas
          if (link.href.startsWith('/')) {
            const base = new URL(baseUrl);
            return new URL(link.href, base.origin).href;
          } else if (link.href.startsWith('http')) {
            return link.href;
          } else {
            return new URL(link.href, baseUrl).href;
          }
        } catch (e) {
          return null;
        }
      })
      .filter(url => url !== null)
      .filter((url, index, self) => self.indexOf(url) === index) // Eliminar duplicados
      .slice(0, 50); // Limitar a 50 enlaces más prometedores
  }
}

export default RelevanceDetector;

