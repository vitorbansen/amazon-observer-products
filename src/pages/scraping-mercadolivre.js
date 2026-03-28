
const { parsePrice, calculateDiscount } = require("../extractors/extractor");
const { DeduplicationService } = require("../services/deduplication");

// ✅ Instância global do serviço de deduplicação
const dedup = new DeduplicationService();
let isDeduplicationInitialized = false;

// ─────────────────────────────────────────────
// ⚙️  CONFIGURAÇÕES
// ─────────────────────────────────────────────
const CONFIG = {
    ML_AFFILIATE_TAG: process.env.ML_AFFILIATE_TAG || "",   // ex: "?matt_tool=XX&..."
    MIN_PRICE:        10,
    MAX_PRICE:        5000,
    PRODUCTS_PER_RUN: 4,          // meta de ofertas por execução
    MIN_DISCOUNT:     20,          // % mínimo para qualificar
    MIN_PRODUCT_SCORE: 0,
    // Rolar a página de ofertas para carregar mais cards
    MAX_SCROLL_ATTEMPTS: 6,
    SCROLL_DELAY_MS:     2000,
    PAGE_URL: "https://www.mercadolivre.com.br/ofertas#nav-header",
};

// ✅ PALAVRAS-CHAVE BLOQUEADAS
const BLOCKED_KEYWORDS = [
    "livro", "apostila", "usado", "reembalado", "refil",
    "peça de reposição", "recarga", "ebook", "e-book",
    "revista", "jornal", "assinatura", "gift card", "vale presente",
    "curso online", "capa case", "capa para", "película", "armação",
    "ingresso", "voucher"
];

// ─────────────────────────────────────────────
// 🏆 CALCULAR SCORE DO PRODUTO (0-100)
// ─────────────────────────────────────────────
function calculateProductScore(product) {
    let score = 0;

    if      (product.discount >= 50) score += 40;
    else if (product.discount >= 40) score += 35;
    else if (product.discount >= 30) score += 25;
    else if (product.discount >= 15) score += 15;
    else                             score += 3;

    const r = product.rating || 0;
    if      (r >= 4.5) score += 30;
    else if (r >= 4.0) score += 20;
    else if (r >= 3.5) score += 10;
    else if (r >  0)   score += 3;

    if (product.freeShipping) score += 10;

    if      (product.price >= 50  && product.price <= 500) score += 15;
    else if (product.price >= 30  && product.price <= 800) score += 10;
    else score += 5;

    return Math.round(score);
}

// ─────────────────────────────────────────────
// 🔗 CONSTRUIR LINK DE AFILIADO (se configurado)
// ─────────────────────────────────────────────
function buildAffiliateLink(originalUrl) {
    const tag = process.env.ML_AFFILIATE_TAG;
    if (!tag || !originalUrl) return originalUrl;

    try {
        // Remove o fragmento #... que é tracking interno do ML e não agrega
        const cleanUrl = originalUrl.split("#")[0];

        // Formato correto do redirect de afiliado do ML
        return `https://www.mercadolivre.com.br/social/${tag}?url=${encodeURIComponent(cleanUrl)}`;
    } catch (err) {
        return originalUrl;
    }
}
// ─────────────────────────────────────────────
// 📦 EXTRAIR CARDS DA PÁGINA DE OFERTAS
// ─────────────────────────────────────────────
async function extractOffersFromPage(page) {
    const rawProducts = await page.evaluate(() => {
        const items = [];

        // Seletores dos cards de oferta do Mercado Livre
        const cards = document.querySelectorAll(
            ".poly-card, " +
            "[class*='poly-card'], " +
            ".andes-card.poly-card--grid-card"
        );

        cards.forEach(card => {
            try {
                // ── Título ──────────────────────────────────────────────
                const titleEl = card.querySelector(
                    ".poly-component__title, " +
                    "h3.poly-component__title-wrapper a, " +
                    "a.poly-component__title"
                );
                const title = titleEl ? titleEl.innerText.trim() : null;
                if (!title || title.length < 5) return;

                // ── Link ────────────────────────────────────────────────
                const linkEl = card.querySelector(
                    "a.poly-component__title, " +
                    "h3.poly-component__title-wrapper a, " +
                    ".poly-component__title"
                );
                const href = linkEl ? linkEl.href : null;
                if (!href) return;

                // ── Preço atual ─────────────────────────────────────────
                // Tenta o preço destacado (cents-superscript) primeiro
                let priceStr = null;

                const priceCurrentEl = card.querySelector(
                    ".poly-price__current .andes-money-amount, " +
                    ".andes-money-amount.andes-money-amount--cents-superscript"
                );
                if (priceCurrentEl) {
                    const fraction = priceCurrentEl.querySelector(".andes-money-amount__fraction");
                    const cents    = priceCurrentEl.querySelector(".andes-money-amount__cents");
                    if (fraction) {
                        priceStr = fraction.innerText.replace(/\./g, "") +
                                   "," + (cents ? cents.innerText : "00");
                    }
                }

                // Fallback: aria-label do elemento de preço atual
                if (!priceStr) {
                    const ariaEl = card.querySelector(
                        "[aria-label*='Agora'], " +
                        ".poly-price__current [aria-label]"
                    );
                    if (ariaEl) {
                        const match = ariaEl.getAttribute("aria-label")
                            .match(/(\d[\d.]*[\.,]\d{2})/);
                        if (match) priceStr = match[1].replace(".", ",");
                    }
                }

                if (!priceStr) return;

                // ── Preço original (riscado) ─────────────────────────────
                let oldPriceStr = null;

                const strikeEl = card.querySelector(
                    ".andes-money-amount--previous, " +
                    "s.andes-money-amount"
                );
                if (strikeEl) {
                    const ariaLabel = strikeEl.getAttribute("aria-label") || "";
                    const match = ariaLabel.match(/(\d[\d.]*[\.,]\d{2})/);
                    if (match) {
                        oldPriceStr = match[1].replace(".", ",");
                    } else {
                        const frac = strikeEl.querySelector(".andes-money-amount__fraction");
                        const cts  = strikeEl.querySelector(".andes-money-amount__cents");
                        if (frac) {
                            oldPriceStr = frac.innerText.replace(/\./g, "") +
                                          "," + (cts ? cts.innerText : "00");
                        }
                    }
                }

                // ── % OFF exibido pelo site ──────────────────────────────
                let siteDiscountPct = null;
                const discountEl = card.querySelector(
                    ".andes-money-amount__discount, " +
                    ".poly-price__disc_label"
                );
                if (discountEl) {
                    const match = discountEl.innerText.match(/(\d+)\s*%/);
                    if (match) siteDiscountPct = parseInt(match[1], 10);
                }

                // ── Imagem ──────────────────────────────────────────────
                const imgEl = card.querySelector(
                    "img.poly-component__picture, " +
                    "img[class*='poly-component__picture']"
                );
                let imageUrl = imgEl ? (imgEl.src || imgEl.getAttribute("data-src")) : null;

                // ── Avaliação ───────────────────────────────────────────
                const ratingEl = card.querySelector(
                    ".poly-reviews__rating, " +
                    ".poly-component__reviews .poly-reviews__rating"
                );
                const rating = ratingEl ? parseFloat(ratingEl.innerText) : null;

                // ── Total de avaliações ─────────────────────────────────
                const reviewCountEl = card.querySelector(".poly-reviews__total");
                const reviewCount = reviewCountEl
                    ? parseInt(reviewCountEl.innerText.replace(/\D/g, ""), 10)
                    : null;

                // ── Frete grátis ────────────────────────────────────────
                const shippingEl = card.querySelector(
                    ".poly-component__shipping, " +
                    ".poly-shipping--next_day, " +
                    "[class*='poly-shipping']"
                );
                const shippingText = shippingEl ? shippingEl.innerText.toLowerCase() : "";
                const freeShipping = shippingText.includes("grátis") ||
                                     shippingText.includes("gratis") ||
                                     shippingText.includes("chegará") ||
                                     shippingText.includes("chegara");

                // ── Parcelamento ────────────────────────────────────────
                const installmentsEl = card.querySelector(
                    ".poly-price__installments, " +
                    ".poly-component__price .poly-price__installments"
                );
                const installmentsText = installmentsEl ? installmentsEl.innerText.trim() : null;

                // ── Badge / Destaque (ex: "OFERTA DO DIA") ───────────────
                const highlightEl = card.querySelector(
                    ".poly-component__highlight, " +
                    "[class*='poly-component__highlight']"
                );
                const highlight = highlightEl ? highlightEl.innerText.trim() : null;

                // ── Vendedor / Marca ─────────────────────────────────────
                const sellerEl = card.querySelector(
                    ".poly-component__seller, " +
                    ".poly-component__brand"
                );
                const seller = sellerEl ? sellerEl.innerText.replace(/\s+/g, " ").trim() : null;

                items.push({
                    title,
                    href,
                    priceStr,
                    oldPriceStr,
                    siteDiscountPct,
                    imageUrl,
                    rating,
                    reviewCount,
                    freeShipping,
                    installmentsText,
                    highlight,
                    seller
                });
            } catch (_) {}
        });

        return items;
    });

    return rawProducts;
}

// ─────────────────────────────────────────────
// 📜 ROLAR A PÁGINA PARA CARREGAR MAIS CARDS
// ─────────────────────────────────────────────
async function scrollPageToLoadMore(page) {
    for (let i = 0; i < CONFIG.MAX_SCROLL_ATTEMPTS; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await new Promise(r => setTimeout(r, CONFIG.SCROLL_DELAY_MS));
        console.log(`   📜 Scroll ${i + 1}/${CONFIG.MAX_SCROLL_ATTEMPTS}`);
    }
    // Volta ao topo
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 1000));
}

// ─────────────────────────────────────────────
// 🚀 FUNÇÃO PRINCIPAL
// ─────────────────────────────────────────────
async function scrapeGoldbox(page) {
    console.log("\n" + "=".repeat(70));
    console.log("🎯 MERCADO LIVRE OFERTAS — COLETANDO PRODUTOS");
    console.log(`📌 URL: ${CONFIG.PAGE_URL}`);
    console.log("=".repeat(70));

    // ── Inicializar deduplicação ─────────────────────────────────────
    if (!isDeduplicationInitialized) {
        try {
            await dedup.initialize();
            isDeduplicationInitialized = true;
        } catch (err) {
            console.warn("⚠️  Anti-repetição indisponível:", err.message);
        }
    }

    // ── Navegar para a página de ofertas ────────────────────────────
    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(CONFIG.PAGE_URL, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    console.log(`✅ Página carregada`);

    // ── Rolar para carregar mais produtos ────────────────────────────
    console.log("📜 Rolando página para carregar mais ofertas...");
    await scrollPageToLoadMore(page);

    // ── Extrair todos os cards ────────────────────────────────────────
    const rawProducts = await extractOffersFromPage(page);
    console.log(`\n📦 ${rawProducts.length} cards extraídos da página`);

    if (rawProducts.length === 0) {
        console.warn("⚠️  Nenhum card encontrado — possível mudança de seletor ou bloqueio");
        return [];
    }

    // Debug: mostra os 3 primeiros
    rawProducts.slice(0, 3).forEach((p, i) => {
        console.log(
            `   [${i+1}] ${p.title?.substring(0, 50)} | ` +
            `R$ ${p.priceStr} | old: ${p.oldPriceStr || "N/A"} | ` +
            `site: ${p.siteDiscountPct ?? "?"}% OFF`
        );
    });

    // ── Mapear para objeto padrão ─────────────────────────────────────
    const mapped = rawProducts.map(p => {
        const price    = parsePrice(p.priceStr);
        const oldPrice = parsePrice(p.oldPriceStr);

        // Prioriza o desconto calculado; se não der, usa o exibido pelo site
        let discount = calculateDiscount(oldPrice, price);
        if ((!discount || discount === 0) && p.siteDiscountPct) {
            discount = p.siteDiscountPct;
        }

        // Gera um ID único baseado na URL (equivalente ao ASIN da Amazon)
        let productId = null;
        try {
            const url   = new URL(p.href);
            const parts = url.pathname.split("/");
            // ex: /parafusadeira-.../MLB123456789 → pega o último segmento MLB...
            const mlbSegment = parts.find(s => /^MLB\d+$/i.test(s));
            if (mlbSegment) {
                productId = mlbSegment.toUpperCase();
            } else {
                // Fallback: usa o segmento antes de qualquer query param
                productId = parts[parts.length - 1]?.split("?")[0] || null;
            }
        } catch (_) {}

        const link = buildAffiliateLink(p.href);

        return {
            title:            p.title,
            price,
            oldPrice,
            discount,
            productId,              // equivale ao "asin" da Amazon
            link,
            originalLink:     p.href,
            imageUrl:         p.imageUrl,
            rating:           p.rating,
            reviewCount:      p.reviewCount,
            freeShipping:     p.freeShipping,
            installmentsText: p.installmentsText,
            highlight:        p.highlight,
            seller:           p.seller,
            category:         "Mercado Livre Ofertas",
            source:           "mercadolivre"
        };
    });

    // ── Filtros básicos ───────────────────────────────────────────────
    const filtered = mapped.filter(p => {
        if (!p.price || p.price < CONFIG.MIN_PRICE || p.price > CONFIG.MAX_PRICE) return false;
        if (!p.productId) return false;
        const lower = (p.title || "").toLowerCase();
        return !BLOCKED_KEYWORDS.some(kw => lower.includes(kw));
    });

    console.log(`   Após filtros de preço/id/keywords: ${filtered.length} produto(s)`);

    // ── Remover duplicatas internas (mesmo productId) ─────────────────
    const seenIds = new Set();
    const deduped = filtered.filter(p => {
        if (seenIds.has(p.productId)) return false;
        seenIds.add(p.productId);
        return true;
    });

    console.log(`   Após deduplicação interna: ${deduped.length} produto(s) únicos`);

    // ── Filtrar produtos já enviados (deduplicação global) ────────────
    let fresh = deduped;
    if (isDeduplicationInitialized) {
        try {
            fresh = await dedup.filterNewProducts(deduped);
            console.log(`   Após deduplicação global: ${fresh.length} produto(s) novos`);
        } catch (err) {
            console.warn("⚠️  Erro na deduplicação global:", err.message);
        }
    }

    // ── Score e ordenação ─────────────────────────────────────────────
    const scored = fresh
        .map(p => ({ ...p, score: calculateProductScore(p) }))
        .filter(p => p.score >= CONFIG.MIN_PRODUCT_SCORE)
        .sort((a, b) => b.score - a.score);

    // ── Resultado final ───────────────────────────────────────────────
    const finalProducts = scored.slice(0, CONFIG.PRODUCTS_PER_RUN);

    console.log("\n" + "=".repeat(70));
    if (finalProducts.length === 0) {
        console.log("😔 Nenhum produto encontrado com os critérios definidos.");
    } else {
        console.log(`🎉 ${finalProducts.length} produto(s) coletados com sucesso.`);
        finalProducts.forEach((p, i) => {
            console.log(
                `   ${i + 1}. ${p.title.substring(0, 55)}...`
            );
            console.log(
                `      R$ ${p.price?.toFixed(2)} | ${p.discount}% OFF | ` +
                `⭐ ${p.rating ?? "N/A"} | Score: ${p.score} | ID: ${p.productId}`
            );
        });
    }
    console.log("=".repeat(70) + "\n");

    return finalProducts;
}

// ─────────────────────────────────────────────
// 📦 EXPORTAÇÕES
// ─────────────────────────────────────────────
module.exports = {
    scrapeGoldbox,
    calculateProductScore
};
