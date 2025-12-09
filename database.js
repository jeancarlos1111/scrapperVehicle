import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const dbPath = join(__dirname, 'vehicles.db');
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Base de datos conectada:', dbPath);
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const run = promisify(this.db.run.bind(this.db));

    // Tabla de URLs visitadas
    await run(`
      CREATE TABLE IF NOT EXISTS visited_urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE NOT NULL,
        visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        relevance_score REAL,
        content_type TEXT
      )
    `);

    // Tabla de vehículos
    await run(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url_id INTEGER,
        year INTEGER,
        brand TEXT,
        model TEXT,
        condition TEXT,
        description TEXT,
        extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (url_id) REFERENCES visited_urls(id)
      )
    `);

    // Tabla de autopartes
    await run(`
      CREATE TABLE IF NOT EXISTS parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url_id INTEGER,
        part_name TEXT,
        part_number TEXT,
        brand TEXT,
        compatible_vehicle TEXT,
        description TEXT,
        extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (url_id) REFERENCES visited_urls(id)
      )
    `);

    // Tabla de URLs inválidas (bloqueadas, no responsivas, errores)
    await run(`
      CREATE TABLE IF NOT EXISTS invalid_urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE NOT NULL,
        error_type TEXT NOT NULL,
        error_message TEXT,
        failed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        retry_count INTEGER DEFAULT 0
      )
    `);

    // Índices para búsquedas rápidas
    await run(`CREATE INDEX IF NOT EXISTS idx_vehicles_brand ON vehicles(brand)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_vehicles_year ON vehicles(year)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_parts_brand ON parts(brand)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_visited_url ON visited_urls(url)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_invalid_url ON invalid_urls(url)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_invalid_error_type ON invalid_urls(error_type)`);

    // Garantizar unicidad de vehículos por combinación (brand, model, year)
    try {
      await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_unique_brand_model_year ON vehicles(brand, model, year)`);
    } catch (error) {
      console.warn('⚠️ No se pudo crear índice único (posibles duplicados existentes):', error.message);
    }

    console.log('✅ Tablas creadas correctamente');
  }

  async isUrlVisited(url) {
    const get = promisify(this.db.get.bind(this.db));
    const result = await get('SELECT id FROM visited_urls WHERE url = ?', [url]);
    return result !== undefined;
  }

  async isUrlInvalid(url) {
    const get = promisify(this.db.get.bind(this.db));
    const result = await get('SELECT id, retry_count FROM invalid_urls WHERE url = ?', [url]);
    return result !== undefined ? result : null;
  }

  async markUrlInvalid(url, errorType, errorMessage = null) {
    const run = promisify(this.db.run.bind(this.db));
    const get = promisify(this.db.get.bind(this.db));
    try {
      // Verificar si ya existe
      const existing = await this.isUrlInvalid(url);
      
      if (existing) {
        // Incrementar contador de reintentos
        await run(
          'UPDATE invalid_urls SET retry_count = retry_count + 1, failed_at = CURRENT_TIMESTAMP, error_message = ? WHERE url = ?',
          [errorMessage || 'Reintento fallido', url]
        );
      } else {
        // Insertar nueva URL inválida
        await run(
          'INSERT INTO invalid_urls (url, error_type, error_message) VALUES (?, ?, ?)',
          [url, errorType, errorMessage]
        );
      }
      console.log(`   🚫 URL marcada como inválida (${errorType}): ${url}`);
    } catch (error) {
      console.error('Error marcando URL como inválida:', error);
    }
  }

  async markUrlVisited(url, relevanceScore = null, contentType = null) {
    const run = promisify(this.db.run.bind(this.db));
    try {
      await run(
        'INSERT OR IGNORE INTO visited_urls (url, relevance_score, content_type) VALUES (?, ?, ?)',
        [url, relevanceScore, contentType]
      );
      const get = promisify(this.db.get.bind(this.db));
      const result = await get('SELECT id FROM visited_urls WHERE url = ?', [url]);
      return result.id;
    } catch (error) {
      console.error('Error marcando URL como visitada:', error);
      return null;
    }
  }

  async saveVehicle(vehicleData) {
    const run = promisify(this.db.run.bind(this.db));
    try {
      await run(
        `INSERT INTO vehicles (url_id, year, brand, model, condition, description)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(brand, model, year) DO UPDATE SET
           url_id = COALESCE(excluded.url_id, url_id),
           condition = COALESCE(excluded.condition, condition),
           description = COALESCE(excluded.description, description),
           extracted_at = CURRENT_TIMESTAMP`,
        [
          vehicleData.urlId,
          vehicleData.year,
          vehicleData.brand,
          vehicleData.model,
          vehicleData.condition,
          vehicleData.description
        ]
      );
      console.log(`✅ Vehículo guardado: ${vehicleData.year} ${vehicleData.brand} ${vehicleData.model}`);
    } catch (error) {
      console.error('Error guardando vehículo:', error);
    }
  }

  async savePart(partData) {
    const run = promisify(this.db.run.bind(this.db));
    try {
      await run(
        `INSERT INTO parts (url_id, part_name, part_number, brand, compatible_vehicle, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          partData.urlId,
          partData.partName,
          partData.partNumber,
          partData.brand,
          partData.compatibleVehicle,
          partData.description
        ]
      );
      console.log(`✅ Autoparte guardada: ${partData.partName}`);
    } catch (error) {
      console.error('Error guardando autoparte:', error);
    }
  }

  async getStats() {
    const get = promisify(this.db.get.bind(this.db));
    const vehicles = await get('SELECT COUNT(*) as count FROM vehicles') || { count: 0 };
    const parts = await get('SELECT COUNT(*) as count FROM parts') || { count: 0 };
    const urls = await get('SELECT COUNT(*) as count FROM visited_urls') || { count: 0 };
    const invalidUrls = await get('SELECT COUNT(*) as count FROM invalid_urls') || { count: 0 };
    
    return {
      vehicles: vehicles.count || 0,
      parts: parts.count || 0,
      urls: urls.count || 0,
      invalidUrls: invalidUrls.count || 0
    };
  }

  /**
   * Obtiene URLs que fueron visitadas pero no tienen datos extraídos
   * (útil para reintentar)
   */
  async getPendingUrls(limit = 50) {
    const all = promisify(this.db.all.bind(this.db));
    try {
      const results = await all(`
        SELECT v.url 
        FROM visited_urls v
        LEFT JOIN vehicles veh ON v.id = veh.url_id
        LEFT JOIN parts p ON v.id = p.url_id
        WHERE veh.id IS NULL AND p.id IS NULL
        ORDER BY v.visited_at DESC
        LIMIT ?
      `, [limit]);
      return results.map(r => r.url);
    } catch (error) {
      console.error('Error obteniendo URLs pendientes:', error);
      return [];
    }
  }

  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else {
          console.log('✅ Base de datos cerrada');
          resolve();
        }
      });
    });
  }
}

export default Database;

