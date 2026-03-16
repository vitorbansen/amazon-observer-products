/**
 * Gera link afiliado limpo da Amazon Brasil
 * @param {string} asin - ASIN do produto
 * @param {string} tag - StoreID / Tracking ID do afiliado
 * @returns {string}
 */
function buildAffiliateLink(asin, tag) {
    if (!asin) {
        throw new Error('ASIN é obrigatório para gerar link afiliado');
    }

    if (!tag) {
        throw new Error('Affiliate tag (StoreID) é obrigatório');
    }

    return `https://www.amazon.com.br/dp/${asin}/?tag=${tag}`;
}

module.exports = { buildAffiliateLink };
