require('dotenv').config();

const { startBrowser } = require('./browser/browser');
const { scrapeGoldbox } = require('./pages/scraping-amazon');
const { saveOffers } = require('./storage/storage');
const { AmazonDealsBot } = require('./services/zapiService');
const { DeduplicationService } = require('./services/deduplication');

async function run() {
    let browser;
    const dedup = new DeduplicationService();
    
    try {
        // ✅ Inicializar sistema anti-repetição
        await dedup.initialize();
        
        browser = await startBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        const goldboxOffers = await scrapeGoldbox(page);
        console.log(`📦 Encontrados ${goldboxOffers.length} produtos na Goldbox.`);

        // ✅ FILTRAR PRODUTOS JÁ ENVIADOS
        const newOffers = await dedup.filterNewProducts(goldboxOffers);
        console.log(`✨ ${newOffers.length} produtos são novos (não enviados recentemente)`);

        // Aplicar filtro de desconto
        const filteredOffers = newOffers.filter(offer => {
            return offer.discount >= 20;
        });

        console.log(`📊 Total de ofertas qualificadas (>= 20%): ${filteredOffers.length}`);

        if (filteredOffers.length > 0) {
            await saveOffers(filteredOffers);
            
            if (process.env.WHATSAPP_GROUP_ID) {
                const bot = new AmazonDealsBot();
                await bot.sendDealsToGroup(filteredOffers);
                console.log('✅ Enviado para WhatsApp!');
                
                // ✅ REGISTRAR PRODUTOS COMO ENVIADOS
                await dedup.markAsSent(filteredOffers);
            }
            
            // 📊 Mostrar estatísticas
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
        
        // Fechar conexão do banco
        await dedup.close();
    }
}

run();