require('dotenv').config();
const cron = require('node-cron');
const { startBrowser } = require('./browser/browser');
const { scrapeGoldbox } = require('./pages/goldbox');
const { saveOffers } = require('./storage/storage');
const { AmazonDealsBot } = require('./services/zapiService');

/**
 * 🤖 Função principal que executa o scraper
 */
async function executeObserver() {
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    console.log('\n' + '='.repeat(70));
    console.log(`🚀 INICIANDO EXECUÇÃO - ${timestamp}`);
    console.log('='.repeat(70));

    let browser;
    try {
        browser = await startBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        const goldboxOffers = await scrapeGoldbox(page);
        console.log(`✅ Encontrados ${goldboxOffers.length} produtos na Goldbox.`);

        const filteredOffers = goldboxOffers.filter(offer => {
            return offer.discount >= 20;
        });

        console.log(`📊 Total de ofertas qualificadas (>= 20%): ${filteredOffers.length}`);

        if (filteredOffers.length > 0) {
            await saveOffers(filteredOffers);
            console.log('💾 Ofertas salvas no banco de dados');
            
            if (process.env.WHATSAPP_GROUP_ID) {
                const bot = new AmazonDealsBot();
                await bot.sendDealsToGroup(filteredOffers);
                console.log('✅ Enviado para WhatsApp!');
            }
        } else {
            console.log("ℹ️  Nenhuma oferta qualificada encontrada nesta execução.");
        }

        console.log('\n' + '='.repeat(70));
        console.log(`✅ EXECUÇÃO CONCLUÍDA - ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
        console.log('='.repeat(70) + '\n');

    } catch (err) {
        console.error("❌ Erro durante a execução do observador:", err);
        console.error(err.stack);
    } finally {
        if (browser) {
            await browser.close();
            console.log("🔒 Navegador encerrado.");
        }
    }
}

/**
 * ⏰ Configuração dos horários de execução
 * Formato cron: segundo minuto hora dia mês dia-da-semana
 * 
 * '0 0 9,14,20 * * *' = Executa às 9h, 14h e 20h todos os dias
 */

// Executar às 9h da manhã (horário de Brasília)
cron.schedule('0 0 9 * * *', () => {
    console.log('⏰ AGENDAMENTO: 9h da manhã');
    executeObserver();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

// Executar às 14h da tarde (horário de Brasília)
cron.schedule('0 0 14 * * *', () => {
    console.log('⏰ AGENDAMENTO: 14h da tarde');
    executeObserver();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

// Executar às 20h da noite (horário de Brasília)
cron.schedule('0 0 20 * * *', () => {
    console.log('⏰ AGENDAMENTO: 20h da noite');
    executeObserver();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

console.log('🤖 SCHEDULER INICIADO');
console.log('📅 Horários configurados:');
console.log('   • 09:00 - Manhã');
console.log('   • 14:00 - Tarde');
console.log('   • 20:00 - Noite');
console.log('🌎 Timezone: America/Sao_Paulo (Horário de Brasília)');
console.log('⏳ Aguardando próxima execução...\n');

// Opcional: Executar imediatamente ao iniciar (para testes)
if (process.argv.includes('--run-now')) {
    console.log('🧪 Executando imediatamente (modo teste)...\n');
    executeObserver();
}