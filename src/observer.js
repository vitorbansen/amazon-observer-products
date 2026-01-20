const { startBrowser } = require('./browser/browser');
const { scrapeGoldbox } = require('./pages/goldbox');
const { scrapeCupons } = require('./pages/cupons');
const { saveOffers } = require('./storage/storage');

async function run() {
    let browser;
    try {
        browser = await startBrowser();
        const page = await browser.newPage();

        
        // Configurar viewport
        await page.setViewport({ width: 1920, height: 1080 });

        // 1. Scrape Goldbox
        const goldboxOffers = await scrapeGoldbox(page);
        console.log(`Encontrados ${goldboxOffers.length} produtos na Goldbox.`);

        // 2. Scrape Cupons (Opcional/Adicional)
        // const cuponsOffers = await scrapeCupons(page);
        // console.log(`Encontrados ${cuponsOffers.length} cupons.`);

        // Combinar e filtrar
        // const allOffers = [...goldboxOffers, ...cuponsOffers];
        const allOffers = goldboxOffers;
        
        const filteredOffers = allOffers.filter(offer => {
            // Regra: desconto >= 20%
            return offer.discount >= 20;
        });

        console.log(`Total de ofertas que atendem ao critério (>= 20%): ${filteredOffers.length}`);

        // Salvar
        if (filteredOffers.length > 0) {
            await saveOffers(filteredOffers);
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
