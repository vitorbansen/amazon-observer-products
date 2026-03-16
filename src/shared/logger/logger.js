/**
 * Logger Centralizado
 * Fornece logs estruturados com diferentes níveis
 */

const config = require('../constants/config');

class Logger {
  constructor(context = 'App') {
    this.context = context;
    this.level = config.LOGGING.LEVEL;
  }

  _formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;
    
    if (config.LOGGING.FORMAT === 'json') {
      return JSON.stringify({
        timestamp,
        level,
        context: this.context,
        message,
        data: data || undefined
      });
    }
    
    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }
    return `${prefix} ${message}`;
  }

  debug(message, data = null) {
    if (['debug'].includes(this.level)) {
      console.log(this._formatMessage('debug', message, data));
    }
  }

  info(message, data = null) {
    if (['debug', 'info'].includes(this.level)) {
      console.log(this._formatMessage('info', message, data));
    }
  }

  warn(message, data = null) {
    if (['debug', 'info', 'warn'].includes(this.level)) {
      console.warn(this._formatMessage('warn', message, data));
    }
  }

  error(message, error = null) {
    const data = error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : error;
    
    console.error(this._formatMessage('error', message, data));
  }

  section(title) {
    console.log('\n' + '='.repeat(70));
    console.log(`🚀 ${title}`);
    console.log('='.repeat(70));
  }

  subsection(title) {
    console.log('\n' + '─'.repeat(70));
    console.log(`📂 ${title}`);
    console.log('─'.repeat(70));
  }

  success(message) {
    console.log(`✅ ${message}`);
  }

  warning(message) {
    console.log(`⚠️  ${message}`);
  }

  error_icon(message) {
    console.error(`❌ ${message}`);
  }

  stats(label, value) {
    console.log(`   • ${label}: ${value}`);
  }
}

module.exports = Logger;
