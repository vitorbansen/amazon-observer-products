// ========================================
// 📱 SERVIÇO Z-API - VERSÃO COM DEBUG COMPLETO
// ========================================

const axios = require('axios');

class ZApiService {
    constructor() {
        this.instanceId = process.env.ZAPI_INSTANCE_ID;
        this.token = process.env.ZAPI_TOKEN;
        this.clientToken = process.env.ZAPI_CLIENT_TOKEN;
        
        if (!this.instanceId || !this.token) {
            throw new Error(
                '❌ Credenciais Z-API não configuradas!\n' +
                'Configure no .env:\n' +
                '  ZAPI_INSTANCE_ID=...\n' +
                '  ZAPI_TOKEN=...\n' +
                '  ZAPI_CLIENT_TOKEN=... (opcional)'
            );
        }
        
        this.baseUrl = `https://api.z-api.io/instances/${this.instanceId}/token/${this.token}`;
        
        this.headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.clientToken) {
            this.headers['Client-Token'] = this.clientToken;
            console.log('✅ Client-Token configurado');
        } else {
            console.log('⚠️ Client-Token não configurado');
        }
        
        this.debugMode = process.env.DEBUG === 'true';
        console.log(`✅ ZApiService inicializado (Debug: ${this.debugMode})`);
    }

    log(message, data = null) {
        console.log(message);
        if (data && this.debugMode) {
            console.log(JSON.stringify(data, null, 2));
        }
    }

    async sendToGroup(groupId, message) {
        this.log(`\n📤 Enviando para grupo ${groupId}...`);
        this.log(`📝 Mensagem (${message.length} caracteres):`);
        if (this.debugMode) {
            console.log(message);
        }
        
        try {
            const payload = {
                phone: groupId,
                message: message
            };

            this.log('\n🌐 Requisição:', payload);
            
            const response = await axios.post(
                `${this.baseUrl}/send-text`,
                payload,
                { 
                    headers: this.headers,
                    timeout: 30000 // 30 segundos
                }
            );
            
            this.log('\n✅ Resposta da API:', response.data);

            // Verificar se houve erro na resposta
            if (response.data.error) {
                console.error('❌ API retornou erro:', response.data);
                throw new Error(`Z-API Error: ${JSON.stringify(response.data)}`);
            }

            if (!response.data.messageId && !response.data.zaapId) {
                console.warn('⚠️ Resposta sem messageId:', response.data);
            }
            
            return response.data;
            
        } catch (error) {
            console.error('\n❌ ERRO ao enviar para grupo:');
            console.error('Mensagem:', error.message);
            
            if (error.response) {
                console.error('\n📊 Resposta HTTP:');
                console.error('Status:', error.response.status);
                console.error('Data:', error.response.data);
                
                // Erros específicos
                if (error.response.status === 401) {
                    console.error('\n🔑 Erro de autenticação!');
                    console.error('   - Verifique ZAPI_INSTANCE_ID e ZAPI_TOKEN no .env');
                } else if (error.response.status === 403) {
                    console.error('\n🚫 Acesso negado!');
                    console.error('   - Client-Token pode estar inválido ou expirado');
                    console.error('   - Tente remover ZAPI_CLIENT_TOKEN do .env');
                } else if (error.response.status === 404) {
                    console.error('\n❌ Grupo não encontrado!');
                    console.error(`   - Verifique se o ID ${groupId} está correto`);
                }
            } else if (error.request) {
                console.error('\n🌐 Erro de rede - sem resposta do servidor');
            }
            
            throw error;
        }
    }

    async sendImage(groupId, imageUrl, caption = '') {
        this.log(`\n📤 Enviando imagem para grupo ${groupId}...`);
        this.log(`🖼️ URL da imagem: ${imageUrl}`);
        
        try {
            const payload = {
                phone: groupId,
                image: imageUrl,
                caption: caption
            };

            this.log('\n🌐 Requisição:', payload);
            
            const response = await axios.post(
                `${this.baseUrl}/send-image`,
                payload,
                { 
                    headers: this.headers,
                    timeout: 30000
                }
            );
            
            this.log('\n✅ Resposta da API:', response.data);

            if (response.data.error) {
                console.error('❌ API retornou erro:', response.data);
                throw new Error(`Z-API Error: ${JSON.stringify(response.data)}`);
            }
            
            return response.data;
            
        } catch (error) {
            console.error('\n❌ ERRO ao enviar imagem:');
            console.error('Mensagem:', error.message);
            
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Data:', error.response.data);
            }
            
            throw error;
        }
    }

    async sendText(phone, message) {
        return this.sendToGroup(phone, message);
    }

    async checkConnection() {
        this.log('🔍 Verificando conexão...');
        
        try {
            const response = await axios.get(
                `${this.baseUrl}/status`,
                { headers: this.headers }
            );
            
            this.log(response.data.connected ? '✅ Conectado' : '❌ Desconectado', response.data);
            return response.data;
            
        } catch (error) {
            console.error('❌ Erro ao verificar conexão:', error.message);
            if (error.response) {
                console.error('Resposta:', error.response.data);
            }
            throw error;
        }
    }

    async listGroups() {
        this.log('📋 Listando grupos...');
        
        try {
            const response = await axios.get(
                `${this.baseUrl}/chats`,
                { headers: this.headers }
            );
            
            const groups = response.data.filter(chat => chat.id && chat.id.includes('@g.us'));
            this.log(`✅ ${groups.length} grupos encontrados`);
            
            return groups;
            
        } catch (error) {
            console.error('❌ Erro ao listar grupos:', error.message);
            if (error.response) {
                console.error('Resposta:', error.response.data);
            }
            throw error;
        }
    }

    formatPhone(phone) {
        if (phone.includes('@g.us')) {
            return phone;
        }
        
        let cleaned = phone.replace(/\D/g, '');
        
        if (!cleaned.startsWith('55')) {
            cleaned = '55' + cleaned;
        }
        
        return cleaned;
    }
}

// ========================================
// 📦 FORMATADOR DE MENSAGENS
// ========================================

class ProductMessageFormatter {
    
    static formatProduct(product) {
        // Resumir título de forma inteligente
        let cleanTitle = this.cleanText(product.title);
        
        // Remover tudo após espaços duplos ou quebras
        const doubleSpaceIndex = cleanTitle.indexOf('  ');
        if (doubleSpaceIndex > 0) {
            cleanTitle = cleanTitle.substring(0, doubleSpaceIndex);
        }
        
        // Resumir título mantendo as informações essenciais
        cleanTitle = this.summarizeTitle(cleanTitle);
        
        let msg = `*${cleanTitle}*\n\n`;
        
        if (product.oldPrice) {
            msg += `💸 ~De: R$ ${product.oldPrice.toFixed(2)}~\n`;
        }
        
        msg += `💰 *Por: R$ ${product.price.toFixed(2)}*\n`;
        
        if (product.discount) {
            msg += `🎁 Desconto: *${product.discount}% OFF*\n`;
        }
        
        if (product.prime) {
            msg += `⚡ Prime disponível\n`;
        }
        
        msg += `\n🛍️ *COMPRE AQUI:*\n${product.link}`;
        
        return msg;
    }
    
    // Nova função para resumir títulos de forma inteligente
    static summarizeTitle(title) {
        // Remove palavras repetidas consecutivas
        const words = title.split(' ');
        const uniqueWords = [];
        let lastWord = '';
        
        for (const word of words) {
            if (word.toLowerCase() !== lastWord.toLowerCase()) {
                uniqueWords.push(word);
                lastWord = word;
            }
        }
        
        let result = uniqueWords.join(' ');
        
        // Remove informações redundantes comuns
        const redundantPatterns = [
            /\s*-\s*Edicao.*/i,
            /\s*\(Embalagem pode variar\)/i,
            /\s*Tamanho\s*:\s*\d+.*/i,
            /\s*Cor\s*:\s*\w+$/i,
            /\s*,\s*Cor\s*:\s*.*/i,
            /\s*,\s*Tamanho\s*:\s*.*/i,
            /\s*\|\s*Estilo\s*:\s*.*/i
        ];
        
        for (const pattern of redundantPatterns) {
            result = result.replace(pattern, '');
        }
        
        // Limitar a 70 caracteres em uma quebra natural (palavra completa)
        if (result.length > 70) {
            result = result.substring(0, 70);
            const lastSpace = result.lastIndexOf(' ');
            if (lastSpace > 40) {
                result = result.substring(0, lastSpace);
            }
        }
        
        return result.trim();
    }

    static formatProductList(products, maxProducts = 5) {
        let msg = `TOP ${maxProducts} OFERTAS DO DIA\n\n`;
        
        const topProducts = products.slice(0, maxProducts);
        
        topProducts.forEach((product, index) => {
            msg += `${index + 1}. ${this.cleanText(product.title)}\n`;
            
            if (product.oldPrice) {
                msg += `   De: R$ ${product.oldPrice.toFixed(2)}\n`;
            }
            
            msg += `   Por: R$ ${product.price.toFixed(2)}`;
            
            if (product.discount) {
                msg += ` (${product.discount}% OFF)`;
            }
            
            msg += `\n   ${product.link}\n\n`;
        });
        
        msg += `Ofertas por tempo limitado!`;
        
        return msg;
    }

    static formatSummary(products, category = null) {
        const totalProducts = products.length;
        const avgDiscount = products.reduce((sum, p) => sum + (p.discount || 0), 0) / totalProducts;
        const primeCount = products.filter(p => p.prime).length;
        
        let msg = `RESUMO DA BUSCA\n\n`;
        
        if (category) {
            msg += `Categoria: ${category}\n`;
        }
        
        msg += `${totalProducts} ofertas encontradas\n`;
        msg += `Desconto medio: ${avgDiscount.toFixed(0)}%\n`;
        msg += `Prime: ${primeCount} produtos\n\n`;
        msg += `Enviando melhores ofertas...`;
        
        return msg;
    }

    // Limpar texto de caracteres problemáticos
    static cleanText(text) {
        return text
            .replace(/[^\x00-\x7F]/g, '') // Remove caracteres não-ASCII
            .replace(/\s+/g, ' ')          // Normaliza espaços
            .trim();
    }
}

// ========================================
// 🤖 BOT PRINCIPAL
// ========================================

class AmazonDealsBot {
    constructor() {
        this.zapi = new ZApiService();
        this.groupId = process.env.WHATSAPP_GROUP_ID;
        
        if (!this.groupId) {
            throw new Error('❌ WHATSAPP_GROUP_ID não configurado no .env!');
        }
        
        console.log(`✅ Bot configurado para o grupo: ${this.groupId}`);
        this.debugMode = process.env.DEBUG === 'true';
    }

    log(message) {
        if (this.debugMode) {
            console.log(message);
        }
    }

    async sendDealsToGroup(products) {
        console.log('\n' + '='.repeat(60));
        console.log('🎯 ENVIANDO OFERTAS PARA O WHATSAPP');
        console.log('='.repeat(60));

        try {
            // 1. Verificar conexão
            console.log('\n1️⃣ Verificando conexão...');
            const status = await this.zapi.checkConnection();
            
            if (!status.connected) {
                throw new Error('❌ WhatsApp não está conectado! Acesse: https://panel.z-api.io');
            }
            console.log('✅ WhatsApp conectado!');

            // 2. Enviar produtos (top 5) com imagem
            const topProducts = products.slice(0, 5);
            console.log(`\n2️⃣ Enviando ${topProducts.length} produtos...`);
            
            for (let i = 0; i < topProducts.length; i++) {
                const product = topProducts[i];
                
                console.log(`\n📤 Produto ${i + 1}/${topProducts.length}:`);
                console.log(`   ${product.title.substring(0, 50)}...`);
                console.log(`   🖼️ Imagem: ${product.imageUrl ? 'Disponível ✓' : 'Não encontrada'}`);
                
                // ✅ ENVIAR IMAGEM SE DISPONÍVEL (usando imageUrl do goldbox.js)
                if (product.imageUrl) {
                    const caption = ProductMessageFormatter.formatProduct(product);
                    await this.zapi.sendImage(this.groupId, product.imageUrl, caption);
                    console.log(`✅ Enviado com imagem!`);
                } else {
                    // Enviar apenas texto se não houver imagem
                    const message = ProductMessageFormatter.formatProduct(product);
                    await this.zapi.sendToGroup(this.groupId, message);
                    console.log(`✅ Enviado sem imagem!`);
                }
                
                if (i < topProducts.length - 1) {
                    // Delay de 1 minuto entre cada produto
                    console.log('⏳ Aguardando 1 minuto para evitar bloqueios...');
                    await this.sleep(60000); // 60 segundos
                }
            }

            console.log('\n' + '='.repeat(60));
            console.log(`✅ ${topProducts.length} ofertas enviadas com sucesso!`);
            console.log('='.repeat(60) + '\n');
            
        } catch (error) {
            console.error('\n' + '='.repeat(60));
            console.error('❌ ERRO AO ENVIAR OFERTAS');
            console.error('='.repeat(60));
            console.error('Mensagem:', error.message);
            console.error('');
            throw error;
        }
    }

    async testConnection() {
        console.log('\n🧪 Testando conexão com Z-API...\n');
        
        const status = await this.zapi.checkConnection();
        
        console.log('📊 Status da instância:');
        console.log(`   Connected: ${status.connected}`);
        console.log(`   Phone: ${status.phone || 'N/A'}`);
        console.log(`   State: ${status.state || 'N/A'}`);
        
        if (status.connected) {
            console.log('\n✅ Tudo pronto para enviar mensagens!');
            console.log(`📱 Grupo configurado: ${this.groupId}`);
        } else {
            console.log('\n❌ Conecte o WhatsApp no painel Z-API');
            console.log('   Acesse: https://panel.z-api.io');
        }
        
        return status;
    }

    async listAvailableGroups() {
        const groups = await this.zapi.listGroups();
        
        console.log('\n📱 Grupos disponíveis:\n');
        groups.forEach((group, index) => {
            const isTarget = group.id === this.groupId;
            const marker = isTarget ? '👉 ' : '   ';
            
            console.log(`${marker}${index + 1}. ${group.name || 'Sem nome'}`);
            console.log(`${marker}ID: ${group.id}`);
            console.log(`${marker}Participantes: ${group.participants?.length || 'N/A'}`);
            
            if (isTarget) {
                console.log(`${marker}⭐ GRUPO CONFIGURADO PARA ENVIO`);
            }
            console.log('');
        });
        
        return groups;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ========================================
// 📤 EXPORTAÇÕES
// ========================================

module.exports = {
    ZApiService,
    ProductMessageFormatter,
    AmazonDealsBot
};