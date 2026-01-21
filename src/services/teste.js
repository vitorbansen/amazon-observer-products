// ========================================
// 🧪 SCRIPT DE TESTE Z-API - DIAGNÓSTICO COMPLETO
// ========================================
// Use: node scripts/test-zapi.js

require('dotenv').config();
const axios = require('axios');

async function testZApiDirect() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TESTE DIRETO Z-API (SEM CAMADAS)');
    console.log('='.repeat(60) + '\n');

    const instanceId = process.env.ZAPI_INSTANCE_ID;
    const token = process.env.ZAPI_TOKEN;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;
    const groupId = process.env.WHATSAPP_GROUP_ID;

    console.log('📋 Configurações:');
    console.log(`   Instance ID: ${instanceId?.substring(0, 8)}...`);
    console.log(`   Token: ${token?.substring(0, 8)}...`);
    console.log(`   Client Token: ${clientToken ? clientToken.substring(0, 8) + '...' : 'NÃO CONFIGURADO'}`);
    console.log(`   Group ID: ${groupId}`);
    console.log('');

    if (!instanceId || !token || !groupId) {
        console.error('❌ Credenciais incompletas no .env!');
        return;
    }

    const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

    try {
        // TESTE 1: Verificar Status
        console.log('📡 TESTE 1: Verificando status da instância...\n');
        
        const statusResponse = await axios.get(`${baseUrl}/status`, {
            headers: clientToken ? { 'Client-Token': clientToken } : {}
        });

        console.log('Status:', statusResponse.data);
        
        if (!statusResponse.data.connected) {
            console.log('\n❌ WhatsApp não está conectado!');
            console.log('👉 Acesse: https://panel.z-api.io');
            return;
        }

        console.log('✅ WhatsApp conectado!\n');

        // TESTE 2: Listar Chats
        console.log('📱 TESTE 2: Listando chats...\n');
        
        const chatsResponse = await axios.get(`${baseUrl}/chats`, {
            headers: clientToken ? { 'Client-Token': clientToken } : {}
        });

        const groups = chatsResponse.data.filter(chat => 
            chat.id && chat.id.includes('@g.us')
        );

        console.log(`Grupos encontrados: ${groups.length}`);
        groups.forEach((group, i) => {
            const isTarget = group.id === groupId;
            console.log(`${isTarget ? '👉' : '  '} ${i + 1}. ${group.name || 'Sem nome'}`);
            console.log(`   ID: ${group.id}`);
        });
        console.log('');

        // TESTE 3: Enviar Mensagem Simples
        console.log('📤 TESTE 3: Enviando mensagem de teste...\n');
        
        const testMessage = 'TESTE DE CONEXAO\n\nSe voce recebeu esta mensagem, o bot esta funcionando!';
        
        console.log('📝 Payload:');
        const payload = {
            phone: groupId,
            message: testMessage
        };
        console.log(JSON.stringify(payload, null, 2));
        console.log('');

        const sendResponse = await axios.post(
            `${baseUrl}/send-text`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    ...(clientToken ? { 'Client-Token': clientToken } : {})
                }
            }
        );

        console.log('📊 Resposta da API:');
        console.log(JSON.stringify(sendResponse.data, null, 2));

        if (sendResponse.data.error) {
            console.log('\n❌ ERRO retornado pela API!');
        } else {
            console.log('\n✅ MENSAGEM ENVIADA COM SUCESSO!');
            console.log('👉 Verifique o grupo no WhatsApp');
        }

    } catch (error) {
        console.error('\n❌ ERRO NA REQUISIÇÃO:');
        console.error('Mensagem:', error.message);

        if (error.response) {
            console.error('\n📊 Resposta HTTP:');
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));

            // Erros comuns
            if (error.response.status === 401) {
                console.error('\n🔑 ERRO DE AUTENTICAÇÃO!');
                console.error('   - Verifique ZAPI_INSTANCE_ID e ZAPI_TOKEN');
                console.error('   - Verifique se o Client-Token está correto');
            } else if (error.response.status === 404) {
                console.error('\n❌ INSTÂNCIA NÃO ENCONTRADA!');
                console.error('   - Verifique o ZAPI_INSTANCE_ID');
            } else if (error.response.status === 403) {
                console.error('\n🚫 ACESSO NEGADO!');
                console.error('   - Verifique o Client-Token');
                console.error('   - Pode estar expirado ou inválido');
            }
        } else if (error.request) {
            console.error('\n🌐 ERRO DE REDE:');
            console.error('   - Sem resposta do servidor');
            console.error('   - Verifique sua conexão com a internet');
        }

        console.error('\n🔍 Stack completo:');
        console.error(error.stack);
    }
}

// Executar teste
testZApiDirect().then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Teste concluído!');
    console.log('='.repeat(60) + '\n');
});