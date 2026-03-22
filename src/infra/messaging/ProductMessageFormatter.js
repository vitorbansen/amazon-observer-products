/**
 * Formatador de Mensagens de Produtos
 * Estilo solicitado: Impacto -> Título Lapidado -> Preços -> Link
 */

const config = require('../../shared/constants/config');

class ProductMessageFormatter {
  /**
   * Formata um produto para envio via WhatsApp com o estilo solicitado
   */
  static formatProduct(product) {
    // Se o produto já foi lapidado pela IA, usamos os dados novos
    const impactComment = product.ai_impact || "OFERTA SELECIONADA";
    const title = product.ai_title || this._limitTitle(product.title);
    
    let message = `*${impactComment}* \n\n`;
    message += `*${title}*\n\n`;
    
    const oldPriceStr = product.oldPrice ? `${product.oldPrice.toFixed(0)}` : '';
    const currentPriceStr = `R$${product.price.toFixed(0)}`;
    
    if (oldPriceStr) {
      message += `De: ${oldPriceStr} | *Por: ${currentPriceStr} 👑*\n\n`;
    } else {
      message += `*Por: ${currentPriceStr} 👑*\n\n`;
    }
    
    message += `Link: ${product.link}`;
    
    return message;
  }

  /**
   * Limita o título a um tamanho máximo
   */
  static _limitTitle(title) {
    const maxLength = config.MESSAGING.MAX_TITLE_LENGTH || 100;
    if (title.length > maxLength) {
      return title.substring(0, maxLength) + '...';
    }
    return title;
  }
}

module.exports = ProductMessageFormatter;
