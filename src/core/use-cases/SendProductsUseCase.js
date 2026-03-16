/**
 * Caso de Uso: Enviar Produtos
 * Orquestra o envio de produtos para WhatsApp
 */

const Logger = require('../../shared/logger/logger');
const ProductMessageFormatter = require('../../infra/messaging/ProductMessageFormatter');
const config = require('../../shared/constants/config');

class SendProductsUseCase {
  constructor(whatsappService, deduplicationRepository, curatorService) {
    this.whatsappService = whatsappService;
    this.deduplicationRepository = deduplicationRepository;
    this.curatorService = curatorService;
    this.logger = new Logger('SendProductsUseCase');
  }

  /**
   * Executa o caso de uso de envio
   */
  async execute(products, groupId) {
    if (!groupId) {
      throw new Error('groupId é obrigatório');
    }

    if (!products || products.length === 0) {
      this.logger.warning('Nenhum produto para enviar');
      return { sent: 0, failed: 0 };
    }

    this.logger.section('Iniciando Envio de Produtos');

    // 1. Filtrar produtos já enviados
    const newProducts = await this.deduplicationRepository.filterNewProducts(products);
    
    if (newProducts.length === 0) {
      this.logger.warning('Todos os produtos já foram enviados');
      return { sent: 0, failed: 0 };
    }

    this.logger.info(`${newProducts.length} produtos novos para enviar`);

    // 2. Filtrar por qualidade
    const qualityFiltered = this.curatorService.filterByQuality(newProducts);
    
    if (qualityFiltered.length === 0) {
      this.logger.warning('Nenhum produto passou no filtro de qualidade');
      return { sent: 0, failed: 0 };
    }

    this.logger.info(`${qualityFiltered.length} produtos passaram no filtro de qualidade`);

    // 3. Organizar para envio
    const organized = this.curatorService.organizeForSending(qualityFiltered);
    
    this.logger.info(`${organized.length} produtos serão enviados`);

    // 4. Enviar produtos
    const results = await this._sendProducts(organized, groupId);

    // 5. Registrar como enviados
    if (results.sent > 0) {
      const sentProducts = organized.slice(0, results.sent);
      await this.deduplicationRepository.markAsSent(sentProducts);
    }

    return results;
  }

  /**
   * Envia os produtos um por um
   */
  async _sendProducts(products, groupId) {
    const results = { sent: 0, failed: 0 };

    for (const product of products) {
      try {
        const message = ProductMessageFormatter.formatProduct(product);
        await this.whatsappService.sendText(groupId, message);
        
        results.sent++;
        this.logger.success(`Enviado: ${product.title.substring(0, 50)}...`);
        
        // Delay entre mensagens para evitar bloqueio
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        results.failed++;
        this.logger.error(`Falha ao enviar: ${product.title}`, error);
      }
    }

    return results;
  }
}

module.exports = SendProductsUseCase;
