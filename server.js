const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
// تحديد البورت ديناميكياً عشان يشتغل على Render أو محلياً
const port = process.env.PORT || 3000; 

app.use(cors({ origin: '*', methods: ['POST'] }));
app.use(express.json());

// تقديم ملفات الواجهة من مجلد public تلقائياً
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { type: 'error', error: 'تجاوزت الحد المسموح. يرجى المحاولة لاحقاً.' }
});
app.use('/api/extract', limiter);

app.post('/api/extract', async (req, res) => {
    const { url } = req.body;

    try {
        const parsedUrl = new URL(url);
        if (!parsedUrl.hostname.includes('smule.com')) throw new Error();
    } catch (e) {
        return res.status(400).json({ type: 'error', error: 'رابط غير صالح أو غير مدعوم' });
    }

    let browser;
    try {
        // إعدادات التشغيل
        let launchOptions = {
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
        };

        // إذا ما كنا على سيرفرات Render، بنستخدم مسار تيرمكس (عشان يضل شغال عندك محلياً)
        if (!process.env.RENDER) {
            launchOptions.executablePath = '/data/data/com.termux/files/usr/bin/chromium-browser';
        }

        browser = await puppeteer.launch(launchOptions);
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        const mediaData = await page.evaluate(() => {
            let mediaUrl = null;
            let meta = document.querySelector('meta[name="twitter:player:stream"]');
            if (meta && meta.content) mediaUrl = meta.content;
            
            if (!mediaUrl) {
                let media = document.querySelector('video source, video, audio source, audio');
                if (media && media.src) mediaUrl = media.src;
            }

            if (!mediaUrl) {
                let scripts = Array.from(document.querySelectorAll('script'));
                for (let script of scripts) {
                    let text = script.textContent;
                    let match = text.match(/(https:\/\/[^"']+\.(?:mp4|m4a)[^"']*)/i);
                    if (match) mediaUrl = match[1].replace(/\\u002F/g, '/'); 
                }
            }

            let ogTitle = document.querySelector('meta[property="og:title"]');
            let rawTitle = ogTitle ? ogTitle.content : 'Unknown Audio';
            
            let ogImage = document.querySelector('meta[property="og:image"]');
            let cover = ogImage ? ogImage.content : '';

            let parts = rawTitle.split(' - ');
            let title = parts[0] ? parts[0].trim() : 'Unknown';
            let artist = parts[1] ? parts[1].trim() : 'Smule Artist';

            return { 
                url: mediaUrl ? mediaUrl.replace(/&amp;/g, '&') : null, 
                title, 
                artist, 
                cover 
            };
        });

        if (mediaData.url) {
            return res.json({ type: 'success', data: mediaData });
        } else {
            return res.json({ type: 'error', error: 'لم يتم العثور على الميديا، قد يكون الرابط خاص أو الحماية غيرت النمط.' });
        }
    } catch (error) {
        console.error('Server Error Detail:', error);
        return res.status(500).json({ type: 'error', error: error.message || 'حدث خطأ غير متوقع في متصفح السيرفر.' });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(port, () => {
    console.log(`Quantum Server Active on port ${port} 🚀`);
});
