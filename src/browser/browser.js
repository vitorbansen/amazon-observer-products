const puppeteer = require('puppeteer');

async function startBrowser() {
    let browser;
    try {
        console.log("Iniciando o navegador...");
        browser = await puppeteer.launch({
            headless: true,
            args: [
                "--disable-setuid-sandbox",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
                "--window-size=1920,1080",
            ],
            ignoreHTTPSErrors: true,
        });
    } catch (err) {
        console.log("Não foi possível criar uma instância do navegador => : ", err);
    }
    return browser;
}

module.exports = {
    startBrowser
};
