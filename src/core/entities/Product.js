/**
 * Entidade Product
 * Representa um produto da Amazon com todas as suas propriedades
 */

class Product {
  constructor(data) {
    this.asin = data.asin;
    this.title = data.title;
    this.price = data.price;
    this.oldPrice = data.oldPrice || null;
    this.discount = data.discount || 0;
    this.category = data.category;
    this.link = data.link;
    this.imageUrl = data.imageUrl || null;
    this.rating = data.rating || null;
    this.reviewCount = data.reviewCount || 0;
    this.isPrime = data.isPrime || false;
    this.scrapedAt = data.scrapedAt || new Date();
  }

  /**
   * Valida se o produto tem os campos obrigatórios
   */
  isValid() {
    return !!(this.asin && this.title && this.price && this.category && this.link);
  }

  /**
   * Retorna um objeto serializado para armazenamento
   */
  toJSON() {
    return {
      asin: this.asin,
      title: this.title,
      price: this.price,
      oldPrice: this.oldPrice,
      discount: this.discount,
      category: this.category,
      link: this.link,
      imageUrl: this.imageUrl,
      rating: this.rating,
      reviewCount: this.reviewCount,
      isPrime: this.isPrime,
      scrapedAt: this.scrapedAt.toISOString()
    };
  }

  /**
   * Cria uma instância de Product a partir de um objeto JSON
   */
  static fromJSON(json) {
    return new Product({
      asin: json.asin,
      title: json.title,
      price: json.price,
      oldPrice: json.oldPrice,
      discount: json.discount,
      category: json.category,
      link: json.link,
      imageUrl: json.imageUrl,
      rating: json.rating,
      reviewCount: json.reviewCount,
      isPrime: json.isPrime,
      scrapedAt: new Date(json.scrapedAt)
    });
  }
}

module.exports = Product;
