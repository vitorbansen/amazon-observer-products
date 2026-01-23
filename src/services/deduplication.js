// ========================================
// 🛡️ SISTEMA DE CONTROLE ANTI-REPETIÇÃO
// ========================================
// Rastreia os últimos 100 ASINs enviados para evitar duplicatas

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DeduplicationService {
    constructor(dbPath = './data/sent_products.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.MAX_HISTORY = 100; // Mantém apenas os últimos 100 produtos
    }

    /**
     * 🔧 Inicializa o banco de dados
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            // Criar diretório se não existir
            const dir = path.dirname(this.dbPath);
            const fs = require('fs');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Erro ao abrir banco de dados:', err);
                    reject(err);
                    return;
                }

                // Criar tabela se não existir
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS sent_products (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        asin TEXT NOT NULL UNIQUE,
                        title TEXT,
                        price REAL,
                        discount REAL,
                        category TEXT,
                        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('❌ Erro ao criar tabela:', err);
                        reject(err);
                    } else {
                        console.log('✅ Sistema anti-repetição inicializado');
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * 🔍 Verifica se um ASIN já foi enviado recentemente
     */
    async wasRecentlySent(asin) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT asin FROM sent_products WHERE asin = ? LIMIT 1',
                [asin],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(!!row);
                    }
                }
            );
        });
    }

    /**
     * 📊 Filtra produtos que já foram enviados
     */
    async filterNewProducts(products) {
        const newProducts = [];
        
        console.log(`\n🔍 Verificando ${products.length} produtos contra histórico...`);
        
        for (const product of products) {
            if (!product.asin) {
                console.warn(`⚠️  Produto sem ASIN, pulando: ${product.title?.substring(0, 50)}`);
                continue;
            }

            const alreadySent = await this.wasRecentlySent(product.asin);
            
            if (!alreadySent) {
                newProducts.push(product);
            } else {
                console.log(`⏭️  Duplicata removida: ${product.title?.substring(0, 50)}...`);
            }
        }

        console.log(`✅ ${newProducts.length}/${products.length} produtos são novos\n`);
        
        return newProducts;
    }

    /**
     * 💾 Registra produtos como enviados
     */
    async markAsSent(products) {
        if (!products || products.length === 0) {
            return;
        }

        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR IGNORE INTO sent_products (asin, title, price, discount, category)
                VALUES (?, ?, ?, ?, ?)
            `);

            let inserted = 0;

            products.forEach((product) => {
                if (product.asin) {
                    stmt.run(
                        product.asin,
                        product.title?.substring(0, 200) || 'Sem título',
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
                    console.log(`💾 ${inserted} produtos registrados no histórico`);
                    
                    // Limpar histórico antigo (manter apenas últimos 100)
                    this.cleanOldEntries().then(resolve).catch(reject);
                }
            });
        });
    }

    /**
     * 🗑️ Limpa entradas antigas (mantém apenas últimas 100)
     */
    async cleanOldEntries() {
        return new Promise((resolve, reject) => {
            this.db.run(`
                DELETE FROM sent_products
                WHERE id NOT IN (
                    SELECT id FROM sent_products
                    ORDER BY sent_at DESC
                    LIMIT ?
                )
            `, [this.MAX_HISTORY], (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.db.get('SELECT COUNT(*) as count FROM sent_products', (err, row) => {
                        if (!err && row) {
                            console.log(`🗂️  Histórico: ${row.count} produtos registrados`);
                        }
                        resolve();
                    });
                }
            });
        });
    }

    /**
     * 📊 Estatísticas do histórico
     */
    async getStats() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(DISTINCT category) as categories,
                    AVG(discount) as avg_discount,
                    MIN(sent_at) as oldest,
                    MAX(sent_at) as newest
                FROM sent_products
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows[0]);
                }
            });
        });
    }

    /**
     * 📋 Lista últimos produtos enviados
     */
    async getRecentProducts(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT asin, title, category, discount, sent_at
                FROM sent_products
                ORDER BY sent_at DESC
                LIMIT ?
            `, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * 🧹 Limpar todo o histórico (usar com cuidado!)
     */
    async clearHistory() {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM sent_products', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('🗑️  Histórico completamente limpo');
                    resolve();
                }
            });
        });
    }

    /**
     * 🔒 Fecha a conexão com o banco de dados
     */
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('🔒 Banco de dados fechado');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

// ========================================
// 📦 EXPORTAÇÃO
// ========================================

module.exports = { DeduplicationService };