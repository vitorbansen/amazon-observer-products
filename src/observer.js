// observer.js
require('dotenv').config();

const { startBrowser }                      = require('./browser/browser');
const { scrapeGoldbox }                     = require('./pages/scraping-amazon');
const { scrapeGoldbox: scrapeMercadoLivre } = require('./pages/scraping-mercadolivre');
const { generateAffiliateLinks }            = require('./services/mercadolivre-link'); // ← atualizado
const { saveOffers }                        = require('./storage/storage');
const { AmazonDealsBot }                    = require('./services/zapiService');
const { DeduplicationService }              = require('./services/deduplication');

async function run() {
    let browser;
    const dedup = new DeduplicationService();

    try {
        await dedup.initialize();

        browser = await startBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

          // ── Mercado Livre Ofertas ───────────────────────────────────────
        let mlOffers = await scrapeMercadoLivre(page);
        console.log(`📦 Encontrados ${mlOffers.length} produtos no Mercado Livre.`);

            // ── Gera links de afiliado para os produtos do ML ───────────────
            if (mlOffers.length > 0) {
                console.log(`\n🔗 Gerando links de afiliado para ${mlOffers.length} produtos do ML...`);
                mlOffers = await generateAffiliateLinks(mlOffers, browser);
                console.log(`✅ Links de afiliado gerados com sucesso.`);
            }


        // ── Amazon Goldbox ──────────────────────────────────────────────
        const goldboxOffers = await scrapeGoldbox(page);
        console.log(`📦 Encontrados ${goldboxOffers.length} produtos na Goldbox.`);

        // ── Combina tudo ────────────────────────────────────────────────
        const allOffers = [...goldboxOffers, ...mlOffers];
        console.log(`📦 Total combinado: ${allOffers.length} produtos.`);

        // ── Filtra produtos já enviados ─────────────────────────────────
        const newOffers = await dedup.filterNewProducts(allOffers);
        console.log(`✨ ${newOffers.length} produtos são novos (não enviados recentemente)`);

        // ── Filtro de desconto mínimo ───────────────────────────────────
        const filteredOffers = newOffers.filter(offer => offer.discount >= 20);
        console.log(`📊 Total de ofertas qualificadas (>= 20%): ${filteredOffers.length}`);

        if (filteredOffers.length > 0) {
            await saveOffers(filteredOffers);

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

    } catch (err) {
        console.error("❌ Erro durante a execução do observador:", err);
    } finally {
        if (browser) {
            await browser.close();
            console.log("🔒 Navegador encerrado.");
        }
        await dedup.close();
    }
}

run();