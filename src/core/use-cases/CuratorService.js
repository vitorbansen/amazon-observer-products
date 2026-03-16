/**
 * Serviço de Curadoria
 * Filtra e organiza produtos de acordo com as regras de negócio
 */

const Logger = require('../../shared/logger/logger');
const { isValidProduct } = require('../../shared/utils/parsers');
const config = require('../../shared/constants/config');

class CuratorService {
  constructor() {
    this.logger = new Logger('CuratorService');
    this.categoryRotation = [...config.CURATION.PRIORITY_CATEGORIES];
    this.lastCategoryIndex = 0;
  }

  /**
   * Filtra produtos de acordo com as regras de qualidade
   */
  filterByQuality(products) {
    return products.filter(product => isValidProduct(product, config));
  }

  /**
   * Organiza produtos para envio respeitando a variação de categorias
   */
  organizeForSending(products, count = config.SCHEDULE.PRODUCTS_PER_SEND) {
    if (products.length === 0) return [];

    const organized = [];
    const categoryCount = {};

    // Priorizar categorias de "Casa"
    const prioritized = this._prioritizeCategories(products);

    for (const product of prioritized) {
      if (organized.length >= count) break;

      const category = product.category;
      categoryCount[category] = (categoryCount[category] || 0) + 1;

      // Evitar muitos produtos da mesma categoria seguidos
      if (categoryCount[category] <= config.CURATION.MAX_SAME_CATEGORY_CONSECUTIVE) {
        organized.push(product);
      }
    }

    return organized.slice(0, count);
  }

  /**
   * Prioriza categorias de "Casa" e faz rodízio
   */
  _prioritizeCategories(products) {
    const priorityProducts = [];
    const secondaryProducts = [];

    products.forEach(product => {
      if (config.CURATION.PRIORITY_CATEGORIES.includes(product.category)) {
        priorityProducts.push(product);
      } else if (config.CURATION.SECONDARY_CATEGORIES.includes(product.category)) {
        secondaryProducts.push(product);
      }
    });

    // Mescla: 70% prioridade, 30% secundária
    const ratio = Math.ceil(products.length * 0.7);
    return [
      ...priorityProducts.slice(0, ratio),
      ...secondaryProducts.slice(0, products.length - ratio)
    ];
  }

  /**
   * Valida se um produto tem desconto real
   */
  hasRealDiscount(product) {
    return product.discount >= config.CURATION.MIN_DISCOUNT;
  }

  /**
   * Valida se um produto tem avaliação aceitável
   */
  hasAcceptableRating(product) {
    if (!product.rating) return true; // Se não tem rating, não filtra
    return product.rating >= config.CURATION.MIN_RATING;
  }

  /**
   * Gera relatório de curadoria
   */
  generateReport(products, filtered) {
    const stats = {
      total: products.length,
      filtered: filtered.length,
      removed: products.length - filtered.length,
      byCategory: {}
    };

    filtered.forEach(product => {
      stats.byCategory[product.category] = (stats.byCategory[product.category] || 0) + 1;
    });

    return stats;
  }
}

module.exports = CuratorService;
