/**
 * Calcula o desconto real baseado no preço antigo e atual.
 * @param {number} oldPrice 
 * @param {number} currentPrice 
 * @returns {number}
 */
function calculateDiscount(oldPrice, currentPrice) {
    if (!oldPrice || !currentPrice || oldPrice <= currentPrice) return 0;
    return parseFloat((((oldPrice - currentPrice) / oldPrice) * 100).toFixed(2));
}

/**
 * Extrai o ASIN de uma URL da Amazon.
 * @param {string} url 
 * @returns {string|null}
 */
function extractAsin(url) {
    const match = url.match(/\/dp\/([A-Z0-9]{10})/) || url.match(/\/gp\/product\/([A-Z0-9]{10})/);
    return match ? match[1] : null;
}

/**
 * Limpa e converte string de preço para número.
 * @param {string} priceStr 
 * @returns {number|null}
 */
function parsePrice(priceStr) {
    if (!priceStr) return null;
    // Remove R$, espaços e converte vírgula para ponto
    const cleaned = priceStr.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(cleaned) || null;
}

module.exports = {
    calculateDiscount,
    extractAsin,
    parsePrice
};
