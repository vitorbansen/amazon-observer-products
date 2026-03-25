
const { parsePrice, calculateDiscount, extractAsin } = require("../extractors/extractor");
const { buildAffiliateLink } = require("../services/amazonAffiliate.service");
const { DeduplicationService } = require("../services/deduplication");

// ✅ Instância global do serviço de deduplicação
const dedup = new DeduplicationService();
let isDeduplicationInitialized = false;

// ─────────────────────────────────────────────
// ⚙️  CONFIGURAÇÕES
// ─────────────────────────────────────────────
const CONFIG_PROFILES = [
    { MIN_PRICE: 10, MAX_PRICE: 2000, MIN_DISCOUNT: 0, REQUIRE_PRIME: false },
    { MIN_PRICE: 10, MAX_PRICE: 2000, MIN_DISCOUNT: 0, REQUIRE_PRIME: false }
];

const selectedProfile = CONFIG_PROFILES[Math.floor(Math.random() * CONFIG_PROFILES.length)];

const CONFIG = {
    AFFILIATE_TAG: process.env.AMAZON_AFFILIATE_TAG || "kompreaki05-20",
    ...selectedProfile,
    PRODUCTS_PER_RUN: 4,        // Quantos produtos finais queremos por execução
    MIN_PRODUCT_SCORE: 0,       // Sem filtro de score — só ordena do melhor pro pior
    VERIFY_PRICES: true,
    DELAY_BETWEEN_VERIFICATIONS: 3000,
    PRICE_TOLERANCE: 10,
    // Novo: Desconto mínimo para ser considerado "qualificado" na primeira passada
    QUALIFIED_MIN_DISCOUNT: 20 
};

// ─────────────────────────────────────────────
// 🗂️  MAPA DE CATEGORIAS → PRODUTOS
// ─────────────────────────────────────────────

const SEARCH_CATALOG = {
    'Casa': {
        produtos: [
            'air fryer',
            'aspirador portátil',
            'aspirador robô',
            'cafeteira elétrica',
            'liquidificador potente',
            'panela elétrica',
            'panela pressão elétrica',
            'purificador de água',
            'filtro de água',
            'ventilador torre',
            'ventilador silencioso',
            'aquecedor elétrico',
            'climatizador de ar',
            'umidificador de ar',
            'lâmpada smart',
            'luminária led',
            'fita led',
            'tomada inteligente',
            'sensor presença',
            'câmera segurança wifi',
            'fechadura digital',
            'suporte notebook',
            'mesa portátil notebook',
            'organizador cozinha',
            'organizador geladeira',
            'organizador armário',
            'dispenser automático sabão',
            'mop giratório',
            'aspirador vertical',
            'escova elétrica limpeza',
            'robo limpa vidro',
            'secador roupa portátil',
            'ferro a vapor',
            'vaporizador roupa',
            'varal retrátil',
            'balança digital',
            'garrafa térmica',
            'kit panelas antiaderente',
            'cooktop elétrico',
            'forno elétrico',
            'mini forno',
            'torneira elétrica',
            'torneira gourmet',
            'chuveiro elétrico',
            'ducha elétrica',
            'espelho led',
            'projetor portátil',
            'difusor aromático',
            'aromatizador ambiente',
            'desumidificador'
        ]
    },
    'Cozinha': {
        produtos: [
            'batedeira planetária',
            'batedeira elétrica',
            'máquina café cápsula',
            'cafeteira expresso',
            'chaleira elétrica',
            'grill elétrico',
            'sanduicheira',
            'torradeira',
            'centrífuga frutas',
            'multiprocessador',
            'moedor café elétrico',
            'moedor pimenta elétrico',
            'descascador elétrico',
            'abridor vinho elétrico',
            'seladora alimentos',
            'máquina waffle',
            'panela wok',
            'panela ferro fundido',
            'frigideira antiaderente',
            'frigideira cerâmica',
            'panela vapor',
            'cuscuzeira',
            'leiteira inox',
            'churrasqueira elétrica',
            'kit churrasco',
            'faca chef profissional',
            'jogo facas premium',
            'afiador facas profissional',
            'tábua corte profissional',
            'ralador multifuncional',
            'cortador legumes espiral',
            'cortador batata palito',
            'fatiador mandoline',
            'forma air fryer silicone',
            'assadeira vidro',
            'assadeira antiaderente',
            'travessa porcelana',
            'pote hermético vidro',
            'kit marmita térmica',
            'lancheira térmica',
            'porta temperos giratório',
            'organizador temperos gaveta',
            'dosador azeite',
            'galheteiro vidro',
            'escorredor louça inox',
            'tapete silicone culinário',
            'luva térmica cozinha',
            'kit utensílios silicone'
        ]
    },
    'Eletrônicos': {
        produtos: [
            'fone bluetooth',
            'headset gamer',
            'earbuds sem fio',
            'caixa de som bluetooth',
            'soundbar tv',
            'smartwatch',
            'smartband',
            'tablet android',
            'ipad',
            'notebook',
            'chromebook',
            'monitor gamer',
            'monitor ultrawide',
            'webcam full hd',
            'webcam 4k',
            'microfone condensador',
            'microfone usb',
            'ring light',
            'tripé celular',
            'estabilizador gimbal',
            'controle videogame',
            'controle bluetooth',
            'console portátil',
            'óculos vr',
            'drone com câmera',
            'projetor portátil',
            'mini projetor',
            'tv box android',
            'fire tv stick',
            'google chromecast',
            'roteador wifi',
            'roteador mesh',
            'repetidor wifi',
            'adaptador bluetooth usb',
            'placa captura vídeo',
            'ssd externo',
            'hd externo',
            'pendrive alta velocidade',
            'hub usb c',
            'dock station notebook',
            'cooler notebook',
            'teclado mecânico',
            'mouse gamer',
            'mousepad rgb',
            'fonte carregador notebook',
            'carregador portátil power bank',
            'cabo lightning',
            'cabo usb reforçado',
            'leitor cartão memória',
            'adaptador hdmi'
        ]
    },
    'Informática': {
        produtos: [
            'memória ram ddr4',
            'memória ram ddr5',
            'processador intel',
            'processador ryzen',
            'placa de vídeo geforce',
            'placa de vídeo radeon',
            'placa mãe',
            'fonte pc gamer',
            'gabinete gamer',
            'cooler cpu',
            'water cooler',
            'pasta térmica',
            'kit upgrade pc',
            'placa de rede wifi pci',
            'placa de som',
            'adaptador wifi usb',
            'switch ethernet',
            'cabo de rede cat6',
            'cabo de rede cat7',
            'extensor usb',
            'extensor hdmi',
            'kvm switch',
            'mesa digitalizadora',
            'caneta digital',
            'impressora multifuncional',
            'impressora laser',
            'scanner portátil',
            'etiquetadora',
            'leitor código barras',
            'calculadora científica',
            'calculadora financeira',
            'suporte cpu',
            'base notebook com cooler',
            'apoio ergonômico teclado',
            'apoio ergonômico mouse',
            'mouse ergonômico',
            'teclado ergonômico',
            'capa teclado',
            'protetor tela notebook',
            'trava notebook segurança',
            'organizador cabos mesa',
            'caixa organizadora fios',
            'adaptador vga hdmi',
            'adaptador displayport hdmi',
            'dock hd externo',
            'case hd 2.5',
            'case ssd nvme',
            'gravador dvd externo',
            'leitor dvd externo',
            'placa captura usb'
        ]
    },
    'Eletrodomésticos': {
        produtos: [
            'lava e seca',
            'máquina lavar roupa',
            'tanquinho lavagem',
            'secadora roupa',
            'lava louças',
            'geladeira frost free',
            'geladeira duplex',
            'geladeira inverse',
            'freezer horizontal',
            'freezer vertical',
            'frigobar',
            'adega climatizada',
            'cooktop gás',
            'coifa inox',
            'depurador cozinha',
            'forno embutir',
            'microondas inverter',
            'microondas grill',
            'forno microondas espelhado',
            'aspirador de pó vertical sem fio',
            'aspirador de pó com fio potente',
            'enceradeira elétrica',
            'lavadora alta pressão',
            'lavadora portátil',
            'passadeira a vapor',
            'vaporizador portátil roupa',
            'máquina costura elétrica',
            'overlock doméstica',
            'ferro de passar sem fio',
            'ferro de passar antiaderente',
            'ventilador coluna',
            'ventilador mesa potente',
            'climatizador evaporativo',
            'ar condicionado portátil',
            'ar condicionado split',
            'desumidificador ar elétrico',
            'aquecedor a óleo',
            'aquecedor cerâmico',
            'circulador de ar',
            'exaustor cozinha',
            'triturador alimentos pia',
            'bebedouro água elétrico',
            'máquina gelo',
            'frigobar retrô',
            'freezer cervejeira',
            'adega vinho pequena',
            'lavadora ultrassônica',
            'máquina lavar portátil',
            'secadora portátil',
            'centrífuga roupas'
        ]
    },
    'Moda': {
        produtos: [
            'tênis nike',
            'tênis adidas',
            'tênis puma',
            'tênis casual masculino',
            'tênis feminino casual',
            'tênis esportivo masculino',
            'tênis esportivo feminino',
            'tênis corrida',
            'chinelo havaianas',
            'sandália feminina confortável',
            'bota feminina',
            'bota masculina',
            'sapato social masculino',
            'sapato casual masculino',
            'mochila impermeável',
            'mochila notebook',
            'bolsa feminina premium',
            'bolsa transversal feminina',
            'bolsa couro feminina',
            'carteira masculina couro',
            'carteira feminina',
            'cinto couro masculino',
            'cinto feminino',
            'relógio masculino',
            'relógio feminino',
            'óculos sol masculino',
            'óculos sol feminino',
            'óculos polarizado',
            'jaqueta masculina',
            'jaqueta feminina',
            'jaqueta corta vento',
            'casaco inverno masculino',
            'casaco feminino inverno',
            'moletom masculino',
            'moletom feminino',
            'conjunto moletom',
            'camiseta básica premium',
            'camiseta oversized',
            'camisa polo masculina',
            'camisa social masculina',
            'legging academia',
            'shorts esportivo',
            'bermuda masculina',
            'vestido feminino casual',
            'vestido festa',
            'pijama feminino',
            'pijama masculino',
            'kit cueca masculina',
            'kit calcinha',
            'boné aba curva'
        ]
    },
    'Beleza': {
        produtos: [
            'secador cabelo profissional',
            'secador cabelo iônico',
            'chapinha profissional',
            'escova alisadora',
            'modelador de cachos',
            'escova rotativa',
            'escova secadora',
            'máquina cortar cabelo',
            'aparador barba',
            'barbeador elétrico',
            'depilador elétrico',
            'laser depilação portátil',
            'escova limpeza facial',
            'massageador facial',
            'roller facial',
            'dermaroller',
            'sérum vitamina c',
            'sérum ácido hialurônico',
            'creme anti idade',
            'creme facial hidratante',
            'protetor solar facial',
            'protetor solar corporal',
            'base líquida',
            'corretivo facial',
            'pó compacto',
            'paleta maquiagem',
            'kit maquiagem profissional',
            'esponja maquiagem',
            'kit pincéis maquiagem',
            'fixador maquiagem',
            'removedor maquiagem',
            'água micelar',
            'tônico facial',
            'gel limpeza facial',
            'kit skincare',
            'perfume masculino importado',
            'perfume feminino importado',
            'body splash',
            'creme corporal hidratante',
            'óleo corporal',
            'hidratante labial',
            'kit cuidados pele',
            'máscara facial',
            'máscara capilar',
            'óleo capilar',
            'finalizador cabelo',
            'kit shampoo profissional',
            'shampoo antiqueda',
            'condicionador profissional',
            'leave in cabelo'
        ]
    },
    'Esporte': {
        produtos: [
            'tênis corrida',
            'tênis treino',
            'mochila academia',
            'garrafa térmica academia',
            'squeeze esportivo',
            'whey protein',
            'creatina',
            'pré treino',
            'barra proteína',
            'coqueteleira',
            'halter ajustável',
            'kit halteres',
            'barra musculação',
            'banco musculação',
            'estação musculação',
            'band elástica',
            'kit elástico resistência',
            'corda pular',
            'colchonete yoga',
            'tapete yoga',
            'rolo liberação miofascial',
            'bola pilates',
            'bola suíça',
            'caneleira peso',
            'luva musculação',
            'cinta lombar',
            'joelheira esportiva',
            'tornozeleira esportiva',
            'faixa abdominal',
            'smartband fitness',
            'relógio esportivo',
            'fones esportivos',
            'óculos ciclismo',
            'capacete ciclismo',
            'luva ciclismo',
            'bermuda ciclismo',
            'camisa ciclismo',
            'suporte bicicleta parede',
            'bomba encher pneu',
            'lanterna bicicleta',
            'garrafa ciclismo',
            'mochila hidratação',
            'patinete elétrico',
            'skate',
            'longboard',
            'bola futebol',
            'bola basquete',
            // 'bola vôlei',
            'rede esportiva',
            'apito esportivo'
        ]
    },
    'Bebês': {
        produtos: [
            'babá eletrônica',
            'monitor bebê câmera',
            'carrinho bebê',
            'cadeira alimentação bebê',
            'bebê conforto',
            'cadeirinha carro bebê',
            'berço portátil',
            'cercadinho bebê',
            'banheira bebê',
            'banheira dobrável bebê',
            'almofada amamentação',
            'extrator leite elétrico',
            'esterilizador mamadeira',
            'aquecedor mamadeira',
            'mamadeira anticolica',
            'kit mamadeira',
            'chupeta ortodôntica',
            'kit higiene bebê',
            'termômetro digital bebê',
            'termômetro banho bebê',
            'umidificador quarto bebê',
            'tapete atividades bebê',
            'tapete eva infantil',
            'andador bebê',
            'canguru bebê',
            'mochila maternidade',
            'bolsa maternidade',
            'fralda descartável',
            'kit fralda promoção',
            'lenço umedecido',
            'kit enxoval bebê',
            'cobertor bebê',
            'roupinha bebê kit',
            'macacão bebê'
        ]
    },
    'Pet Shop': {
        produtos: [
            'comedouro automático pet',
            'bebedouro fonte pet',
            'bebedouro automático pet',
            'arranhador gato',
            'brinquedo interativo pet',
            'brinquedo interativo gato',
            'brinquedo cachorro resistente',
            'cama cachorro',
            'cama pet premium',
            'tapete higiênico cachorro',
            'kit tapete higiênico',
            'areia gato',
            'areia sílica gato',
            'caixa areia gato',
            'coleira antipulgas',
            'antipulgas cachorro',
            'antipulgas gato',
            'guia retrátil cachorro',
            'peitoral cachorro',
            'coleira cachorro',
            'transportadora pet',
            'bolsa transporte pet',
            'mochila pet',
            'escova tira pelos pet',
            'escova pet removedor pelos',
            'kit higiene pet',
            'shampoo pet',
            'máquina tosa pet',
            'soprador pet',
            'cortador unha pet',
            'cercadinho pet',
            'portão pet segurança',
            'câmera monitor pet',
            'fonte água pet',
            'roupa cachorro inverno'
        ]
    },
    'Ferramentas': {
        produtos: [
            'furadeira parafusadeira',
            'parafusadeira sem fio',
            'kit furadeira parafusadeira',
            'nível laser',
            'trena digital',
            'fita métrica',
            'kit ferramentas completo',
            'jogo chaves precisão',
            'jogo chaves allen',
            'jogo chaves combinadas',
            'alicate universal',
            'alicate pressão',
            'alicate corte',
            'multímetro digital',
            'detector de metais parede',
            'serra tico tico',
            'serra circular',
            'esmerilhadeira angular',
            'lixadeira elétrica',
            'mini retífica',
            'pistola cola quente',
            'pistola pintura elétrica',
            'compressor ar portátil',
            'lavadora alta pressão',
            'caixa ferramentas organizadora',
            'maleta ferramentas',
            'organizador ferramentas',
            'escada dobrável',
            'lanterna recarregável',
            'refletor led portátil',
            'extensão elétrica',
            'estabilizador energia',
            'bateria ferramenta sem fio',
            'carregador bateria ferramenta',
            'kit brocas aço',
            'kit brocas concreto',
            'kit bits parafusadeira'
        ]
    },
    'Games': {
        produtos: [
            'controle ps5',
            'controle xbox wireless',
            'headset gamer',
            'headset gamer rgb',
            'cadeira gamer',
            'monitor gamer',
            'teclado gamer rgb',
            'mouse gamer',
            'mousepad gamer grande',
            'mousepad gamer rgb',
            'suporte headset',
            'suporte controle',
            'base carregadora controle',
            'cooler notebook gamer',
            'hub usb gamer',
            'webcam streaming',
            'microfone gamer usb',
            'ring light streaming',
            'placa captura video',
            'ssd para games',
            'memoria ram gamer',
            'adaptador bluetooth pc',
            'repetidor wifi gamer',
            'cartão memória nintendo switch',
            'case nintendo switch',
            'grip controle',
            'gatilho controle celular',
            'controle bluetooth celular',
            'suporte celular gamer',
            'cadeira gamer suporte lombar'
        ]
    },
};

// ✅ PALAVRAS-CHAVE BLOQUEADAS
const BLOCKED_KEYWORDS = [
    "livro", "apostila", "usado", "reembalado", "refil",
    "peça de reposição", "recarga", "ebook", "e-book",
    "revista", "jornal", "assinatura", "gift card", "vale presente",
    "curso online", "capa case", "capa para", "película", "armação"
];

// ─────────────────────────────────────────────
// 🎲 SORTEAR CATEGORIA
// ─────────────────────────────────────────────
function pickRandomCategory(exclude = []) {
    const categories = Object.keys(SEARCH_CATALOG).filter(c => !exclude.includes(c));
    if (categories.length === 0) return null;
    return categories[Math.floor(Math.random() * categories.length)];
}

/**
 * Retorna uma lista embaralhada dos produtos de uma categoria.
 */
function shuffleProducts(category) {
    if (!SEARCH_CATALOG[category]) return [];
    const produtos = [...SEARCH_CATALOG[category].produtos];
    for (let i = produtos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [produtos[i], produtos[j]] = [produtos[j], produtos[i]];
    }
    return produtos;
}

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

    if (product.prime) score += 15;

    if      (product.price >= 50  && product.price <= 500) score += 15;
    else if (product.price >= 30  && product.price <= 800) score += 10;
    else score += 5;

    return Math.round(score);
}

// ─────────────────────────────────────────────
// 🔍 BUSCAR PRODUTOS NA AMAZON
// ─────────────────────────────────────────────
async function searchAmazon(page, keyword, category) {
    console.log(`\n🔍 Buscando: "${keyword}" [${category}]`);

    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    const encodedKeyword = encodeURIComponent(keyword);
    const searchUrl = `https://www.amazon.com.br/s?k=${encodedKeyword}&s=price-asc-rank`;

    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));

    console.log(`   🔗 URL: ${searchUrl}`);

    const rawProducts = await page.evaluate(() => {
        const items = [];
        const cards = document.querySelectorAll("[data-component-type=\"s-search-result\"]");

        cards.forEach(card => {
            try {
                const asin = card.getAttribute("data-asin");
                if (!asin) return;

                const titleEl = card.querySelector("h2 .a-link-normal span, h2 span.a-size-medium, h2 span.a-size-base-plus, h2 span.a-size-mini, [data-cy=\"title-recipe\"] h2 span");
                const title   = titleEl ? titleEl.innerText.trim() : null;
                if (!title || title.length < 5) return;

                const priceEl         = card.querySelector(".a-price:not(.a-text-price) .a-price-whole");
                const priceFractionEl = card.querySelector(".a-price:not(.a-text-price) .a-price-fraction");
                let priceStr = null;
                if (priceEl) {
                    const whole    = priceEl.innerText.replace(/\D/g, "");
                    const fraction = priceFractionEl ? priceFractionEl.innerText.replace(/\D/g, "") : "00";
                    priceStr = `${whole},${fraction}`;
                }
                if (!priceStr) {
                    const match = card.innerText.match(/R\$\s?(\d[\d.]*[\.,]\d{2})/);
                    if (match) priceStr = match[1].replace(".", ",");
                }
                if (!priceStr) return;

                let oldPriceStr = null;
                const strikeEl = card.querySelector("[data-a-strike=\"true\"]");
                if (strikeEl) {
                    const visibleEl  = strikeEl.querySelector("[aria-hidden=\"true\"]");
                    const rawVisible = visibleEl ? (visibleEl.innerText || "") : "";
                    const matchVisible = rawVisible.match(/R\$\s?(\d[\d.]*[\.,]\d{2})/);
                    if (matchVisible) {
                        oldPriceStr = matchVisible[1].replace(".", ",");
                    }
                    if (!oldPriceStr) {
                        const offscreenEl = strikeEl.querySelector(".a-offscreen");
                        if (offscreenEl) {
                            const rawOffscreen = offscreenEl.innerText || "";
                            const matchOffscreen = rawOffscreen.match(/R\$\s?(\d[\d.]*[\.,]\d{2})/);
                            if (matchOffscreen) oldPriceStr = matchOffscreen[1].replace(".", ",");
                        }
                    }
                    if (!oldPriceStr) {
                        const rawStrike = strikeEl.innerText || "";
                        const matchStrike = rawStrike.match(/R\$\s?(\d[\d.]*[\.,]\d{2})/);
                        if (matchStrike) oldPriceStr = matchStrike[1].replace(".", ",");
                    }
                } else {
                    const oldOffscreen = card.querySelector(".a-text-price .a-offscreen");
                    if (oldOffscreen) {
                        const raw   = oldOffscreen.innerText || "";
                        const match = raw.match(/R\$\s?(\d[\d.]*[\.,]\d{2})/);
                        if (match) oldPriceStr = match[1].replace(".", ",");
                    }
                }

                const linkEl = card.querySelector("h2 a.a-link-normal, a.a-link-normal[href*=\"/dp/\"]");
                const href   = linkEl ? linkEl.href : null;
                if (!href) return;

                const primeEl = card.querySelector(".a-icon-prime, .s-prime");
                const imgEl  = card.querySelector("img.s-image");
                let imageUrl = imgEl ? (imgEl.src || imgEl.getAttribute("data-src")) : null;
                if (imageUrl) {
                    imageUrl = imageUrl
                        .replace(/SF\d+,\d+/g, "SF500,500")
                        .replace(/QL\d+/g, "QL85");
                }

                const ratingEl = card.querySelector(".a-icon-star-small .a-icon-alt, .a-icon-star .a-icon-alt");
                const rating   = ratingEl ? parseFloat(ratingEl.innerText) : null;

                items.push({ asin, title, priceStr, oldPriceStr, href, prime: !!primeEl, imageUrl, rating });
            } catch (_) {}
        });

        return items;
    });

    console.log(`📦 ${rawProducts.length} produtos extraídos`);

    if (rawProducts.length === 0) {
        console.warn("⚠️  Nenhum card encontrado — possível bloqueio de bot ou mudança de seletor");
        return [];
    }

    rawProducts.slice(0, 3).forEach((p, i) => {
        console.log(`   [${i+1}] ${p.title?.substring(0, 50)} | R$ ${p.priceStr} | old: ${p.oldPriceStr || "N/A"}`);
    });

    const mapped = rawProducts.map(p => {
        const price    = parsePrice(p.priceStr);
        const oldPrice = parsePrice(p.oldPriceStr);
        const discount = calculateDiscount(oldPrice, price);

        let finalLink = p.href;
        try {
            finalLink = buildAffiliateLink(p.asin, CONFIG.AFFILIATE_TAG);
        } catch (_) {}

        return {
            title:         p.title,
            price,
            oldPrice,
            discount,
            asin:          p.asin,
            link:          finalLink,
            originalLink:  p.href,
            prime:         p.prime,
            category,
            imageUrl:      p.imageUrl,
            rating:        p.rating,
            searchKeyword: keyword
        };
    });

    const filtered = mapped.filter(p => {
        if (!p.price || p.price < CONFIG.MIN_PRICE || p.price > CONFIG.MAX_PRICE) return false;
        if (CONFIG.REQUIRE_PRIME && !p.prime) return false;
        const lower = p.title.toLowerCase();
        return !BLOCKED_KEYWORDS.some(kw => lower.includes(kw));
    });

    console.log(`   Após filtros: ${filtered.length} produto(s)`);

    const scored = filtered
        .map(p => ({ ...p, score: calculateProductScore(p) }))
        .filter(p => p.score >= CONFIG.MIN_PRODUCT_SCORE)
        .sort((a, b) => b.score - a.score);

    // Retorna os top 8 candidatos para a verificação escolher o melhor
    return scored.slice(0, 8);
}

// ─────────────────────────────────────────────
// ✅ VERIFICAR PREÇO NA PÁGINA DO PRODUTO
// ─────────────────────────────────────────────
async function verifyProductPrice(page, product) {
    try {
        const productUrl = product.originalLink || product.link.split("?")[0];
        console.log(`      🔗 Verificando: ${productUrl.substring(0, 80)}...`);

        await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));

        const extracted = await page.evaluate(() => {
            const currentSelectors = [
                ".priceToPay .a-price-whole",
                ".reinventPricePriceToPayMargin .a-price-whole",
                "[data-feature-name=\"corePriceDisplay\"] .a-price-whole",
                "#corePriceDisplay_desktop_feature_div .a-price-whole",
                "#corePrice_feature_div .a-price-whole"
            ];
            const fractionSelectors = [
                ".priceToPay .a-price-fraction",
                ".reinventPricePriceToPayMargin .a-price-fraction",
                "[data-feature-name=\"corePriceDisplay\"] .a-price-fraction"
            ];

            let wholeEl = null, fractionEl = null;
            for (const sel of currentSelectors) {
                wholeEl = document.querySelector(sel);
                if (wholeEl) break;
            }
            for (const sel of fractionSelectors) {
                fractionEl = document.querySelector(sel);
                if (fractionEl) break;
            }

            let currentPrice = null;
            if (wholeEl) {
                const whole    = wholeEl.textContent.replace(/[^\d]/g, "");
                const fraction = fractionEl ? fractionEl.textContent.replace(/[^\d]/g, "") : "00";
                currentPrice   = `${whole},${fraction}`;
            }

            const oldSelectors = [
                ".basisPrice .a-price[data-a-strike=\"true\"] .a-offscreen",
                "[data-a-strike=\"true\"] .a-offscreen",
                ".basisPrice .a-text-price",
                ".a-price.a-text-price[data-a-strike=\"true\"]"
            ];
            let oldPrice = null;
            for (const sel of oldSelectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const match = (el.textContent || el.innerText).match(/R\$\s?(\d+[\.,]\d{2})/);
                    if (match) { oldPrice = match[1].replace(".", ","); break; }
                }
            }

            return { currentPrice, oldPrice };
        });

        const verifiedPrice    = parsePrice(extracted.currentPrice);
        const verifiedOldPrice = parsePrice(extracted.oldPrice);

        console.log(`      💰 Preço na página: R$ ${verifiedPrice || "NÃO ENCONTRADO"}`);

        if (!verifiedPrice) return { verified: false };

        const diff = Math.abs(verifiedPrice - product.price);
        console.log(`      📊 Busca: R$ ${product.price?.toFixed(2)} | Página: R$ ${verifiedPrice.toFixed(2)} | Diff: R$ ${diff.toFixed(2)}`);

        if (diff > CONFIG.PRICE_TOLERANCE) {
            console.log(`      ⚠️  Preço não bate! (tolerância: R$ ${CONFIG.PRICE_TOLERANCE})`);
            return { verified: false };
        }

        return { verified: true, currentPrice: verifiedPrice, oldPrice: verifiedOldPrice || product.oldPrice };
    } catch (err) {
        console.log(`      ❌ Erro ao verificar: ${err.message}`);
        return { verified: false };
    }
}

// ─────────────────────────────────────────────
// 🔎 BUSCAR + VERIFICAR UM ÚNICO SLOT
// ─────────────────────────────────────────────
async function findOneProduct(page, keyword, category, minDiscount = 0) {
    let candidates = [];
    try {
        candidates = await searchAmazon(page, keyword, category);
    } catch (err) {
        console.error(`❌ Erro na busca de "${keyword}":`, err.message);
        return null;
    }

    if (candidates.length === 0) {
        console.log(`   ⚠️  Sem candidatos para "${keyword}"`);
        return null;
    }

    // Filtra por desconto mínimo ANTES da verificação de preço na página
    const filteredByDiscount = candidates.filter(p => p.discount >= minDiscount);

    if (filteredByDiscount.length === 0) {
        console.log(`   ⚠️  Nenhum candidato com desconto >= ${minDiscount}% para "${keyword}"`);
        return null;
    }

    if (!CONFIG.VERIFY_PRICES) {
        return filteredByDiscount[0];
    }

    console.log(`\n🔍 Verificando preços para "${keyword}" (${filteredByDiscount.length} candidato(s) com >= ${minDiscount}% OFF)...`);
    for (let i = 0; i < filteredByDiscount.length; i++) {
        const p = filteredByDiscount[i];
        console.log(`\n   [${i + 1}/${filteredByDiscount.length}] ${p.title.substring(0, 60)}...`);
        const result = await verifyProductPrice(page, p);

        if (result.verified) {
            p.verifiedPrice    = result.currentPrice;
            p.verifiedOldPrice = result.oldPrice;
            console.log(`      ✅ APROVADO`);
            return p;
        } else {
            console.log(`      ❌ REPROVADO`);
        }

        if (i < filteredByDiscount.length - 1) {
            await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_VERIFICATIONS));
        }
    }

    console.log(`   ⚠️  Nenhum candidato aprovado para "${keyword}" com desconto >= ${minDiscount}%`);
    return null;
}

// ─────────────────────────────────────────────
// 🚀 FUNÇÃO PRINCIPAL
// ─────────────────────────────────────────────
async function scrapeBySearch(page) {
    console.log("\n" + "=".repeat(70));
    console.log("🎯 BUSCA POR CATEGORIA — COLETANDO 4 PRODUTOS");
    console.log("=".repeat(70));

    if (!isDeduplicationInitialized) {
        try {
            await dedup.initialize();
            isDeduplicationInitialized = true;
        } catch (err) {
            console.warn("⚠️  Anti-repetição indisponível:", err.message);
        }
    }

    const finalProducts = [];
    const usedAsins     = new Set();
    const attemptedCategories = [];

    // Loop principal para garantir que atingimos o objetivo de PRODUCTS_PER_RUN
    while (finalProducts.length < CONFIG.PRODUCTS_PER_RUN) {
        // ── 1. Sorteia uma categoria que ainda não foi tentada ───────────
        const currentCategory = pickRandomCategory(attemptedCategories);
        
        if (!currentCategory) {
            console.warn("⚠️  Todas as categorias do catálogo foram esgotadas e não atingimos 4 produtos.");
            break;
        }

        attemptedCategories.push(currentCategory);
        console.log(`\n🗂️  Categoria selecionada: ${currentCategory}`);

        // ── 2. Embaralha os produtos da categoria ──────────────────────────
        const keywordPool = shuffleProducts(currentCategory);
        console.log(`   ${keywordPool.length} keywords disponíveis na categoria`);

        const qualifiedProductsFromCategory = [];
        const otherProductsFromCategory = [];

        // --- PRIMEIRA PASSADA: Busca produtos QUALIFICADOS (com desconto >= QUALIFIED_MIN_DISCOUNT) na categoria atual ---
        console.log(`\n⭐ Buscando produtos QUALIFICADOS (>= ${CONFIG.QUALIFIED_MIN_DISCOUNT}% OFF) na categoria "${currentCategory}"...`);
        for (const keyword of keywordPool) {
            if (qualifiedProductsFromCategory.length + finalProducts.length >= CONFIG.PRODUCTS_PER_RUN) break; // Já temos o suficiente ou estamos perto

            const product = await findOneProduct(page, keyword, currentCategory, CONFIG.QUALIFIED_MIN_DISCOUNT);

            if (product) {
                if (!usedAsins.has(product.asin)) {
                    if (isDeduplicationInitialized) {
                        try {
                            const fresh = await dedup.filterNewProducts([product]);
                            if (fresh.length > 0) {
                                qualifiedProductsFromCategory.push(product);
                                usedAsins.add(product.asin);
                                console.log(`   ✅ Qualificado adicionado: ${product.title.substring(0, 55)}...`);
                            } else {
                                console.log(`   ⚠️  Produto qualificado já enviado anteriormente (deduplicação global) — pulando`);
                            }
                        } catch (err) {
                            console.warn("⚠️  Erro na deduplicação de qualificado:", err.message);
                            qualifiedProductsFromCategory.push(product); // Adiciona mesmo com erro de dedup para não perder
                            usedAsins.add(product.asin);
                        }
                    } else {
                        qualifiedProductsFromCategory.push(product);
                        usedAsins.add(product.asin);
                        console.log(`   ✅ Qualificado adicionado: ${product.title.substring(0, 55)}...`);
                    }
                } else {
                    console.log(`   ⚠️  ASIN ${product.asin} já coletado nesta execução (qualificado) — pulando`);
                }
            }
        }

        // Adiciona os produtos qualificados encontrados nesta categoria aos produtos finais
        finalProducts.push(...qualifiedProductsFromCategory);
        console.log(`   Total de produtos qualificados até agora: ${finalProducts.length}/${CONFIG.PRODUCTS_PER_RUN}`);

        // --- SEGUNDA PASSADA: Se ainda faltam produtos, busca o restante (sem filtro de desconto) na MESMA categoria ---
        if (finalProducts.length < CONFIG.PRODUCTS_PER_RUN) {
            console.log(`\n⏳ Faltam ${CONFIG.PRODUCTS_PER_RUN - finalProducts.length} produtos. Buscando o restante na categoria "${currentCategory}" (sem filtro de desconto)...`);
            for (const keyword of keywordPool) {
                if (finalProducts.length >= CONFIG.PRODUCTS_PER_RUN) break;

                // Verifica se o produto já foi adicionado como qualificado
                const existingQualified = qualifiedProductsFromCategory.find(p => p.searchKeyword === keyword);
                if (existingQualified) {
                    continue; // Já pegamos este produto na primeira passada
                }

                const product = await findOneProduct(page, keyword, currentCategory, 0); // minDiscount = 0 para relaxar o critério

                if (product) {
                    if (!usedAsins.has(product.asin)) {
                        if (isDeduplicationInitialized) {
                            try {
                                const fresh = await dedup.filterNewProducts([product]);
                                if (fresh.length > 0) {
                                    finalProducts.push(product);
                                    usedAsins.add(product.asin);
                                    console.log(`   ➕ Complementar adicionado: ${product.title.substring(0, 55)}...`);
                                } else {
                                    console.log(`   ⚠️  Produto complementar já enviado anteriormente (deduplicação global) — pulando`);
                                }
                            } catch (err) {
                                console.warn("⚠️  Erro na deduplicação de complementar:", err.message);
                                finalProducts.push(product); // Adiciona mesmo com erro de dedup para não perder
                                usedAsins.add(product.asin);
                            }
                        } else {
                            finalProducts.push(product);
                            usedAsins.add(product.asin);
                            console.log(`   ➕ Complementar adicionado: ${product.title.substring(0, 55)}...`);
                        }
                    } else {
                        console.log(`   ⚠️  ASIN ${product.asin} já coletado nesta execução (complementar) — pulando`);
                    }
                }
            }
        }

        if (finalProducts.length < CONFIG.PRODUCTS_PER_RUN) {
            console.log(`\n⚠️  Categoria "${currentCategory}" esgotada com ${finalProducts.length} produto(s). Buscando próxima categoria...`);
        }
    }

    // ── 4. Resultado final ─────────────────────────────────────────────
    console.log("\n" + "=".repeat(70));
    if (finalProducts.length === 0) {
        console.log(`😔 Nenhum produto encontrado em nenhuma categoria.`);
    } else {
        console.log(`🎉 ${finalProducts.length}/${CONFIG.PRODUCTS_PER_RUN} produto(s) coletados com sucesso.`);
        finalProducts.forEach((p, i) => {
            console.log(`   ${i + 1}. [${p.category}] ${p.title.substring(0, 55)}...`);
            console.log(`      R$ ${p.price?.toFixed(2)} | ${p.discount}% OFF | ASIN: ${p.asin}`);
        });
    }
    console.log("=".repeat(70) + "\n");

    return finalProducts;
}

// ─────────────────────────────────────────────
// 📦 EXPORTAÇÕES
// ─────────────────────────────────────────────
module.exports = {
    scrapeGoldbox: scrapeBySearch,
    SEARCH_CATALOG,
    pickRandomCategory,
    shuffleProducts
};
