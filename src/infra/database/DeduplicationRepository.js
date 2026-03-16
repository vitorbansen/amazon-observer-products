/**
 * Repositório de Deduplicação
 * Gerencia o histórico de produtos enviados e evita duplicatas
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const Logger = require('../../shared/logger/logger');
const { normalizeTitle } = require('../../shared/utils/parsers');
const config = require('../../shared/constants/config');

class DeduplicationRepository {
  constructor(dbPath = config.DATABASE.PATH) {
    this.dbPath = dbPath;
    this.db = null;
    this.logger = new Logger('DeduplicationRepository');
  }

  /**
   * Inicializa o banco de dados
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          this.logger.error('Erro ao abrir banco de dados', err);
          reject(err);
          return;
        }

        try {
          await this._createTable();
          this.logger.success('Sistema de deduplicação inicializado');
          resolve();
        } catch (error) {
          this.logger.error('Erro ao criar tabela', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Cria a tabela de produtos enviados
   */
  async _createTable() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS sent_products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          asin TEXT UNIQUE NOT NULL,
          title_normalized TEXT NOT NULL,
          title_original TEXT,
          price REAL,
          discount REAL,
          category TEXT,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          this._createIndex().then(resolve).catch(reject);
        }
      });
    });
  }

  /**
   * Cria índices para melhorar performance
   */
  async _createIndex() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_asin ON sent_products(asin)
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Verifica se um produto já foi enviado
   */
  async wasAlreadySent(asin) {
    if (!asin) return false;

    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT asin FROM sent_products WHERE asin = ? LIMIT 1',
        [asin],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  /**
   * Filtra apenas produtos novos (não enviados)
   */
  async filterNewProducts(products) {
    const newProducts = [];

    for (const product of products) {
      if (!product.asin) continue;

      const alreadySent = await this.wasAlreadySent(product.asin);
      if (!alreadySent) {
        newProducts.push(product);
      } else {
        this.logger.debug(`Duplicata removida: ${product.title.substring(0, 60)}...`);
      }
    }

    return newProducts;
  }

  /**
   * Registra produtos como enviados
   */
  async markAsSent(products) {
    if (!products || products.length === 0) return;

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO sent_products (asin, title_normalized, title_original, price, discount, category)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      let inserted = 0;

      products.forEach((product) => {
        if (product.asin && product.title) {
          const normalized = normalizeTitle(product.title);
          stmt.run(
            product.asin,
            normalized,
            product.title.substring(0, 300),
            product.price || 0,
            product.discount || 0,
            product.category || 'Sem categoria'
          );
          inserted++;
        }
      });

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          this.logger.info(`${inserted} produtos registrados no histórico`);
          this._cleanOldEntries().then(resolve).catch(reject);
        }
      });
    });
  }

  /**
   * Limpa entradas antigas (mantém apenas as últimas N)
   */
  async _cleanOldEntries() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        DELETE FROM sent_products
        WHERE id NOT IN (
          SELECT id FROM sent_products
          ORDER BY sent_at DESC
          LIMIT ?
        )
      `, [config.DEDUPLICATION.HISTORY_LIMIT], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Obtém estatísticas do histórico
   */
  async getStats() {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT
          COUNT(*) as total,
          COUNT(DISTINCT category) as categories,
          AVG(discount) as avg_discount
        FROM sent_products
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            total: row.total || 0,
            categories: row.categories || 0,
            avg_discount: row.avg_discount || 0
          });
        }
      });
    });
  }

  /**
   * Fecha a conexão com o banco
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = DeduplicationRepository;
