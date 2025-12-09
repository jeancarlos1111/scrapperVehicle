# Scraper Autónomo de Vehículos y Autopartes

Un scraper inteligente que explora la web de forma autónoma, identifica páginas relevantes sobre vehículos (año, marca, modelo) y autopartes, y extrae datos estructurados guardándolos en una base de datos SQLite.

## 🚀 Características

- **Exploración Autónoma**: Navega por la web sin necesidad de URLs específicas
- **Detección Inteligente**: Identifica automáticamente contenido relevante sobre vehículos y autopartes
- **Extracción de Datos**: Extrae información estructurada (año, marca, modelo, condición, descripción)
- **Base de Datos SQLite**: Almacena todos los datos en una base de datos local
- **Navegación Inteligente**: Sigue enlaces prometedores basándose en relevancia
- **Soporte para Páginas Dinámicas**: ✅ Compatible con React, Vue, Angular y otras SPAs (Single Page Applications)
  - Espera automática a que el JavaScript se ejecute
  - Manejo de contenido lazy-loaded
  - Scroll automático para cargar contenido infinito
  - Detección de elementos renderizados dinámicamente
- **Protección Anti-Bot**: 🛡️ Múltiples técnicas para evadir detección
  - Puppeteer Stealth Plugin para ocultar automatización
  - Rotación de User Agents realistas
  - Headers HTTP realistas y variables
  - Simulación de comportamiento humano (movimientos de mouse, scroll)
  - Delays aleatorios entre requests
  - Detección y manejo de CAPTCHAs/bloqueos
  - Fingerprinting mejorado (WebGL, plugins, etc.)

## 📋 Requisitos

- Node.js 18 o superior
- npm o yarn

## 🔧 Instalación

1. Instalar dependencias:

```bash
npm install
```

2. Ejecutar el scraper:

```bash
npm start
```

## 📁 Estructura del Proyecto

```
scrapperVehicle/
├── index.js              # Punto de entrada principal
├── crawler.js            # Crawler autónomo
├── antiBot.js            # Módulo de protección anti-bot
├── dataExtractor.js      # Extractor de datos
├── relevanceDetector.js  # Detector de relevancia
├── database.js           # Gestión de base de datos SQLite
├── package.json
└── README.md
```

## 🗄️ Base de Datos

El scraper crea una base de datos SQLite (`vehicles.db`) con las siguientes tablas:

### `visited_urls`
Almacena todas las URLs visitadas con su score de relevancia.

### `vehicles`
Almacena información de vehículos extraídos:
- Año
- Marca
- Modelo
- Condición (nuevo/usado/seminuevo)
- Descripción

**Nota**: Los vehículos son únicos por la combinación de marca + modelo + año. No se extraen precio ni kilometraje.

### `parts`
Almacena información de autopartes:
- Nombre de la parte
- Número de parte
- Marca
- Vehículo compatible
- Descripción

## ⚙️ Configuración

Puedes modificar los parámetros en `index.js`:

```javascript
crawler.maxPages = 50;  // Número máximo de páginas a visitar
crawler.maxDepth = 2;   // Profundidad máxima de navegación
crawler.delay = 2000;   // Delay entre requests (ms)
```

## 🔍 Cómo Funciona

1. **Inicio**: El scraper comienza con URLs semilla (sitios conocidos de vehículos)
2. **Navegación**: Visita cada página y analiza su contenido
3. **Detección**: Calcula un score de relevancia basado en palabras clave
4. **Extracción**: Si la página es relevante, extrae datos estructurados
5. **Exploración**: Agrega enlaces prometedores a la cola para visitar
6. **Almacenamiento**: Guarda todos los datos en SQLite

## 📊 Consultar Datos

Puedes consultar la base de datos usando cualquier cliente SQLite:

```bash
sqlite3 vehicles.db

# Ejemplos de consultas:
SELECT * FROM vehicles LIMIT 10;
SELECT brand, COUNT(*) FROM vehicles GROUP BY brand;
SELECT * FROM parts WHERE brand = 'Toyota';
```

## 🛡️ Protección Anti-Bot

El scraper incluye múltiples técnicas para evadir detección:

### Técnicas Implementadas

1. **Puppeteer Stealth Plugin**: Oculta indicadores de automatización
   - Elimina `navigator.webdriver`
   - Modifica propiedades del navegador
   - Oculta características de headless

2. **Rotación de User Agents**: Usa User Agents reales y actualizados
   - Chrome, Firefox, Safari, Edge
   - Diferentes sistemas operativos
   - Versiones actualizadas

3. **Headers HTTP Realistas**: Headers que simulan navegadores reales
   - Accept-Language apropiado
   - Sec-Fetch-* headers
   - Referer cuando corresponde

4. **Simulación de Comportamiento Humano**:
   - Movimientos aleatorios del mouse
   - Scroll suave y progresivo
   - Clicks ocasionales en elementos
   - Delays aleatorios entre acciones

5. **Detección de Bloqueos**:
   - Detecta CAPTCHAs automáticamente
   - Identifica páginas de bloqueo (Cloudflare, etc.)
   - Intenta evadir bloqueos con recargas

6. **Fingerprinting Mejorado**:
   - WebGL spoofing
   - Plugins simulados
   - Permisos del navegador

### Limitaciones

⚠️ **Importante**: Estas técnicas mejoran las posibilidades de evadir detección, pero:
- No garantizan 100% de éxito contra todas las protecciones
- Sitios con protecciones avanzadas (Cloudflare Enterprise, etc.) pueden seguir bloqueando
- Algunos sitios requieren soluciones más avanzadas (resolución de CAPTCHAs, proxies rotativos, etc.)

## ⚠️ Consideraciones

- **Respeto a robots.txt**: El scraper no verifica robots.txt automáticamente. Úsalo responsablemente.
- **Rate Limiting**: Incluye delays aleatorios entre requests para no sobrecargar servidores
- **Legalidad**: Asegúrate de cumplir con los términos de servicio de los sitios que visites
- **Rendimiento**: El proceso puede ser lento debido a delays y simulación de comportamiento humano
- **Ética**: Usa el scraper de forma responsable y respeta las políticas de los sitios web

## 🛠️ Desarrollo

Para desarrollo con auto-reload:

```bash
npm run dev
```

## 📝 Notas Técnicas

- **Puppeteer Extra**: Usa `puppeteer-extra` con plugins stealth para mejor evasión
- **Páginas Dinámicas**: Soporta completamente React, Vue, Angular y otras SPAs:
  - Espera a que el DOM esté completamente renderizado
  - Detecta elementos comunes de frameworks (React root, Vue app, Angular ng-app)
  - Maneja contenido asíncrono y lazy-loading
  - Hace scroll automático para cargar contenido infinito
- **Detección de Relevancia**: Se basa en análisis de texto y patrones
- **Limpieza de Datos**: Los datos extraídos pueden requerir limpieza manual dependiendo de la fuente
- **Delays Aleatorios**: Los tiempos de espera son aleatorios para simular comportamiento humano real

## 📄 Licencia

MIT

