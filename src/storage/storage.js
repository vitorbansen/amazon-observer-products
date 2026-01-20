const fs = require('fs').promises;
const path = require('path');

const STORAGE_PATH = path.join(__dirname, '../../data/offers.json');

async function saveOffers(newOffers) {
    try {
        let existingOffers = [];
        try {
            const data = await fs.readFile(STORAGE_PATH, 'utf8');
            existingOffers = JSON.parse(data);
        } catch (err) {
            // Arquivo não existe ou está vazio, começa com lista vazia
        }

        const existingAsins = new Set(existingOffers.map(o => o.asin));
        
        const uniqueNewOffers = newOffers.filter(offer => {
            if (!offer.asin) return false;
            if (existingAsins.has(offer.asin)) return false;
            existingAsins.add(offer.asin);
            return true;
        });

        const updatedOffers = [...existingOffers, ...uniqueNewOffers];
        
        await fs.writeFile(STORAGE_PATH, JSON.stringify(updatedOffers, null, 2), 'utf8');
        console.log(`${uniqueNewOffers.length} novas ofertas salvas. Total: ${updatedOffers.length}`);
    } catch (err) {
        console.error("Erro ao salvar ofertas:", err);
    }
}

module.exports = {
    saveOffers
};
