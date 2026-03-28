// src/services/mercadolivre-link.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs   = require('fs');

const LINK_BUILDER_URL = "https://www.mercadolivre.com.br/afiliados/linkbuilder";
const COOKIES_PATH     = path.resolve(__dirname, '../../data/ml-cookies.json');

// ─────────────────────────────────────────────
// 🍪 CARREGA COOKIES DO ARQUIVO
// ─────────────────────────────────────────────
function loadCookies() {
    if (!fs.existsSync(COOKIES_PATH)) {
        console.log("❌ Arquivo ml-cookies.json não encontrado em:", COOKIES_PATH);
        process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
    console.log(`📂 ${raw.length} cookies carregados de ml-cookies.json`);
    return raw;
}

// ─────────────────────────────────────────────
// 💾 SALVA COOKIES ATUALIZADOS NO ARQUIVO
// ─────────────────────────────────────────────
function saveCookies(cookies) {
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2), 'utf-8');
    console.log(`💾 ${cookies.length} cookies atualizados em ml-cookies.json`);
}

// ─────────────────────────────────────────────
// 🔄 CONVERTE PARA FORMATO DO PUPPETEER
// ─────────────────────────────────────────────
function parseCookies(raw) {
    return raw.map(c => ({
        name:     c.name,
        value:    c.value,
        domain:   c.domain,
        path:     c.path     || "/",
        expires:  c.expirationDate || c.expires || -1,
        httpOnly: c.httpOnly || false,
        secure:   c.secure   || false,
        sameSite: c.sameSite === "no_restriction" ? "None" : (c.sameSite || "None")
    }));
}

// ─────────────────────────────────────────────
// 🌐 INICIA BROWSER (igual ao test-affiliate)
// ─────────────────────────────────────────────
async function startAffiliateBrowser() {
    return await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ["--start-maximized"]
    });
}

// ─────────────────────────────────────────────
// 🧹 LIMPA URL PARA O LINK BUILDER
// ─────────────────────────────────────────────
function cleanUrl(url) {
    try { return url.split("#")[0].split("?matt_")[0]; }
    catch (_) { return url; }
}

// ─────────────────────────────────────────────
// 🔗 GERA LINKS DE AFILIADO
// ─────────────────────────────────────────────
async function generateAffiliateLinks(products) {
    if (!products || products.length === 0) return products;

    const result = products.map(p => ({ ...p }));

    const browser = await startAffiliateBrowser();

    // ── Divide em lotes de 30 ────────────────────────────────────────
    const BATCH_SIZE = 30;
    const batches    = [];
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
        batches.push(products.slice(i, i + BATCH_SIZE));
    }

    let globalIndex = 0;

    try {
        for (let b = 0; b < batches.length; b++) {
            const batch = batches[b];
            const urls  = batch.map(p => cleanUrl(p.originalLink || p.link));

            console.log(`\n📦 Lote ${b + 1}/${batches.length} — ${urls.length} URLs`);

            const page = await browser.newPage();

            try {
                // ── 1. Injeta cookies ────────────────────────────────────
                const rawCookies = loadCookies();
                const cookies    = parseCookies(rawCookies);
                await page.setCookie(...cookies);
                console.log(`✅ ${cookies.length} cookies injetados`);

                // ── 2. Navega pro link builder ───────────────────────────
                await page.goto(LINK_BUILDER_URL, { waitUntil: "networkidle2", timeout: 60000 });
                await new Promise(r => setTimeout(r, 2000));

                // ── 3. Verifica sessão ───────────────────────────────────
                const currentUrl = page.url();
                if (currentUrl.includes("login")) {
                    console.log("❌ Sessão inválida — redirecionou para login. Atualize o ml-cookies.json.");
                    await page.close();
                    return result;
                }
                console.log("✅ Sessão válida");

                // ── 4. Cola as URLs no textarea ──────────────────────────
                await page.waitForSelector("textarea#url-0", { timeout: 10000 });
                await page.click("textarea#url-0");

                await page.evaluate((urlList) => {
                    const textarea = document.querySelector("textarea#url-0");
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLTextAreaElement.prototype, 'value'
                    ).set;
                    nativeInputValueSetter.call(textarea, urlList.join("\n"));
                    textarea.dispatchEvent(new Event('input',  { bubbles: true }));
                    textarea.dispatchEvent(new Event('change', { bubbles: true }));
                }, urls);

                console.log(`📝 ${urls.length} URLs coladas no textarea`);
                await new Promise(r => setTimeout(r, 2000));

                // ── 5. Clica no botão Gerar ──────────────────────────────
                try {
                    await page.waitForFunction(() => {
                        const btns = [...document.querySelectorAll("button")];
                        const btn  = btns.find(b => b.innerText.trim() === "Gerar");
                        return btn && !btn.disabled;
                    }, { timeout: 8000 });

                    await page.evaluate(() => {
                        const btns = [...document.querySelectorAll("button")];
                        const btn  = btns.find(b => b.innerText.trim() === "Gerar");
                        if (btn) btn.click();
                    });
                    console.log("🖱️  Botão Gerar clicado");
                } catch (err) {
                    console.warn("⚠️  Botão Gerar não habilitou:", err.message);

                    // ── Screenshot de debug ao falhar ────────────────────
                    const failPath = path.resolve(__dirname, `../../debug-linkbuilder-lote${b + 1}-fail.png`);
                    await page.screenshot({ path: failPath, fullPage: true });
                    console.log(`📸 Print de falha salvo: ${failPath}`);

                    await page.close();
                    globalIndex += batch.length;
                    continue;
                }

                await new Promise(r => setTimeout(r, 4000));

                // ── 6. Captura os links gerados ──────────────────────────
                const generatedLinks = await page.evaluate(() => {
                    const resultTextareas = [...document.querySelectorAll("textarea[id^='textfield-copyLink']")];

                    if (resultTextareas.length > 0) {
                        const content = resultTextareas[0].value || resultTextareas[0].innerText || "";
                        return content
                            .split("\n")
                            .map(line => line.trim())
                            .filter(line => line.startsWith("https://meli.la") || line.includes("mercadolivre"));
                    }

                    const fromInputs = [...document.querySelectorAll("input[readonly]")]
                        .map(i => i.value)
                        .filter(v => v && v.includes("mercadolivre"));
                    if (fromInputs.length > 0) return fromInputs;

                    return [...document.querySelectorAll("input, textarea")]
                        .map(i => i.value)
                        .filter(v => v && v.includes("mercadolivre.com") && v.includes("matt"));
                });

                // ── 7. Printa e atualiza os produtos ─────────────────────
                console.log("\n" + "=".repeat(70));
                console.log("🎯 RESULTADO — LINKS DE AFILIADO GERADOS");
                console.log("=".repeat(70));

                if (generatedLinks.length === 0) {
                    console.log("⚠️  Nenhum link encontrado no DOM");
                } else {
                    batch.forEach((_, i) => {
                        const affiliateLink = generatedLinks[i];
                        const produto       = result[globalIndex + i];
                        if (affiliateLink) {
                            produto.link = affiliateLink;
                            console.log(`\n📦 Produto ${globalIndex + i + 1}: ${produto.title}`);
                            console.log(`   🔗 Original : ${produto.originalLink}`);
                            console.log(`   ✅ Afiliado : ${affiliateLink}`);
                        } else {
                            console.warn(`\n⚠️  Sem link para: ${produto.title}`);
                        }
                    });
                }

                console.log("\n" + "=".repeat(70));

                // ── 8. Screenshot do estado final ────────────────────────
                const screenshotPath = path.resolve(__dirname, `../../debug-linkbuilder-lote${b + 1}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`📸 Print salvo: ${screenshotPath}`);

                // ── 9. Salva cookies renovados ───────────────────────────
                const updatedCookies = await page.cookies();
                saveCookies(updatedCookies);

            } catch (err) {
                console.error("❌ Erro ao gerar links de afiliado:", err.message);

                // ── Screenshot de debug em caso de erro ──────────────────
                try {
                    const errPath = path.resolve(__dirname, `../../debug-linkbuilder-lote${b + 1}-erro.png`);
                    await page.screenshot({ path: errPath, fullPage: true });
                    console.log(`📸 Print de erro salvo: ${errPath}`);
                } catch (_) {}

            } finally {
                await page.close();
            }

            globalIndex += batch.length;

            if (b < batches.length - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    } finally {
        await browser.close();
        console.log("🔒 Browser de afiliados encerrado.");
    }

    return result;
}

// ─────────────────────────────────────────────
// 📦 EXPORTAÇÕES
// ─────────────────────────────────────────────
module.exports = { generateAffiliateLinks };