/**
 * Serviço de Envio WhatsApp via Z-API
 * Refatorado para ser mais robusto e testável
 */

const axios = require('axios');
const Logger = require('../../shared/logger/logger');
const { cleanText } = require('../../shared/utils/parsers');
const config = require('../../shared/constants/config');

class WhatsAppService {
  constructor(instanceId, token, clientToken = null) {
    this.instanceId = instanceId;
    this.token = token;
    this.clientToken = clientToken;
    this.logger = new Logger('WhatsAppService');

    if (!instanceId || !token) {
      throw new Error('ZAPI_INSTANCE_ID e ZAPI_TOKEN são obrigatórios');
    }

    this.baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
    this.headers = {
      'Content-Type': 'application/json'
    };

    if (clientToken) {
      this.headers['Client-Token'] = clientToken;
    }
  }

  /**
   * Envia texto para um grupo
   */
  async sendText(groupId, message) {
    if (!groupId || !message) {
      throw new Error('groupId e message são obrigatórios');
    }

    if (message.length > config.MESSAGING.MAX_MESSAGE_LENGTH) {
      throw new Error(`Mensagem excede o limite de ${config.MESSAGING.MAX_MESSAGE_LENGTH} caracteres`);
    }

    return this._sendWithRetry(async () => {
      const response = await axios.post(
        `${this.baseUrl}/send-text`,
        { phone: groupId, message },
        { headers: this.headers, timeout: 30000 }
      );

      if (response.data.error) {
        throw new Error(`Z-API Error: ${JSON.stringify(response.data)}`);
      }

      return response.data;
    });
  }

  /**
   * Envia imagem com legenda
   */
  async sendImage(groupId, imageUrl, caption = '') {
    if (!groupId || !imageUrl) {
      throw new Error('groupId e imageUrl são obrigatórios');
    }

    return this._sendWithRetry(async () => {
      const response = await axios.post(
        `${this.baseUrl}/send-image`,
        { phone: groupId, image: imageUrl, caption },
        { headers: this.headers, timeout: 30000 }
      );

      if (response.data.error) {
        throw new Error(`Z-API Error: ${JSON.stringify(response.data)}`);
      }

      return response.data;
    });
  }

  /**
   * Verifica a conexão com WhatsApp
   */
  async checkConnection() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/status`,
        { headers: this.headers, timeout: 10000 }
      );

      return response.data.connected === true;
    } catch (error) {
      this.logger.error('Erro ao verificar conexão', error);
      return false;
    }
  }

  /**
   * Envia com retry automático
   */
  async _sendWithRetry(sendFn, attempt = 1) {
    try {
      return await sendFn();
    } catch (error) {
      if (attempt < config.MESSAGING.RETRY_ATTEMPTS) {
        this.logger.warning(`Tentativa ${attempt} falhou, aguardando ${config.MESSAGING.RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, config.MESSAGING.RETRY_DELAY));
        return this._sendWithRetry(sendFn, attempt + 1);
      }

      this.logger.error(`Falha após ${attempt} tentativas`, error);
      throw error;
    }
  }
}

module.exports = WhatsAppService;
