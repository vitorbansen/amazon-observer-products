const { parsePrice, calculateDiscount, extractAsin } = require('../extractors/extractor');
const { buildAffiliateLink } = require('../services/amazonAffiliate.service');

// ✅ CONFIGURAÇÕES DE SCRAPING SEGURO
const CONFIG = {
    // Tag de afiliado (StoreID) - CONFIGURE AQUI SUA TAG
    AFFILIATE_TAG: process.env.AMAZON_AFFILIATE_TAG || 'toppromobr054-20',
    
    // Filtros rígidos
    MIN_PRICE: 20,
    MAX_PRICE: 1500,
    MIN_DISCOUNT: 25,           // Apenas descontos >= 25%
    REQUIRE_PRIME: false,       // Prime opcional
    
    // Limites de validação (anti-ban)
    MAX_VALIDATIONS: 12,        // Nunca validar mais que 12 produtos
    TARGET_VALID_PRODUCTS: 8,   // Parar ao encontrar 8 produtos válidos
    
    // Delays (comportamento humano)
    DELAY_BETWEEN_MIN: 4000,    // Mínimo 4 segundos
    DELAY_BETWEEN_MAX: 7000,    // Máximo 7 segundos
    
    // Score mínimo para validação
    MIN_PRODUCT_SCORE: 60
};

// ✅ CATEGORIAS DISPONÍVEIS PARA BUSCA ALEATÓRIA
const CATEGORIES = [
    { 
        id: 'beauty', 
        url: 'https://www.amazon.com.br/gp/goldbox?bubble-id=deals-collection-beauty',
        name: 'Beleza'
    },
    { 
        id: 'electronics', 
        url: 'https://www.amazon.com.br/gp/goldbox?bubble-id=deals-collection-electronics',
        name: 'Eletrônicos'
    },
    { 
        id: 'home', 
        url: 'https://www.amazon.com.br/gp/goldbox?bubble-id=deals-collection-home',
        name: 'Casa'
    },
    { 
        id: 'kitchen', 
        url: 'https://www.amazon.com.br/gp/goldbox?bubble-id=deals-collection-kitchen',
        name: 'Cozinha'
    },
    { 
        id: 'baby', 
        url: 'https://www.amazon.com.br/gp/goldbox?bubble-id=deals-collection-baby',
        name: 'Bebês'
    },
    { 
        id: 'pet-products', 
        url: 'https://www.amazon.com.br/gp/goldbox?bubble-id=deals-collection-pet-products',
        name: 'Pet Shop'
    },
    { 
        id: 'video-games', 
        url: 'https://www.amazon.com.br/gp/goldbox?bubble-id=deals-collection-video-games',
        name: 'Games'
    },
    { 
        id: 'fashion', 
        url: 'https://www.amazon.com.br/gp/goldbox?bubble-id=deals-collection-fashion',
        name: 'Moda'
    },
    { 
        id: 'eletro', 
        url: 'https://www.amazon.com.br/gp/goldbox?bubble-id=deals-collection-eletro',
        name: 'Eletrodomésticos'
    },
    { 
        id: 'sports', 
        url: 'https://www.amazon.com.br/gp/goldbox?bubble-id=deals-collection-sports',
        name: 'Esportes'
    },
    { 
        id: 'tools', 
        url: 'https://www.amazon.com.br/gp/goldbox?bubble-id=deals-collection-tools',
        name: 'Ferramentas'
    },
    { 
        id: 'computers', 
        url: 'https://www.amazon.com.br/gp/goldbox?bubble-id=deals-collection-computers',
        name: 'Informática'
    }
];

// ✅ PALAVRAS-CHAVE BLOQUEADAS (produtos que não convertem)
const BLOCKED_KEYWORDS = [
    'livro', 'apostila', 'edição escolar', 'usado', 'reembalado',
    'refil', 'peça de reposição', 'recarga', 'ebook', 'e-book',
    'revista', 'jornal', 'assinatura', 'gift card', 'vale presente',
    'curso online', 'treinamento', 'seminário', 'Matemática'
];

/**
 * ✅ SELECIONAR CATEGORIA ALEATÓRIA
 */
function selectRandomCategory() {
    const randomIndex = Math.floor(Math.random() * CATEGORIES.length);
    return CATEGORIES[randomIndex];
}

/**
 * ✅ SCRAPER PRINCIPAL COM CATEGORIA ALEATÓRIA
 */
async function scrapeGoldbox(page, specificCategory = null) {
    // Selecionar categoria (aleatória ou específica)
    const category = specificCategory || selectRandomCategory();
    
    console.log("\n" + "=".repeat(60));
    console.log(`🎯 CATEGORIA SELECIONADA: ${category.name.toUpperCase()}`);
    console.log("=".repeat(60));
    console.log(`📍 URL: ${category.url}\n`);
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
    await page.goto(category.url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Delay aleatório
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

    // Rolar a página para carregar conteúdo dinâmico
    await autoScroll(page);
    
    // Esperar um pouco mais para o React renderizar
    await new Promise(r => setTimeout(r, 5000));

    const products = await page.evaluate(() => {
        const items = [];
        const cards = document.querySelectorAll('[data-testid="product-card"], .ProductCard-module__card_uyr_Jh7WpSkPx4iEpn4w, div[data-asin]');
        console.log(`Encontrados ${cards.length} possíveis cards.`);
        
        cards.forEach(card => {
            try {
                const titleEl = card.querySelector('p[id^="title-"] .a-truncate-full, p[id^="title-"] span');
                const priceEl = card.querySelector('[data-testid="price-section"] .a-price-whole, .ProductCard-module__priceToPay_olAgJzVNGyj2javg2pAe .a-price-whole');
                const fractionEl = card.querySelector('[data-testid="price-section"] .a-price-fraction, .ProductCard-module__priceToPay_olAgJzVNGyj2javg2pAe .a-price-fraction');
                const oldPriceEl = card.querySelector('[data-a-strike="true"], .ProductCard-module__wrapPrice__sMO92NjAjHmGPn3jnIH .a-text-price');
                const linkEl = card.querySelector('a[data-testid="product-card-link"], a[href*="/dp/"]');
                const primeEl = card.querySelector('.a-icon-prime, [aria-label*="Prime"]');

                if (titleEl && linkEl) {
                    let priceText = "";
                    if (priceEl) {
                        priceText = priceEl.innerText + (fractionEl ? ',' + fractionEl.innerText : '');
                    } else {
                        const match = card.innerText.match(/R\$\s?(\d+[\.,]\d{2})/);
                        if (match) priceText = match[1].replace('.', ',');
                    }

                    if (priceText && 
                        priceText.length > 0 && 
                        !priceText.toLowerCase().includes('não disponível') &&
                        !priceText.toLowerCase().includes('indisponível')) {
                        
                        items.push({
                            title: titleEl.innerText.trim(),
                            priceStr: priceText,
                            oldPriceStr: oldPriceEl ? oldPriceEl.innerText.trim() : null,
                            link: linkEl.href,
                            prime: !!primeEl
                        });
                    }
                }
            } catch (e) {
                console.error('Erro ao processar card:', e.message);
            }
        });
        
        console.log(`${items.length} produtos extraídos com sucesso.`);
        return items;
    });

    const mappedProducts = products.map(p => {
        const price = parsePrice(p.priceStr);
        const oldPrice = parsePrice(p.oldPriceStr);
        const discount = calculateDiscount(oldPrice, price);
        const asin = extractAsin(p.link);

        // ✅ GERAR LINK DE AFILIADO AUTOMATICAMENTE
        let finalLink = p.link;
        if (asin) {
            try {
                finalLink = buildAffiliateLink(asin, CONFIG.AFFILIATE_TAG);
            } catch (error) {
                console.warn(`⚠️ Erro ao gerar link afiliado para ASIN ${asin}:`, error.message);
            }
        }

        return {
            title: p.title,
            price,
            oldPrice,
            discount,
            asin,
            link: finalLink,
            prime: p.prime,
            category: category.name  // ✅ Adicionar categoria ao produto
        };
    });

    // ✅ FILTROS RÍGIDOS PRÉ-VALIDAÇÃO
    console.log(`\n🔍 Aplicando filtros rigorosos na categoria ${category.name}...`);
    
    const filteredProducts = mappedProducts.filter(p => {
        // Filtro 1: Faixa de preço
        if (p.price < CONFIG.MIN_PRICE || p.price > CONFIG.MAX_PRICE) {
            return false;
        }
        
        // Filtro 2: Desconto mínimo
        if (!p.discount || p.discount < CONFIG.MIN_DISCOUNT) {
            return false;
        }
        
        // Filtro 3: Prime obrigatório
        if (CONFIG.REQUIRE_PRIME && !p.prime) {
            return false;
        }
        
        // Filtro 4: Palavras-chave bloqueadas
        const titleLower = p.title.toLowerCase();
        for (const keyword of BLOCKED_KEYWORDS) {
            if (titleLower.includes(keyword)) {
                return false;
            }
        }
        
        return true;
    });
    
    console.log(`   Produtos originais: ${mappedProducts.length}`);
    console.log(`   Após filtros: ${filteredProducts.length}`);
    console.log(`   Filtros aplicados:`);
    console.log(`     ✓ Categoria: ${category.name}`);
    console.log(`     ✓ Preço: R$ ${CONFIG.MIN_PRICE} - R$ ${CONFIG.MAX_PRICE}`);
    console.log(`     ✓ Desconto mínimo: ${CONFIG.MIN_DISCOUNT}%`);
    console.log(`     ✓ Prime: ${CONFIG.REQUIRE_PRIME ? 'Obrigatório' : 'Opcional'}`);
    console.log(`     ✓ Palavras bloqueadas: ${BLOCKED_KEYWORDS.length} termos`);
    console.log(`     ✓ Tag de afiliado: ${CONFIG.AFFILIATE_TAG}`);

    // ✅ CALCULAR SCORE E ORDENAR
    const productsWithScore = filteredProducts.map(p => ({
        ...p,
        score: calculateProductScore(p)
    })).filter(p => p.score >= CONFIG.MIN_PRODUCT_SCORE);
    
    const sortedProducts = productsWithScore.sort((a, b) => b.score - a.score);
    
    console.log(`\n📊 Produtos com score >= ${CONFIG.MIN_PRODUCT_SCORE}: ${sortedProducts.length}`);

    // ✅ VALIDAR DISPONIBILIDADE (com limites seguros)
    if (sortedProducts.length === 0) {
        console.log('\n⚠️ Nenhum produto qualificado para validação.');
        return [];
    }
    
    console.log(`\n🔍 Iniciando validação inteligente...`);
    console.log(`   Limite máximo: ${CONFIG.MAX_VALIDATIONS} produtos`);
    console.log(`   Meta: ${CONFIG.TARGET_VALID_PRODUCTS} produtos válidos`);
    
    const validatedProducts = await validateProductsIntelligent(page, sortedProducts);

    return validatedProducts;
}

/**
 * ✅ FUNÇÃO AUXILIAR: Buscar em MÚLTIPLAS categorias
 * Use quando quiser varrer várias categorias de uma vez
 */
async function scrapeMultipleCategories(page, numberOfCategories = 3) {
    const results = [];
    const shuffledCategories = [...CATEGORIES].sort(() => Math.random() - 0.5);
    const selectedCategories = shuffledCategories.slice(0, numberOfCategories);
    
    console.log(`\n🎲 Buscando em ${numberOfCategories} categorias aleatórias:`);
    selectedCategories.forEach(cat => console.log(`   - ${cat.name}`));
    
    for (const category of selectedCategories) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`Processando categoria: ${category.name}`);
        console.log("=".repeat(60));
        
        const products = await scrapeGoldbox(page, category);
        results.push(...products);
        
        // Delay entre categorias
        if (selectedCategories.indexOf(category) < selectedCategories.length - 1) {
            const delay = 8000 + Math.random() * 5000;
            console.log(`\n⏳ Aguardando ${(delay / 1000).toFixed(1)}s antes da próxima categoria...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    
    console.log(`\n✅ TOTAL: ${results.length} produtos encontrados em ${numberOfCategories} categorias`);
    return results;
}

/**
 * ✅ CALCULAR SCORE DO PRODUTO (0-100)
 */
function calculateProductScore(product) {
    let score = 0;
    
    // Desconto (0-50 pontos)
    if (product.discount >= 50) score += 50;
    else if (product.discount >= 40) score += 40;
    else if (product.discount >= 30) score += 30;
    else score += product.discount * 0.6;
    
    // Prime (+20 pontos)
    if (product.prime) score += 20;
    
    // Faixa de preço ideal (0-30 pontos)
    if (product.price >= 50 && product.price <= 500) score += 30;
    else if (product.price >= 30 && product.price <= 800) score += 20;
    else score += 10;
    
    return Math.round(score);
}

/**
 * ✅ VALIDAÇÃO INTELIGENTE (para ao atingir meta)
 */
async function validateProductsIntelligent(browserPage, products) {
    const validProducts = [];
    const maxToValidate = Math.min(products.length, CONFIG.MAX_VALIDATIONS);
    
    for (let i = 0; i < maxToValidate; i++) {
        const product = products[i];
        
        console.log(`\n[${i + 1}/${maxToValidate}] Validando (Score: ${product.score}):`);
        console.log(`   ${product.title.substring(0, 60)}...`);
        console.log(`   Preço: R$ ${product.price.toFixed(2)} | Desconto: ${product.discount}%`);
        console.log(`   🔗 Link: ${product.link}`);
        
        let productPage;
        
        try {
            // ✅ ABRIR NOVA PÁGINA PARA CADA VALIDAÇÃO (mais seguro)
            productPage = await browserPage.browser().newPage();
            
            const isAvailable = await validateSingleProduct(productPage, product);
            
            if (isAvailable) {
                validProducts.push(product);
                console.log(`   ✅ VÁLIDO (${validProducts.length}/${CONFIG.TARGET_VALID_PRODUCTS})`);
                
                // Parar se atingir a meta
                if (validProducts.length >= CONFIG.TARGET_VALID_PRODUCTS) {
                    console.log(`\n🎯 Meta atingida! ${validProducts.length} produtos válidos encontrados.`);
                    break;
                }
            } else {
                console.log(`   ❌ Indisponível`);
            }
        } catch (error) {
            console.log(`   ⚠️ Erro na validação: ${error.message}`);
        } finally {
            // ✅ SEMPRE FECHAR A PÁGINA (com proteção contra erro)
            if (productPage) {
                try {
                    await productPage.close();
                } catch (closeError) {
                    // Ignorar erro ao fechar (página pode já estar fechada)
                }
            }
        }
        
        // ✅ DELAY ALEATÓRIO (4-7 segundos)
        if (i < maxToValidate - 1 && validProducts.length < CONFIG.TARGET_VALID_PRODUCTS) {
            const delay = CONFIG.DELAY_BETWEEN_MIN + 
                         Math.random() * (CONFIG.DELAY_BETWEEN_MAX - CONFIG.DELAY_BETWEEN_MIN);
            console.log(`   ⏳ Aguardando ${(delay / 1000).toFixed(1)}s...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    
    console.log(`\n✅ Validação concluída: ${validProducts.length} produtos disponíveis`);
    console.log(`📋 Todos os produtos retornados já possuem links de afiliado aplicados`);
    return validProducts;
}

/**
 * ✅ VALIDAR PRODUTO INDIVIDUAL
 */
async function validateSingleProduct(page, product) {
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
        
        await page.goto(product.link, { 
            waitUntil: 'domcontentloaded', 
            timeout: 20000 
        });
        
        // Delay aleatório
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
        
        const isAvailable = await page.evaluate(() => {
            // Seletores de indisponibilidade
            const unavailableIndicators = [
                '#availability .a-color-price',
                '#availability .a-color-state',
                '[data-feature-name="availability"] .a-color-price',
                '.availability-msg .a-color-price',
                '#outOfStock'
            ];
            
            for (const selector of unavailableIndicators) {
                const el = document.querySelector(selector);
                if (el) {
                    const text = el.innerText.toLowerCase();
                    if (text.includes('não disponível') || 
                        text.includes('indisponível') ||
                        text.includes('esgotado') ||
                        text.includes('fora de estoque')) {
                        return false;
                    }
                }
            }
            
            // Verificar botão de compra
            const addToCartBtn = document.querySelector(
                '#add-to-cart-button, #buy-now-button, input[name="submit.add-to-cart"]'
            );
            
            if (!addToCartBtn) return false;
            
            // Verificar preço
            const priceEl = document.querySelector(
                '.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price-whole'
            );
            
            if (!priceEl) return false;
            
            return true;
        });
        
        return isAvailable;
        
    } catch (error) {
        console.log(`   ⚠️ Erro: ${error.message}`);
        return false;
    }
}

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            let distance = 100;
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight || totalHeight > 8000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

module.exports = { 
    scrapeGoldbox,              // Busca em 1 categoria aleatória
    scrapeMultipleCategories,   // Busca em N categorias aleatórias
    selectRandomCategory,       // Utilitário para pegar categoria aleatória
    CATEGORIES                  // Exporta lista de categorias
};
