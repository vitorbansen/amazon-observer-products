/**
 * Gerenciador de Agendamento
 * Garante o envio de produtos nos horários corretos com limite diário
 */

const cron = require('node-cron');
const Logger = require('../../shared/logger/logger');
const config = require('../../shared/constants/config');

class ScheduleManager {
  constructor(onScheduleTime) {
    this.logger = new Logger('ScheduleManager');
    this.onScheduleTime = onScheduleTime;
    this.tasks = [];
    this.productsToday = 0;
    this.lastResetDate = new Date().toDateString();
  }

  /**
   * Inicia o agendador com os horários configurados
   */
  start() {
    this.logger.section('Iniciando Scheduler');
    this.logger.info(`Horários configurados: ${config.SCHEDULE.SEND_TIMES.join(':00, ')}:00`);
    this.logger.info(`Produtos por envio: ${config.SCHEDULE.PRODUCTS_PER_SEND}`);
    this.logger.info(`Máximo por dia: ${config.SCHEDULE.MAX_PRODUCTS_PER_DAY}`);

    // Criar tarefa cron para cada horário
    config.SCHEDULE.SEND_TIMES.forEach(hour => {
      const cronExpression = `0 ${hour} * * *`;
      
      const task = cron.schedule(cronExpression, () => {
        this._onScheduleTime();
      }, {
        scheduled: true,
        timezone: config.SCHEDULE.TIMEZONE
      });

      this.tasks.push(task);
      this.logger.info(`✅ Agendado para ${String(hour).padStart(2, '0')}:00`);
    });

    // Reset diário do contador
    const resetTask = cron.schedule('0 0 * * *', () => {
      this._resetDailyCounter();
    }, {
      scheduled: true,
      timezone: config.SCHEDULE.TIMEZONE
    });

    this.tasks.push(resetTask);
    this.logger.success('Scheduler iniciado com sucesso');
  }

  /**
   * Callback executado quando um horário de envio chega
   */
  async _onScheduleTime() {
    const now = new Date();
    const timestamp = now.toLocaleString('pt-BR', { timeZone: config.SCHEDULE.TIMEZONE });
    
    this.logger.section(`Horário de Envio - ${timestamp}`);

    // Verificar limite diário
    if (this.productsToday >= config.SCHEDULE.MAX_PRODUCTS_PER_DAY) {
      this.logger.warning(`Limite diário atingido (${this.productsToday}/${config.SCHEDULE.MAX_PRODUCTS_PER_DAY})`);
      return;
    }

    // Calcular quantos produtos ainda podem ser enviados
    const remainingProducts = config.SCHEDULE.MAX_PRODUCTS_PER_DAY - this.productsToday;
    const productsToSend = Math.min(config.SCHEDULE.PRODUCTS_PER_SEND, remainingProducts);

    try {
      await this.onScheduleTime(productsToSend);
      this.productsToday += productsToSend;
      
      this.logger.info(`Contador atualizado: ${this.productsToday}/${config.SCHEDULE.MAX_PRODUCTS_PER_DAY}`);
    } catch (error) {
      this.logger.error('Erro ao executar tarefa agendada', error);
    }
  }

  /**
   * Reset do contador diário
   */
  _resetDailyCounter() {
    const now = new Date().toDateString();
    
    if (now !== this.lastResetDate) {
      this.productsToday = 0;
      this.lastResetDate = now;
      this.logger.info(`Reset diário: contador zerado`);
    }
  }

  /**
   * Para todos os agendamentos
   */
  stop() {
    this.tasks.forEach(task => task.stop());
    this.logger.info('Scheduler parado');
  }

  /**
   * Retorna o status atual
   */
  getStatus() {
    return {
      productsToday: this.productsToday,
      maxPerDay: config.SCHEDULE.MAX_PRODUCTS_PER_DAY,
      remaining: config.SCHEDULE.MAX_PRODUCTS_PER_DAY - this.productsToday,
      nextSendTimes: this._getNextSendTimes()
    };
  }

  /**
   * Calcula os próximos horários de envio
   */
  _getNextSendTimes() {
    const now = new Date();
    const currentHour = now.getHours();
    
    return config.SCHEDULE.SEND_TIMES
      .filter(hour => hour > currentHour)
      .map(hour => `${String(hour).padStart(2, '0')}:00`);
  }
}

module.exports = ScheduleManager;
