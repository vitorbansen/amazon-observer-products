/**
 * Arquivo Principal - Composition Root
 * Inicializa todas as dependências e orquestra a aplicação
 */

require('dotenv').config();

const Logger = require('./shared/logger/logger');
const config = require('./shared/constants/config');

// Importar repositórios e serviços
const DeduplicationRepository = require('./infra/database/DeduplicationRepository');
const WhatsAppService = require('./infra/messaging/WhatsAppService');
const ScheduleManager = require('./infra/scheduler/ScheduleManager');

// Importar casos de uso
const CuratorService = require('./core/use-cases/CuratorService');
const SendProductsUseCase = require('./core/use-cases/SendProductsUseCase');

// Importar scraper (será refatorado depois)
const { scrapeGoldbox } = require('./pages/scraping-amazon');
const { startBrowser } = require('./browser/browser');

const logger = new Logger('Main');

/**
 * Classe principal da aplicação
 */
class AmazonObserverApp {
  constructor() {
    this.logger = new Logger('AmazonObserverApp');
    this.deduplicationRepository = null;
    this.whatsappService = null;
    this.curatorService = null;
    this.sendProductsUseCase = null;
    this.scheduleManager = null;
  }

  /**
   * Inicializa a aplicação
   */
  async initialize() {
    this.logger.section('Inicializando Amazon Observer');

    try {
      // Inicializar repositório de deduplicação
      this.deduplicationRepository = new DeduplicationRepository();
      await this.deduplicationRepository.initialize();

      // Inicializar serviço de WhatsApp
      this.whatsappService = new WhatsAppService(
        process.env.ZAPI_INSTANCE_ID,
        process.env.ZAPI_TOKEN,
        process.env.ZAPI_CLIENT_TOKEN
      );

      // Verificar conexão com WhatsApp
      const isConnected = await this.whatsappService.checkConnection();
      if (!isConnected) {
        this.logger.warning('WhatsApp não está conectado. Verifique as credenciais.');
      } else {
        this.logger.success('Conectado ao WhatsApp');
      }

      // Inicializar serviços de negócio
      this.curatorService = new CuratorService();
      this.sendProductsUseCase = new SendProductsUseCase(
        this.whatsappService,
        this.deduplicationRepository,
        this.curatorService
      );

      // Inicializar scheduler
      this.scheduleManager = new ScheduleManager(
        this._onScheduleTime.bind(this)
      );

      this.logger.success('Aplicação inicializada com sucesso');
    } catch (error) {
      this.logger.error('Erro ao inicializar aplicação', error);
      throw error;
    }
  }

  /**
   * Inicia o scheduler
   */
  start() {
    this.scheduleManager.start();
  }

  /**
   * Callback executado quando um horário de envio chega
   */
  async _onScheduleTime(productsToSend) {
    this.logger.section('Executando Scraping de Produtos');

    let browser;
    try {
      // Iniciar navegador e fazer scraping
      browser = await startBrowser();
      const page = await browser.newPage();
      await page.setViewport({
        width: config.SCRAPING.VIEWPORT_WIDTH,
        height: config.SCRAPING.VIEWPORT_HEIGHT
      });

      const products = await scrapeGoldbox(page);
      this.logger.info(`${products.length} produtos encontrados`);

      if (products.length > 0) {
        // Enviar produtos
        const groupId = process.env.WHATSAPP_GROUP_ID;
        if (!groupId) {
          this.logger.error('WHATSAPP_GROUP_ID não configurado no .env');
          return;
        }

        const results = await this.sendProductsUseCase.execute(products, groupId);
        this.logger.info(`Enviados: ${results.sent}, Falhados: ${results.failed}`);

        // Mostrar estatísticas
        const stats = await this.deduplicationRepository.getStats();
        this.logger.info(`Total no histórico: ${stats.total}/${config.DEDUPLICATION.HISTORY_LIMIT}`);
      }
    } catch (error) {
      this.logger.error('Erro durante execução agendada', error);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Encerra a aplicação
   */
  async shutdown() {
    this.logger.section('Encerrando Aplicação');
    
    if (this.scheduleManager) {
      this.scheduleManager.stop();
    }

    if (this.deduplicationRepository) {
      await this.deduplicationRepository.close();
    }

    this.logger.success('Aplicação encerrada');
  }
}

/**
 * Função de inicialização
 */
async function main() {
  const app = new AmazonObserverApp();

  try {
    await app.initialize();
    app.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await app.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await app.shutdown();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Erro fatal', error);
    process.exit(1);
  }
}

// Executar se for o arquivo principal
if (require.main === module) {
  main();
}

module.exports = AmazonObserverApp;
