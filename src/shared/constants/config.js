/**
 * Configurações Centralizadas do Sistema
 * Todas as constantes de negócio e técnicas estão aqui
 */

module.exports = {
  // ===== REGRAS DE NEGÓCIO =====
  SCHEDULE: {
    SEND_TIMES: [8, 12, 16, 20], // Horários de envio (08:00, 12:00, 16:00, 20:00)
    PRODUCTS_PER_SEND: 5,         // 5 produtos por vez
    MAX_PRODUCTS_PER_DAY: 20,     // Máximo de 20 produtos/dia
    TIMEZONE: 'America/Sao_Paulo'
  },

  // ===== CURADORIA E FILTROS =====
  CURATION: {
    MIN_DISCOUNT: 15,             // Desconto mínimo de 15%
    MIN_RATING: 3.5,              // Avaliação mínima (se disponível)
    PRIORITY_CATEGORIES: [
      'home',
      'kitchen',
      'eletro',
      'tools'
    ],
    SECONDARY_CATEGORIES: [
      'electronics',
      'computers',
      'fashion',
      'video-games'
    ],
    BLOCKED_KEYWORDS: [
      'livro', 'apostila', 'edição escolar', 'usado', 'reembalado',
      'refil', 'peça de reposição', 'recarga', 'ebook', 'e-book',
      'revista', 'jornal', 'assinatura', 'gift card', 'vale presente',
      'curso online', 'treinamento', 'seminário'
    ],
    MAX_SAME_CATEGORY_CONSECUTIVE: 2 // Máximo 2 produtos da mesma categoria seguidos
  },

  // ===== DEDUPLICAÇÃO =====
  DEDUPLICATION: {
    HISTORY_LIMIT: 100,           // Manter histórico dos últimos 100 produtos
    RETENTION_DAYS: 30,           // Não reenviar produtos dos últimos 30 dias
    DEDUP_FIELDS: ['asin', 'title_normalized'] // Campos para deduplicação
  },

  // ===== SCRAPING =====
  SCRAPING: {
    TIMEOUT: 60000,               // 60 segundos
    VIEWPORT_WIDTH: 1920,
    VIEWPORT_HEIGHT: 1080,
    DELAY_BETWEEN_CATEGORIES: 8000,  // 8 segundos
    DELAY_BETWEEN_VERIFICATIONS: 3000, // 3 segundos
    PRICE_TOLERANCE: 0.50,        // R$ 0.50
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  },

  // ===== MENSAGENS =====
  MESSAGING: {
    MAX_MESSAGE_LENGTH: 4096,
    MAX_TITLE_LENGTH: 100,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 5000
  },

  // ===== DATABASE =====
  DATABASE: {
    PATH: './data/sent_products.db',
    TIMEOUT: 10000
  },

  // ===== LOGGING =====
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || 'info', // debug, info, warn, error
    FORMAT: 'json' // json ou text
  }
};
