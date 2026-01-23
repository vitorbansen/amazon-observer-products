require('dotenv').config();
const cron = require('node-cron');
const { startBrowser } = require('./browser/browser');
const { scrapeGoldbox } = require('./pages/goldbox');
const { saveOffers } = require('./storage/storage');
const { AmazonDealsBot } = require('./services/zapiService');
const { DeduplicationService } = require('./services/deduplication');

// ✅ Instância global do serviço de deduplicação
const dedup = new DeduplicationService();
let isInitialized = false;

/**
 * 🤖 Função principal que executa o scraper
 * Busca 3 categorias aleatórias x 5 produtos = 15 ofertas por execução
 * ✅ COM CONTROLE ANTI-REPETIÇÃO
 */
async function executeObserver() {
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    console.log('\n' + '='.repeat(70));
    console.log(`🚀 INICIANDO EXECUÇÃO - ${timestamp}`);
    console.log('='.repeat(70));

    let browser;
    try {
        // ✅ Inicializar serviço de deduplicação (apenas uma vez)
        if (!isInitialized) {
            await dedup.initialize();
            isInitialized = true;
        }

        browser = await startBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // 🔥 Buscar ofertas (goldbox.js já filtra duplicatas internamente)
        const goldboxOffers = await scrapeGoldbox(page);
        console.log(`✅ Encontrados ${goldboxOffers.length} produtos únicos (meta: 15).`);

        // Aplicar filtro de desconto
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
                
                // ✅ REGISTRAR PRODUTOS COMO ENVIADOS
                await dedup.markAsSent(filteredOffers);
            }
            
            // 📊 Mostrar estatísticas do histórico
            const stats = await dedup.getStats();
            console.log('\n📊 Estatísticas do Histórico:');
            console.log(`   • Produtos no histórico: ${stats.total}/100`);
            console.log(`   • Categorias diferentes: ${stats.categories}`);
            console.log(`   • Desconto médio histórico: ${stats.avg_discount?.toFixed(1)}%`);
            
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
 * ⏰ CONFIGURAÇÃO: 8 EXECUÇÕES POR DIA
 * 
 * Distribuição:
 * - 09:00 (Manhã cedo)
 * - 11:00 (Meio da manhã)
 * - 13:00 (Início da tarde)
 * - 15:00 (Meio da tarde)
 * - 17:00 (Final da tarde)
 * - 19:00 (Início da noite)
 * - 21:00 (Meio da noite)
 * - 23:00 (Final da noite)
 * 
 * Total: 8 execuções x ~15 ofertas = ~120 mensagens/dia
 * ✅ SEM REPETIÇÃO dos últimos 100 produtos
 */

// 1️⃣ Execução: 09:00
cron.schedule('0 0 9 * * *', () => {
    console.log('⏰ AGENDAMENTO 1/8: 09:00 (Manhã cedo)');
    executeObserver();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

// 2️⃣ Execução: 11:00
cron.schedule('0 0 11 * * *', () => {
    console.log('⏰ AGENDAMENTO 2/8: 11:00 (Meio da manhã)');
    executeObserver();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

// 3️⃣ Execução: 13:00
cron.schedule('0 0 13 * * *', () => {
    console.log('⏰ AGENDAMENTO 3/8: 13:00 (Início da tarde)');
    executeObserver();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

// 4️⃣ Execução: 15:00
cron.schedule('0 0 15 * * *', () => {
    console.log('⏰ AGENDAMENTO 4/8: 15:00 (Meio da tarde)');
    executeObserver();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

// 5️⃣ Execução: 17:00
cron.schedule('0 0 17 * * *', () => {
    console.log('⏰ AGENDAMENTO 5/8: 17:00 (Final da tarde)');
    executeObserver();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

// 6️⃣ Execução: 19:00
cron.schedule('0 0 19 * * *', () => {
    console.log('⏰ AGENDAMENTO 6/8: 19:00 (Início da noite)');
    executeObserver();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

// 7️⃣ Execução: 21:00
cron.schedule('0 0 21 * * *', () => {
    console.log('⏰ AGENDAMENTO 7/8: 21:00 (Meio da noite)');
    executeObserver();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

// 8️⃣ Execução: 23:00
cron.schedule('0 0 23 * * *', () => {
    console.log('⏰ AGENDAMENTO 8/8: 23:00 (Final da noite)');
    executeObserver();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

console.log('\n' + '='.repeat(70));
console.log('🤖 SCHEDULER INICIADO - MODO COMPETITIVO + ANTI-REPETIÇÃO');
console.log('='.repeat(70));
console.log('📊 Configuração:');
console.log('   • Execuções por dia: 8');
console.log('   • Categorias por execução: 3 (aleatórias)');
console.log('   • Produtos por categoria: 5');
console.log('   • Total de ofertas/execução: ~15');
console.log('   • Total de mensagens/dia: ~120');
console.log('   • 🛡️  Controle anti-repetição: últimos 100 produtos');
console.log('');
console.log('📅 Horários configurados:');
console.log('   1️⃣  09:00 - Manhã cedo');
console.log('   2️⃣  11:00 - Meio da manhã');
console.log('   3️⃣  13:00 - Início da tarde');
console.log('   4️⃣  15:00 - Meio da tarde');
console.log('   5️⃣  17:00 - Final da tarde');
console.log('   6️⃣  19:00 - Início da noite');
console.log('   7️⃣  21:00 - Meio da noite');
console.log('   8️⃣  23:00 - Final da noite');
console.log('');
console.log('🌎 Timezone: America/Sao_Paulo (Horário de Brasília)');
console.log('🎯 Estratégia: Cobrir todo o dia com ofertas diversificadas');
console.log('🛡️  Garantia: Zero repetições nos últimos 100 produtos');
console.log('='.repeat(70));
console.log('⏳ Aguardando próxima execução...\n');

// Opcional: Executar imediatamente ao iniciar (para testes)
if (process.argv.includes('--run-now')) {
    console.log('🧪 Executando imediatamente (modo teste)...\n');
    executeObserver();
}

// 🧹 Limpeza ao encerrar
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Encerrando scheduler...');
    await dedup.close();
    process.exit(0);
});