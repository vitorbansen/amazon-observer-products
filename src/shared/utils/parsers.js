/**
 * Utilitários de Parsing e Normalização
 */

/**
 * Calcula o desconto percentual entre preço antigo e atual
 */
function calculateDiscount(oldPrice, currentPrice) {
  if (!oldPrice || !currentPrice || oldPrice <= currentPrice) {
    return 0;
  }
  return parseFloat((((oldPrice - currentPrice) / oldPrice) * 100).toFixed(2));
}

/**
 * Extrai ASIN de uma URL da Amazon
 */
function extractAsin(url) {
  if (!url) return null;
  const match = url.match(/\/dp\/([A-Z0-9]{10})/) || url.match(/\/gp\/product\/([A-Z0-9]{10})/);
  return match ? match[1] : null;
}

/**
 * Converte string de preço para número
 * Suporta formatos: "R$ 100,50" ou "100.50"
 */
function parsePrice(priceStr) {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^\d,]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Normaliza título para comparação
 * Remove espaços extras, caracteres especiais e converte para minúsculas
 */
function normalizeTitle(title) {
  if (!title) return '';
  
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

/**
 * Remove caracteres especiais e emojis do texto
 */
function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/[*_~`]/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .trim();
}

/**
 * Valida se um produto tem qualidade mínima
 */
function isValidProduct(product, config) {
  if (!product.title || !product.price) return false;
  if (!product.asin) return false;
  if (product.discount < config.CURATION.MIN_DISCOUNT) return false;
  
  const hasBlockedKeyword = config.CURATION.BLOCKED_KEYWORDS.some(keyword =>
    product.title.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return !hasBlockedKeyword;
}

module.exports = {
  calculateDiscount,
  extractAsin,
  parsePrice,
  normalizeTitle,
  cleanText,
  isValidProduct
};
