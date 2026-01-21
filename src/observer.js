require('dotenv').config();

const { startBrowser } = require('./browser/browser');
const { scrapeGoldbox } = require('./pages/goldbox');
const { saveOffers } = require('./storage/storage');
const { AmazonDealsBot } = require('./services/zapiService');

async function run() {
    let browser;
    try {
        browser = await startBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        const goldboxOffers = await scrapeGoldbox(page);
        console.log(`Encontrados ${goldboxOffers.length} produtos na Goldbox.`);

        const allOffers = goldboxOffers;
        
        const filteredOffers = allOffers.filter(offer => {
            return offer.discount >= 20;
        });

        console.log(`Total de ofertas que atendem ao critério (>= 20%): ${filteredOffers.length}`);

        if (filteredOffers.length > 0) {
            await saveOffers(filteredOffers);
            
            if (process.env.WHATSAPP_GROUP_ID) {
                const bot = new AmazonDealsBot();
                await bot.sendDealsToGroup(filteredOffers);
                console.log('✅ Enviado para WhatsApp!');
            }
        } else {
            console.log("Nenhuma oferta qualificada encontrada nesta execução.");
        }

    } catch (err) {
        console.error("Erro durante a execução do observador:", err);
    } finally {
        if (browser) {
            await browser.close();
            console.log("Navegador encerrado.");
        }
    }
}

run();