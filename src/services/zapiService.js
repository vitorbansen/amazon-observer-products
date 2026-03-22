// ========================================
// 📱 SERVIÇO Z-API - VERSÃO ANTI-BLOQUEIO
// ========================================

const axios = require('axios');
const sharp = require('sharp');
const AIService = require('../services/AIService');

// Tamanho padrão das imagens enviadas
const IMAGE_SIZE = 500;

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
                    timeout: 30000
                }
            );
            
            this.log('\n✅ Resposta da API:', response.data);

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
                
                if (error.response.status === 401) {
                    console.error('\n🔑 Erro de autenticação!');
                    console.error('   - Verifique ZAPI_INSTANCE_ID e ZAPI_TOKEN no .env');
                } else if (error.response.status === 403) {
                    console.error('\n🚫 Acesso negado!');
                    console.error('   - Client-Token pode estar inválido ou expirado');
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
            // 📥 Baixar imagem
            console.log(`   🔄 Baixando e redimensionando imagem para ${IMAGE_SIZE}x${IMAGE_SIZE}...`);
            const imageResponse = await axios.get(imageUrl, { 
                responseType: 'arraybuffer',
                timeout: 15000
            });

            // 📐 Redimensionar com sharp (mantém proporção, fundo branco se necessário)
            const resizedBuffer = await sharp(Buffer.from(imageResponse.data))
                .resize(IMAGE_SIZE, IMAGE_SIZE, { 
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .jpeg({ quality: 85 })
                .toBuffer();

            // 🔁 Converter para base64
            const base64Image = `data:image/jpeg;base64,${resizedBuffer.toString('base64')}`;
            console.log(`   ✅ Imagem redimensionada (${Math.round(resizedBuffer.length / 1024)}KB)`);

            const payload = {
                phone: groupId,
                image: base64Image,
                caption: caption
            };

            this.log('\n🌐 Requisição:', { phone: groupId, image: '[base64]', caption });
            
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
// 🛡️ ANTI-BLOQUEIO - COMPORTAMENTO HUMANO
// ========================================

class AntiBanHelper {

    // Gera delay aleatório entre min e max segundos
    static getRandomDelay(minSeconds = 60, maxSeconds = 120) {
        const delayMs = (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000;
        return Math.floor(delayMs);
    }

    // Embaralha array (Fisher-Yates)
    static shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

// ========================================
// 📦 FORMATADOR DE MENSAGENS
// ========================================

class ProductMessageFormatter {

    static formatProduct(product) {
        // 🤖 Dados vindos da IA
        const intro = product.ai_impact || 'OFERTA SELECIONADA';
        const cleanTitle = product.ai_title || this.cleanText(product.title).substring(0, 100);
        const discount = Math.round(product.discount || 0);

        // Formato:
        // *COMENTÁRIO DE IMPACTO* 
        // *Título Lapidado*
        // ~~De: R$X~~ → *R$Y* 🛍️ | *43% OFF*
        // Link: url

        let msg = `*${intro}* \n\n`;
        msg += `${cleanTitle}\n\n`;

        if (product.oldPrice) {
            msg += `R$${product.oldPrice.toFixed(0)} → *R$${product.price.toFixed(0)}* 🛍️ | *${discount}% OFF*\n\n`;
        } else {
            msg += `*R$${product.price.toFixed(0)}* 🛍️ | *${discount}% OFF*\n\n`;
        }

        msg += `Link: ${product.link}`;

        return msg;
    }

    static formatProductList(products, maxProducts = 5) {
        let msg = `🔥 TOP ${maxProducts} OFERTAS\n\n`;
        
        const topProducts = products.slice(0, maxProducts);
        
        topProducts.forEach((product, index) => {
            let title = this.cleanText(product.ai_title || product.title);
            
            if (title.length > 60) {
                title = title.substring(0, 60) + '...';
            }
            
            msg += `${index + 1}. ${title}\n`;
            
            if (product.oldPrice) {
                msg += `   De: R$ ${product.oldPrice.toFixed(2)}\n`;
            }
            
            msg += `   Por: R$ ${product.price.toFixed(2)}`;
            
            if (product.discount) {
                msg += ` (${product.discount}% OFF)`;
            }
            
            msg += `\n   ${product.link}\n\n`;
        });
        
        msg += `🎁 Ofertas por tempo limitado!`;
        
        return msg;
    }

    static formatSummary(products, category = null) {
        const totalProducts = products.length;
        const avgDiscount = products.reduce((sum, p) => sum + (p.discount || 0), 0) / totalProducts;
        const primeCount = products.filter(p => p.prime).length;
        
        let msg = `📊 RESUMO DA BUSCA\n\n`;
        
        if (category) {
            msg += `Categoria: ${category}\n`;
        }
        
        msg += `✓ ${totalProducts} ofertas encontradas\n`;
        msg += `✓ Desconto médio: ${avgDiscount.toFixed(0)}%\n`;
        msg += `✓ Prime: ${primeCount} produtos\n\n`;
        msg += `Enviando melhores ofertas...`;
        
        return msg;
    }

    static cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .trim();
    }
}

// ========================================
// 🤖 BOT PRINCIPAL - VERSÃO ANTI-BAN
// ========================================

class AmazonDealsBot {
    constructor() {
        this.zapi = new ZApiService();
        this.aiService = new AIService();
        this.groupId = process.env.WHATSAPP_GROUP_ID;
        
        if (!this.groupId) {
            throw new Error('❌ WHATSAPP_GROUP_ID não configurado no .env!');
        }
        
        console.log(`✅ Bot configurado para o grupo: ${this.groupId}`);
        this.debugMode = process.env.DEBUG === 'true';
        
        this.sentLinks = new Set();
        this.lastSentTime = null;
    }

    log(message) {
        if (this.debugMode) {
            console.log(message);
        }
    }

    async sendDealsToGroup(products) {
        console.log('\n' + '='.repeat(60));
        console.log('🎯 ENVIANDO OFERTAS COM PROTEÇÃO ANTI-BAN');
        console.log('='.repeat(60));

        try {
            // 1. Verificar conexão
            console.log('\n1️⃣ Verificando conexão...');
            const status = await this.zapi.checkConnection();
            
            if (!status.connected) {
                throw new Error('❌ WhatsApp não está conectado! Acesse: https://panel.z-api.io');
            }
            console.log('✅ WhatsApp conectado!');

            // 2. Filtrar produtos já enviados
            const newProducts = products.filter(p => !this.sentLinks.has(p.link));
            
            if (newProducts.length === 0) {
                console.log('⚠️ Todos os produtos já foram enviados anteriormente');
                return;
            }

            // 3. Embaralhar e limitar
            const shuffledProducts = AntiBanHelper.shuffleArray(newProducts);
            const topProducts = shuffledProducts.slice(0, 15);
            
            console.log(`\n2️⃣ Enviando ${topProducts.length} produtos (ordem aleatória)...`);
            
            for (let i = 0; i < topProducts.length; i++) {
                const product = topProducts[i];
                
                console.log(`\n📤 Produto ${i + 1}/${topProducts.length}:`);
                console.log(`   ${product.title.substring(0, 50)}...`);
                console.log(`   🖼️ Imagem: ${product.imageUrl ? 'Disponível ✓' : 'Não encontrada'}`);

                // 🤖 Avaliar com IA antes de enviar
                console.log(`   🤖 Avaliando com IA...`);
                const evaluation = await this.aiService.evaluateOffer(product);
                console.log(`   📊 Score IA: ${evaluation.score} | ${evaluation.impact_comment}`);

                if (!evaluation.is_worthy || evaluation.score < 70) {
                    console.log(`   ❌ Reprovado pela IA (score ${evaluation.score}) - pulando...`);
                    continue;
                }

                // Enriquecer produto com dados da IA
                product.ai_impact = evaluation.impact_comment;
                product.ai_title = evaluation.polished_title;
                product.ai_score = evaluation.score;
                
                // Enviar com imagem ou texto
                if (product.imageUrl) {
                    const caption = ProductMessageFormatter.formatProduct(product);
                    await this.zapi.sendImage(this.groupId, product.imageUrl, caption);
                    console.log(`✅ Enviado com imagem!`);
                } else {
                    const message = ProductMessageFormatter.formatProduct(product);
                    await this.zapi.sendToGroup(this.groupId, message);
                    console.log(`✅ Enviado sem imagem!`);
                }
                
                // Marcar link como enviado
                this.sentLinks.add(product.link);
                
                // Delay entre produtos
                if (i < topProducts.length - 1) {
                    const delay = AntiBanHelper.getRandomDelay(60, 120);
                    const delaySeconds = Math.floor(delay / 1000);
                    console.log(`⏳ Aguardando ${delaySeconds}s (delay aleatório)...`);
                    await this.sleep(delay);
                }
            }

            console.log('\n' + '='.repeat(60));
            console.log(`✅ Envio concluído com proteção anti-ban!`);
            console.log('🛡️ Recursos ativados:');
            console.log('   ✓ Delays aleatórios (60-120s)');
            console.log('   ✓ Ordem de envio embaralhada');
            console.log('   ✓ Filtro de links duplicados');
            console.log('   ✓ Curadoria por IA (score >= 70)');
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

    clearSentLinks() {
        this.sentLinks.clear();
        console.log('🗑️ Histórico de links enviados limpo');
    }
}

// ========================================
// 📤 EXPORTAÇÕES
// ========================================

module.exports = {
    ZApiService,
    ProductMessageFormatter,
    AmazonDealsBot,
    AntiBanHelper
};