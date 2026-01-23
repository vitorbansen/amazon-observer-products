const { parsePrice, calculateDiscount, extractAsin } = require('../extractors/extractor');
const { buildAffiliateLink } = require('../services/amazonAffiliate.service');
const { DeduplicationService } = require('../services/deduplication');

// ✅ Instância global do serviço de deduplicação
const dedup = new DeduplicationService();
let isDeduplicationInitialized = false;

// ✅ CONFIGURAÇÕES DE SCRAPING SEGURO
const CONFIG = {
    // Tag de afiliado (StoreID) - CONFIGURE AQUI SUA TAG
    AFFILIATE_TAG: process.env.AMAZON_AFFILIATE_TAG || 'toppromobr054-20',
    
    // Filtros rígidos
    MIN_PRICE: 20,
    MAX_PRICE: 1500,
    MIN_DISCOUNT: 25,           // Apenas descontos >= 25%
    REQUIRE_PRIME: false,       // Prime opcional
    
    // 🔥 CONFIGURAÇÃO: 3 categorias x 5 produtos = 15 ofertas
    CATEGORIES_PER_EXECUTION: 3,
    PRODUCTS_PER_CATEGORY: 5,
    
    // Delay entre categorias (comportamento humano)
    DELAY_BETWEEN_CATEGORIES: 8000, // 8s entre categorias
    
    // Score mínimo
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
 * 🔥 Selecionar 3 categorias aleatórias diferentes
 */
function selectRandomCategories(count = 3) {
    const shuffled = [...CATEGORIES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * 🔥 FUNÇÃO PRINCIPAL: Buscar em 3 categorias e retornar produtos únicos
 * ✅ COM CONTROLE ANTI-REPETIÇÃO
 */
async function scrapeGoldbox(page) {
    console.log("\n" + "=".repeat(70));
    console.log("🎯 BUSCANDO OFERTAS EM 3 CATEGORIAS ALEATÓRIAS");
    console.log("=".repeat(70));
    console.log(`📊 Meta: ${CONFIG.CATEGORIES_PER_EXECUTION} categorias x ${CONFIG.PRODUCTS_PER_CATEGORY} produtos = ${CONFIG.CATEGORIES_PER_EXECUTION * CONFIG.PRODUCTS_PER_CATEGORY} ofertas`);
    console.log("🛡️  Controle anti-repetição: ATIVO");
    console.log("=".repeat(70));
    
    // ✅ Inicializar serviço de deduplicação (apenas uma vez)
    if (!isDeduplicationInitialized) {
        try {
            await dedup.initialize();
            isDeduplicationInitialized = true;
        } catch (error) {
            console.warn('⚠️  Sistema anti-repetição não disponível:', error.message);
            console.log('   Continuando sem controle de duplicatas...');
        }
    }
    
    const selectedCategories = selectRandomCategories(CONFIG.CATEGORIES_PER_EXECUTION);
    const allProducts = [];
    
    console.log("\n📋 Categorias selecionadas:");
    selectedCategories.forEach((cat, idx) => {
        console.log(`   ${idx + 1}. ${cat.name}`);
    });
    console.log("");
    
    for (let i = 0; i < selectedCategories.length; i++) {
        const category = selectedCategories[i];
        
        console.log("\n" + "─".repeat(70));
        console.log(`📂 CATEGORIA ${i + 1}/${selectedCategories.length}: ${category.name.toUpperCase()}`);
        console.log("─".repeat(70));
        
        try {
            const products = await scrapeSingleCategory(page, category);
            
            if (products.length > 0) {
                console.log(`✅ ${products.length} produtos coletados de ${category.name}`);
                allProducts.push(...products);
            } else {
                console.log(`⚠️  Nenhum produto qualificado em ${category.name}`);
            }
            
            // Delay entre categorias (exceto na última)
            if (i < selectedCategories.length - 1) {
                const delay = CONFIG.DELAY_BETWEEN_CATEGORIES;
                console.log(`\n⏳ Aguardando ${delay / 1000}s antes da próxima categoria...`);
                await new Promise(r => setTimeout(r, delay));
            }
            
        } catch (error) {
            console.error(`❌ Erro ao processar categoria ${category.name}:`, error.message);
            // Continua para a próxima categoria
        }
    }
    
    console.log("\n" + "=".repeat(70));
    console.log(`🎉 BUSCA CONCLUÍDA`);
    console.log("=".repeat(70));
    console.log(`📦 Total de produtos coletados: ${allProducts.length}`);
    console.log(`📊 Distribuição:`);
    
    selectedCategories.forEach(cat => {
        const count = allProducts.filter(p => p.category === cat.name).length;
        console.log(`   • ${cat.name}: ${count} produtos`);
    });
    
    // ✅ FILTRAR PRODUTOS JÁ ENVIADOS (ANTES DE RETORNAR)
    let finalProducts = allProducts;
    
    if (isDeduplicationInitialized) {
        try {
            console.log("\n🔍 Verificando duplicatas...");
            finalProducts = await dedup.filterNewProducts(allProducts);
            
            const removed = allProducts.length - finalProducts.length;
            if (removed > 0) {
                console.log(`✂️  ${removed} produto(s) removido(s) (já enviados anteriormente)`);
                console.log(`✨ ${finalProducts.length} produto(s) são novos e únicos`);
            } else {
                console.log(`✅ Todos os ${finalProducts.length} produtos são novos!`);
            }
        } catch (error) {
            console.warn('⚠️  Erro ao verificar duplicatas:', error.message);
            console.log('   Retornando todos os produtos...');
        }
    }
    
    console.log("=".repeat(70) + "\n");
    
    return finalProducts;
}

/**
 * 🔥 Processar uma única categoria
 */
async function scrapeSingleCategory(page, category) {
    console.log(`🔗 URL: ${category.url}`);
    
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
        
        cards.forEach(card => {
            try {
                const titleEl = card.querySelector('p[id^="title-"] .a-truncate-full, p[id^="title-"] span');
                const priceEl = card.querySelector('[data-testid="price-section"] .a-price-whole, .ProductCard-module__priceToPay_olAgJzVNGyj2javg2pAe .a-price-whole');
                const fractionEl = card.querySelector('[data-testid="price-section"] .a-price-fraction, .ProductCard-module__priceToPay_olAgJzVNGyj2javg2pAe .a-price-fraction');
                const oldPriceEl = card.querySelector('[data-a-strike="true"], .ProductCard-module__wrapPrice__sMO92NjAjHmGPn3jnIH .a-text-price');
                const linkEl = card.querySelector('a[data-testid="product-card-link"], a[href*="/dp/"]');
                const primeEl = card.querySelector('.a-icon-prime, [aria-label*="Prime"]');
                
                // 🖼️ CAPTURAR IMAGEM DO PRODUTO
                const imageEl = card.querySelector('img.a-amazon-image, img[class*="ProductCardImage"]');
                let imageUrl = null;
                
                if (imageEl) {
                    imageUrl = imageEl.src || 
                               imageEl.getAttribute('data-src') || 
                               imageEl.srcset?.split(',')[0]?.trim()?.split(' ')[0];
                    
                    if (imageUrl) {
                        imageUrl = imageUrl
                            .replace(/SF\d+,\d+/g, 'SF500,500')
                            .replace(/QL\d+/g, 'QL85');
                    }
                }

                if (titleEl && linkEl) {
                    let priceText = "";
                    if (priceEl) {
                        const wholePrice = priceEl.innerText.replace(',', '');
                        priceText = wholePrice + (fractionEl ? ',' + fractionEl.innerText : ',00');
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
                            prime: !!primeEl,
                            imageUrl: imageUrl
                        });
                    }
                }
            } catch (e) {
                // Ignora erros individuais
            }
        });
        
        return items;
    });

    console.log(`📦 ${products.length} produtos extraídos da página`);

    const mappedProducts = products.map(p => {
        const price = parsePrice(p.priceStr);
        const oldPrice = parsePrice(p.oldPriceStr);
        const discount = calculateDiscount(oldPrice, price);
        const asin = extractAsin(p.link);

        let finalLink = p.link;
        if (asin) {
            try {
                finalLink = buildAffiliateLink(asin, CONFIG.AFFILIATE_TAG);
            } catch (error) {
                console.warn(`⚠️ Erro ao gerar link afiliado para ASIN ${asin}`);
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
            category: category.name,
            imageUrl: p.imageUrl
        };
    });

    // ✅ FILTROS RÍGIDOS
    console.log(`🔍 Aplicando filtros...`);
    
    const filteredProducts = mappedProducts.filter(p => {
        if (p.price < CONFIG.MIN_PRICE || p.price > CONFIG.MAX_PRICE) return false;
        if (!p.discount || p.discount < CONFIG.MIN_DISCOUNT) return false;
        if (CONFIG.REQUIRE_PRIME && !p.prime) return false;
        
        const titleLower = p.title.toLowerCase();
        for (const keyword of BLOCKED_KEYWORDS) {
            if (titleLower.includes(keyword)) return false;
        }
        
        return true;
    });
    
    console.log(`   Produtos originais: ${mappedProducts.length}`);
    console.log(`   Após filtros: ${filteredProducts.length}`);

    // ✅ CALCULAR SCORE E ORDENAR
    const productsWithScore = filteredProducts.map(p => ({
        ...p,
        score: calculateProductScore(p)
    })).filter(p => p.score >= CONFIG.MIN_PRODUCT_SCORE);
    
    const sortedProducts = productsWithScore.sort((a, b) => b.score - a.score);
    
    console.log(`📊 Produtos qualificados (score >= ${CONFIG.MIN_PRODUCT_SCORE}): ${sortedProducts.length}`);

    // ✅ RETORNAR OS 5 MELHORES
    const topProducts = sortedProducts.slice(0, CONFIG.PRODUCTS_PER_CATEGORY);
    
    console.log(`✅ Selecionados ${topProducts.length} melhores produtos`);
    
    if (topProducts.length > 0) {
        console.log(`\n   Top ${topProducts.length} produtos:`);
        topProducts.forEach((p, idx) => {
            console.log(`   ${idx + 1}. ${p.title.substring(0, 50)}...`);
            console.log(`      ASIN: ${p.asin || 'N/A'} | R$ ${p.price.toFixed(2)} | ${p.discount}% OFF | Score: ${p.score}`);
        });
    }

    return topProducts;
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
    scrapeGoldbox,
    CATEGORIES
};