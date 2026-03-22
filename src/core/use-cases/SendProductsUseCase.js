/**
 * Caso de Uso: Enviar Produtos
 * Orquestra o envio de produtos para WhatsApp com Curadoria Inteligente e Copy da IA
 */

const Logger = require('../../shared/logger/logger');
const ProductMessageFormatter = require('../../infra/messaging/ProductMessageFormatter');
const AIService = require('../services/AIService');

class SendProductsUseCase {
  constructor(whatsappService, deduplicationRepository, curatorService) {
    this.whatsappService = whatsappService;
    this.deduplicationRepository = deduplicationRepository;
    this.curatorService = curatorService;
    this.aiService = new AIService();
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

    this.logger.section('Iniciando Envio de Produtos com IA');

    // 1. Filtrar produtos já enviados
    const newProducts = await this.deduplicationRepository.filterNewProducts(products);
    
    if (newProducts.length === 0) {
      this.logger.warning('Todos os produtos já foram enviados');
      return { sent: 0, failed: 0 };
    }

    this.logger.info(`${newProducts.length} produtos novos para enviar`);

    // 2. Filtrar por qualidade básica (desconto mínimo, categorias permitidas)
    const qualityFiltered = this.curatorService.filterByQuality(newProducts);
    
    if (qualityFiltered.length === 0) {
      this.logger.warning('Nenhum produto passou no filtro de qualidade básica');
      return { sent: 0, failed: 0 };
    }

    // 3. Avaliar com IA (Filtro Inteligente + Lapidação de Copy)
    const aiFiltered = [];
    for (const product of qualityFiltered) {
      const evaluation = await this.aiService.evaluateOffer(product);
      
      // Se a nota for maior ou igual a 70, o produto é digno de envio
      if (evaluation.score >= 70) {
        // Guardamos as informações da IA no objeto do produto
        product.ai_score = evaluation.score;
        product.ai_reason = evaluation.reason;
        product.ai_impact = evaluation.impact_comment; // Ex: "PRA GUARDAR DE ESTOQUE"
        product.ai_title = evaluation.polished_title;  // Título limpo e lapidado pela IA
        aiFiltered.push(product);
      } else {
        this.logger.debug(`Produto descartado pela IA (Nota: ${evaluation.score}): ${product.title.substring(0, 50)}`);
      }
    }

    if (aiFiltered.length === 0) {
      this.logger.warning('Nenhum produto passou no filtro da IA');
      return { sent: 0, failed: 0 };
    }

    this.logger.info(`${aiFiltered.length} produtos aprovados pela IA`);

    // 4. Organizar para envio
    const organized = this.curatorService.organizeForSending(aiFiltered);
    
    this.logger.info(`${organized.length} produtos serão enviados com copy personalizado`);

    // 5. Enviar produtos com Imagem Original e Copy da IA
    const results = await this._sendProducts(organized, groupId);

    // 6. Registrar como enviados
    if (results.sent > 0) {
      const sentProducts = organized.slice(0, results.sent);
      await this.deduplicationRepository.markAsSent(sentProducts);
    }

    return results;
  }

  /**
   * Envia os produtos um por um com imagem original e delay
   */
  async _sendProducts(products, groupId) {
    const results = { sent: 0, failed: 0 };

    for (const product of products) {
      try {
        this.logger.info(`Processando envio de: ${product.title.substring(0, 50)}...`);

        // Usamos a imagem original do produto (extraída no scraping)
        const productImageUrl = product.imageUrl;
        
        // Formatar mensagem final usando os dados lapidados pela IA
        const message = ProductMessageFormatter.formatProduct(product);
        
        // Enviar via WhatsApp (Imagem com Legenda)
        await this.whatsappService.sendImage(groupId, productImageUrl, message);
        
        results.sent++;
        this.logger.success(`Enviado com sucesso: ${product.title.substring(0, 50)}...`);
        
        // Delay entre mensagens para evitar bloqueio do WhatsApp
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        results.failed++;
        this.logger.error(`Falha ao enviar: ${product.title}`, error);
      }
    }

    return results;
  }
}

module.exports = SendProductsUseCase;
