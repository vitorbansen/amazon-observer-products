const { parsePrice, calculateDiscount, extractAsin } = require('../extractors/extractor');
const { buildAffiliateLink } = require('../services/amazonAffiliate.service');
const { DeduplicationService } = require('../services/deduplication');

// ✅ Instância global do serviço de deduplicação
const dedup = new DeduplicationService();
let isDeduplicationInitialized = false;

// ✅ CONFIGURAÇÕES DE SCRAPING SEGURO - SORTEIO AUTOMÁTICO
const CONFIG_PROFILES = [
    {
        MIN_PRICE: 5,
        MAX_PRICE: 40,
        MIN_DISCOUNT: 13,
        REQUIRE_PRIME: false
    },
    {
        MIN_PRICE: 20,
        MAX_PRICE: 1500,
        MIN_DISCOUNT: 10,
        REQUIRE_PRIME: false
    }
];

const selectedProfile = CONFIG_PROFILES[Math.floor(Math.random() * CONFIG_PROFILES.length)];

const CONFIG = {
    AFFILIATE_TAG: process.env.AMAZON_AFFILIATE_TAG || 'kompreaki05-20',
    ...selectedProfile,
    CATEGORIES_PER_EXECUTION: 3,
    PRODUCTS_PER_CATEGORY: 15,
    DELAY_BETWEEN_CATEGORIES: 8000,
    MIN_PRODUCT_SCORE: 45,
    VERIFY_PRICES: true, 
    DELAY_BETWEEN_VERIFICATIONS: 3000, // Aumentado para 3s
    PRICE_TOLERANCE: 0.50 // Tolerância de R$ 0.50
};

// ✅ CATEGORIAS DISPONÍVEIS PARA BUSCA ALEATÓRIA
const CATEGORIES = [
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
    'curso online', 'treinamento', 'seminário', 'Matemática', 'Armação','Capa','Óculos','Ray-ban','capa case'
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
 * ✅ COM CONTROLE ANTI-REPETIÇÃO E VERIFICAÇÃO DE PREÇOS
 */
async function scrapeGoldbox(page) {
    console.log("\n" + "=".repeat(70));
    console.log("🎯 BUSCANDO OFERTAS EM 3 CATEGORIAS ALEATÓRIAS");
    console.log("=".repeat(70));
    console.log(`📊 Meta: ${CONFIG.CATEGORIES_PER_EXECUTION} categorias x ${CONFIG.PRODUCTS_PER_CATEGORY} produtos = ${CONFIG.CATEGORIES_PER_EXECUTION * CONFIG.PRODUCTS_PER_CATEGORY} ofertas`);
    console.log("🛡️  Controle anti-repetição: ATIVO");
    console.log(`🔍 Verificação de preços: ${CONFIG.VERIFY_PRICES ? 'ATIVA' : 'DESATIVADA'}`);
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
            originalLink: p.link, // ✅ GUARDAR LINK ORIGINAL
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

    // ✅ SELECIONAR OS MELHORES
    let topProducts = sortedProducts.slice(0, CONFIG.PRODUCTS_PER_CATEGORY);
    
    // 🔥 VERIFICAR PREÇOS CLICANDO NO PRODUTO
    if (CONFIG.VERIFY_PRICES && topProducts.length > 0) {
        console.log(`\n🔍 Verificando preços clicando nos produtos...`);
        
        const verifiedProducts = [];
        
        for (let i = 0; i < topProducts.length; i++) {
            const product = topProducts[i];
            console.log(`\n   [${i + 1}/${topProducts.length}] ${product.title.substring(0, 60)}...`);
            console.log(`      💰 Preço Goldbox: R$ ${product.price.toFixed(2)}`);
            
            const verification = await verifyProductPriceByClicking(page, product);
            
            if (verification.verified) {
                // ✅ ATUALIZAR PRODUTO COM PREÇOS VERIFICADOS
                product.verifiedPrice = verification.currentPrice;
                product.verifiedOldPrice = verification.oldPrice;
                verifiedProducts.push(product);
                console.log(`      ✅ APROVADO!`);
            } else {
                console.log(`      ❌ REPROVADO - Produto removido`);
            }
            
            // Delay entre verificações
            if (i < topProducts.length - 1) {
                const delay = CONFIG.DELAY_BETWEEN_VERIFICATIONS;
                console.log(`      ⏳ Aguardando ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        
        topProducts = verifiedProducts;
        console.log(`\n   ✅ ${topProducts.length} produto(s) verificado(s) e aprovado(s)`);
        
        // 🔄 Voltar para a página da categoria
        try {
            console.log(`\n   🔙 Voltando para página da categoria...`);
            await page.goto(category.url, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 2000));
        } catch (error) {
            console.warn(`   ⚠️  Erro ao voltar para categoria: ${error.message}`);
        }
    }
    
    console.log(`\n✅ Total final: ${topProducts.length} produtos`);
    
    if (topProducts.length > 0) {
        console.log(`\n   📋 Produtos aprovados:`);
        topProducts.forEach((p, idx) => {
            console.log(`   ${idx + 1}. ${p.title.substring(0, 50)}...`);
            console.log(`      ASIN: ${p.asin || 'N/A'} | R$ ${p.price.toFixed(2)} | ${p.discount}% OFF | Score: ${p.score}`);
        });
    }

    return topProducts;
}

/**
 * 🔍 VERIFICAR PREÇO CLICANDO NO PRODUTO
 * ✅ Acessa o link ORIGINAL e extrai o preço REAL da página do produto
 */
async function verifyProductPriceByClicking(page, product) {
    try {
        // 🔗 USAR O LINK ORIGINAL (sem tag de afiliado)
        const productUrl = product.originalLink || product.link.split('?')[0];
        
        console.log(`      🔗 Acessando: ${productUrl.substring(0, 80)}...`);
        
        // 📄 NAVEGAR PARA A PÁGINA DO PRODUTO
        await page.goto(productUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        // ⏳ Aguardar conteúdo carregar
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
        
        // 💰 EXTRAIR PREÇOS DA PÁGINA DO PRODUTO
        const extractedData = await page.evaluate(() => {
            const result = {
                currentPrice: null,
                oldPrice: null,
                priceText: null,
                oldPriceText: null,
                htmlSnippet: null
            };
            
            // 🎯 SELETORES PARA PREÇO ATUAL (baseado no HTML que você forneceu)
            const currentPriceSelectors = [
                // Selector específico do HTML que você mostrou
                '.priceToPay .a-price-whole',
                '.reinventPricePriceToPayMargin .a-price-whole',
                // Outros seletores comuns
                '[data-feature-name="corePriceDisplay"] .a-price-whole',
                '.a-price.priceToPay .a-price-whole',
                '#corePriceDisplay_desktop_feature_div .a-price-whole',
                '#corePrice_feature_div .a-price-whole'
            ];
            
            const currentFractionSelectors = [
                '.priceToPay .a-price-fraction',
                '.reinventPricePriceToPayMargin .a-price-fraction',
                '[data-feature-name="corePriceDisplay"] .a-price-fraction',
                '.a-price.priceToPay .a-price-fraction'
            ];
            
            // Buscar preço atual
            let wholeEl = null;
            let fractionEl = null;
            
            for (const selector of currentPriceSelectors) {
                wholeEl = document.querySelector(selector);
                if (wholeEl) {
                    // Capturar HTML para debug
                    const parent = wholeEl.closest('.a-price') || wholeEl.closest('div');
                    if (parent) {
                        result.htmlSnippet = parent.outerHTML.substring(0, 500);
                    }
                    break;
                }
            }
            
            for (const selector of currentFractionSelectors) {
                fractionEl = document.querySelector(selector);
                if (fractionEl) break;
            }
            
            if (wholeEl) {
                const whole = wholeEl.textContent.replace(/[^\d]/g, '');
                const fraction = fractionEl ? fractionEl.textContent.replace(/[^\d]/g, '') : '00';
                result.currentPrice = `${whole},${fraction}`;
                result.priceText = `R$ ${whole},${fraction}`;
            }
            
            // 💵 PREÇO ANTIGO (riscado)
            const oldPriceSelectors = [
                '.basisPrice .a-price[data-a-strike="true"] .a-offscreen',
                '[data-a-strike="true"] .a-offscreen',
                '.a-text-price[data-a-strike="true"]',
                '.basisPrice .a-text-price',
                '.a-price.a-text-price[data-a-strike="true"]'
            ];
            
            for (const selector of oldPriceSelectors) {
                const oldPriceEl = document.querySelector(selector);
                if (oldPriceEl) {
                    const text = oldPriceEl.textContent || oldPriceEl.innerText;
                    const match = text.match(/R\$\s?(\d+[\.,]\d{2})/);
                    if (match) {
                        result.oldPrice = match[1].replace('.', ',');
                        result.oldPriceText = text.trim();
                        break;
                    }
                }
            }
            
            return result;
        });
        
        // 🔢 CONVERTER PARA NÚMEROS
        const verifiedPrice = parsePrice(extractedData.currentPrice);
        const verifiedOldPrice = parsePrice(extractedData.oldPrice);
        
        console.log(`      💰 Preço na página: ${extractedData.priceText || 'NÃO ENCONTRADO'}`);
        if (extractedData.oldPriceText) {
            console.log(`      💵 Preço antigo: ${extractedData.oldPriceText}`);
        }
        
        // ❌ Falha se não conseguiu extrair o preço
        if (!verifiedPrice || verifiedPrice === 0) {
            console.log(`      ⚠️  Não foi possível extrair o preço da página`);
            if (extractedData.htmlSnippet) {
                console.log(`      🔍 HTML encontrado: ${extractedData.htmlSnippet.substring(0, 200)}...`);
            }
            return { verified: false };
        }
        
        // ✅ COMPARAR PREÇOS
        const priceDiff = Math.abs(verifiedPrice - product.price);
        const priceMatches = priceDiff <= CONFIG.PRICE_TOLERANCE;
        
        console.log(`      📊 Comparação:`);
        console.log(`         Goldbox: R$ ${product.price.toFixed(2)}`);
        console.log(`         Página:  R$ ${verifiedPrice.toFixed(2)}`);
        console.log(`         Diferença: R$ ${priceDiff.toFixed(2)}`);
        
        if (!priceMatches) {
            console.log(`      ⚠️  PREÇO NÃO BATE! (tolerância: R$ ${CONFIG.PRICE_TOLERANCE})`);
            return { 
                verified: false,
                currentPrice: verifiedPrice,
                oldPrice: verifiedOldPrice
            };
        }
        
        // ✅ Verificar preço antigo (se existir)
        if (product.oldPrice && verifiedOldPrice && verifiedOldPrice > 0) {
            const oldPriceDiff = Math.abs(verifiedOldPrice - product.oldPrice);
            const oldPriceMatches = oldPriceDiff <= CONFIG.PRICE_TOLERANCE;
            
            if (!oldPriceMatches) {
                console.log(`      ⚠️  Preço antigo não bate (diff: R$ ${oldPriceDiff.toFixed(2)})`);
                // Não bloqueia, só avisa
            }
        }
        
        return {
            verified: true,
            currentPrice: verifiedPrice,
            oldPrice: verifiedOldPrice || product.oldPrice
        };
        
    } catch (error) {
        console.log(`      ❌ Erro ao verificar: ${error.message}`);
        return { 
            verified: false,
            error: error.message 
        };
    }
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