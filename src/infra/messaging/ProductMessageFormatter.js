/**
 * Formatador de Mensagens de Produtos
 * Cria mensagens humanizadas para WhatsApp
 */

const { cleanText } = require('../../shared/utils/parsers');
const config = require('../../shared/constants/config');

class ProductMessageFormatter {
  /**
   * Formata um produto para envio via WhatsApp
   */
  static formatProduct(product) {
    const title = this._limitTitle(product.title);
    const discount = product.discount ? `${product.discount.toFixed(0)}%` : 'Desconto';
    
    let message = `🔥 *OFERTA IMPERDÍVEL*\n\n`;
    message += `*${title}*\n\n`;
    
    if (product.oldPrice) {
      message += `De: R$ ${product.oldPrice.toFixed(2)}\n`;
    }
    
    message += `💰 *Por: R$ ${product.price.toFixed(2)}*\n`;
    message += `📊 Desconto: ${discount}\n`;
    
    if (product.rating) {
      message += `⭐ Avaliação: ${product.rating}/5\n`;
    }
    
    if (product.isPrime) {
      message += `📦 Frete Prime\n`;
    }
    
    message += `\n🛍️ *COMPRE AQUI:*\n${product.link}`;
    
    return message;
  }

  /**
   * Formata múltiplos produtos para um lote de envio
   */
  static formatBatch(products) {
    const messages = [];
    
    products.forEach((product, index) => {
      const message = this.formatProduct(product);
      messages.push(message);
    });
    
    return messages;
  }

  /**
   * Limita o título a um tamanho máximo
   */
  static _limitTitle(title) {
    if (title.length > config.MESSAGING.MAX_TITLE_LENGTH) {
      return title.substring(0, config.MESSAGING.MAX_TITLE_LENGTH) + '...';
    }
    return title;
  }

  /**
   * Cria uma mensagem de resumo do lote
   */
  static createBatchSummary(products) {
    const categories = {};
    
    products.forEach(product => {
      categories[product.category] = (categories[product.category] || 0) + 1;
    });
    
    let summary = `📦 *LOTE DE OFERTAS*\n\n`;
    summary += `Total: ${products.length} produtos\n`;
    summary += `Desconto médio: ${(products.reduce((a, b) => a + b.discount, 0) / products.length).toFixed(0)}%\n\n`;
    summary += `*Categorias:*\n`;
    
    Object.entries(categories).forEach(([category, count]) => {
      summary += `• ${category}: ${count}\n`;
    });
    
    return summary;
  }
}

module.exports = ProductMessageFormatter;
