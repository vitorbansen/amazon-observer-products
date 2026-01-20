const { parsePrice, calculateDiscount, extractAsin } = require('../extractors/extractor');

async function scrapeCupons(page) {
    console.log("Navegando para a página de Cupons...");
    const url = 'https://www.amazon.com.br/cupons';
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));

    const products = await page.evaluate(() => {
        const items = [];
        // Seletores para cupons
        const cards = document.querySelectorAll('.a-section.coupon-tile');
        
        cards.forEach(card => {
            try {
                const titleEl = card.querySelector('.a-size-base.a-color-base');
                const discountEl = card.querySelector('.coupon-badge-text'); // Ex: "Economize R$ 10,00" ou "10%"
                const linkEl = card.querySelector('a.a-link-normal');
                
                if (titleEl && linkEl) {
                    items.push({
                        title: titleEl.innerText.trim(),
                        discountText: discountEl ? discountEl.innerText.trim() : '',
                        link: linkEl.href,
                        prime: false // Cupons geralmente não mostram ícone prime no card
                    });
                }
            } catch (e) {}
        });
        return items;
    });

    // Nota: Cupons na Amazon muitas vezes não mostram o preço final diretamente no card, 
    // apenas o valor do desconto. Para simplificar e seguir a regra de 11%, 
    // vamos focar em cupons que mencionam porcentagem ou tentar inferir.
    // No entanto, o requisito pede cálculo de desconto real (preco_antigo - preco_atual).
    // Se o cupom não fornece os dois preços, o cálculo fica prejudicado.
    // Vamos filtrar os que conseguirmos processar.

    return products.map(p => {
        const asin = extractAsin(p.link);
        // Para cupons, a lógica de "desconto real" pode ser diferente se os preços não estiverem presentes.
        // Como o requisito é estrito sobre a fórmula, vamos marcar como 0 se não houver dados suficientes.
        return {
            title: p.title,
            price: null,
            oldPrice: null,
            discount: 0, // Placeholder
            asin,
            link: p.link,
            prime: p.prime
        };
    });
}

module.exports = { scrapeCupons };
