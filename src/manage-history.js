require('dotenv').config();
const { DeduplicationService } = require('./services/deduplication');

/**
 * 🛠️ SCRIPT DE GERENCIAMENTO DO HISTÓRICO
 * 
 * Uso:
 *   node manage-history.js stats        - Ver estatísticas
 *   node manage-history.js list         - Listar últimos 20 produtos
 *   node manage-history.js clear        - Limpar todo histórico
 */

const dedup = new DeduplicationService();

async function main() {
    const command = process.argv[2] || 'stats';

    try {
        await dedup.initialize();

        switch (command) {
            case 'stats':
                await showStats();
                break;

            case 'list':
                await listRecent();
                break;

            case 'clear':
                await clearHistory();
                break;

            default:
                console.log('❌ Comando inválido!');
                console.log('\nComandos disponíveis:');
                console.log('  stats  - Ver estatísticas');
                console.log('  list   - Listar últimos produtos');
                console.log('  clear  - Limpar histórico');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await dedup.close();
    }
}

async function showStats() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ESTATÍSTICAS DO HISTÓRICO');
    console.log('='.repeat(60));

    const stats = await dedup.getStats();

    console.log(`\n📦 Total de produtos enviados: ${stats.total}/100`);
    console.log(`📂 Categorias diferentes: ${stats.categories}`);
    console.log(`💰 Desconto médio: ${stats.avg_discount?.toFixed(1)}%`);

    if (stats.oldest) {
        const oldest = new Date(stats.oldest);
        const newest = new Date(stats.newest);
        console.log(`\n📅 Período:`);
        console.log(`   Mais antigo: ${oldest.toLocaleString('pt-BR')}`);
        console.log(`   Mais recente: ${newest.toLocaleString('pt-BR')}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

async function listRecent() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 ÚLTIMOS 20 PRODUTOS ENVIADOS');
    console.log('='.repeat(60) + '\n');

    const products = await dedup.getRecentProducts(20);

    if (products.length === 0) {
        console.log('   Nenhum produto no histórico.\n');
        return;
    }

    products.forEach((product, index) => {
        const sentDate = new Date(product.sent_at);
        console.log(`${index + 1}. ${product.title.substring(0, 60)}...`);
        console.log(`   ASIN: ${product.asin}`);
        console.log(`   Categoria: ${product.category} | Desconto: ${product.discount}%`);
        console.log(`   Enviado em: ${sentDate.toLocaleString('pt-BR')}`);
        console.log('');
    });

    console.log('='.repeat(60) + '\n');
}

async function clearHistory() {
    console.log('\n⚠️  ATENÇÃO: Isso irá limpar TODO o histórico!');
    console.log('Produtos poderão ser enviados novamente.\n');

    // Simples confirmação
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('Deseja continuar? (s/N): ', async (answer) => {
        if (answer.toLowerCase() === 's') {
            await dedup.clearHistory();
            console.log('✅ Histórico limpo com sucesso!\n');
        } else {
            console.log('❌ Operação cancelada.\n');
        }

        readline.close();
        await dedup.close();
        process.exit(0);
    });
}

main();