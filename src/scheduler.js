require('dotenv').config();
const cron = require('node-cron');
const { startBrowser }                      = require('./browser/browser');
const { scrapeGoldbox }                     = require('./pages/scraping-amazon');
const { scrapeGoldbox: scrapeMercadoLivre } = require('./pages/scraping-mercadolivre');
const { generateAffiliateLinks }            = require('./services/mercadolivre-link');
const { saveOffers }                        = require('./storage/storage');
const { AmazonDealsBot }                    = require('./services/zapiService');
const { DeduplicationService }              = require('./services/deduplication');

// ✅ Instância global do serviço de deduplicação
const dedup = new DeduplicationService();
let isInitialized = false;

// 🔒 Trava para evitar execuções paralelas
let isRunning = false;

// ─────────────────────────────────────────────
// 🛒 AMAZON — Goldbox
// ─────────────────────────────────────────────
async function executeAmazon() {
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    console.log('\n' + '='.repeat(70));
    console.log(`🛒 [AMAZON] INICIANDO EXECUÇÃO - ${timestamp}`);
    console.log('='.repeat(70));

    let browser;
    try {
        if (!isInitialized) {
            await dedup.initialize();
            isInitialized = true;
        }

        browser = await startBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        const goldboxOffers = await scrapeGoldbox(page);
        console.log(`✅ Encontrados ${goldboxOffers.length} produtos na Goldbox.`);

        const newOffers = await dedup.filterNewProducts(goldboxOffers);
        console.log(`✨ ${newOffers.length} produtos são novos (não enviados recentemente)`);

        const filteredOffers = newOffers.filter(offer => offer.discount >= 20);
        console.log(`📊 Total de ofertas qualificadas (>= 20%): ${filteredOffers.length}`);

        if (filteredOffers.length > 0) {
            await saveOffers(filteredOffers);
            console.log('💾 Ofertas salvas no banco de dados');

            if (process.env.WHATSAPP_GROUP_ID) {
                const bot = new AmazonDealsBot();
                await bot.sendDealsToGroup(filteredOffers);
                console.log('✅ Enviado para WhatsApp!');

                await dedup.markAsSent(filteredOffers);
            }

            const stats = await dedup.getStats();
            console.log('\n📊 Estatísticas do Histórico:');
            console.log(`   • Total de produtos enviados: ${stats.total}`);
            console.log(`   • Categorias diferentes: ${stats.categories}`);
            console.log(`   • Desconto médio: ${stats.avg_discount?.toFixed(1)}%`);
        } else {
            console.log("ℹ️  Nenhuma oferta qualificada encontrada nesta execução.");
        }

        console.log('\n' + '='.repeat(70));
        console.log(`✅ [AMAZON] EXECUÇÃO CONCLUÍDA - ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
        console.log('='.repeat(70) + '\n');

    } catch (err) {
        console.error("❌ [AMAZON] Erro durante a execução:", err);
        console.error(err.stack);
    } finally {
        if (browser) {
            await browser.close();
            console.log("🔒 [AMAZON] Navegador encerrado.");
        }
    }
}

// ─────────────────────────────────────────────
// 🛍️  MERCADO LIVRE — Ofertas + Afiliados
// ─────────────────────────────────────────────
async function executeMercadoLivre() {
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    console.log('\n' + '='.repeat(70));
    console.log(`🛍️  [MERCADO LIVRE] INICIANDO EXECUÇÃO - ${timestamp}`);
    console.log('='.repeat(70));

    let browser;
    try {
        if (!isInitialized) {
            await dedup.initialize();
            isInitialized = true;
        }

        browser = await startBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        let mlOffers = await scrapeMercadoLivre(page);
        console.log(`📦 Encontrados ${mlOffers.length} produtos no Mercado Livre.`);

        // Fecha o browser do scraping antes de abrir o do link builder
        await browser.close();
        browser = null;
        console.log("🔒 Browser de scraping encerrado.");

        if (mlOffers.length > 0) {
            console.log(`\n🔗 Gerando links de afiliado para ${mlOffers.length} produtos...`);
            mlOffers = await generateAffiliateLinks(mlOffers);
            console.log(`✅ Links de afiliado gerados com sucesso.`);
        }

        const newOffers = await dedup.filterNewProducts(mlOffers);
        console.log(`✨ ${newOffers.length} produtos são novos (não enviados recentemente)`);

        const filteredOffers = newOffers.filter(offer => offer.discount >= 20);
        console.log(`📊 Total de ofertas qualificadas (>= 20%): ${filteredOffers.length}`);

        if (filteredOffers.length > 0) {
            await saveOffers(filteredOffers);
            console.log('💾 Ofertas salvas no banco de dados');

            if (process.env.WHATSAPP_GROUP_ID) {
                const bot = new AmazonDealsBot();
                await bot.sendDealsToGroup(filteredOffers);
                console.log('✅ Enviado para WhatsApp!');

                await dedup.markAsSent(filteredOffers);
            }

            const stats = await dedup.getStats();
            console.log('\n📊 Estatísticas do Histórico:');
            console.log(`   • Total de produtos enviados: ${stats.total}`);
            console.log(`   • Categorias diferentes: ${stats.categories}`);
            console.log(`   • Desconto médio: ${stats.avg_discount?.toFixed(1)}%`);
        } else {
            console.log("ℹ️  Nenhuma oferta qualificada encontrada nesta execução.");
        }

        console.log('\n' + '='.repeat(70));
        console.log(`✅ [MERCADO LIVRE] EXECUÇÃO CONCLUÍDA - ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
        console.log('='.repeat(70) + '\n');

    } catch (err) {
        console.error("❌ [MERCADO LIVRE] Erro durante a execução:", err);
        console.error(err.stack);
    } finally {
        if (browser) {
            await browser.close();
            console.log("🔒 [MERCADO LIVRE] Navegador encerrado.");
        }
    }
}

// ─────────────────────────────────────────────
// ⏰ AGENDAMENTOS INTERCALADOS
//    Amazon  → ímpares : 9h, 13h, 17h, 21h
//    ML      → pares   : 11h, 15h, 19h, 23h
// ─────────────────────────────────────────────
const horarios = [
    { hora: '0 9',  label: '1️⃣  09:00 - Amazon',         fn: executeAmazon        },
    { hora: '0 11', label: '2️⃣  11:00 - Mercado Livre',   fn: executeMercadoLivre  },
    { hora: '0 13', label: '3️⃣  13:00 - Amazon',         fn: executeAmazon        },
    { hora: '0 15', label: '4️⃣  15:00 - Mercado Livre',   fn: executeMercadoLivre  },
    { hora: '0 17', label: '5️⃣  17:00 - Amazon',         fn: executeAmazon        },
    { hora: '0 19', label: '6️⃣  19:00 - Mercado Livre',   fn: executeMercadoLivre  },
    { hora: '0 21', label: '7️⃣  21:00 - Amazon',         fn: executeAmazon        },
    { hora: '0 23', label: '8️⃣  23:00 - Mercado Livre',   fn: executeMercadoLivre  },
];

horarios.forEach(({ hora, label, fn }) => {
    cron.schedule(`0 ${hora} * * *`, async () => {
        console.log(`\n⏰ AGENDAMENTO DISPARADO: ${label}`);

        if (isRunning) {
            console.log('⚠️  Execução anterior ainda em andamento, pulando este horário...');
            return;
        }

        isRunning = true;
        try {
            await fn();
        } finally {
            isRunning = false;
        }
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });
});

// ─────────────────────────────────────────────
// 🖨️  BANNER INICIAL
// ─────────────────────────────────────────────
console.log('\n' + '='.repeat(70));
console.log('🤖 SCHEDULER INICIADO - AMAZON + MERCADO LIVRE INTERCALADOS');
console.log('='.repeat(70));
console.log('📅 Horários configurados:');
horarios.forEach(({ label }) => console.log(`   ${label}`));
console.log('');
console.log('🌎 Timezone: America/Sao_Paulo (Horário de Brasília)');
console.log('🛡️  Controle anti-repetição: últimos 100 produtos');
console.log('🔒 Proteção: Execuções paralelas bloqueadas automaticamente');
console.log('='.repeat(70));
console.log('⏳ Aguardando próxima execução...\n');

// ─────────────────────────────────────────────
// 🧪 EXECUÇÃO IMEDIATA (--run-now)
// ─────────────────────────────────────────────
if (process.argv.includes('--run-now')) {
    const source = process.argv.includes('--ml') ? 'ml' : 'amazon';
    console.log(`🧪 Executando imediatamente (modo teste) — fonte: ${source.toUpperCase()}\n`);
    source === 'ml' ? executeMercadoLivre() : executeAmazon();
}

// ─────────────────────────────────────────────
// 🧹 LIMPEZA AO ENCERRAR
// ─────────────────────────────────────────────
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Encerrando scheduler...');
    await dedup.close();
    console.log('🔒 Banco de dados fechado');
    process.exit(0);
});