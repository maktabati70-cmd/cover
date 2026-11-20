import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'https://esm.sh/react@18.3.1';
import Konva from 'https://esm.sh/konva@9.3.14';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1';
import { Stage, Layer, Rect, Text, Transformer, Group, Shape, Ellipse, Circle, Line, Image as KonvaImage } from 'https://esm.sh/react-konva@18.2.10?deps=react@18.3.1,react-dom@18.3.1,konva@9.3.14';
const IMGLY_URL = 'https://esm.sh/@imgly/background-removal@1.5.5';
const IMGLY_FALLBACK = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm';
// ===== lib/constants.js =====
// الأبعاد المنطقية للغلاف (نسبة 2:3 القياسية لأغلفة الكتب)
const COVER_W = 1000;
const COVER_H = 1500;
// مضاعف دقة التصدير: 1000×1500 × 2 = 2000×3000 بكسل
const EXPORT_PIXEL_RATIO = 2;
// دقة توليد طبقات المؤثرات (أعلى من 1 لتبقى حادة عند التصدير)
const OVERLAY_SCALE = 1.5;
// ===== lib/palettes.js =====
// أنماط لونية داكنة وترابية وفاتحة.
// colors: [اللون الأساسي, لون الإضاءة, لون الأطراف]
// type: linear تدرّج قُطري | radial تدرّج دائري من المنتصف
const PALETTES = [
    { id: 'ink-night', name: 'ليل الحبر', type: 'radial', colors: ['#0b0d12', '#1c2230', '#030407'] },
    { id: 'volcanic-ash', name: 'رماد بركاني', type: 'linear', colors: ['#1a1716', '#332c28', '#0a0908'] },
    { id: 'desert-dusk', name: 'غروب الصحراء', type: 'linear', colors: ['#2a1a10', '#7a4220', '#0f0805'] },
    { id: 'burnt-clay', name: 'طين محروق', type: 'radial', colors: ['#3a1d14', '#6a3220', '#120604'] },
    { id: 'coffee', name: 'بُنّ القهوة', type: 'linear', colors: ['#24170f', '#45301f', '#0c0704'] },
    { id: 'military-olive', name: 'زيتوني عسكري', type: 'linear', colors: ['#1b1f14', '#363d27', '#090b06'] },
    { id: 'moss', name: 'أخضر الطحلب', type: 'radial', colors: ['#10201a', '#244536', '#040a07'] },
    { id: 'old-copper', name: 'نحاس قديم', type: 'linear', colors: ['#2b1c12', '#86522a', '#100a05'] },
    { id: 'amber', name: 'كهرماني', type: 'radial', colors: ['#2d1b05', '#956214', '#0f0802'] },
    { id: 'burgundy', name: 'عنّابي داكن', type: 'linear', colors: ['#2a0c10', '#651a24', '#0e0305'] },
    { id: 'night-violet', name: 'بنفسجي الليل', type: 'radial', colors: ['#17111f', '#33244a', '#07050b'] },
    { id: 'steel-blue', name: 'أزرق فولاذي', type: 'linear', colors: ['#0e1620', '#263c52', '#04070b'] },
    { id: 'charcoal-gold', name: 'فحم وذهب', type: 'radial', colors: ['#0d0c0a', '#3a3120', '#000000'] },
    { id: 'sand-fog', name: 'ضباب رملي', type: 'linear', colors: ['#3b342a', '#74695a', '#17140f'] },
    { id: 'rust', name: 'صدأ', type: 'radial', colors: ['#2e140a', '#843a16', '#0f0603'] },
    { id: 'slate', name: 'حجر الإردواز', type: 'linear', colors: ['#1c1f22', '#40464c', '#0a0b0c'] },
    { id: 'night-dunes', name: 'كثبان الليل', type: 'radial', colors: ['#1e1812', '#4f3e2b', '#080604'] },
    // ── أنماط إضافية: spot = بقعة ضوء من الأعلى، horizon = أفق، corner = ضوء من الزاوية ──
    { id: 'royal-navy', name: 'كحلي ملكي', type: 'spot', colors: ['#0a1a33', '#2c5a9e', '#030812'] },
    { id: 'emerald-night', name: 'زمرّد الليل', type: 'spot', colors: ['#06261c', '#1f7a5a', '#020d09'] },
    { id: 'ruby', name: 'ياقوتي', type: 'spot', colors: ['#3a0612', '#a3182f', '#12020a'] },
    { id: 'sapphire', name: 'ياقوت أزرق', type: 'radial', colors: ['#0b1c4a', '#2e5bd6', '#040a1c'] },
    { id: 'teal-depth', name: 'فيروزي عميق', type: 'radial', colors: ['#06303a', '#1b8a9c', '#021216'] },
    { id: 'plum', name: 'برقوقي', type: 'linear', colors: ['#2a0f2e', '#6b2a6e', '#0f0412'] },
    { id: 'mocha', name: 'موكا', type: 'spot', colors: ['#2b1b14', '#7a5440', '#0f0905'] },
    { id: 'gunmetal', name: 'رصاصي معدني', type: 'corner', colors: ['#1a1d21', '#5b636c', '#08090a'] },
    { id: 'bronze-light', name: 'ضوء برونزي', type: 'corner', colors: ['#2a1a0e', '#b07a3a', '#0c0703'] },
    { id: 'crimson-dusk', name: 'غسق قرمزي', type: 'horizon', colors: ['#1a0612', '#c0392b', '#3a0d10'] },
    { id: 'desert-gold', name: 'ذهب الصحراء', type: 'horizon', colors: ['#2a1608', '#e0a040', '#5a3412'] },
    { id: 'arctic', name: 'قطبي', type: 'horizon', colors: ['#0c1a2a', '#8fb8d8', '#1d3348'] },
    { id: 'forest-dawn', name: 'فجر الغابة', type: 'horizon', colors: ['#0d1f14', '#7aa35a', '#16301e'] },
    { id: 'ink-blue', name: 'حبر أزرق', type: 'linear', colors: ['#0a1530', '#203f7a', '#040915'] },
    { id: 'olive-gold', name: 'زيتون وذهب', type: 'corner', colors: ['#1f2210', '#9a8a3a', '#0a0b05'] },
    { id: 'smoke-gray', name: 'رمادي دخاني', type: 'spot', colors: ['#1e1e20', '#6a6a70', '#0a0a0b'] },
    { id: 'sunset-pink', name: 'غروب وردي', type: 'horizon', colors: ['#24102e', '#e46a8a', '#3a1630'] },
    { id: 'midnight-teal', name: 'منتصف الليل', type: 'corner', colors: ['#071a1f', '#2a7c86', '#020a0c'] },
    { id: 'ivory', name: 'عاجي فاتح', type: 'radial', colors: ['#e9e2d4', '#fbf8f1', '#cfc4b0'] },
    { id: 'sand-light', name: 'رملي فاتح', type: 'linear', colors: ['#d9c7a5', '#efe3c8', '#b8a07a'] },
    { id: 'sky-light', name: 'سماء صافية', type: 'horizon', colors: ['#2f6fb5', '#cfe6f7', '#7fb2dc'] },
    { id: 'mint-light', name: 'نعناعي', type: 'radial', colors: ['#bfe3d0', '#eefaf3', '#8cc7aa'] },
    { id: 'peach', name: 'خوخي', type: 'linear', colors: ['#f2b08c', '#ffe0cc', '#e08060'] },
];
const getPalette = (id, custom) => id === 'custom' && custom ? { id: 'custom', ...custom } : PALETTES.find((p) => p.id === id) || PALETTES[0];
// CSS مطابق لتدرّج الكانفاس — لعرض المعاينات الصغيرة في لوحة التحكم
function paletteToCss(p) {
    const [a, b, c] = p.colors;
    switch (p.type) {
        case 'radial':
            return `radial-gradient(circle at 50% 40%, ${b} 0%, ${a} 55%, ${c} 100%)`;
        case 'spot':
            return `radial-gradient(ellipse at 50% 8%, ${b} 0%, ${a} 45%, ${c} 100%)`;
        case 'corner':
            return `radial-gradient(circle at 95% 5%, ${b} 0%, ${a} 50%, ${c} 100%)`;
        case 'horizon':
            return `linear-gradient(180deg, ${a} 0%, ${b} 62%, ${c} 100%)`;
        default:
            return `linear-gradient(165deg, ${b} 0%, ${a} 50%, ${c} 100%)`;
    }
}
// ===== lib/fonts.js =====
// ─────────────────────────────────────────────────────────────
// الخطوة 4: تحميل الخطوط العربية من Google Fonts ديناميكياً
// ─────────────────────────────────────────────────────────────
// الكانفاس (Konva) لا يعيد الرسم تلقائياً عند وصول الخط، لذلك:
// 1) نحقن <link> لملف CSS الخاص بالخط عند الحاجة فقط.
// 2) ننتظر document.fonts.load حتى يصبح الخط جاهزاً فعلياً للرسم.
// 3) نُعلم الواجهة (عبر useArabicFonts) لتعيد رسم النصوص بالقياسات الصحيحة.
const FONT_CATEGORIES = [
    { id: 'calligraphy', label: 'خطوط تراثية وزخرفية' },
    { id: 'naskh', label: 'نسخ وكلاسيكي' },
    { id: 'kufi', label: 'كوفي' },
    { id: 'display', label: 'عناوين عريضة' },
    { id: 'modern', label: 'حديث' },
    { id: 'hand', label: 'يدوي ومرح' },
];
// pkg: اسم الحزمة في fontsource (لدمج الخط داخل تطبيق أندرويد)
// core: يُحمَّل عند بدء التشغيل — البقية تُحمَّل عند اختيارها فقط
const ARABIC_FONTS = [
    // ── تراثية وزخرفية ──
    { family: 'Aref Ruqaa', label: 'عارف رقعة', weights: [400, 700], category: 'calligraphy', pkg: 'aref-ruqaa', core: true },
    { family: 'Aref Ruqaa Ink', label: 'عارف رقعة — حبر', weights: [400, 700], category: 'calligraphy', pkg: 'aref-ruqaa-ink' },
    { family: 'Noto Nastaliq Urdu', label: 'نستعليق', weights: [400, 700], category: 'calligraphy', pkg: 'noto-nastaliq-urdu' },
    { family: 'Gulzar', label: 'گلزار — نستعليق', weights: [400], category: 'calligraphy', pkg: 'gulzar' },
    { family: 'Qahiri', label: 'القاهري — كوفي مزخرف', weights: [400], category: 'calligraphy', pkg: 'qahiri' },
    { family: 'Alkalami', label: 'الكلامي — مغربي', weights: [400], category: 'calligraphy', pkg: 'alkalami' },
    { family: 'Reem Kufi Ink', label: 'ريم كوفي — حبر', weights: [400], category: 'calligraphy', pkg: 'reem-kufi-ink' },
    // ── نسخ وكلاسيكي ──
    { family: 'Amiri', label: 'أميري', weights: [400, 700], category: 'naskh', pkg: 'amiri', core: true },
    { family: 'Amiri Quran', label: 'أميري قرآن', weights: [400], category: 'naskh', pkg: 'amiri-quran' },
    { family: 'Scheherazade New', label: 'شهرزاد', weights: [400, 700], category: 'naskh', pkg: 'scheherazade-new' },
    { family: 'Noto Naskh Arabic', label: 'نوتو نسخ', weights: [400, 700], category: 'naskh', pkg: 'noto-naskh-arabic' },
    { family: 'Lateef', label: 'لطيف', weights: [400, 700], category: 'naskh', pkg: 'lateef' },
    { family: 'Markazi Text', label: 'مركزي', weights: [400, 700], category: 'naskh', pkg: 'markazi-text' },
    { family: 'Mirza', label: 'ميرزا', weights: [400, 700], category: 'naskh', pkg: 'mirza' },
    { family: 'Harmattan', label: 'هرمتان', weights: [400, 700], category: 'naskh', pkg: 'harmattan' },
    { family: 'El Messiri', label: 'المسيري', weights: [400, 700], category: 'naskh', pkg: 'el-messiri' },
    // ── كوفي ──
    { family: 'Reem Kufi', label: 'ريم كوفي', weights: [400, 500, 700], category: 'kufi', pkg: 'reem-kufi', core: true },
    { family: 'Reem Kufi Fun', label: 'ريم كوفي — مرح', weights: [400, 700], category: 'kufi', pkg: 'reem-kufi-fun' },
    { family: 'Noto Kufi Arabic', label: 'نوتو كوفي', weights: [400, 700, 900], category: 'kufi', pkg: 'noto-kufi-arabic' },
    { family: 'Kufam', label: 'كوفام', weights: [400, 700, 900], category: 'kufi', pkg: 'kufam' },
    // ── عناوين عريضة ──
    { family: 'Lalezar', label: 'لاله‌زار', weights: [400], category: 'display', pkg: 'lalezar', core: true },
    { family: 'Rakkas', label: 'رقّاص', weights: [400], category: 'display', pkg: 'rakkas' },
    { family: 'Jomhuria', label: 'جمهورية', weights: [400], category: 'display', pkg: 'jomhuria' },
    { family: 'Katibeh', label: 'كاتبة', weights: [400], category: 'display', pkg: 'katibeh' },
    { family: 'Blaka', label: 'بلاكا — قوطي', weights: [400], category: 'display', pkg: 'blaka' },
    { family: 'Badeen Display', label: 'بديع', weights: [400], category: 'display', pkg: 'badeen-display' },
    { family: 'Changa', label: 'شانغا', weights: [400, 700, 800], category: 'display', pkg: 'changa' },
    // ── حديث ──
    { family: 'Cairo', label: 'القاهرة', weights: [400, 700, 900], category: 'modern', pkg: 'cairo', core: true },
    { family: 'Tajawal', label: 'تجوال', weights: [400, 500, 700, 900], category: 'modern', pkg: 'tajawal', core: true },
    { family: 'Almarai', label: 'المراعي', weights: [400, 700, 800], category: 'modern', pkg: 'almarai', core: true },
    { family: 'Mada', label: 'مدى', weights: [400, 700, 900], category: 'modern', pkg: 'mada' },
    { family: 'Readex Pro', label: 'ريدكس', weights: [400, 700], category: 'modern', pkg: 'readex-pro' },
    { family: 'IBM Plex Sans Arabic', label: 'بلكس عربي', weights: [400, 700], category: 'modern', pkg: 'ibm-plex-sans-arabic' },
    { family: 'Baloo Bhaijaan 2', label: 'بالو', weights: [400, 700, 800], category: 'modern', pkg: 'baloo-bhaijaan-2' },
    // ── يدوي ومرح ──
    { family: 'Marhey', label: 'مرحي', weights: [400, 700], category: 'hand', pkg: 'marhey' },
    { family: 'Lemonada', label: 'ليمونادة', weights: [400, 700], category: 'hand', pkg: 'lemonada' },
    { family: 'Vibes', label: 'فايبز', weights: [400], category: 'hand', pkg: 'vibes' },
];
const WEIGHT_LABELS = {
    200: 'رفيع جداً',
    300: 'رفيع',
    600: 'نصف عريض',
    400: 'عادي',
    500: 'متوسط',
    700: 'عريض',
    800: 'عريض جداً',
    900: 'أسود',
};
const SAMPLE_TEXT = 'أبجد هوز حطي كلمن';
const cache = new Map(); // family -> Promise
function getFontMeta(family) {
    return ARABIC_FONTS.find((f) => f.family === family);
}
function buildGoogleFontsUrl(font) {
    const family = font.family.replace(/ /g, '+');
    return `https://fonts.googleapis.com/css2?family=${family}:wght@${font.weights.join(';')}&display=swap`;
}
function injectStylesheet(href, family) {
    return new Promise((resolve) => {
        const existing = document.querySelector(`link[data-cover-font="${family}"]`);
        if (existing)
            return resolve();
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.coverFont = family;
        link.onload = () => resolve();
        link.onerror = () => resolve(); // لا نوقف التطبيق إذا فشل خط واحد
        document.head.appendChild(link);
    });
}
/** يحمّل خطاً واحداً بكل أوزانه ويعيد Promise تُحل عند جاهزيته للرسم */
function loadGoogleFont(family) {
    if (cache.has(family))
        return cache.get(family);
    const font = getFontMeta(family);
    if (!font)
        return Promise.resolve(false);
    // في تطبيق أندرويد الخطوط مدمجة محلياً (window.__LOCAL_FONTS__) فلا حاجة لـ Google Fonts
    const local = typeof window !== 'undefined' && window.__LOCAL_FONTS__;
    const promise = (local ? Promise.resolve() : injectStylesheet(buildGoogleFontsUrl(font), family))
        .then(() => Promise.all(font.weights.map((w) => document.fonts.load(`${w} 64px "${family}"`, SAMPLE_TEXT))))
        .then(() => true)
        .catch((err) => {
        console.warn(`تعذّر تحميل الخط ${family}`, err);
        return false;
    });
    cache.set(family, promise);
    return promise;
}
function loadAllArabicFonts() {
    return Promise.all(ARABIC_FONTS.map((f) => loadGoogleFont(f.family)));
}
const CORE_FONTS = ARABIC_FONTS.filter((f) => f.core);
function isFontLoaded(family) {
    return cache.has(family);
}
/** أقرب وزن متاح للخط (مثلاً Lalezar لا يملك إلا 400) */
function closestWeight(family, weight) {
    const font = getFontMeta(family);
    if (!font)
        return weight;
    return font.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best));
}
// ===== lib/image.js =====
// أدوات مساعدة للصور
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}
function canvasToBlob(canvas, type = 'image/png', quality = 1) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
/** تصغير الصور الضخمة قبل التفريغ — يسرّع النموذج كثيراً دون خسارة ملحوظة */
async function downscaleImage(blob, maxSide = 2048) {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    const ratio = Math.min(1, maxSide / Math.max(width, height));
    if (ratio === 1) {
        bitmap.close?.();
        return blob;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvasToBlob(canvas, 'image/png');
}
/** قصّ الحواف الشفافة حول العنصر المفرَّغ ليُحيط به إطار التحويل بدقة */
async function trimTransparent(blob, alphaThreshold = 8, padding = 4) {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const { data } = ctx.getImageData(0, 0, width, height);
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
        const row = y * width * 4;
        for (let x = 0; x < width; x++) {
            if (data[row + x * 4 + 3] > alphaThreshold) {
                if (x < minX)
                    minX = x;
                if (x > maxX)
                    maxX = x;
                if (y < minY)
                    minY = y;
                if (y > maxY)
                    maxY = y;
            }
        }
    }
    if (maxX < 0)
        return blob; // الصورة شفافة بالكامل
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (w === width && h === height)
        return blob;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d').drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
    return canvasToBlob(out, 'image/png');
}
/** حجم مبدئي مناسب لعنصر جديد داخل الغلاف */
function fitSize(naturalW, naturalH, maxW, maxH) {
    const ratio = Math.min(maxW / naturalW, maxH / naturalH, 1e9);
    return { width: naturalW * ratio, height: naturalH * ratio };
}
// ===== lib/color.js =====
// ─────────────────────────────────────────────────────────────
// استخراج ألوان الصورة واقتراح نمط لوني ولون للعنوان تلقائياً
// ─────────────────────────────────────────────────────────────
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }) {
    return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
function rgbToHsl({ r, g, b }) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min)
        return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r)
        h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g)
        h = (b - r) / d + 2;
    else
        h = (r - g) / d + 4;
    return { h: h * 60, s, l };
}
function hslToHex(h, s, l) {
    s = clamp(s, 0, 1);
    l = clamp(l, 0, 1);
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return rgbToHex({ r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 });
}
const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
/** أهم ألوان الصورة مرتبة حسب مساحتها (يتجاهل البكسلات الشفافة) */
async function extractColors(src, max = 8) {
    const img = await loadImage(src);
    const scale = Math.min(1, 96 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200)
            continue;
        const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
        const bk = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
        bk.r += data[i];
        bk.g += data[i + 1];
        bk.b += data[i + 2];
        bk.n++;
        buckets.set(key, bk);
    }
    const list = [...buckets.values()]
        .map((bk) => ({ r: bk.r / bk.n, g: bk.g / bk.n, b: bk.b / bk.n, n: bk.n }))
        .sort((a, b) => b.n - a.n);
    const picked = [];
    for (const c of list) {
        if (picked.every((p) => dist(p, c) > 48))
            picked.push(c);
        if (picked.length >= max)
            break;
    }
    const total = picked.reduce((s, c) => s + c.n, 0) || 1;
    return picked.map((c) => ({ ...c, ...rgbToHsl(c), hex: rgbToHex(c), share: c.n / total }));
}
/** يبني نمطاً لونياً داكناً من ألوان الصورة + ألوان متناسقة للنصوص */
function suggestDesign(colors) {
    if (!colors.length)
        return null;
    const dominant = colors[0];
    const accent = [...colors].sort((a, b) => b.s * (0.35 + b.l) - a.s * (0.35 + a.l))[0];
    const hue = dominant.s < 0.08 ? accent.h : dominant.h;
    const sat = clamp(dominant.s, 0.12, 0.5);
    return {
        palette: {
            name: 'من الصورة',
            type: 'radial',
            colors: [hslToHex(hue, sat, 0.09), hslToHex(hue, Math.min(0.6, sat * 1.2), 0.25), hslToHex(hue, sat * 0.7, 0.03)],
        },
        title: hslToHex(accent.h, clamp(accent.s, 0.3, 0.7), 0.8),
        titleEnd: hslToHex(accent.h, clamp(accent.s, 0.4, 0.8), 0.55),
        subtitle: hslToHex(accent.h, 0.22, 0.7),
        glow: hslToHex(accent.h, 0.75, 0.55),
        swatches: colors.map((c) => c.hex),
    };
}
// ===== lib/shapes.js =====
// ─────────────────────────────────────────────────────────────
// أشكال زخرفية: خلفيات خلف الصور (محراب، قوس…) ولوحة النص الزخرفية
// تُرسم داخل Konva Shape عبر sceneFunc، ومركزها (0,0)
// ─────────────────────────────────────────────────────────────
const BACKDROP_SHAPES = [
    { id: 'none', label: 'بدون' },
    { id: 'mihrab', label: 'محراب', w: 0.95, h: 1.1, y: -0.06 },
    { id: 'arch', label: 'قوس مدبّب', w: 0.9, h: 1.05, y: -0.04 },
    { id: 'round', label: 'قوس دائري', w: 0.85, h: 1.0, y: -0.04 },
    { id: 'circle', label: 'دائرة', w: 0.9, h: 0.9 * 1, y: -0.12 },
    { id: 'rect', label: 'مستطيل', w: 0.85, h: 0.95, y: -0.04 },
    { id: 'diamond', label: 'معيّن', w: 1.1, h: 1.1, y: -0.05 },
    { id: 'glow', label: 'توهّج', w: 1.4, h: 1.3, y: -0.05 },
];
const DEFAULT_BACKDROP = {
    shape: 'none',
    color: '#b3121f',
    opacity: 0.9,
    width: 1,
    height: 1,
    offsetY: 0,
    fade: 0.25,
    pattern: 0,
    stroke: false,
    strokeColor: '#d4af6a',
};
const K = 0.5522847498;
function ellipsePath(ctx, rx, ry) {
    ctx.moveTo(rx, 0);
    ctx.bezierCurveTo(rx, ry * K, rx * K, ry, 0, ry);
    ctx.bezierCurveTo(-rx * K, ry, -rx, ry * K, -rx, 0);
    ctx.bezierCurveTo(-rx, -ry * K, -rx * K, -ry, 0, -ry);
    ctx.bezierCurveTo(rx * K, -ry, rx, -ry * K, rx, 0);
}
function traceBackdrop(ctx, shape, w, h) {
    const hw = w / 2, hh = h / 2;
    ctx.beginPath();
    switch (shape) {
        case 'mihrab': {
            const iw = hw * 0.82;
            const shoulder = -hh + h * 0.42;
            const step = shoulder - w * 0.06;
            const spring = -hh + h * 0.28;
            const rise = spring + hh;
            ctx.moveTo(-hw, hh);
            ctx.lineTo(-hw, shoulder);
            ctx.lineTo(-iw, step);
            ctx.lineTo(-iw, spring);
            ctx.bezierCurveTo(-iw, spring - rise * 0.55, -iw * 0.15, -hh + rise * 0.15, 0, -hh);
            ctx.bezierCurveTo(iw * 0.15, -hh + rise * 0.15, iw, spring - rise * 0.55, iw, spring);
            ctx.lineTo(iw, step);
            ctx.lineTo(hw, shoulder);
            ctx.lineTo(hw, hh);
            break;
        }
        case 'arch': {
            const spring = -hh + h * 0.3;
            const rise = spring + hh;
            ctx.moveTo(-hw, hh);
            ctx.lineTo(-hw, spring);
            ctx.bezierCurveTo(-hw, spring - rise * 0.6, -hw * 0.12, -hh + rise * 0.12, 0, -hh);
            ctx.bezierCurveTo(hw * 0.12, -hh + rise * 0.12, hw, spring - rise * 0.6, hw, spring);
            ctx.lineTo(hw, hh);
            break;
        }
        case 'round':
            ctx.moveTo(-hw, hh);
            ctx.lineTo(-hw, -hh + hw);
            ctx.arc(0, -hh + hw, hw, Math.PI, 0, false);
            ctx.lineTo(hw, hh);
            break;
        case 'diamond':
            ctx.moveTo(0, -hh);
            ctx.lineTo(hw, 0);
            ctx.lineTo(0, hh);
            ctx.lineTo(-hw, 0);
            break;
        case 'rect':
            ctx.moveTo(-hw, -hh);
            ctx.lineTo(hw, -hh);
            ctx.lineTo(hw, hh);
            ctx.lineTo(-hw, hh);
            break;
        default: // circle, glow
            ellipsePath(ctx, hw, hh);
    }
    ctx.closePath();
}
/** لوحة زخرفية بزوايا مقعّرة وأطراف مدبّبة — توضع خلف العنوان */
function tracePlaque(ctx, w, h) {
    const hw = w / 2, hh = h / 2;
    const r = h * 0.2;
    const p = h * 0.18;
    ctx.beginPath();
    ctx.moveTo(-hw + r, -hh);
    ctx.lineTo(hw - r, -hh);
    ctx.arc(hw, -hh, r, Math.PI, Math.PI / 2, true);
    ctx.lineTo(hw, -hh * 0.35);
    ctx.lineTo(hw + p, 0);
    ctx.lineTo(hw, hh * 0.35);
    ctx.lineTo(hw, hh - r);
    ctx.arc(hw, hh, r, -Math.PI / 2, -Math.PI, true);
    ctx.lineTo(-hw + r, hh);
    ctx.arc(-hw, hh, r, 0, -Math.PI / 2, true);
    ctx.lineTo(-hw, hh * 0.35);
    ctx.lineTo(-hw - p, 0);
    ctx.lineTo(-hw, -hh * 0.35);
    ctx.lineTo(-hw, -hh + r);
    ctx.arc(-hw, -hh, r, Math.PI / 2, 0, true);
    ctx.closePath();
}
function rgba(hex, a) {
    const h = (hex || '#000000').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
/** تلاشي حواف الصورة (أسفل / إطار بيضاوي) حتى تندمج مع الخلفية */
function makeFadedImage(img, bottom = 0, edges = 0) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'destination-in';
    if (bottom > 0) {
        const g = ctx.createLinearGradient(0, 0, 0, c.height);
        g.addColorStop(0, '#000');
        g.addColorStop(Math.max(0, 1 - bottom), '#000');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, c.width, c.height);
    }
    if (edges > 0) {
        const R = c.width / 2;
        ctx.save();
        ctx.translate(c.width / 2, c.height / 2);
        ctx.scale(1, c.height / c.width);
        const g = ctx.createRadialGradient(0, 0, R * (1 - edges) * 0.95, 0, 0, R * 1.02);
        g.addColorStop(0, '#000');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
        ctx.restore();
    }
    return c;
}
// ===== lib/textMeasure.js =====
// قياس أسطر النص بعد الالتفاف (لرسم الأشرطة والصناديق خلف كل سطر بدقة)
let ctx = null;
function getCtx() {
    if (!ctx)
        ctx = document.createElement('canvas').getContext('2d');
    return ctx;
}
function measureLines(t) {
    const c = getCtx();
    c.font = `${t.weight} ${t.size}px "${t.font}"`;
    const ls = t.letterSpacing || 0;
    const measure = (s) => c.measureText(s).width + Math.max(0, s.length - 1) * ls;
    const out = [];
    for (const para of String(t.text || '').split('\n')) {
        const words = para.split(' ');
        let line = '';
        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (line && measure(test) > t.width) {
                out.push(line);
                line = word;
            }
            else {
                line = test;
            }
        }
        out.push(line);
    }
    return out.map((text) => ({ text, width: Math.min(t.width, measure(text)) }));
}
/** التاريخ الهجري الحالي بالأرقام العربية: "جمادى الأولى\n١٤٤٨هـ" */
function hijriNow() {
    try {
        const parts = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', { month: 'long', year: 'numeric' }).formatToParts(new Date());
        const month = parts.find((p) => p.type === 'month')?.value || '';
        const year = parts.find((p) => p.type === 'year')?.value || '';
        return `${month}\n${year}هـ`;
    }
    catch {
        return '١٤٤٨هـ';
    }
}
// ===== lib/maskRefine.js =====
// ─────────────────────────────────────────────────────────────
// تحسين قناع القص: حدّة الحواف، تقليص الهالة، التنعيم، إزالة التلوّث اللوني
// كل شيء داخل المتصفح على Canvas
// ─────────────────────────────────────────────────────────────
const DEFAULT_REFINE = { hardness: 0.4, shrink: 1.2, feather: 0.8, decontaminate: true };
const WORK_MAX_SIDE = 1800; // كافٍ للغلاف وأسرع على الهاتف
function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
}
const ctx2d = (c) => c.getContext('2d', { willReadFrequently: true });
/** نسخة من الصورة بحجم العمل (أطول ضلع ≤ maxSide) */
function toWorkCanvas(src, maxSide = WORK_MAX_SIDE) {
    const w0 = src.naturalWidth || src.width;
    const h0 = src.naturalHeight || src.height;
    const r = Math.min(1, maxSide / Math.max(w0, h0));
    const c = makeCanvas(w0 * r, h0 * r);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
}
/** يحوّل قناة الشفافية لصورة مفرّغة إلى قناع رمادي (أبيض = يبقى) */
function alphaToMask(fg, w, h) {
    const c = makeCanvas(w, h);
    const ctx = ctx2d(c);
    ctx.drawImage(fg, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const v = d[i + 3];
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
}
/** القناع الأساسي + تعديلات الفرشاة (أسود = ممحاة، أبيض = استعادة) */
function combineMask(base, edits, w = base.width, h = base.height) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(base, 0, 0, c.width, c.height);
    if (edits)
        ctx.drawImage(edits, 0, 0, c.width, c.height);
    return c;
}
function blurred(src, px) {
    const c = makeCanvas(src.width, src.height);
    const ctx = c.getContext('2d');
    ctx.filter = `blur(${px}px)`;
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';
    return c;
}
/**
 * يُنتج صورة مفرّغة نهائية (RGBA) من الأصل + القناع الخام.
 * scale: نسبة الدقة الحالية إلى دقة العمل (للمعاينة المصغّرة).
 */
function refineCutout(original, rawMask, params = DEFAULT_REFINE, scale = 1) {
    const w = original.width, h = original.height;
    let m = makeCanvas(w, h);
    ctx2d(m).drawImage(rawMask, 0, 0, w, h);
    // 1) تقليص الحواف (يزيل هالة الخلفية): تمويه ثم رفع العتبة
    const shrink = (params.shrink || 0) * scale;
    if (shrink > 0.05)
        m = blurred(m, shrink);
    // 2) حدّة الحواف عبر جدول تحويل
    const mctx = ctx2d(m);
    const mImg = mctx.getImageData(0, 0, w, h);
    const md = mImg.data;
    const span = Math.max(0.02, 1 - (params.hardness || 0) * 0.95);
    let lo = 0.5 - span / 2;
    let hi = 0.5 + span / 2;
    if (shrink > 0.05) {
        lo += 0.15;
        hi = Math.min(1, hi + 0.15);
    }
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++)
        lut[i] = Math.max(0, Math.min(1, (i / 255 - lo) / Math.max(0.001, hi - lo))) * 255;
    for (let i = 0; i < md.length; i += 4)
        md[i] = md[i + 1] = md[i + 2] = lut[md[i]];
    mctx.putImageData(mImg, 0, 0);
    // 3) تنعيم الحافة
    const feather = (params.feather || 0) * scale;
    if (feather > 0.05)
        m = blurred(m, feather);
    const alpha = ctx2d(m).getImageData(0, 0, w, h).data;
    // 4) تركيب النتيجة
    const out = makeCanvas(w, h);
    const octx = ctx2d(out);
    octx.drawImage(original, 0, 0, w, h);
    const oImg = octx.getImageData(0, 0, w, h);
    const od = oImg.data;
    // 5) إزالة التلوّث اللوني: ألوان الحافة تُستبدل بألوان الداخل المجاورة
    let bleed = null;
    if (params.decontaminate) {
        const core = makeCanvas(w, h);
        const cctx = ctx2d(core);
        const cImg = cctx.createImageData(w, h);
        const cd = cImg.data;
        for (let i = 0; i < cd.length; i += 4) {
            const a = alpha[i];
            if (a > 200) {
                cd[i] = od[i];
                cd[i + 1] = od[i + 1];
                cd[i + 2] = od[i + 2];
                cd[i + 3] = 255;
            }
        }
        cctx.putImageData(cImg, 0, 0);
        bleed = ctx2d(blurred(core, Math.max(2, 7 * scale))).getImageData(0, 0, w, h).data;
    }
    for (let i = 0; i < od.length; i += 4) {
        const a = alpha[i];
        if (bleed && a < 250 && bleed[i + 3] > 8) {
            const t = 1 - a / 255;
            od[i] = od[i] * (1 - t) + bleed[i] * t;
            od[i + 1] = od[i + 1] * (1 - t) + bleed[i + 1] * t;
            od[i + 2] = od[i + 2] * (1 - t) + bleed[i + 2] * t;
        }
        od[i + 3] = a;
    }
    octx.putImageData(oImg, 0, 0);
    return out;
}
// ===== lib/backgroundRemoval.js =====
// ─────────────────────────────────────────────────────────────
// إزالة الخلفية بالكامل داخل المتصفح (Client-side)
// ─────────────────────────────────────────────────────────────
// المكتبة: @imgly/background-removal (ONNX Runtime + WebAssembly / WebGPU)
// • الصورة لا تغادر جهاز المستخدم — لا يوجد أي API خارجي للمعالجة.
// • في أول استخدام تُنزَّل ملفات النموذج وتُخزَّن في المتصفح.
//
// المسار المحسّن:
//   1) النموذج يُنتج قناعاً (Mask) على نسخة بحجم العمل.
//   2) القناع يُحسَّن (حدّة، تقليص الهالة، تنعيم، إزالة التلوّث اللوني) — lib/maskRefine.js
//   3) يُطبَّق على الصورة بدقتها، ويُحفظ القناع لإعادة التحرير يدوياً لاحقاً.
const QUALITY_MODES = [
    { id: 'high', label: 'دقة قصوى', model: 'isnet' },
    { id: 'balanced', label: 'متوازن', model: 'isnet_fp16' },
    { id: 'fast', label: 'سريع', model: 'isnet_quint8' },
];
// في تطبيق أندرويد: نموذج «متوازن» ومحرك التشغيل مدمجان داخل التطبيق (لا تنزيل)
const LOCAL_MODEL = 'isnet_fp16';
let localPathPromise = null;
function localEnginePath() {
    if (!localPathPromise) {
        const path = typeof window !== 'undefined' && window.__LOCAL_IMGLY_PATH__;
        localPathPromise = !path
            ? Promise.resolve(null)
            : fetch(path + 'resources.json', { cache: 'no-store' })
                .then((r) => (r.ok ? path : null))
                .catch(() => null);
    }
    return localPathPromise;
}
function hasLocalEngine() {
    return typeof window !== 'undefined' && !!window.__LOCAL_IMGLY_PATH__;
}
const QUALITY_KEY = 'cover-studio-cut-quality';
function getCutQuality() {
    const fallback = hasLocalEngine() ? 'balanced' : 'high';
    try {
        return localStorage.getItem(QUALITY_KEY) || fallback;
    }
    catch {
        return fallback;
    }
}
function setCutQuality(q) {
    try {
        localStorage.setItem(QUALITY_KEY, q);
    }
    catch {
        /* التخزين غير متاح */
    }
}
const BG_REMOVAL_CONFIG = {
    output: { format: 'image/png', quality: 1 },
    // publicPath: `${typeof window !== 'undefined' ? window.location.origin : ''}/imgly/`,
    debug: false,
};
// مصادر المكتبة بالترتيب: النسخة المدمجة (أو npm) ثم نسخة CDN احتياطية
const LIB_LOADERS = [
    () => import(IMGLY_URL),
    () => import(IMGLY_FALLBACK),
];
const libCache = [];
function loadLibrary(i = 0) {
    if (!libCache[i]) {
        libCache[i] = LIB_LOADERS[i]().catch((e) => {
            libCache[i] = null;
            throw e;
        });
    }
    return libCache[i];
}
async function preloadBackgroundRemoval() {
    const lib = await loadLibrary();
    if (typeof lib.preload === 'function')
        await lib.preload(BG_REMOVAL_CONFIG);
}
function describeProgress(key, current, total) {
    const downloading = key.startsWith('fetch');
    return {
        phase: downloading ? 'download' : 'compute',
        label: downloading ? 'تنزيل نموذج الذكاء الاصطناعي (مرة واحدة فقط)…' : 'جارٍ كشف الشخص/العنصر داخل المتصفح…',
        percent: total ? Math.min(100, Math.round((current / total) * 100)) : 0,
    };
}
async function toBlob(input) {
    if (typeof input === 'string')
        return (await fetch(input)).blob();
    return input;
}
/** يُرجع الصورة بحجم العمل + قناعها الخام من النموذج */
let workingAttempt = null; // آخر طريقة نجحت — نبدأ بها في المرة القادمة
async function aiMask(input, onProgress, quality = getCutQuality()) {
    onProgress?.({ phase: 'prepare', label: 'تجهيز الصورة…', percent: 0 });
    const bitmap = await createImageBitmap(await toBlob(input));
    const original = toWorkCanvas(bitmap);
    bitmap.close?.();
    const model = (QUALITY_MODES.find((q) => q.id === quality) || QUALITY_MODES[0]).model;
    const localPath = model === LOCAL_MODEL ? await localEnginePath() : null;
    const workBlob = await canvasToBlob(original);
    // محاولات متتالية: المحرك المدمج ← ملفات النموذج من الإنترنت ← المكتبة كاملة من الإنترنت
    const attempts = [];
    if (localPath)
        attempts.push({ lib: 0, publicPath: localPath, name: 'المحرك المدمج' });
    attempts.push({ lib: 0, publicPath: null, name: 'النموذج من الإنترنت' });
    attempts.push({ lib: 1, publicPath: null, name: 'المكتبة الاحتياطية' });
    if (workingAttempt)
        attempts.sort((a, b) => (a.name === workingAttempt ? -1 : b.name === workingAttempt ? 1 : 0));
    const errors = [];
    for (const att of attempts) {
        try {
            const { removeBackground } = await loadLibrary(att.lib);
            const fg = await removeBackground(workBlob, {
                ...BG_REMOVAL_CONFIG,
                ...(att.publicPath ? { publicPath: att.publicPath } : {}),
                model,
                progress: (key, current, total) => onProgress?.(describeProgress(key, current, total)),
            });
            workingAttempt = att.name;
            const fgBitmap = await createImageBitmap(fg);
            const mask = alphaToMask(fgBitmap, original.width, original.height);
            fgBitmap.close?.();
            return { original, mask };
        }
        catch (e) {
            console.warn(`فشلت محاولة القص (${att.name})`, e);
            errors.push(`${att.name}: ${e?.message || e}`);
        }
    }
    throw new Error('تعذّر تشغيل محرك القص — ' + errors.join(' | '));
}
/**
 * إزالة الخلفية مع تحسين الحواف.
 * @returns {Promise<{blob: Blob, maskUrl: string}>}
 */
async function removeImageBackgroundDetailed(input, onProgress, params = DEFAULT_REFINE) {
    const { original, mask } = await aiMask(input, onProgress);
    onProgress?.({ phase: 'finish', label: 'تحسين الحواف وإزالة الهالة…', percent: 100 });
    const out = refineCutout(original, mask, params, 1);
    const blob = await trimTransparent(await canvasToBlob(out));
    const maskUrl = URL.createObjectURL(await canvasToBlob(mask));
    return { blob, maskUrl };
}
/** واجهة مبسّطة (للتوافق): تُرجع Blob للصورة المفرّغة فقط */
async function removeImageBackground(input, onProgress) {
    return (await removeImageBackgroundDetailed(input, onProgress)).blob;
}
// ===== lib/exportImage.js =====
// ─────────────────────────────────────────────────────────────
// الخطوة 5: تصدير الغلاف كصورة PNG عالية الدقة (pixelRatio: 2)
// ─────────────────────────────────────────────────────────────
/**
 * تصدير لوحة Konva بدقة ثابتة بغض النظر عن حجم المعاينة على الشاشة.
 * المعاينة مصغّرة بمعامل displayScale، لذلك نقسم عليه:
 *   1000×1500 (منطقي) × 2 = 2000×3000 بكسل دائماً.
 */
function exportStageToBlob(stage, { pixelRatio = EXPORT_PIXEL_RATIO, mimeType = 'image/png' } = {}) {
    const displayScale = stage.scaleX() || 1;
    const effectiveRatio = pixelRatio / displayScale;
    return new Promise((resolve, reject) => {
        try {
            stage.toBlob({
                mimeType,
                quality: 1,
                pixelRatio: effectiveRatio,
                callback: (blob) => (blob ? resolve(blob) : reject(new Error('فشل إنشاء الصورة'))),
            });
        }
        catch (err) {
            reject(err);
        }
    });
}
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
        fr.onerror = reject;
        fr.readAsDataURL(blob);
    });
}
/** داخل تطبيق أندرويد: نرسل الملف على أجزاء إلى الكود الأصلي ليحفظه في الصور/التنزيلات */
async function saveViaAndroid(blob, filename) {
    const bridge = window.AndroidBridge;
    const b64 = await blobToBase64(blob);
    const id = bridge.beginFile(filename, blob.type || 'application/octet-stream');
    const CHUNK = 512 * 1024; // مضاعف 4 حتى يُفك كل جزء مستقلاً
    for (let i = 0; i < b64.length; i += CHUNK)
        bridge.appendChunk(id, b64.slice(i, i + CHUNK));
    bridge.finishFile(id);
}
function isAndroidApp() {
    return typeof window !== 'undefined' && !!window.AndroidBridge;
}
function downloadBlob(blob, filename = 'book-cover.png') {
    if (isAndroidApp())
        return saveViaAndroid(blob, filename);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
}
/**
 * بديل HTML → Image لأي عنصر DOM (مثلاً لو بُنيت المعاينة بعناصر HTML بدل الكانفاس).
 * ننتظر الخطوط أولاً حتى لا تُصدَّر النصوص بخط بديل.
 */
async function exportDomNodeToPNG(node, filename = 'book-cover.png', pixelRatio = EXPORT_PIXEL_RATIO) {
    const { toBlob } = await import('https://esm.sh/html-to-image@1.11.11');
    await document.fonts.ready;
    const blob = await toBlob(node, { pixelRatio, cacheBust: true, backgroundColor: '#000' });
    downloadBlob(blob, filename);
    return blob;
}
function coverFileName(title) {
    const safe = (title || 'غلاف').replace(/[\\/:*?"<>|\n]+/g, ' ').trim().slice(0, 60) || 'غلاف';
    return `${safe}.png`;
}
// ===== lib/overlays.js =====
// ─────────────────────────────────────────────────────────────
// نظام الطبقات والمؤثرات (Overlays & Textures)
// ─────────────────────────────────────────────────────────────
// كل طبقة تُولَّد برمجياً على Canvas مستقل (بدون ملفات صور خارجية)،
// باستخدام مولّد أرقام عشوائية ثابت البذرة حتى تبقى النتيجة نفسها بين الجلسات.
// تُرسم الطبقة فوق التصميم في Konva مع وضع دمج (blend) وشفافية يتحكم بها المستخدم.
// لاستبدال أي طبقة بصورة PNG حقيقية: غيّر draw لترسم الصورة عبر ctx.drawImage.
// ───────── أدوات ─────────
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const TAU = Math.PI * 2;
function softDot(ctx, x, y, radius, color0, color1 = 'rgba(0,0,0,0)') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color0);
    g.addColorStop(1, color1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
}
function organicBlob(ctx, x, y, radius, r) {
    const p1 = r() * TAU, p2 = r() * TAU, k1 = 2 + Math.floor(r() * 3), k2 = 5 + Math.floor(r() * 4);
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * TAU;
        const rr = radius * (1 + 0.12 * Math.sin(k1 * a + p1) + 0.06 * Math.sin(k2 * a + p2));
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
}
// ═════════ الطقس ═════════
function drawRain(ctx, w, h, r) {
    ctx.fillStyle = 'rgba(140,160,185,0.08)';
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    for (let i = 0; i < 1700; i++) {
        const depth = r();
        const x = r() * w * 1.3 - w * 0.15;
        const y = r() * h * 1.1 - h * 0.05;
        const len = 16 + depth * 64;
        ctx.strokeStyle = `rgba(215,228,242,${0.07 + depth * 0.42})`;
        ctx.lineWidth = 0.4 + depth * 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * 0.22, y + len);
        ctx.stroke();
    }
    // رذاذ على الأرض
    for (let i = 0; i < 260; i++) {
        softDot(ctx, r() * w, h * (0.86 + r() * 0.14), 1 + r() * 3, 'rgba(230,240,250,0.35)');
    }
}
function drawSnow(ctx, w, h, r) {
    for (let i = 0; i < 1200; i++) {
        const s = r();
        const radius = 0.6 + s * s * s * 7;
        softDot(ctx, r() * w, r() * h, radius, `rgba(255,255,255,${0.45 + s * 0.55})`);
    }
}
function drawDust(ctx, w, h, r) {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(195,145,85,0.5)');
    g.addColorStop(0.45, 'rgba(175,125,75,0.16)');
    g.addColorStop(1, 'rgba(150,110,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // سحب غبار أفقية
    for (let i = 0; i < 45; i++) {
        ctx.save();
        ctx.translate(r() * w, h * (0.3 + r() * 0.75));
        ctx.scale(1, 0.12 + r() * 0.1);
        softDot(ctx, 0, 0, 200 + r() * 320, 'rgba(205,160,110,0.12)');
        ctx.restore();
    }
    for (let i = 0; i < 5500; i++) {
        const size = 0.3 + r() ** 2 * 2.4;
        ctx.fillStyle = `rgba(238,208,165,${0.1 + r() * 0.5})`;
        ctx.fillRect(r() * w, r() * h, size, size);
    }
}
function drawSmokeFog(ctx, w, h, r) {
    for (let i = 0; i < 80; i++) {
        const y = h * (0.2 + r() * 0.9);
        const shade = 190 + Math.floor(r() * 40);
        softDot(ctx, r() * w, y, 120 + r() * 400, `rgba(${shade},${shade},${shade + 5},${0.07 + r() * 0.09})`);
    }
    const g = ctx.createLinearGradient(0, h, 0, h * 0.4);
    g.addColorStop(0, 'rgba(210,210,215,0.35)');
    g.addColorStop(1, 'rgba(210,210,215,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}
// ═════════ التكتشر ═════════
function drawFilmGrain(ctx, w, h, r) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const img = ctx.createImageData(cw, ch);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const v = 128 + (r() - 0.5) * 150;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // شوائب وشعيرات الفيلم
    for (let i = 0; i < 30; i++) {
        ctx.strokeStyle = r() > 0.5 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 0.6 + r();
        const x = r() * w, y = r() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 40, x + (r() - 0.5) * 40, y + (r() - 0.5) * 40, x + (r() - 0.5) * 50, y + (r() - 0.5) * 50);
        ctx.stroke();
    }
}
function drawGlassScratches(ctx, w, h, r) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 280; i++) {
        const biased = r() < 0.7;
        const ang = biased ? -0.6 + (r() - 0.5) * 0.7 : r() * Math.PI;
        const len = 20 + r() ** 2 * 480;
        const x = r() * w, y = r() * h;
        const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
        ctx.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.35})`;
        ctx.lineWidth = 0.3 + r() * 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo((x + ex) / 2 + (r() - 0.5) * 50, (y + ey) / 2 + (r() - 0.5) * 50, ex, ey);
        ctx.stroke();
    }
    for (let i = 0; i < 120; i++)
        softDot(ctx, r() * w, r() * h, 1 + r() * 3, 'rgba(255,255,255,0.5)');
}
function drawStains(ctx, w, h, r) {
    for (let i = 0; i < 24; i++) {
        const x = r() * w, y = r() * h, radius = 40 + r() * 230;
        const g = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.15);
        g.addColorStop(0, 'rgba(95,62,30,0.10)');
        g.addColorStop(0.75, 'rgba(95,62,30,0.18)');
        g.addColorStop(0.86, 'rgba(60,36,15,0.55)'); // حلقة القهوة
        g.addColorStop(1, 'rgba(60,36,15,0)');
        ctx.fillStyle = g;
        organicBlob(ctx, x, y, radius, r);
        ctx.fill();
    }
    for (let i = 0; i < 160; i++)
        softDot(ctx, r() * w, r() * h, 2 + r() * 10, 'rgba(70,42,18,0.45)');
}
function drawBurntPaper(ctx, w, h, r) {
    ctx.fillStyle = 'rgba(140,95,50,0.16)';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1000; i++) {
        const side = Math.floor(r() * 4), t = r(), inward = r() ** 2.2 * 150;
        const x = side === 0 ? t * w : side === 1 ? w - inward : side === 2 ? t * w : inward;
        const y = side === 0 ? inward : side === 1 ? t * h : side === 2 ? h - inward : t * h;
        const radius = 25 + r() * 95;
        const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
        g.addColorStop(0, 'rgba(14,5,0,0.75)');
        g.addColorStop(0.6, 'rgba(60,25,5,0.32)');
        g.addColorStop(1, 'rgba(60,25,5,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, TAU);
        ctx.fill();
    }
    // ثقوب احتراق بحافة جمرية
    for (let i = 0; i < 4; i++) {
        const x = w * (0.1 + r() * 0.8), y = h * (0.1 + r() * 0.8), radius = 18 + r() * 50;
        const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
        g.addColorStop(0, 'rgba(0,0,0,0.95)');
        g.addColorStop(0.65, 'rgba(15,6,0,0.9)');
        g.addColorStop(0.8, 'rgba(190,85,20,0.55)');
        g.addColorStop(1, 'rgba(90,40,10,0)');
        ctx.fillStyle = g;
        organicBlob(ctx, x, y, radius, r);
        ctx.fill();
    }
}
function drawConcrete(ctx, w, h, r) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const layerNoise = (div, contrast, alpha) => {
        const small = document.createElement('canvas');
        small.width = Math.ceil(cw / div);
        small.height = Math.ceil(ch / div);
        const sctx = small.getContext('2d');
        const si = sctx.createImageData(small.width, small.height);
        for (let i = 0; i < si.data.length; i += 4) {
            const v = 128 + (r() - 0.5) * contrast;
            si.data[i] = si.data[i + 1] = si.data[i + 2] = v;
            si.data[i + 3] = 255;
        }
        sctx.putImageData(si, 0, 0);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(small, 0, 0, cw, ch);
        ctx.restore();
    };
    layerNoise(14, 130, 1);
    layerNoise(4, 80, 0.5);
    // ضجيج دقيق
    const img = ctx.getImageData(0, 0, cw, ch);
    for (let i = 0; i < img.data.length; i += 4) {
        const n = (r() - 0.5) * 55;
        img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
        img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
        img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
    // مسامات وتشققات
    for (let i = 0; i < 700; i++)
        softDot(ctx, r() * w, r() * h, 0.8 + r() * 2.5, 'rgba(40,40,40,0.8)');
    ctx.strokeStyle = 'rgba(30,30,30,0.6)';
    for (let c = 0; c < 7; c++) {
        let x = r() * w, y = r() * h;
        ctx.lineWidth = 0.6 + r() * 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        let ang = r() * TAU;
        for (let s = 0; s < 40; s++) {
            ang += (r() - 0.5) * 0.9;
            x += Math.cos(ang) * 9;
            y += Math.sin(ang) * 9;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}
// ═════════ الإضاءة والظلال ═════════
function drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h * 0.47, h * 0.22, w / 2, h * 0.47, h * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0.96)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}
function drawLightLeak(ctx, w, h) {
    softDot(ctx, -60, h * 0.15, 780, 'rgba(255,110,30,0.85)');
    softDot(ctx, w * 0.12, -90, 520, 'rgba(255,205,95,0.7)');
    softDot(ctx, w + 70, h * 0.68, 680, 'rgba(232,40,72,0.55)');
    softDot(ctx, w * 0.9, h * 0.97, 420, 'rgba(255,150,60,0.42)');
}
function drawLightRays(ctx, w, h, r) {
    const ox = w * 0.78, oy = -h * 0.08, len = h * 1.45;
    ctx.filter = 'blur(6px)';
    for (let i = 0; i < 17; i++) {
        const a = Math.PI / 2 - 0.12 + r() * 0.85;
        const wd = 0.012 + r() * 0.045;
        const k = 0.5 + r() * 0.5;
        const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
        g.addColorStop(0, `rgba(255,236,192,${0.5 * k})`);
        g.addColorStop(0.55, `rgba(255,225,170,${0.13 * k})`);
        g.addColorStop(1, 'rgba(255,225,170,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a - wd) * len, oy + Math.sin(a - wd) * len);
        ctx.lineTo(ox + Math.cos(a + wd) * len, oy + Math.sin(a + wd) * len);
        ctx.closePath();
        ctx.fill();
    }
    ctx.filter = 'none';
    softDot(ctx, ox, 0, 360, 'rgba(255,230,180,0.45)');
}
function drawWindowShadow(ctx, w, h) {
    const span = Math.hypot(w, h) * 1.2;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.32);
    ctx.filter = 'blur(6px)';
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    for (let y = -span / 2; y < span / 2; y += 66)
        ctx.fillRect(-span / 2, y, span, 32); // شرائح الستارة
    ctx.fillRect(-span * 0.06, -span / 2, 30, span); // قوائم النافذة
    ctx.fillRect(span * 0.2, -span / 2, 30, span);
    ctx.restore();
    ctx.filter = 'none';
}
// ═════════ هندسية وتكتيكية ═════════
function drawRandomLines(ctx, w, h, r) {
    const edgePoint = () => {
        const s = Math.floor(r() * 4), t = r();
        return s === 0 ? [t * w, 0] : s === 1 ? [w, t * h] : s === 2 ? [t * w, h] : [0, t * h];
    };
    for (let i = 0; i < 70; i++) {
        const [x1, y1] = edgePoint();
        const [x2, y2] = edgePoint();
        ctx.strokeStyle = `rgba(228,208,168,${0.08 + r() * 0.38})`;
        ctx.lineWidth = 0.5 + r() * 1.4;
        ctx.setLineDash(r() < 0.3 ? [4 + r() * 12, 4 + r() * 10] : []);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (r() < 0.15) {
            const len = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
            ctx.setLineDash([]);
            for (let d = 0; d < len; d += 40) {
                const px = x1 + ((x2 - x1) * d) / len, py = y1 + ((y2 - y1) * d) / len;
                ctx.beginPath();
                ctx.moveTo(px - nx * 5, py - ny * 5);
                ctx.lineTo(px + nx * 5, py + ny * 5);
                ctx.stroke();
            }
        }
    }
    ctx.setLineDash([]);
    for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = `rgba(228,208,168,${0.15 + r() * 0.25})`;
        ctx.beginPath();
        ctx.arc(r() * w, r() * h, 40 + r() * 260, r() * TAU, r() * TAU + 1 + r() * 3);
        ctx.stroke();
    }
}
function drawGrid(ctx, w, h) {
    const minor = 50, major = 250;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(190,215,195,0.09)';
    ctx.beginPath();
    for (let x = 0; x <= w; x += minor) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += minor) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,215,195,0.3)';
    ctx.beginPath();
    for (let x = 0; x <= w; x += major) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += major) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,215,195,0.6)';
    ctx.font = '13px ui-monospace, monospace';
    if ('direction' in ctx)
        ctx.direction = 'ltr';
    for (let i = 0, x = 0; x < w; x += major, i++)
        ctx.fillText(String.fromCharCode(65 + i), x + 6, 18);
    for (let i = 1, y = major; y < h; y += major, i++)
        ctx.fillText(String(i).padStart(2, '0'), 6, y - 6);
    // شبكة تصويب
    const cx = w * 0.66, cy = h * 0.4;
    ctx.strokeStyle = 'rgba(210,235,215,0.45)';
    ctx.lineWidth = 1.2;
    [36, 70].forEach((rad) => { ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke(); });
    ctx.beginPath();
    ctx.moveTo(cx - 100, cy);
    ctx.lineTo(cx - 20, cy);
    ctx.moveTo(cx + 20, cy);
    ctx.lineTo(cx + 100, cy);
    ctx.moveTo(cx, cy - 100);
    ctx.lineTo(cx, cy - 20);
    ctx.moveTo(cx, cy + 20);
    ctx.lineTo(cx, cy + 100);
    ctx.stroke();
    ctx.fillText('N 33°30′ / E 36°18′', cx + 78, cy - 78);
}
function drawScanlines(ctx, w, h, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (let y = 0; y < h; y += 4)
        ctx.fillRect(0, y, w, 1.6);
    for (let i = 0; i < 3; i++) {
        const y = r() * h, bh = 50 + r() * 120;
        const g = ctx.createLinearGradient(0, y, 0, y + bh);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.06)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y, w, bh);
    }
}
// خطوط كنتورية حقيقية عبر خوارزمية Marching Squares على حقل تضاريس
const MS_SEGMENTS = {
    1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[0, 1], [3, 2]], 6: [[0, 2]], 7: [[3, 0]],
    8: [[3, 0]], 9: [[0, 2]], 10: [[0, 3], [1, 2]], 11: [[0, 1]], 12: [[3, 1]], 13: [[1, 2]], 14: [[3, 2]],
};
function drawTopographic(ctx, w, h, r) {
    const hills = Array.from({ length: 10 }, () => ({ x: r() * w, y: r() * h, s: 110 + r() * 260, a: r() * 1.7 - 0.5 }));
    const field = (x, y) => {
        let v = 0;
        for (const hl of hills) {
            const dx = x - hl.x, dy = y - hl.y;
            v += hl.a * Math.exp(-(dx * dx + dy * dy) / (2 * hl.s * hl.s));
        }
        return v + 0.06 * Math.sin(x * 0.011 + y * 0.007);
    };
    const step = 6, cols = Math.ceil(w / step) + 1, rows = Math.ceil(h / step) + 1;
    const vals = new Float32Array(cols * rows);
    let min = Infinity, max = -Infinity;
    for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
            const v = field(i * step, j * step);
            vals[j * cols + i] = v;
            if (v < min)
                min = v;
            if (v > max)
                max = v;
        }
    const levels = 30;
    for (let L = 0; L < levels; L++) {
        const t = min + ((max - min) * (L + 0.5)) / levels;
        const index = L % 5 === 0;
        ctx.strokeStyle = index ? 'rgba(215,192,150,0.48)' : 'rgba(215,192,150,0.22)';
        ctx.lineWidth = index ? 1.6 : 0.8;
        ctx.beginPath();
        for (let j = 0; j < rows - 1; j++)
            for (let i = 0; i < cols - 1; i++) {
                const a = vals[j * cols + i], b = vals[j * cols + i + 1];
                const c = vals[(j + 1) * cols + i + 1], d = vals[(j + 1) * cols + i];
                const code = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
                const segs = MS_SEGMENTS[code];
                if (!segs)
                    continue;
                const x0 = i * step, y0 = j * step;
                const pt = (e) => e === 0 ? [x0 + ((t - a) / (b - a)) * step, y0]
                    : e === 1 ? [x0 + step, y0 + ((t - b) / (c - b)) * step]
                        : e === 2 ? [x0 + ((t - d) / (c - d)) * step, y0 + step]
                            : [x0, y0 + ((t - a) / (d - a)) * step];
                for (const [e1, e2] of segs) {
                    const p = pt(e1), q = pt(e2);
                    ctx.moveTo(p[0], p[1]);
                    ctx.lineTo(q[0], q[1]);
                }
            }
        ctx.stroke();
    }
}
// ═════════ زخرفية ═════════
function drawIslamicPattern(ctx, w, h) {
    const cell = 140;
    ctx.strokeStyle = 'rgba(215,180,105,0.55)';
    ctx.lineWidth = 1.3;
    const rubElHizb = (cx, cy, R) => {
        for (const rot of [0, Math.PI / 4]) {
            ctx.beginPath();
            for (let k = 0; k < 4; k++) {
                const a = rot + k * (Math.PI / 2) + Math.PI / 4;
                const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
                k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
        }
    };
    const star83 = (cx, cy, R) => {
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) {
            const a = ((k * 3) % 8) * (TAU / 8) + Math.PI / 8;
            const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
            k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
    };
    for (let y = 0; y <= h + cell; y += cell) {
        for (let x = 0; x <= w + cell; x += cell) {
            rubElHizb(x, y, cell * 0.44);
            star83(x, y, cell * 0.3);
            ctx.beginPath();
            ctx.arc(x, y, cell * 0.12, 0, TAU);
            ctx.stroke();
            rubElHizb(x + cell / 2, y + cell / 2, cell * 0.18);
        }
    }
    // الشبكة القُطرية الرابطة
    ctx.strokeStyle = 'rgba(215,180,105,0.2)';
    ctx.beginPath();
    for (let d = -h; d < w + h; d += cell) {
        ctx.moveTo(d, 0);
        ctx.lineTo(d + h, h);
        ctx.moveTo(d + h, 0);
        ctx.lineTo(d, h);
    }
    ctx.stroke();
}
function drawClassicFrame(ctx, w, h) {
    const gold = 'rgba(218,184,112,0.92)';
    ctx.strokeStyle = gold;
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 36, w - 72, h - 72);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(52, 52, w - 104, h - 104);
    ctx.strokeRect(62, 62, w - 124, h - 124);
    const diamond = (x, y, s) => {
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s, y);
        ctx.closePath();
        ctx.fillStyle = gold;
        ctx.fill();
    };
    const corners = [[62, 62, 1, 1], [w - 62, 62, -1, 1], [62, h - 62, 1, -1], [w - 62, h - 62, -1, -1]];
    for (const [cx, cy, sx, sy] of corners) {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 54, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, TAU);
        ctx.stroke();
        diamond(cx, cy, 14);
        for (let k = 1; k <= 3; k++) {
            ctx.beginPath();
            ctx.arc(cx + sx * (54 + k * 22), cy, 3, 0, TAU);
            ctx.arc(cx, cy + sy * (54 + k * 22), 3, 0, TAU);
            ctx.fill();
        }
    }
    diamond(w / 2, 36, 12);
    diamond(w / 2, h - 36, 12);
    diamond(36, h / 2, 12);
    diamond(w - 36, h / 2, 12);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 140, 80);
    ctx.lineTo(w / 2 + 140, 80);
    ctx.moveTo(w / 2 - 140, h - 80);
    ctx.lineTo(w / 2 + 140, h - 80);
    ctx.stroke();
}
function drawEmbers(ctx, w, h, r) {
    for (let i = 0; i < 420; i++) {
        const x = r() * w, y = h * (0.2 + r() * 0.85), s = r();
        const rad = 0.8 + s * s * 3.5;
        softDot(ctx, x, y, rad * 5, `rgba(255,${110 + Math.floor(r() * 80)},30,${0.12 + s * 0.25})`);
        ctx.fillStyle = `rgba(255,${200 + Math.floor(r() * 55)},150,${0.5 + s * 0.5})`;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, TAU);
        ctx.fill();
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
        const x = r() * w, y = h * (0.3 + r() * 0.7), len = 10 + r() * 45;
        ctx.strokeStyle = `rgba(255,170,70,${0.2 + r() * 0.3})`;
        ctx.lineWidth = 0.8 + r() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + (r() - 0.5) * 20, y - len / 2, x + (r() - 0.5) * 16, y - len);
        ctx.stroke();
    }
    const g = ctx.createLinearGradient(0, h, 0, h * 0.5);
    g.addColorStop(0, 'rgba(255,90,20,0.35)');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}
function drawBokeh(ctx, w, h, r) {
    const palette = [[255, 190, 110], [255, 140, 60], [120, 180, 255], [255, 230, 180], [200, 120, 255]];
    for (let i = 0; i < 90; i++) {
        const [cr, cg, cb] = palette[Math.floor(r() * palette.length)];
        const x = r() * w, y = r() * h, rad = 10 + r() ** 2 * 70, a = 0.06 + r() * 0.2;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${a * 1.4})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}
function drawSpotlight(ctx, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.save();
    ctx.translate(w / 2, h * 0.5);
    ctx.scale(1, 1.35);
    const R = w * 0.48;
    const g = ctx.createRadialGradient(0, 0, R * 0.25, 0, 0, R);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
}
function drawClouds(ctx, w, h, r) {
    for (let c = 0; c < 26; c++) {
        const cx = r() * w * 1.2 - w * 0.1, cy = h * (r() * 0.65), spread = 120 + r() * 220;
        for (let i = 0; i < 28; i++) {
            const shade = 200 + Math.floor(r() * 50);
            softDot(ctx, cx + (r() - 0.5) * spread * 2, cy + (r() - 0.5) * spread * 0.6, 50 + r() * 130, `rgba(${shade},${shade},${shade + 6},${0.05 + r() * 0.07})`);
        }
    }
}
function drawLensFlare(ctx, w, h) {
    const sx = w * 0.82, sy = h * 0.1;
    softDot(ctx, sx, sy, 380, 'rgba(255,220,170,0.55)');
    softDot(ctx, sx, sy, 90, 'rgba(255,255,240,0.95)');
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(6, 0.08);
    softDot(ctx, 0, 0, 120, 'rgba(255,230,200,0.9)');
    ctx.restore();
    const tx = w - sx, ty = h - sy;
    const ghosts = [[0.25, 40, 'rgba(120,200,255,0.25)'], [0.45, 70, 'rgba(255,170,90,0.18)'], [0.6, 25, 'rgba(180,255,180,0.3)'], [0.8, 110, 'rgba(255,120,200,0.12)'], [1.0, 55, 'rgba(120,160,255,0.2)']];
    for (const [t, rad, col] of ghosts) {
        const x = sx + (tx - sx) * t, y = sy + (ty - sy) * t;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, TAU);
        ctx.fill();
    }
}
function drawTornEdges(ctx, w, h, r) {
    const pts = [];
    const step = 6;
    let inset = 22;
    const jag = () => {
        inset = Math.min(44, Math.max(10, inset + (r() - 0.5) * 8));
        return inset + (r() - 0.5) * 6;
    };
    for (let x = 0; x <= w; x += step)
        pts.push([x, jag()]);
    for (let y = 0; y <= h; y += step)
        pts.push([w - jag(), y]);
    for (let x = w; x >= 0; x -= step)
        pts.push([x, h - jag()]);
    for (let y = h; y >= 0; y -= step)
        pts.push([jag(), y]);
    const trace = () => {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
    };
    ctx.fillStyle = '#0a0908';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    trace();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // ظل داخلي يعطي عمق الورق الممزق
    ctx.save();
    trace();
    ctx.clip();
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 34;
    ctx.lineWidth = 24;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    trace();
    ctx.stroke();
    ctx.restore();
    // ألياف الورق على الحافة
    ctx.strokeStyle = 'rgba(225,212,190,0.35)';
    ctx.lineWidth = 1.4;
    trace();
    ctx.stroke();
}
function drawThinFrame(ctx, w, h) {
    ctx.strokeStyle = 'rgba(235,225,205,0.8)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(40, 40, w - 80, h - 80);
}
// ═════════ مؤثرات إضافية ═════════
function drawLightning(ctx, w, h, r) {
    const bolt = (x, y, len, ang, width, depth) => {
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        let cx = x, cy = y;
        const steps = 14;
        for (let i = 0; i < steps; i++) {
            cx += Math.cos(ang) * (len / steps) + (r() - 0.5) * 34;
            cy += Math.sin(ang) * (len / steps) + (r() - 0.5) * 10;
            ctx.lineTo(cx, cy);
            if (depth < 2 && r() < 0.22) {
                ctx.stroke();
                bolt(cx, cy, len * 0.4, ang + (r() - 0.5) * 1.4, width * 0.5, depth + 1);
                ctx.lineWidth = width;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
            }
        }
        ctx.stroke();
    };
    softDot(ctx, w * 0.62, h * 0.05, 520, 'rgba(170,190,255,0.35)');
    ctx.strokeStyle = 'rgba(225,235,255,0.95)';
    ctx.shadowColor = 'rgba(150,180,255,1)';
    ctx.shadowBlur = 25;
    ctx.lineCap = 'round';
    bolt(w * 0.62, -10, h * 0.75, Math.PI / 2 + 0.15, 4, 0);
    bolt(w * 0.2, -10, h * 0.45, Math.PI / 2 - 0.2, 2.5, 1);
    ctx.shadowBlur = 0;
}
function drawStars(ctx, w, h, r) {
    for (let i = 0; i < 900; i++) {
        const s = r();
        const x = r() * w, y = r() * h * 0.75;
        ctx.fillStyle = `rgba(255,${235 + Math.floor(r() * 20)},${210 + Math.floor(r() * 45)},${0.3 + s * 0.7})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.4 + s * s * 1.8, 0, TAU);
        ctx.fill();
    }
    for (let i = 0; i < 18; i++) {
        const x = r() * w, y = r() * h * 0.7, L = 8 + r() * 18;
        softDot(ctx, x, y, L, 'rgba(255,250,235,0.6)');
        ctx.strokeStyle = 'rgba(255,250,235,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - L, y);
        ctx.lineTo(x + L, y);
        ctx.moveTo(x, y - L);
        ctx.lineTo(x, y + L);
        ctx.stroke();
    }
    // درب التبانة
    ctx.save();
    ctx.translate(w / 2, h * 0.3);
    ctx.rotate(-0.5);
    ctx.scale(1, 0.18);
    softDot(ctx, 0, 0, w * 0.8, 'rgba(200,190,255,0.12)');
    ctx.restore();
}
function drawFlames(ctx, w, h, r) {
    const g = ctx.createLinearGradient(0, h, 0, h * 0.45);
    g.addColorStop(0, 'rgba(255,120,20,0.85)');
    g.addColorStop(0.4, 'rgba(255,60,10,0.35)');
    g.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);
    for (let i = 0; i < 60; i++) {
        const x = r() * w, fh = 120 + r() * 380, fw = 30 + r() * 70;
        const fg = ctx.createLinearGradient(0, h, 0, h - fh);
        fg.addColorStop(0, 'rgba(255,230,120,0.55)');
        fg.addColorStop(0.5, 'rgba(255,120,30,0.35)');
        fg.addColorStop(1, 'rgba(200,30,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(x - fw, h);
        ctx.bezierCurveTo(x - fw, h - fh * 0.5, x + (r() - 0.5) * fw, h - fh * 0.7, x + (r() - 0.5) * fw * 0.6, h - fh);
        ctx.bezierCurveTo(x + fw * 0.4, h - fh * 0.6, x + fw, h - fh * 0.4, x + fw, h);
        ctx.closePath();
        ctx.fill();
    }
}
function drawHalftone(ctx, w, h) {
    const step = 14;
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    for (let y = 0; y < h; y += step) {
        for (let x = (y / step) % 2 ? step / 2 : 0; x < w; x += step) {
            const t = Math.min(1, Math.hypot(x - w / 2, y - h * 0.45) / (h * 0.7));
            const rad = 0.5 + t * t * step * 0.55;
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, TAU);
            ctx.fill();
        }
    }
}
function drawOldPaper(ctx, w, h, r) {
    ctx.fillStyle = 'rgba(214,190,145,0.55)';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++)
        softDot(ctx, r() * w, r() * h, 60 + r() * 220, `rgba(150,110,60,${0.05 + r() * 0.1})`);
    for (let i = 0; i < 3500; i++) {
        ctx.fillStyle = `rgba(90,60,30,${r() * 0.25})`;
        ctx.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
    g.addColorStop(0, 'rgba(120,80,40,0)');
    g.addColorStop(1, 'rgba(90,55,25,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}
function drawGrunge(ctx, w, h, r) {
    for (let i = 0; i < 160; i++) {
        const x = r() * w, y = r() * h, rad = 4 + r() ** 2 * 70;
        ctx.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.5})`;
        organicBlob(ctx, x, y, rad, r);
        ctx.fill();
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
        ctx.strokeStyle = `rgba(0,0,0,${0.2 + r() * 0.4})`;
        ctx.lineWidth = 1 + r() * 5;
        const x = r() * w, y = r() * h, a = r() * TAU, L = 20 + r() * 160;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a + 0.5) * L * 0.5, y + Math.sin(a + 0.5) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L);
        ctx.stroke();
    }
    for (let i = 0; i < 6000; i++) {
        ctx.fillStyle = `rgba(0,0,0,${r() * 0.35})`;
        ctx.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
}
function drawGlitch(ctx, w, h, r) {
    for (let i = 0; i < 26; i++) {
        const y = r() * h, bh = 3 + r() ** 2 * 40, off = (r() - 0.5) * 80;
        const colors = ['rgba(255,0,80,0.45)', 'rgba(0,255,230,0.45)', 'rgba(255,255,255,0.25)'];
        ctx.fillStyle = colors[Math.floor(r() * colors.length)];
        ctx.fillRect(off + r() * w * 0.4, y, w * (0.2 + r() * 0.7), bh);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < h; y += 3)
        ctx.fillRect(0, y, w, 1);
    for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(${r() < 0.5 ? '255,0,90' : '0,240,255'},${0.3 + r() * 0.4})`;
        ctx.fillRect(r() * w, r() * h, 4 + r() * 40, 2 + r() * 6);
    }
}
function drawSunburst(ctx, w, h) {
    const cx = w / 2, cy = h * 0.42, R = Math.hypot(w, h);
    const n = 36;
    for (let i = 0; i < n; i++) {
        if (i % 2)
            continue;
        const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.7);
        g.addColorStop(0, 'rgba(255,225,160,0.4)');
        g.addColorStop(1, 'rgba(255,225,160,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
        ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
        ctx.closePath();
        ctx.fill();
    }
    softDot(ctx, cx, cy, 260, 'rgba(255,235,190,0.5)');
}
function drawSparkles(ctx, w, h, r) {
    const sparkle = (x, y, s, a) => {
        ctx.fillStyle = `rgba(255,245,215,${a})`;
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.quadraticCurveTo(x, y, x + s * 0.28, y);
        ctx.quadraticCurveTo(x, y, x, y + s);
        ctx.quadraticCurveTo(x, y, x - s * 0.28, y);
        ctx.quadraticCurveTo(x, y, x, y - s);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.7, y);
        ctx.quadraticCurveTo(x, y, x, y + s * 0.2);
        ctx.quadraticCurveTo(x, y, x + s * 0.7, y);
        ctx.quadraticCurveTo(x, y, x, y - s * 0.2);
        ctx.quadraticCurveTo(x, y, x - s * 0.7, y);
        ctx.fill();
    };
    for (let i = 0; i < 70; i++) {
        const x = r() * w, y = r() * h, s = 5 + r() ** 2 * 28;
        softDot(ctx, x, y, s * 1.6, 'rgba(255,220,150,0.25)');
        sparkle(x, y, s, 0.6 + r() * 0.4);
    }
    for (let i = 0; i < 500; i++)
        softDot(ctx, r() * w, r() * h, 1 + r() * 2.5, 'rgba(255,235,190,0.8)');
}
function drawGroundFog(ctx, w, h, r) {
    for (let i = 0; i < 70; i++) {
        ctx.save();
        ctx.translate(r() * w, h * (0.72 + r() * 0.3));
        ctx.scale(1, 0.25);
        softDot(ctx, 0, 0, 180 + r() * 260, `rgba(225,225,230,${0.08 + r() * 0.1})`);
        ctx.restore();
    }
    const g = ctx.createLinearGradient(0, h, 0, h * 0.6);
    g.addColorStop(0, 'rgba(220,220,228,0.55)');
    g.addColorStop(1, 'rgba(220,220,228,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}
function drawCrackedGlass(ctx, w, h, r) {
    const cx = w * (0.3 + r() * 0.4), cy = h * (0.3 + r() * 0.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineCap = 'round';
    const rays = 18;
    for (let i = 0; i < rays; i++) {
        let a = (i / rays) * TAU + r() * 0.2, x = cx, y = cy;
        ctx.lineWidth = 1 + r() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const L = 300 + r() * 900;
        for (let d = 0; d < L; d += 25) {
            a += (r() - 0.5) * 0.25;
            x += Math.cos(a) * 25;
            y += Math.sin(a) * 25;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    for (let ring = 1; ring <= 4; ring++) {
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i <= rays; i++) {
            const a = (i / rays) * TAU, rr = ring * (45 + r() * 25);
            const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
    }
    softDot(ctx, cx, cy, 40, 'rgba(255,255,255,0.6)');
}
// ───────── السجل ─────────
// blend: وضع الدمج في Konva/Canvas (source-over | screen | multiply | overlay | soft-light)
const OVERLAY_GROUPS = [
    {
        id: 'weather',
        label: 'الطقس',
        items: [
            { id: 'rain', label: 'مطر', blend: 'screen', opacity: 0.6, draw: drawRain },
            { id: 'snow', label: 'ثلج', blend: 'screen', opacity: 0.7, draw: drawSnow },
            { id: 'dust', label: 'غبار', blend: 'screen', opacity: 0.55, draw: drawDust },
            { id: 'smoke', label: 'ضباب دخاني', blend: 'screen', opacity: 0.6, draw: drawSmokeFog },
            { id: 'clouds', label: 'غيوم', blend: 'screen', opacity: 0.55, draw: drawClouds },
            { id: 'embers', label: 'جمر متطاير', blend: 'screen', opacity: 0.7, draw: drawEmbers },
            { id: 'lightning', label: 'برق', blend: 'screen', opacity: 0.85, draw: drawLightning },
            { id: 'stars', label: 'سماء نجوم', blend: 'screen', opacity: 0.8, draw: drawStars },
            { id: 'flames', label: 'لهب', blend: 'screen', opacity: 0.7, draw: drawFlames },
            { id: 'groundfog', label: 'ضباب أرضي', blend: 'screen', opacity: 0.6, draw: drawGroundFog },
        ],
    },
    {
        id: 'texture',
        label: 'التكتشر',
        items: [
            { id: 'grain', label: 'حبيبات فيلم', blend: 'overlay', opacity: 0.35, draw: drawFilmGrain },
            { id: 'scratches', label: 'خدوش زجاج', blend: 'screen', opacity: 0.5, draw: drawGlassScratches },
            { id: 'stains', label: 'بقع', blend: 'multiply', opacity: 0.7, draw: drawStains },
            { id: 'burnt', label: 'ورق محروق', blend: 'source-over', opacity: 0.8, draw: drawBurntPaper },
            { id: 'concrete', label: 'جدار خرساني', blend: 'overlay', opacity: 0.45, draw: drawConcrete },
            { id: 'oldpaper', label: 'ورق قديم', blend: 'multiply', opacity: 0.6, draw: drawOldPaper },
            { id: 'grunge', label: 'تآكل (Grunge)', blend: 'multiply', opacity: 0.55, draw: drawGrunge },
            { id: 'halftone', label: 'نقاط طباعة', blend: 'multiply', opacity: 0.35, draw: drawHalftone },
            { id: 'cracked', label: 'زجاج مكسور', blend: 'screen', opacity: 0.55, draw: drawCrackedGlass },
        ],
    },
    {
        id: 'lighting',
        label: 'الإضاءة والظلال',
        items: [
            { id: 'vignette', label: 'تظليل الأطراف', blend: 'source-over', opacity: 0.8, draw: drawVignette },
            { id: 'leak', label: 'تسريب ضوئي', blend: 'screen', opacity: 0.45, draw: drawLightLeak },
            { id: 'rays', label: 'أشعة ضوء', blend: 'screen', opacity: 0.55, draw: drawLightRays },
            { id: 'window', label: 'ظل نافذة', blend: 'multiply', opacity: 0.6, draw: drawWindowShadow },
            { id: 'spotlight', label: 'بقعة ضوء', blend: 'source-over', opacity: 0.7, draw: drawSpotlight },
            { id: 'bokeh', label: 'بوكيه', blend: 'screen', opacity: 0.5, draw: drawBokeh },
            { id: 'flare', label: 'وهج عدسة', blend: 'screen', opacity: 0.6, draw: drawLensFlare },
            { id: 'sunburst', label: 'أشعة دائرية', blend: 'screen', opacity: 0.45, draw: drawSunburst },
            { id: 'sparkles', label: 'لمعان', blend: 'screen', opacity: 0.7, draw: drawSparkles },
        ],
    },
    {
        id: 'tactical',
        label: 'هندسية وتكتيكية',
        items: [
            { id: 'lines', label: 'خطوط عشوائية', blend: 'screen', opacity: 0.5, draw: drawRandomLines },
            { id: 'grid', label: 'شبكة إحداثيات', blend: 'screen', opacity: 0.55, draw: drawGrid },
            { id: 'glitch', label: 'تشويش رقمي', blend: 'screen', opacity: 0.6, draw: drawGlitch },
            { id: 'scanlines', label: 'خطوط مسح', blend: 'source-over', opacity: 0.5, draw: drawScanlines },
            { id: 'topo', label: 'خريطة طبوغرافية', blend: 'screen', opacity: 0.45, draw: drawTopographic },
        ],
    },
    {
        id: 'decor',
        label: 'زخارف وإطارات',
        items: [
            { id: 'islamic', label: 'زخارف إسلامية', blend: 'screen', opacity: 0.35, draw: drawIslamicPattern },
            { id: 'frame', label: 'إطار كلاسيكي', blend: 'source-over', opacity: 0.85, draw: drawClassicFrame },
            { id: 'thinframe', label: 'إطار رفيع', blend: 'source-over', opacity: 0.8, draw: drawThinFrame },
            { id: 'torn', label: 'حواف ممزقة', blend: 'source-over', opacity: 1, draw: drawTornEdges },
        ],
    },
];
const ALL_OVERLAYS = OVERLAY_GROUPS.flatMap((g) => g.items);
const canvasCache = new Map();
/** يولّد الطبقة مرة واحدة ويخزّنها — الاستدعاءات التالية فورية */
function getOverlayCanvas(id) {
    if (canvasCache.has(id))
        return canvasCache.get(id);
    const def = ALL_OVERLAYS.find((o) => o.id === id);
    if (!def)
        return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(COVER_W * OVERLAY_SCALE);
    canvas.height = Math.round(COVER_H * OVERLAY_SCALE);
    const ctx = canvas.getContext('2d', { willReadFrequently: id === 'concrete' });
    ctx.scale(OVERLAY_SCALE, OVERLAY_SCALE);
    const seed = [...id].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7);
    def.draw(ctx, COVER_W, COVER_H, rng(seed));
    canvasCache.set(id, canvas);
    return canvas;
}
function createDefaultLayerState() {
    const state = {};
    for (const o of ALL_OVERLAYS)
        state[o.id] = { enabled: false, opacity: o.opacity };
    state.vignette.enabled = true;
    state.grain.enabled = true;
    return state;
}
// ===== lib/textEffects.js =====
// ─────────────────────────────────────────────────────────────
// تأثيرات النص الاحترافية
// ─────────────────────────────────────────────────────────────
// كل تأثير = طبقات: under (خلف النص) + main (النص نفسه) + over (لمعة/إضاءة فوقه).
// الطبقات خصائص Konva.Text عادية، ويُرسم بها أيضاً معاينة مصغّرة في معرض التأثيرات.
const TEXT_EFFECTS = [
    { id: 'none', label: 'بدون', group: 'basic' },
    { id: 'cinematic', label: 'سينمائي', group: 'basic', needs: [] },
    { id: 'gold', label: 'ذهب فاخر', group: 'metal' },
    { id: 'goldFoil', label: 'رقائق ذهب', group: 'metal' },
    { id: 'chrome', label: 'كروم', group: 'metal' },
    { id: 'silver', label: 'فضّي', group: 'metal' },
    { id: 'bronze', label: 'نحاسي', group: 'metal' },
    { id: 'embossed', label: 'بارز', group: 'relief' },
    { id: 'engraved', label: 'محفور', group: 'relief' },
    { id: 'extrude', label: 'ثلاثي الأبعاد', group: 'relief', needs: ['color2'] },
    { id: 'longShadow', label: 'ظل طويل', group: 'relief' },
    { id: 'glow', label: 'توهّج ناعم', group: 'light', needs: ['glowColor'] },
    { id: 'neon', label: 'نيون', group: 'light', needs: ['glowColor'] },
    { id: 'fire', label: 'ناري', group: 'light' },
    { id: 'ice', label: 'جليدي', group: 'light' },
    { id: 'blood', label: 'رعب دموي', group: 'light' },
    { id: 'retro', label: 'ريترو', group: 'style', needs: ['color2'] },
    { id: 'glitch', label: 'تشويش رقمي', group: 'style' },
    { id: 'glass', label: 'زجاجي', group: 'style' },
    { id: 'gradient', label: 'تدرّج لوني', group: 'style', needs: ['color2'] },
    { id: 'outline', label: 'مفرّغ', group: 'style', needs: ['stroke'] },
    { id: 'double', label: 'حدّ مزدوج', group: 'style', needs: ['stroke', 'color2'] },
];
const EFFECT_GROUPS = [
    { id: 'basic', label: 'أساسي' },
    { id: 'metal', label: 'معادن' },
    { id: 'relief', label: 'عمق وبروز' },
    { id: 'light', label: 'ضوء' },
    { id: 'style', label: 'أنماط' },
];
/** التأثيرات التي تحتاج تدرّجاً لكل سطر على حدة حتى يبدو المعدن صحيحاً */
const PER_LINE_EFFECTS = new Set(['gold', 'goldFoil', 'chrome', 'silver', 'bronze', 'fire', 'ice', 'blood', 'gradient', 'cinematic', 'glass', 'embossed', 'engraved', 'extrude']);
const needsPerLine = (effect) => PER_LINE_EFFECTS.has(effect);
const TEXT_BACKGROUNDS = [
    { id: 'none', label: 'بدون' },
    { id: 'bars', label: 'شريط لكل سطر' },
    { id: 'box', label: 'صندوق' },
    { id: 'glass', label: 'زجاج مضبّب' },
    { id: 'fade', label: 'شريط متلاشٍ' },
    { id: 'brush', label: 'ضربة فرشاة' },
    { id: 'ribbon', label: 'شريط معقود' },
    { id: 'plaque', label: 'لوحة زخرفية' },
    { id: 'frame', label: 'إطار مزدوج' },
    { id: 'corners', label: 'زوايا' },
    { id: 'ornament', label: 'خطّان ومعيّن' },
    { id: 'pill', label: 'إطار بيضاوي' },
    { id: 'stamp', label: 'ختم دائري' },
    { id: 'torn', label: 'ورقة ممزقة' },
    { id: 'tag', label: 'لوحة معدنية' },
    { id: 'arch', label: 'قوس' },
    { id: 'halo', label: 'هالة ضوئية' },
    { id: 'underline', label: 'خط سفلي' },
];
const TEXT_EFFECT_DEFAULTS = {
    visible: true,
    letterSpacing: 0,
    secondColor: '',
    bg: 'none',
    bgColor: '#7a1c1c',
    bgOpacity: 0.85,
    bgPadding: 18,
    bgRadius: 4,
    bgStroke: '#d4af6a',
    effect: 'none',
    color2: '#9c7426',
    glowColor: '#d4af6a',
    strokeColor: '#000000',
    strokeWidth: 5,
    outlineOnly: false,
    // حدّ ملوّن حول النص (مستقل عن التأثير)
    ring: false,
    ringStyle: 'solid',
    ringColor: '#000000',
    ringWidth: 6,
    ring2: false,
    ring2Color: '#d4af6a',
    ring2Width: 4,
};
// ── أدوات الألوان ──
function hexRgb(hex) {
    let h = String(hex || '#000').replace('#', '');
    if (h.length === 3)
        h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a, b, t) {
    const A = hexRgb(a), B = hexRgb(b);
    const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
const lighten = (c, t) => mixHex(c, '#ffffff', t);
const darken = (c, t) => mixHex(c, '#000000', t);
function rgbaHex(hex, a) {
    const [r, g, b] = hexRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
}
const GOLD = [0, '#fff7d6', 0.2, '#f5d77e', 0.44, '#c28f2c', 0.5, '#7d5413', 0.56, '#d8a948', 0.78, '#f8e199', 1, '#946a20'];
const GOLD_FOIL = [0, '#8a6420', 0.12, '#f9e7a4', 0.24, '#b98b30', 0.38, '#fff3c4', 0.5, '#a8792a', 0.64, '#f1d27c', 0.8, '#946a22', 0.92, '#f6df98', 1, '#7a5418'];
const CHROME = [0, '#ffffff', 0.3, '#d6e6f5', 0.48, '#7ea6cc', 0.5, '#1a2433', 0.53, '#4a3a2a', 0.72, '#cdb391', 0.9, '#f5ead8', 1, '#ffffff'];
const SILVER = [0, '#ffffff', 0.28, '#dfe3e9', 0.48, '#8a909a', 0.52, '#5f656f', 0.6, '#eef1f5', 0.85, '#a7aeb8', 1, '#5b616a'];
const BRONZE = [0, '#ffe2c4', 0.25, '#e09a62', 0.48, '#8a4a22', 0.52, '#5a2a12', 0.6, '#c87a44', 0.85, '#f0b07a', 1, '#6a3618'];
/**
 * @param t خصائص النص
 * @param box { lh: ارتفاع السطر, lines: عدد الأسطر داخل هذه القطعة, w: عرض الصندوق }
 */
function buildTextLayers(t, box = {}) {
    const s = t.size || 60;
    const lh = box.lh || s * (t.lineHeight || 1.2);
    const nLines = box.lines || Math.max(1, String(t.text || '').split('\n').length);
    const w = box.w || t.width || 600;
    // حدود التدرّج: سطر واحد → حول جسم الحروف، عدة أسطر → كامل الكتلة
    const gTop = nLines === 1 ? lh / 2 - s * 0.52 : 0;
    const gBot = nLines === 1 ? lh / 2 + s * 0.46 : nLines * lh;
    const grad = (stops, diagonal) => ({
        fillPriority: 'linear-gradient',
        fillLinearGradientStartPoint: { x: diagonal ? w * 0.2 : 0, y: gTop },
        fillLinearGradientEndPoint: { x: diagonal ? w * 0.8 : 0, y: gBot },
        fillLinearGradientColorStops: stops,
    });
    const noShadow = { shadowEnabled: false };
    const dropShadow = t.shadow
        ? { shadowEnabled: true, shadowColor: '#000', shadowBlur: s * 0.45, shadowOpacity: 0.85, shadowOffsetX: 0, shadowOffsetY: s * 0.08 }
        : noShadow;
    const glowOf = (color, blur, extra = {}) => ({
        fill: color,
        shadowEnabled: true,
        shadowColor: color,
        shadowBlur: blur,
        shadowOpacity: 1,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        ...extra,
    });
    // لمعة علوية ناعمة فوق الحروف
    const gloss = (a = 0.5) => ({
        fillPriority: 'linear-gradient',
        fillLinearGradientStartPoint: { x: 0, y: gTop },
        fillLinearGradientEndPoint: { x: 0, y: gTop + (gBot - gTop) * 0.55 },
        fillLinearGradientColorStops: [0, `rgba(255,255,255,${a})`, 0.6, `rgba(255,255,255,${a * 0.25})`, 1, 'rgba(255,255,255,0)'],
        ...noShadow,
    });
    // قاعدة داكنة رفيعة تفصل المعدن عن الخلفية
    const metalBase = (edge) => ({
        fill: edge,
        stroke: edge,
        strokeWidth: Math.max(2, s * 0.05),
        lineJoin: 'round',
        dy: s * 0.015,
        ...(t.shadow
            ? { shadowEnabled: true, shadowColor: '#000', shadowBlur: s * 0.35, shadowOpacity: 0.9, shadowOffsetY: s * 0.07, shadowOffsetX: 0 }
            : { shadowEnabled: true, shadowColor: '#000', shadowBlur: s * 0.12, shadowOpacity: 0.6, shadowOffsetY: s * 0.03, shadowOffsetX: 0 }),
    });
    const metal = (stops, edge, diagonal) => ({
        under: [metalBase(edge)],
        main: { ...grad(stops, diagonal), stroke: lighten(edge, 0.35), strokeWidth: Math.max(0.8, s * 0.008), ...noShadow },
        over: [gloss(0.38)],
    });
    switch (t.effect) {
        case 'gold':
            return metal(GOLD, '#3d2706');
        case 'goldFoil':
            return metal(GOLD_FOIL, '#3a2405', true);
        case 'chrome':
            return metal(CHROME, '#0d131c');
        case 'silver':
            return metal(SILVER, '#1f2329');
        case 'bronze':
            return metal(BRONZE, '#2a1206');
        case 'cinematic':
            return {
                under: [
                    glowOf(rgbaHex(t.color, 0.55), s * 0.9, { fill: rgbaHex(t.color, 0.35) }),
                    { fill: '#000', shadowEnabled: true, shadowColor: '#000', shadowBlur: s * 0.5, shadowOpacity: 0.9, shadowOffsetY: s * 0.1, shadowOffsetX: 0, opacity: 0.9 },
                ],
                main: { ...grad([0, lighten(t.color, 0.55), 0.5, t.color, 1, darken(t.color, 0.3)]), ...noShadow },
                over: [gloss(0.18)],
            };
        case 'embossed': {
            const d = Math.max(1.5, s * 0.025);
            return {
                under: [
                    { fill: 'rgba(0,0,0,0.65)', dx: d, dy: d, shadowEnabled: true, shadowColor: '#000', shadowBlur: d * 3, shadowOpacity: 0.6 },
                    { fill: rgbaHex(lighten(t.color, 0.7), 0.85), dx: -d * 0.7, dy: -d * 0.7 },
                ],
                main: { ...grad([0, lighten(t.color, 0.2), 1, darken(t.color, 0.15)]), ...noShadow },
                over: [gloss(0.25)],
            };
        }
        case 'engraved': {
            const d = Math.max(1.5, s * 0.022);
            return {
                under: [{ fill: 'rgba(255,255,255,0.32)', dy: d, dx: d * 0.3 }],
                main: { ...grad([0, darken(t.color, 0.45), 0.45, darken(t.color, 0.1), 1, t.color]), ...noShadow },
                over: [
                    {
                        fillPriority: 'linear-gradient',
                        fillLinearGradientStartPoint: { x: 0, y: gTop },
                        fillLinearGradientEndPoint: { x: 0, y: gTop + (gBot - gTop) * 0.4 },
                        fillLinearGradientColorStops: [0, 'rgba(0,0,0,0.55)', 1, 'rgba(0,0,0,0)'],
                        ...noShadow,
                    },
                ],
            };
        }
        case 'extrude': {
            const depth = Math.max(5, s * 0.1);
            const steps = 14;
            const under = [];
            for (let i = steps; i >= 1; i--) {
                const k = i / steps;
                under.push({
                    fill: mixHex(t.color2, '#000000', 0.15 + k * 0.45),
                    dx: depth * k * 0.6,
                    dy: depth * k,
                    ...(i === steps
                        ? { shadowEnabled: true, shadowColor: '#000', shadowBlur: depth * 2.4, shadowOpacity: 0.85, shadowOffsetY: depth * 0.8, shadowOffsetX: depth * 0.3 }
                        : noShadow),
                });
            }
            return {
                under,
                main: { ...grad([0, lighten(t.color, 0.35), 1, t.color]), stroke: lighten(t.color, 0.6), strokeWidth: Math.max(1, s * 0.01), ...noShadow },
                over: [gloss(0.3)],
            };
        }
        case 'longShadow': {
            const n = 26;
            const len = s * 0.9;
            const under = [];
            for (let i = n; i >= 1; i--)
                under.push({ fill: `rgba(0,0,0,${0.09 * (1 - i / (n + 4))})`, dx: (len * i) / n, dy: (len * i) / n });
            return { under, main: { fill: t.color, ...noShadow }, over: [] };
        }
        case 'glow':
            return {
                under: [
                    glowOf(t.glowColor, s * 1.2, { opacity: 0.55 }),
                    glowOf(t.glowColor, s * 0.5, { opacity: 0.8 }),
                ],
                main: { fill: t.color, shadowEnabled: true, shadowColor: t.glowColor, shadowBlur: s * 0.15, shadowOpacity: 1, shadowOffsetX: 0, shadowOffsetY: 0 },
                over: [],
            };
        case 'neon': {
            const g = t.glowColor;
            return {
                under: [
                    { fill: 'rgba(0,0,0,0)', stroke: g, strokeWidth: Math.max(3, s * 0.09), lineJoin: 'round', shadowEnabled: true, shadowColor: g, shadowBlur: s * 1.3, shadowOpacity: 1, opacity: 0.55 },
                    { fill: 'rgba(0,0,0,0)', stroke: g, strokeWidth: Math.max(2, s * 0.05), lineJoin: 'round', shadowEnabled: true, shadowColor: g, shadowBlur: s * 0.45, shadowOpacity: 1 },
                ],
                main: { fill: lighten(g, 0.82), stroke: lighten(g, 0.35), strokeWidth: Math.max(1, s * 0.018), lineJoin: 'round', shadowEnabled: true, shadowColor: g, shadowBlur: s * 0.12, shadowOpacity: 1, shadowOffsetX: 0, shadowOffsetY: 0 },
                over: [],
            };
        }
        case 'fire':
            return {
                under: [glowOf('#ff3c00', s * 1.1, { opacity: 0.6, dy: -s * 0.05 }), glowOf('#ff9a00', s * 0.4, { opacity: 0.85 })],
                main: { ...grad([0, '#fff8c8', 0.35, '#ffd447', 0.65, '#ff7a00', 1, '#c41e00']), ...noShadow },
                over: [gloss(0.2)],
            };
        case 'ice':
            return {
                under: [
                    { fill: '#04121c', stroke: '#04121c', strokeWidth: Math.max(2, s * 0.04), lineJoin: 'round', shadowEnabled: true, shadowColor: '#000', shadowBlur: s * 0.3, shadowOpacity: 0.7, shadowOffsetY: s * 0.05 },
                    glowOf('#7fdcff', s * 0.5, { opacity: 0.7 }),
                ],
                main: { ...grad([0, '#ffffff', 0.45, '#cdf3ff', 0.55, '#8fd6f5', 1, '#3d8fc4']), stroke: '#f2fcff', strokeWidth: Math.max(1, s * 0.01), ...noShadow },
                over: [gloss(0.45)],
            };
        case 'blood':
            return {
                under: [
                    { fill: '#000', shadowEnabled: true, shadowColor: '#000', shadowBlur: s * 0.4, shadowOpacity: 1, shadowOffsetY: s * 0.06, shadowOffsetX: 0 },
                    glowOf('#8a0000', s * 0.7, { opacity: 0.6 }),
                ],
                main: { ...grad([0, '#ff7060', 0.4, '#d81b1b', 1, '#5c0000']), stroke: '#1a0000', strokeWidth: Math.max(1, s * 0.012), ...noShadow },
                over: [gloss(0.15)],
            };
        case 'retro': {
            const o = s * 0.065;
            return {
                under: [
                    { fill: '#111', stroke: '#111', strokeWidth: Math.max(2, s * 0.04), lineJoin: 'round', dx: o, dy: o },
                    { fill: t.color2, stroke: t.color2, strokeWidth: Math.max(2, s * 0.03), lineJoin: 'round', dx: o, dy: o },
                    { fill: '#111', stroke: '#111', strokeWidth: Math.max(2, s * 0.045), lineJoin: 'round' },
                ],
                main: { fill: t.color, ...noShadow },
                over: [],
            };
        }
        case 'glitch': {
            const o = Math.max(2, s * 0.035);
            return {
                under: [
                    { fill: '#00e5ff', dx: -o, dy: -o * 0.3, opacity: 0.9 },
                    { fill: '#ff2a6d', dx: o, dy: o * 0.3, opacity: 0.9 },
                ],
                main: { fill: t.color, ...dropShadow },
                over: [],
            };
        }
        case 'glass':
            return {
                under: [{ fill: 'rgba(0,0,0,0.35)', shadowEnabled: true, shadowColor: '#000', shadowBlur: s * 0.3, shadowOpacity: 0.7, shadowOffsetY: s * 0.05, shadowOffsetX: 0, opacity: 0.8 }],
                main: { ...grad([0, rgbaHex(t.color, 0.55), 1, rgbaHex(t.color, 0.15)]), stroke: 'rgba(255,255,255,0.85)', strokeWidth: Math.max(1, s * 0.014), ...noShadow },
                over: [gloss(0.55)],
            };
        case 'double':
            return {
                under: [{ fill: t.color2, stroke: t.color2, strokeWidth: t.strokeWidth * 3.4, lineJoin: 'round', ...dropShadow }],
                main: { fill: t.color, stroke: t.strokeColor, strokeWidth: t.strokeWidth, fillAfterStrokeEnabled: true, lineJoin: 'round' },
                over: [],
            };
        case 'gradient':
            return { under: [], main: { ...grad([0, t.color, 1, t.color2]), ...dropShadow }, over: [] };
        case 'outline':
            return {
                under: [],
                main: {
                    fill: t.outlineOnly ? 'rgba(0,0,0,0)' : t.color,
                    stroke: t.strokeColor,
                    strokeWidth: t.strokeWidth,
                    fillAfterStrokeEnabled: !t.outlineOnly,
                    lineJoin: 'round',
                    ...dropShadow,
                },
                over: [],
            };
        default:
            return { under: [], main: { fill: t.color, ...dropShadow }, over: [] };
    }
}
/** الحدّ الملوّن حول النص — يُرسم خلف كل شيء ويعمل مع أي تأثير */
function buildRingLayers(t) {
    const out = [];
    if (!t.ring)
        return out;
    const w1 = Math.max(1, t.ringWidth || 6);
    const soft = t.ringStyle === 'soft';
    if (t.ring2) {
        const w2 = w1 + Math.max(1, t.ring2Width || 4);
        out.push({
            fill: t.ring2Color,
            stroke: t.ring2Color,
            strokeWidth: w2 * 2,
            lineJoin: 'round',
            ...(soft ? { shadowEnabled: true, shadowColor: t.ring2Color, shadowBlur: w2 * 1.5, shadowOpacity: 1, shadowOffsetX: 0, shadowOffsetY: 0 } : { shadowEnabled: false }),
        });
    }
    out.push({
        fill: t.ringColor,
        stroke: t.ringColor,
        strokeWidth: w1 * 2,
        lineJoin: 'round',
        ...(soft ? { shadowEnabled: true, shadowColor: t.ringColor, shadowBlur: w1 * 2, shadowOpacity: 1, shadowOffsetX: 0, shadowOffsetY: 0 } : { shadowEnabled: false }),
    });
    return out;
}
// ─────────────────────────────────────────────
// معاينة مصغّرة لأي تأثير بلوحة 2D عادية (لمعرض التأثيرات)
// ─────────────────────────────────────────────
function paintLayer(ctx, L, text, cx, top, lh, boxX) {
    if (L.opacity === 0)
        return;
    ctx.save();
    ctx.globalAlpha = L.opacity ?? 1;
    const x = cx + (L.dx || 0);
    const y = top + lh / 2 + (L.dy || 0);
    let fill = L.fill;
    if (L.fillPriority === 'linear-gradient' && L.fillLinearGradientColorStops) {
        const a = L.fillLinearGradientStartPoint, b = L.fillLinearGradientEndPoint;
        const g = ctx.createLinearGradient(boxX + a.x + (L.dx || 0), top + a.y + (L.dy || 0), boxX + b.x + (L.dx || 0), top + b.y + (L.dy || 0));
        const st = L.fillLinearGradientColorStops;
        for (let i = 0; i < st.length; i += 2)
            g.addColorStop(st[i], st[i + 1]);
        fill = g;
    }
    if (L.shadowEnabled) {
        ctx.shadowColor = L.shadowColor || '#000';
        ctx.shadowBlur = L.shadowBlur || 0;
        ctx.shadowOffsetX = L.shadowOffsetX || 0;
        ctx.shadowOffsetY = L.shadowOffsetY || 0;
    }
    ctx.lineJoin = L.lineJoin || 'miter';
    const doStroke = () => {
        if (L.stroke && L.strokeWidth) {
            ctx.strokeStyle = L.stroke;
            ctx.lineWidth = L.strokeWidth;
            ctx.strokeText(text, x, y);
        }
    };
    if (L.fillAfterStrokeEnabled)
        doStroke();
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fillText(text, x, y);
    }
    if (!L.fillAfterStrokeEnabled) {
        ctx.shadowColor = 'transparent';
        doStroke();
    }
    ctx.restore();
}
function paintEffectPreview(canvas, t, text) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const size = Math.round(H * 0.5);
    const tt = { ...TEXT_EFFECT_DEFAULTS, ...t, size, lineHeight: 1.2, width: W, text };
    const lh = size * 1.2;
    const top = (H - lh) / 2;
    ctx.font = `${t.weight || 700} ${size}px "${t.font}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    const { under, main, over } = buildTextLayers(tt, { lh, lines: 1, w: W });
    [...buildRingLayers(tt), ...under, main, ...over].forEach((L) => paintLayer(ctx, L, text, W / 2, top, lh, 0));
}
// ===== lib/imageFilters.js =====
// ─────────────────────────────────────────────────────────────
// مرشحات الصور المفرَّغة (Konva Filters)
// ─────────────────────────────────────────────────────────────
const FILTER_PRESETS = [
    { id: 'none', label: 'بدون' },
    { id: 'bw', label: 'أبيض وأسود' },
    { id: 'cinematic', label: 'تباين سينمائي' },
    { id: 'sepia', label: 'بنّي قديم' },
    { id: 'warm', label: 'دافئ' },
    { id: 'cold', label: 'بارد' },
    { id: 'mosaic', label: 'فسيفساء' },
];
const DEFAULT_FX = { preset: 'none', brightness: 0, contrast: 0, saturation: 0, tint: 0, tintColor: '#d4af6a', pixelSize: 0, blur: 0 };
function buildImageFilters(fx) {
    if (!fx)
        return { filters: [], attrs: {} };
    const filters = [];
    const attrs = {};
    let { brightness = 0, contrast = 0, saturation = 0, tint = 0, tintColor = '#d4af6a' } = fx;
    switch (fx.preset) {
        case 'bw':
            filters.push(Konva.Filters.Grayscale);
            break;
        case 'sepia':
            filters.push(Konva.Filters.Sepia);
            break;
        case 'cinematic':
            contrast += 30;
            saturation -= 0.6;
            brightness -= 0.04;
            break;
        case 'warm':
            if (!tint) {
                tint = 0.18;
                tintColor = '#ff9a3c';
            }
            break;
        case 'cold':
            if (!tint) {
                tint = 0.18;
                tintColor = '#3c8cff';
            }
            break;
        default:
    }
    if (brightness) {
        filters.push(Konva.Filters.Brighten);
        attrs.brightness = brightness;
    }
    if (contrast) {
        filters.push(Konva.Filters.Contrast);
        attrs.contrast = contrast;
    }
    if (saturation && fx.preset !== 'bw') {
        filters.push(Konva.Filters.HSL);
        Object.assign(attrs, { saturation, hue: 0, luminance: 0 });
    }
    if (tint > 0) {
        // دمج لون (مثل لون الخلفية) فوق الصورة حتى تبدو جزءاً من المشهد
        const { r, g, b } = hexToRgb(tintColor);
        filters.push(Konva.Filters.RGBA);
        Object.assign(attrs, { red: r, green: g, blue: b, alpha: tint });
    }
    const pixel = fx.pixelSize || (fx.preset === 'mosaic' ? 12 : 0);
    if (pixel > 1) {
        filters.push(Konva.Filters.Pixelate);
        attrs.pixelSize = pixel;
    }
    if (fx.blur > 0) {
        filters.push(Konva.Filters.Blur);
        attrs.blurRadius = fx.blur;
    }
    return { filters, attrs };
}
// ===== lib/templates.js =====
// ─────────────────────────────────────────────────────────────
// قوالب جاهزة حسب التصنيف — نقرة واحدة تضبط الخطوط والألوان والطبقات
// (تحتفظ بنصوص المستخدم وصوره وشعاره)
// ─────────────────────────────────────────────────────────────
const TEMPLATE_CATEGORIES = [
    { id: 'all', label: 'الكل' },
    { id: 'horror', label: 'رعب' },
    { id: 'history', label: 'تاريخ' },
    { id: 'religious', label: 'ديني' },
    { id: 'selfdev', label: 'تطوير ذات' },
    { id: 'kids', label: 'أطفال' },
    { id: 'essay', label: 'مقالات وفكر' },
    { id: 'novel', label: 'روايات' },
    { id: 'poetry', label: 'شعر وأدب' },
    { id: 'security', label: 'أمني وعسكري' },
    { id: 'research', label: 'أبحاث وعلوم' },
];
const TEMPLATES = [
    // ── رعب ──
    {
        id: 'horror-whisper', category: 'horror', name: 'همس الظلام', sample: 'همس الظلام',
        paletteId: 'burgundy',
        title: { font: 'Reem Kufi', weight: 700, size: 140, color: '#e6ddd0', effect: 'glow', glowColor: '#b3001b', y: 140, shadow: false },
        subtitle: { font: 'Tajawal', weight: 400, size: 42, color: '#a1968a', y: 1270 },
        layers: { vignette: 0.9, grain: 0.4, smoke: 0.5, scratches: 0.4 },
    },
    {
        id: 'horror-house', category: 'horror', name: 'المنزل الأخير', sample: 'المنزل الأخير',
        paletteId: 'ink-night',
        title: { font: 'Lalezar', weight: 400, size: 150, color: '#ebe4d8', effect: 'outline', strokeColor: '#5c0b0b', strokeWidth: 7, y: 150, shadow: true },
        subtitle: { font: 'Cairo', weight: 400, size: 40, color: '#9a948b', y: 1280 },
        layers: { rain: 0.55, vignette: 0.85, grain: 0.35, window: 0.5 },
        textAboveLayers: true,
    },
    // ── تاريخ ──
    {
        id: 'history-kingdoms', category: 'history', name: 'سجلّ الممالك', sample: 'سجلّ الممالك',
        paletteId: 'old-copper',
        title: { font: 'Aref Ruqaa', weight: 700, size: 135, effect: 'gold', y: 150, shadow: true },
        subtitle: { font: 'Amiri', weight: 400, size: 46, color: '#dcc79c', y: 1240 },
        layers: { burnt: 0.6, stains: 0.5, vignette: 0.7, frame: 0.8 },
    },
    {
        id: 'history-siege', category: 'history', name: 'الحصار', sample: 'الحصار',
        paletteId: 'sand-fog',
        title: { font: 'Amiri', weight: 700, size: 160, color: '#2b2218', effect: 'engraved', y: 160, shadow: false },
        subtitle: { font: 'Almarai', weight: 700, size: 40, color: '#2e261c', y: 1270, shadow: false },
        layers: { concrete: 0.45, dust: 0.5, vignette: 0.6, topo: 0.3 },
    },
    // ── ديني ──
    {
        id: 'religious-noor', category: 'religious', name: 'نور اليقين', sample: 'نور اليقين',
        paletteId: 'moss',
        title: { font: 'Aref Ruqaa', weight: 700, size: 140, effect: 'gold', y: 170, shadow: true },
        subtitle: { font: 'Amiri', weight: 400, size: 46, color: '#e3d3a8', y: 1230 },
        layers: { islamic: 0.3, frame: 0.85, vignette: 0.6, rays: 0.4 },
    },
    {
        id: 'religious-madarij', category: 'religious', name: 'مدارج', sample: 'مدارج السالكين',
        paletteId: 'charcoal-gold',
        title: { font: 'Amiri', weight: 700, size: 130, color: '#f2e5c2', effect: 'glow', glowColor: '#d4af6a', y: 180, shadow: false },
        subtitle: { font: 'Tajawal', weight: 500, size: 42, color: '#cbb78c', y: 1250 },
        layers: { islamic: 0.22, leak: 0.25, vignette: 0.75, grain: 0.2 },
    },
    // ── تطوير ذات ──
    {
        id: 'selfdev-start', category: 'selfdev', name: 'ابدأ الآن', sample: 'ابدأ الآن',
        paletteId: 'steel-blue',
        title: { font: 'Cairo', weight: 900, size: 160, color: '#ffffff', color2: '#d4af6a', effect: 'gradient', y: 160, shadow: true },
        subtitle: { font: 'Tajawal', weight: 500, size: 44, color: '#c9d4df', y: 1260 },
        layers: { rays: 0.35, grain: 0.2, vignette: 0.5 },
    },
    {
        id: 'selfdev-habits', category: 'selfdev', name: 'عادات النخبة', sample: 'عادات النخبة',
        paletteId: 'slate',
        title: { font: 'Almarai', weight: 800, size: 135, color: '#f5efe3', effect: 'none', y: 170, shadow: true },
        subtitle: { font: 'Almarai', weight: 400, size: 40, color: '#b9b5ae', y: 1270 },
        layers: { lines: 0.3, grid: 0.25, vignette: 0.5 },
    },
    // ── أطفال ──
    {
        id: 'kids-adventure', category: 'kids', name: 'مغامرات سنان', sample: 'مغامرات سنان',
        customPalette: { name: 'سماء مرحة', type: 'radial', colors: ['#2f7fd1', '#86d6ff', '#1b4f9a'] },
        title: { font: 'Lalezar', weight: 400, size: 150, color: '#fff6d5', effect: 'outline', strokeColor: '#e0562b', strokeWidth: 12, y: 130, shadow: true },
        subtitle: { font: 'Cairo', weight: 700, size: 44, color: '#ffffff', y: 1280 },
        layers: { vignette: 0.2 },
        textAboveLayers: true,
    },
    {
        id: 'kids-garden', category: 'kids', name: 'حديقة الألوان', sample: 'حديقة الألوان',
        customPalette: { name: 'ربيع', type: 'linear', colors: ['#3fae6a', '#a6e891', '#1f6e45'] },
        title: { font: 'Reem Kufi', weight: 700, size: 140, color: '#fff27a', color2: '#ff8a3d', effect: 'gradient', y: 140, shadow: true },
        subtitle: { font: 'Cairo', weight: 700, size: 44, color: '#fffbe8', y: 1280 },
        layers: { leak: 0.25 },
        textAboveLayers: true,
    },
    // ── مستوحاة من أنماط التصميم: لوحة خلف العنوان، أشرطة ملونة، محراب، حواف ممزقة، إطار رفيع ──
    {
        id: 'plaque-violet', category: 'essay', name: 'اللوحة الزخرفية', sample: 'دروب المعرفة',
        customPalette: { name: 'بنفسجي ملكي', type: 'linear', colors: ['#3b1d8f', '#5a34c4', '#1c0d4d'] },
        title: { font: 'Amiri', weight: 700, size: 104, color: '#ece7de', effect: 'engraved', bg: 'plaque', bgColor: '#a08a5c', bgStroke: '#6a55b5', bgOpacity: 1, bgPadding: 34, y: 230, width: 820, shadow: false },
        subtitle: { font: 'Amiri', weight: 700, size: 58, color: '#c9a86a', y: 470, shadow: true },
        publisher: { visible: true, y: 70, size: 30, color: '#d8d2e8' },
        date: { visible: true, color: '#d8c79f' },
        layers: { grain: 0.3, stains: 0.35, vignette: 0.45 },
    },
    {
        id: 'bars-dark', category: 'essay', name: 'الأشرطة الملونة', sample: 'ذاكرة المدن',
        paletteId: 'ink-night',
        title: { font: 'Cairo', weight: 700, size: 92, color: '#8fe0cf', bg: 'bars', bgColor: '#8a2323', bgOpacity: 0.88, bgPadding: 16, bgRadius: 0, y: 220, effect: 'none', shadow: false },
        subtitle: { font: 'Cairo', weight: 700, size: 36, color: '#ffffff', bg: 'box', bgColor: '#2c7a5e', bgOpacity: 1, bgPadding: 10, y: 470 },
        publisher: { visible: true },
        date: { visible: true },
        layers: { torn: 1, vignette: 0.6, smoke: 0.4, grain: 0.3 },
        textAboveLayers: false,
    },
    {
        id: 'mihrab-blue', category: 'religious', name: 'إطار المحراب', sample: 'سيرة الأعلام',
        customPalette: { name: 'سماء زرقاء', type: 'radial', colors: ['#16488f', '#4f8fd6', '#0a2350'] },
        title: { font: 'Aref Ruqaa', weight: 700, size: 150, color: '#c8102e', effect: 'outline', strokeColor: '#ffffff', strokeWidth: 5, bg: 'halo', bgColor: '#ffffff', bgOpacity: 0.55, bgPadding: 30, y: 80, shadow: true },
        subtitle: { font: 'Aref Ruqaa', weight: 700, size: 64, color: '#ffffff', effect: 'outline', strokeColor: '#000000', strokeWidth: 4, y: 1180, shadow: true },
        publisher: { visible: true, x: 150, y: 1370, width: 240, color: '#ffffff' },
        date: { visible: true, x: 860, color: '#ffffff' },
        imageStyle: { fadeBottom: 0.25, backdrop: { shape: 'mihrab', color: '#c8102e', opacity: 0.9, width: 0.95, height: 1.1, offsetY: -0.06, fade: 0.3, pattern: 0.35 } },
        layers: { vignette: 0.45 },
        textAboveLayers: true,
    },
    {
        id: 'torn-twotone', category: 'essay', name: 'سطران بلونين', sample: 'أسرار القلوب\nفي زمن الفتن',
        paletteId: 'charcoal-gold',
        title: { font: 'Cairo', weight: 900, size: 110, color: '#f2efe9', secondColor: '#4fb08c', effect: 'none', y: 200, shadow: true, lineHeight: 1.25 },
        subtitle: { font: 'Tajawal', weight: 700, size: 40, color: '#cfc8bb', y: 520 },
        publisher: { visible: true },
        date: { visible: true },
        layers: { torn: 1, grain: 0.35, vignette: 0.7, smoke: 0.3 },
    },
    {
        id: 'thin-frame-green', category: 'essay', name: 'الإطار الرفيع', sample: 'تأملات في الفكر',
        customPalette: { name: 'أخضر داكن', type: 'linear', colors: ['#1d3b30', '#2a4d3f', '#0e1f18'] },
        title: { font: 'Reem Kufi', weight: 700, size: 120, color: '#cdb79c', effect: 'none', y: 200, shadow: true },
        subtitle: { font: 'Tajawal', weight: 500, size: 48, color: '#c7c2b8', y: 360 },
        tag: { visible: true, text: 'مقال' },
        publisher: { visible: false },
        layers: { thinframe: 0.8, concrete: 0.35, grain: 0.3 },
    },
    {
        id: 'pill-gold', category: 'essay', name: 'الإطار البيضاوي', sample: 'تعليقات ولفتات',
        paletteId: 'charcoal-gold',
        title: { font: 'Cairo', weight: 700, size: 70, color: '#d9b26a', bg: 'pill', bgStroke: '#b8914a', bgColor: '#000000', bgOpacity: 1, bgPadding: 24, y: 250, effect: 'none', shadow: true },
        subtitle: { font: 'Lalezar', weight: 400, size: 80, color: '#f0ede8', y: 400, shadow: true, effect: 'glow', glowColor: '#ffffff' },
        publisher: { visible: true },
        date: { visible: true },
        layers: { torn: 1, vignette: 0.8, grain: 0.3 },
    },
    // ── قوالب سينمائية ──
    {
        id: 'cinema-teal', category: 'horror', name: 'ملصق سينمائي', sample: 'الليلة الأخيرة',
        paletteId: 'steel-blue',
        title: { font: 'Lalezar', weight: 400, size: 160, color: '#f4efe6', color2: '#7a1d10', effect: 'extrude', y: 120, shadow: false },
        subtitle: { font: 'Cairo', weight: 700, size: 42, color: '#e6d9c4', y: 1290, shadow: true },
        layers: { smoke: 0.5, embers: 0.6, vignette: 0.8, grain: 0.3 },
        grade: 'tealOrange', gradeAmount: 0.7,
        textAboveLayers: true,
    },
    {
        id: 'neon-noir', category: 'horror', name: 'نيون الليل', sample: 'مدينة بلا نوم',
        paletteId: 'night-violet',
        title: { font: 'Reem Kufi', weight: 700, size: 140, color: '#fff3f8', glowColor: '#ff2d75', effect: 'neon', y: 160, shadow: false },
        subtitle: { font: 'Tajawal', weight: 500, size: 42, color: '#c9b8e8', y: 1280 },
        layers: { rain: 0.5, bokeh: 0.5, vignette: 0.7, grain: 0.25 },
        grade: 'cold', gradeAmount: 0.45,
        textAboveLayers: true,
    },
    {
        id: 'silver-history', category: 'history', name: 'الفضّي العريق', sample: 'تاريخ الأندلس',
        paletteId: 'slate',
        title: { font: 'Amiri', weight: 700, size: 150, effect: 'silver', y: 150, shadow: true },
        subtitle: { font: 'Amiri', weight: 400, size: 46, color: '#d9dde3', y: 1250 },
        layers: { clouds: 0.4, spotlight: 0.5, grain: 0.3, frame: 0.6 },
        grade: 'bleach', gradeAmount: 0.5,
    },
    {
        id: 'double-kids', category: 'kids', name: 'المغامر الصغير', sample: 'رحلة إلى القمر',
        customPalette: { name: 'ليل مرح', type: 'radial', colors: ['#24307a', '#4a63d6', '#141b4d'] },
        title: { font: 'Lalezar', weight: 400, size: 150, color: '#ffe04a', strokeColor: '#c2410c', color2: '#ffffff', strokeWidth: 6, effect: 'double', y: 120, shadow: true },
        subtitle: { font: 'Cairo', weight: 700, size: 44, color: '#ffffff', y: 1290 },
        layers: { bokeh: 0.45, flare: 0.4 },
        textAboveLayers: true,
    },
    // ── الإصدار 6: خطوط جديدة + زخارف + مؤثرات ──
    {
        id: 'gilded-quran', category: 'religious', name: 'المذهّب', sample: 'رياض الصالحين',
        customPalette: { name: 'أخضر ملكي', type: 'radial', colors: ['#0b2a20', '#14513d', '#04140e'] },
        title: { font: 'Amiri Quran', weight: 400, size: 128, effect: 'gold', y: 210, shadow: true },
        subtitle: { font: 'Scheherazade New', weight: 700, size: 50, color: '#e8d9a8', y: 1180 },
        shapes: [
            { kind: 'ornateFrame', x: 500, y: 750, width: 840, height: 1340, stroke: '#d4af6a', strokeWidth: 3, fill: '#d4af6a' },
            { kind: 'starDivider', x: 500, y: 430, width: 520, height: 56 },
            { kind: 'rosette', x: 500, y: 800, width: 380, height: 380, opacity: 0.35, behind: true },
        ],
        layers: { islamic: 0.18, vignette: 0.6, grain: 0.2 },
        grade: 'warm', gradeAmount: 0.3,
    },
    {
        id: 'mihrab-gold', category: 'religious', name: 'أنوار المحراب', sample: 'أنوار الهدى',
        paletteId: 'moss',
        title: { font: 'Reem Kufi Ink', weight: 400, size: 140, color: '#f5e6b8', effect: 'glow', glowColor: '#d4af6a', y: 140, shadow: false },
        subtitle: { font: 'El Messiri', weight: 700, size: 44, color: '#e9dcb8', y: 1290 },
        shapes: [
            { kind: 'mihrabFrame', x: 500, y: 820, width: 620, height: 900, strokeWidth: 5 },
            { kind: 'star8', x: 500, y: 400, width: 90, height: 90 },
        ],
        layers: { rays: 0.45, islamic: 0.18, vignette: 0.6 },
    },
    {
        id: 'nastaliq-poetry', category: 'poetry', name: 'ديوان النستعليق', sample: 'قصائد الحنين',
        paletteId: 'night-violet',
        title: { font: 'Noto Nastaliq Urdu', weight: 700, size: 104, color: '#f3e6c8', effect: 'glow', glowColor: '#c9a2ff', y: 200, shadow: false, lineHeight: 1.6 },
        subtitle: { font: 'Markazi Text', weight: 400, size: 48, color: '#d9cfe8', y: 1280 },
        shapes: [
            { kind: 'flourish', x: 500, y: 520, width: 520, height: 90, fill: '#f3e6c8', stroke: '#f3e6c8' },
            { kind: 'crescent', x: 770, y: 1000, width: 220, height: 220, fill: '#f3e6c8', opacity: 0.85, rotation: -30 },
        ],
        layers: { stars: 0.8, groundfog: 0.4, vignette: 0.6 },
        textAboveLayers: true,
    },
    {
        id: 'poetry-night', category: 'poetry', name: 'هلال الغربة', sample: 'قصائد الغربة',
        paletteId: 'night-dunes',
        title: { font: 'Gulzar', weight: 400, size: 128, color: '#f0dfb5', effect: 'none', y: 560, shadow: true },
        subtitle: { font: 'Amiri', weight: 400, size: 46, color: '#e2d2ad', y: 1290 },
        shapes: [
            { kind: 'crescent', x: 300, y: 320, width: 200, height: 200, fill: '#f0dfb5', rotation: 20 },
            { kind: 'flourish', x: 500, y: 830, width: 460, height: 80, fill: '#f0dfb5', stroke: '#f0dfb5' },
        ],
        layers: { stars: 0.8, groundfog: 0.5, vignette: 0.5 },
        textAboveLayers: true,
    },
    {
        id: 'lightning-horror', category: 'horror', name: 'ليلة العاصفة', sample: 'ليلة العاصفة',
        paletteId: 'ink-night',
        title: { font: 'Blaka', weight: 400, size: 170, color: '#e6e9f5', effect: 'glow', glowColor: '#7f9cff', y: 130, shadow: false },
        subtitle: { font: 'Changa', weight: 700, size: 42, color: '#b8c2e0', y: 1290 },
        layers: { lightning: 0.9, rain: 0.6, vignette: 0.8, groundfog: 0.4 },
        grade: 'cold', gradeAmount: 0.5,
        textAboveLayers: true,
    },
    {
        id: 'jomhuria-poster', category: 'novel', name: 'المطاردة', sample: 'المطاردة',
        paletteId: 'burgundy',
        title: { font: 'Jomhuria', weight: 400, size: 240, color: '#f4efe6', color2: '#2a0508', effect: 'extrude', y: 90, shadow: false, lineHeight: 0.95 },
        subtitle: { font: 'Changa', weight: 700, size: 44, color: '#f0d6d6', y: 1290 },
        layers: { spotlight: 0.6, grain: 0.35, cracked: 0.4 },
        grade: 'crimson', gradeAmount: 0.5,
        textAboveLayers: true,
    },
    {
        id: 'neon-scifi', category: 'novel', name: 'مدار الصفر', sample: 'مدار الصفر',
        paletteId: 'steel-blue',
        title: { font: 'Changa', weight: 800, size: 140, color: '#eafcff', glowColor: '#00e5ff', effect: 'neon', y: 150, shadow: false },
        subtitle: { font: 'Readex Pro', weight: 400, size: 42, color: '#bfe9f2', y: 1290 },
        shapes: [{ kind: 'ring', x: 500, y: 820, width: 520, height: 520, stroke: '#00e5ff', strokeWidth: 3, opacity: 0.7 }],
        layers: { stars: 0.6, glitch: 0.35, scanlines: 0.3, flare: 0.35 },
        grade: 'tealOrange', gradeAmount: 0.4,
        textAboveLayers: true,
    },
    {
        id: 'brush-title', category: 'novel', name: 'ضربة الفرشاة', sample: 'صرخة الصمت',
        paletteId: 'charcoal-gold',
        title: { font: 'Lalezar', weight: 400, size: 120, color: '#ffffff', effect: 'none', y: 175, shadow: true },
        subtitle: { font: 'Tajawal', weight: 700, size: 42, color: '#e8e2d8', y: 1290 },
        shapes: [{ kind: 'brush', x: 500, y: 255, width: 860, height: 220, fill: '#8a1c1c' }],
        layers: { grunge: 0.45, vignette: 0.7, grain: 0.3 },
    },
    {
        id: 'fire-epic', category: 'history', name: 'نار الفتوح', sample: 'نار الفتوح',
        paletteId: 'rust',
        title: { font: 'Rakkas', weight: 400, size: 170, color: '#ffd27a', color2: '#5a1a00', effect: 'extrude', y: 120, shadow: false },
        subtitle: { font: 'El Messiri', weight: 700, size: 46, color: '#ffe2b5', y: 1280 },
        layers: { flames: 0.7, embers: 0.7, vignette: 0.7, smoke: 0.3 },
        grade: 'warm', gradeAmount: 0.5,
        textAboveLayers: true,
    },
    {
        id: 'old-manuscript', category: 'history', name: 'المخطوطة', sample: 'المخطوطة',
        customPalette: { name: 'رق قديم', type: 'radial', colors: ['#c9a974', '#e3cc9a', '#7a5a30'] },
        title: { font: 'Aref Ruqaa Ink', weight: 700, size: 150, color: '#3a2410', effect: 'none', y: 220, shadow: false },
        subtitle: { font: 'Amiri', weight: 400, size: 48, color: '#4a3018', y: 1200, shadow: false },
        shapes: [
            { kind: 'doubleFrame', x: 500, y: 750, width: 840, height: 1340, stroke: '#5a3a18', strokeWidth: 3 },
            { kind: 'divider', x: 500, y: 460, width: 480, height: 36, fill: '#5a3a18', stroke: '#5a3a18' },
            { kind: 'corner', x: 165, y: 165, width: 150, height: 150, fill: '#5a3a18', stroke: '#5a3a18', rotation: 0 },
            { kind: 'corner', x: 835, y: 165, width: 150, height: 150, fill: '#5a3a18', stroke: '#5a3a18', rotation: 90 },
            { kind: 'corner', x: 835, y: 1335, width: 150, height: 150, fill: '#5a3a18', stroke: '#5a3a18', rotation: 180 },
            { kind: 'corner', x: 165, y: 1335, width: 150, height: 150, fill: '#5a3a18', stroke: '#5a3a18', rotation: 270 },
        ],
        layers: { oldpaper: 0.7, stains: 0.5, burnt: 0.5 },
    },
    {
        id: 'qahiri-heritage', category: 'history', name: 'تراث الأمة', sample: 'تراث الأمة',
        paletteId: 'old-copper',
        title: { font: 'Qahiri', weight: 400, size: 150, effect: 'gold', y: 200, shadow: true },
        subtitle: { font: 'El Messiri', weight: 400, size: 46, color: '#ead8b0', y: 1240 },
        shapes: [
            { kind: 'ornateFrame', x: 500, y: 750, width: 840, height: 1340, stroke: '#d4af6a', fill: '#d4af6a', strokeWidth: 3 },
            { kind: 'starDivider', x: 500, y: 430, width: 500, height: 56 },
        ],
        layers: { concrete: 0.3, vignette: 0.6, sparkles: 0.3 },
    },
    {
        id: 'kufi-modern', category: 'essay', name: 'كتلة حمراء', sample: 'الخط الحديث',
        paletteId: 'slate',
        title: { font: 'Kufam', weight: 900, size: 120, color: '#ffffff', effect: 'none', y: 200, shadow: true },
        subtitle: { font: 'Readex Pro', weight: 400, size: 40, color: '#d6d9dd', y: 520 },
        shapes: [
            { kind: 'rect', x: 500, y: 300, width: 1000, height: 380, fill: '#b3121f', behind: true },
            { kind: 'line', x: 500, y: 600, width: 260, height: 20, stroke: '#ffffff', strokeWidth: 4 },
        ],
        layers: { grain: 0.25, halftone: 0.2 },
    },
    {
        id: 'minimal-white', category: 'essay', name: 'بساطة', sample: 'بساطة',
        customPalette: { name: 'عاجي', type: 'linear', colors: ['#eeeae2', '#f7f4ee', '#d8d2c6'] },
        title: { font: 'Mada', weight: 900, size: 160, color: '#1a1714', effect: 'none', y: 220, shadow: false },
        subtitle: { font: 'Mada', weight: 400, size: 44, color: '#4a453e', y: 1290, shadow: false },
        tag: { visible: true, text: 'مقال', bgColor: '#1a1714', color: '#eeeae2' },
        shapes: [
            { kind: 'line', x: 500, y: 450, width: 160, height: 20, stroke: '#b3121f', strokeWidth: 7 },
            { kind: 'circle', x: 720, y: 1020, width: 320, height: 320, fill: '#b3121f', behind: true },
        ],
        layers: { grain: 0.15 },
    },
    {
        id: 'halftone-pop', category: 'essay', name: 'بوب آرت', sample: 'جدل',
        customPalette: { name: 'أصفر', type: 'linear', colors: ['#f2c230', '#ffe066', '#d99a00'] },
        title: { font: 'Lalezar', weight: 400, size: 220, color: '#111111', effect: 'none', y: 180, shadow: false },
        subtitle: { font: 'Cairo', weight: 900, size: 46, color: '#111111', y: 1290, shadow: false },
        shapes: [{ kind: 'circle', x: 500, y: 780, width: 640, height: 640, fill: '#e63946', behind: true }],
        layers: { halftone: 0.35, grain: 0.2 },
    },
    {
        id: 'gold-seal-self', category: 'selfdev', name: 'الختم الذهبي', sample: 'قواعد النجاح',
        paletteId: 'ink-night',
        title: { font: 'Noto Kufi Arabic', weight: 900, size: 130, color: '#ffffff', color2: '#d4af6a', effect: 'gradient', y: 180, shadow: true },
        subtitle: { font: 'Noto Kufi Arabic', weight: 400, size: 40, color: '#cfc6b4', y: 1300 },
        shapes: [
            { kind: 'line', x: 500, y: 500, width: 200, height: 20, stroke: '#d4af6a', strokeWidth: 5 },
            { kind: 'seal', x: 790, y: 1120, width: 240, height: 240, fill: '#d4af6a' },
        ],
        layers: { sunburst: 0.35, grain: 0.2 },
        grade: 'warm', gradeAmount: 0.3,
    },
    {
        id: 'business-band', category: 'selfdev', name: 'الشريط الأنيق', sample: 'إدارة الوقت',
        customPalette: { name: 'كحلي', type: 'linear', colors: ['#0f2a44', '#1d4f7a', '#071624'] },
        title: { font: 'IBM Plex Sans Arabic', weight: 700, size: 130, color: '#ffffff', effect: 'none', y: 200, shadow: true },
        subtitle: { font: 'IBM Plex Sans Arabic', weight: 700, size: 44, color: '#0f2a44', y: 1255, shadow: false },
        shapes: [{ kind: 'rect', x: 500, y: 1290, width: 1000, height: 170, fill: '#d4af6a' }],
        layers: { lines: 0.25, grid: 0.2 },
    },
    {
        id: 'ribbon-kids', category: 'kids', name: 'حكايات جدّتي', sample: 'حكايات جدّتي',
        customPalette: { name: 'برتقالي دافئ', type: 'radial', colors: ['#ff9a5a', '#ffd38a', '#e0603a'] },
        title: { font: 'Lemonada', weight: 700, size: 100, color: '#ffffff', strokeColor: '#7a2e10', strokeWidth: 7, effect: 'outline', y: 175, shadow: true },
        subtitle: { font: 'Baloo Bhaijaan 2', weight: 700, size: 46, color: '#ffffff', y: 1290 },
        shapes: [
            { kind: 'ribbon', x: 500, y: 250, width: 900, height: 220, fill: '#c2410c' },
            { kind: 'star5', x: 140, y: 520, width: 110, height: 110, fill: '#fff3b0', rotation: -12 },
            { kind: 'star5', x: 860, y: 560, width: 80, height: 80, fill: '#fff3b0', rotation: 15 },
        ],
        layers: { sparkles: 0.5 },
        textAboveLayers: true,
    },
    {
        id: 'marhey-kids', category: 'kids', name: 'الأرنب الشجاع', sample: 'الأرنب الشجاع',
        customPalette: { name: 'بنفسجي مرح', type: 'radial', colors: ['#5b3fd0', '#9b8cff', '#2c1e7a'] },
        title: { font: 'Marhey', weight: 700, size: 130, color: '#fff27a', strokeColor: '#3a1fa0', color2: '#ffffff', strokeWidth: 6, effect: 'double', y: 130, shadow: true },
        subtitle: { font: 'Baloo Bhaijaan 2', weight: 700, size: 44, color: '#ffffff', y: 1290 },
        layers: { stars: 0.6, bokeh: 0.4 },
        textAboveLayers: true,
    },
    // ── الإصدار 2.3: قوالب على خلفيات جاهزة وأنماط جديدة ──
    {
        id: 'scene-mountains', category: 'novel', name: 'جبال الغروب', sample: 'الطريق إلى القمة',
        paletteId: 'crimson-dusk', background: { scene: 'mountains', dim: 0.1 },
        title: { font: 'El Messiri', weight: 700, size: 130, color: '#fff3e0', effect: 'none', y: 150, shadow: true },
        subtitle: { font: 'Tajawal', weight: 500, size: 44, color: '#ffe2c4', y: 1300 },
        layers: { grain: 0.2, flare: 0.35 },
    },
    {
        id: 'scene-dunes', category: 'poetry', name: 'كثبان القمر', sample: 'ليالي الصحراء',
        paletteId: 'night-dunes', background: { scene: 'dunes', dim: 0.05 },
        title: { font: 'Aref Ruqaa', weight: 700, size: 140, color: '#f3ead2', effect: 'glow', glowColor: '#c9b98a', y: 470, shadow: false },
        subtitle: { font: 'Amiri', weight: 400, size: 46, color: '#e6dcc0', y: 1300 },
        shapes: [{ kind: 'flourish', x: 500, y: 700, width: 440, height: 70, fill: '#f3ead2', stroke: '#f3ead2', opacity: 0.85 }],
        layers: { grain: 0.2 },
        textAboveLayers: true,
    },
    {
        id: 'scene-city', category: 'novel', name: 'أضواء المدينة', sample: 'مدينة لا تنام',
        paletteId: 'ink-blue', background: { scene: 'city', dim: 0.1 },
        title: { font: 'Changa', weight: 800, size: 140, color: '#ffffff', glowColor: '#ff7a3d', effect: 'neon', y: 140, shadow: false },
        subtitle: { font: 'Readex Pro', weight: 400, size: 42, color: '#ffd9b8', y: 520 },
        layers: { rain: 0.4, bokeh: 0.35, grain: 0.2 },
        textAboveLayers: true,
    },
    {
        id: 'scene-sea', category: 'novel', name: 'البحر الهائج', sample: 'رحلة السفينة',
        paletteId: 'steel-blue', background: { scene: 'sea', dim: 0.1 },
        title: { font: 'Lalezar', weight: 400, size: 150, color: '#e9f2f7', color2: '#0b1621', effect: 'extrude', y: 150, shadow: false },
        subtitle: { font: 'Cairo', weight: 700, size: 42, color: '#d6e4ee', y: 1300 },
        layers: { lightning: 0.6, rain: 0.5, vignette: 0.6 },
        grade: 'cold', gradeAmount: 0.4,
        textAboveLayers: true,
    },
    {
        id: 'scene-forest', category: 'horror', name: 'الغابة الصامتة', sample: 'الغابة الصامتة',
        paletteId: 'smoke-gray', background: { scene: 'forest', dim: 0.2 },
        title: { font: 'Blaka', weight: 400, size: 160, color: '#1a2422', effect: 'none', y: 140, shadow: false },
        subtitle: { font: 'Tajawal', weight: 700, size: 42, color: '#1a2422', y: 1320, shadow: false },
        layers: { groundfog: 0.6, grain: 0.35, vignette: 0.5 },
        grade: 'noir', gradeAmount: 0.4,
    },
    {
        id: 'scene-galaxy', category: 'novel', name: 'المجرّة', sample: 'ما وراء النجوم',
        paletteId: 'night-violet', background: { scene: 'galaxy', dim: 0 },
        title: { font: 'Kufam', weight: 900, size: 140, color: '#ffffff', color2: '#b49bff', effect: 'gradient', y: 160, shadow: true },
        subtitle: { font: 'Readex Pro', weight: 400, size: 42, color: '#d6ccff', y: 1300 },
        shapes: [{ kind: 'ring', x: 500, y: 760, width: 560, height: 560, stroke: '#b49bff', strokeWidth: 2, opacity: 0.6 }],
        layers: { sparkles: 0.4, flare: 0.3 },
        textAboveLayers: true,
    },
    {
        id: 'scene-mosques', category: 'religious', name: 'مآذن الغروب', sample: 'نفحات إيمانية',
        paletteId: 'desert-gold', background: { scene: 'mosques', dim: 0.05 },
        title: { font: 'Aref Ruqaa', weight: 700, size: 140, effect: 'gold', y: 150, shadow: true },
        subtitle: { font: 'Scheherazade New', weight: 700, size: 50, color: '#fff1d6', y: 470 },
        shapes: [{ kind: 'starDivider', x: 500, y: 420, width: 420, height: 50, fill: '#f0d27a', stroke: '#f0d27a' }],
        layers: { rays: 0.3, grain: 0.15 },
        textAboveLayers: true,
    },
    {
        id: 'scene-oldcity', category: 'history', name: 'المدينة القديمة', sample: 'أسوار دمشق',
        paletteId: 'royal-navy', background: { scene: 'oldcity', dim: 0.05 },
        title: { font: 'Qahiri', weight: 400, size: 150, color: '#efe3c3', effect: 'engraved', y: 1060, shadow: false },
        subtitle: { font: 'Amiri', weight: 700, size: 46, color: '#efe3c3', y: 1290 },
        layers: { stars: 0.4, grain: 0.25 },
        textAboveLayers: true,
    },
    {
        id: 'scene-marble', category: 'essay', name: 'الرخام الأسود', sample: 'فلسفة الجمال',
        paletteId: 'charcoal-gold', background: { scene: 'marble', dim: 0 },
        title: { font: 'Noto Kufi Arabic', weight: 900, size: 120, effect: 'gold', y: 230, shadow: true },
        subtitle: { font: 'Noto Kufi Arabic', weight: 400, size: 40, color: '#d8d2c4', y: 1300 },
        shapes: [
            { kind: 'doubleFrame', x: 500, y: 750, width: 860, height: 1360, stroke: '#d4af6a', strokeWidth: 2 },
            { kind: 'line', x: 500, y: 480, width: 220, height: 20, stroke: '#d4af6a', strokeWidth: 3 },
        ],
        layers: { vignette: 0.4 },
    },
    {
        id: 'scene-goldmarble', category: 'selfdev', name: 'رخام فاخر', sample: 'عادات الأثرياء',
        paletteId: 'ivory', background: { scene: 'goldMarble', dim: 0 },
        title: { font: 'Mada', weight: 900, size: 140, color: '#1a1714', effect: 'none', y: 220, shadow: false },
        subtitle: { font: 'Mada', weight: 400, size: 44, color: '#4a453e', y: 1300, shadow: false },
        shapes: [{ kind: 'rect', x: 500, y: 520, width: 160, height: 10, fill: '#b8914a' }],
        layers: {},
    },
    {
        id: 'scene-wood', category: 'history', name: 'الخشب العتيق', sample: 'حكايات الأجداد',
        paletteId: 'coffee', background: { scene: 'wood', dim: 0.1 },
        title: { font: 'Aref Ruqaa Ink', weight: 700, size: 140, color: '#f2dcb0', effect: 'engraved', y: 200, shadow: false },
        subtitle: { font: 'Amiri', weight: 400, size: 48, color: '#e8cfa0', y: 1260 },
        shapes: [{ kind: 'scroll', x: 500, y: 290, width: 860, height: 230, fill: '#c9a974', stroke: '#5a3a18', strokeWidth: 3 }],
        layers: { vignette: 0.6, grain: 0.25 },
    },
    {
        id: 'scene-leather', category: 'religious', name: 'الجلد المذهّب', sample: 'صحيح الأحاديث',
        paletteId: 'burnt-clay', background: { scene: 'leather', dim: 0 },
        title: { font: 'Amiri Quran', weight: 400, size: 130, effect: 'gold', y: 260, shadow: true },
        subtitle: { font: 'Amiri', weight: 700, size: 48, color: '#e8c58a', y: 1220 },
        shapes: [
            { kind: 'rosette', x: 500, y: 760, width: 360, height: 360, stroke: '#d4af6a', strokeWidth: 4 },
            { kind: 'corner', x: 140, y: 140, width: 120, height: 120, fill: '#d4af6a', stroke: '#d4af6a', rotation: 0 },
            { kind: 'corner', x: 860, y: 140, width: 120, height: 120, fill: '#d4af6a', stroke: '#d4af6a', rotation: 90 },
            { kind: 'corner', x: 860, y: 1360, width: 120, height: 120, fill: '#d4af6a', stroke: '#d4af6a', rotation: 180 },
            { kind: 'corner', x: 140, y: 1360, width: 120, height: 120, fill: '#d4af6a', stroke: '#d4af6a', rotation: 270 },
        ],
        layers: {},
    },
    {
        id: 'scene-tiles', category: 'religious', name: 'البلاط الأندلسي', sample: 'أيام الأندلس',
        paletteId: 'teal-depth', background: { scene: 'tiles', dim: 0.35 },
        title: { font: 'Reem Kufi', weight: 700, size: 130, color: '#ffffff', effect: 'none', bg: 'box', bgColor: '#0d3b4a', bgOpacity: 0.92, bgPadding: 30, bgRadius: 6, y: 250, shadow: false },
        subtitle: { font: 'El Messiri', weight: 700, size: 46, color: '#ffffff', bg: 'box', bgColor: '#9c2f2f', bgOpacity: 1, bgPadding: 14, y: 520 },
        layers: { vignette: 0.5 },
    },
    {
        id: 'scene-hex', category: 'selfdev', name: 'الشبكة الذكية', sample: 'عقلية التقنية',
        paletteId: 'midnight-teal', background: { scene: 'hexagons', dim: 0 },
        title: { font: 'IBM Plex Sans Arabic', weight: 700, size: 130, color: '#ffffff', glowColor: '#4fd1ff', effect: 'glow', y: 200, shadow: false },
        subtitle: { font: 'IBM Plex Sans Arabic', weight: 400, size: 40, color: '#a8d8ea', y: 1300 },
        layers: { scanlines: 0.2, grain: 0.15 },
    },
    {
        id: 'scene-watercolor', category: 'kids', name: 'الألوان المائية', sample: 'فراشة في الحديقة',
        paletteId: 'ivory', background: { scene: 'watercolor', dim: 0 },
        title: { font: 'Lemonada', weight: 700, size: 110, color: '#5a2a6e', effect: 'none', y: 200, shadow: false },
        subtitle: { font: 'Baloo Bhaijaan 2', weight: 700, size: 46, color: '#5a2a6e', y: 1300, shadow: false },
        shapes: [{ kind: 'flower', x: 820, y: 1120, width: 150, height: 150, fill: '#e46a8a', opacity: 0.9 }],
        layers: {},
    },
    {
        id: 'scene-mesh', category: 'selfdev', name: 'التدرّج العصري', sample: 'ابدأ بنفسك',
        paletteId: 'plum', background: { scene: 'mesh', dim: 0 },
        title: { font: 'Readex Pro', weight: 700, size: 150, color: '#ffffff', effect: 'none', y: 220, shadow: true },
        subtitle: { font: 'Readex Pro', weight: 400, size: 44, color: '#ffffff', y: 1300 },
        shapes: [{ kind: 'roundFrame', x: 500, y: 330, width: 820, height: 330, stroke: '#ffffff', strokeWidth: 3, opacity: 0.7 }],
        layers: { grain: 0.2 },
    },
    {
        id: 'scene-waves', category: 'essay', name: 'الأمواج الذهبية', sample: 'تأملات بحرية',
        paletteId: 'sapphire', background: { scene: 'abstractWaves', dim: 0 },
        title: { font: 'Markazi Text', weight: 700, size: 150, color: '#f0dfb5', effect: 'none', y: 200, shadow: true },
        subtitle: { font: 'Markazi Text', weight: 400, size: 50, color: '#d9c58c', y: 470 },
        layers: { grain: 0.15 },
    },
    {
        id: 'scene-velvet', category: 'poetry', name: 'المخمل الأحمر', sample: 'رسائل الحب',
        paletteId: 'ruby', background: { scene: 'velvet', dim: 0 },
        title: { font: 'Noto Nastaliq Urdu', weight: 700, size: 104, effect: 'gold', y: 300, shadow: true, lineHeight: 1.6 },
        subtitle: { font: 'Markazi Text', weight: 400, size: 48, color: '#f0d6c0', y: 1290 },
        shapes: [
            { kind: 'heart', x: 500, y: 820, width: 160, height: 150, fill: '#d4af6a', opacity: 0.85 },
            { kind: 'flourish', x: 500, y: 650, width: 420, height: 70, fill: '#d4af6a', stroke: '#d4af6a' },
        ],
        layers: { sparkles: 0.35, vignette: 0.5 },
    },
    {
        id: 'spot-royal', category: 'history', name: 'الإضاءة الملكية', sample: 'سيرة السلاطين',
        paletteId: 'royal-navy',
        title: { font: 'Amiri', weight: 700, size: 150, effect: 'silver', y: 170, shadow: true },
        subtitle: { font: 'El Messiri', weight: 400, size: 46, color: '#c9d6ec', y: 1270 },
        shapes: [
            { kind: 'ornateFrame', x: 500, y: 750, width: 840, height: 1340, stroke: '#c9d6ec', fill: '#c9d6ec', strokeWidth: 2 },
            { kind: 'star8', x: 500, y: 760, width: 140, height: 140, fill: '#c9d6ec', opacity: 0.8 },
        ],
        layers: { rays: 0.35, grain: 0.2 },
    },
    {
        id: 'horizon-dawn', category: 'selfdev', name: 'فجر جديد', sample: 'غداً أجمل',
        paletteId: 'sunset-pink',
        title: { font: 'Marhey', weight: 700, size: 150, color: '#ffffff', effect: 'none', y: 230, shadow: true },
        subtitle: { font: 'Tajawal', weight: 500, size: 44, color: '#ffe6ee', y: 1300 },
        shapes: [{ kind: 'sun', x: 500, y: 920, width: 360, height: 360, fill: '#ffd1a8', opacity: 0.9, behind: true }],
        layers: { sunburst: 0.3, grain: 0.15 },
    },
    // ── الإصدار 2.4: قوالب على الخلفيات الجديدة ──
    {
        id: 'scene-library', category: 'essay', name: 'المكتبة العتيقة', sample: 'في صحبة الكتب',
        frame: { style: 'gold', color: '#d4af6a', width: 5, margin: 34 },
        paletteId: 'coffee', background: { scene: 'library', dim: 0.35 },
        title: { font: 'Aref Ruqaa', weight: 700, size: 140, color: '#f0dfb5', effect: 'gold', y: 520, shadow: true, bg: 'plaque', bgColor: '#120b06', bgStroke: '#d4af6a', bgOpacity: 0.85, bgPadding: 34 },
        subtitle: { font: 'Amiri', weight: 400, size: 46, color: '#e6c98a', y: 1300 },
        layers: { grain: 0.3, vignette: 0.5 },
        textAboveLayers: true,
    },
    {
        id: 'scene-candle', category: 'poetry', name: 'ضوء الشمعة', sample: 'خواطر الليل',
        paletteId: 'amber', background: { scene: 'candle', dim: 0 },
        title: { font: 'Noto Nastaliq Urdu', weight: 700, size: 120, color: '#ffe2a8', effect: 'glow', glowColor: '#ff9a3a', y: 170, shadow: false },
        subtitle: { font: 'Tajawal', weight: 400, size: 40, color: '#c9a77a', y: 1360 },
        layers: { grain: 0.25, embers: 0.3 },
        textAboveLayers: true,
    },
    {
        id: 'scene-ruins', category: 'history', name: 'أطلال الحضارة', sample: 'ممالك منسية',
        paletteId: 'burnt-clay', background: { scene: 'ruins', dim: 0.05 },
        title: { font: 'Reem Kufi', weight: 700, size: 140, color: '#fff0d8', color2: '#3a1a0e', effect: 'extrude', y: 1000, shadow: false },
        subtitle: { font: 'Cairo', weight: 600, size: 42, color: '#ffd9b0', y: 1320 },
        layers: { dust: 0.5, grain: 0.3, rays: 0.3 },
        textAboveLayers: true,
    },
    {
        id: 'scene-oasis', category: 'novel', name: 'واحة الغروب', sample: 'سرّ الواحة',
        paletteId: 'desert-gold', background: { scene: 'oasis', dim: 0.05 },
        title: { font: 'Lalezar', weight: 400, size: 150, color: '#fff2d6', effect: 'none', y: 140, shadow: true },
        subtitle: { font: 'Tajawal', weight: 500, size: 42, color: '#ffe0b0', y: 1340 },
        layers: { grain: 0.2, flare: 0.3 },
    },
    {
        id: 'scene-snow', category: 'novel', name: 'قمم الثلج', sample: 'شتاء طويل',
        paletteId: 'arctic', background: { scene: 'snowpeaks', dim: 0.05 },
        title: { font: 'El Messiri', weight: 700, size: 140, color: '#ffffff', effect: 'silver', y: 140, shadow: true },
        subtitle: { font: 'Readex Pro', weight: 400, size: 40, color: '#1a2a40', y: 1350, shadow: false },
        layers: { snow: 0.5, grain: 0.15 },
        textAboveLayers: true,
    },
    {
        id: 'scene-sunrise', category: 'selfdev', name: 'فجر جديد', sample: 'ابدأ من جديد',
        paletteId: 'sunset-pink', background: { scene: 'seaSunrise', dim: 0 },
        title: { font: 'Cairo', weight: 800, size: 150, color: '#ffffff', effect: 'none', y: 170, shadow: true },
        subtitle: { font: 'Tajawal', weight: 500, size: 44, color: '#ffe6cc', y: 470 },
        layers: { flare: 0.45, grain: 0.15 },
    },
    {
        id: 'scene-rainwindow', category: 'poetry', name: 'خلف النافذة', sample: 'مطرٌ وحنين',
        paletteId: 'ink-blue', background: { scene: 'rainyWindow', dim: 0.1 },
        title: { font: 'Aref Ruqaa', weight: 700, size: 145, color: '#f0f4ff', effect: 'glow', glowColor: '#7aa8ff', y: 560, shadow: false },
        subtitle: { font: 'Amiri', weight: 400, size: 44, color: '#c8d4ee', y: 1320 },
        layers: { rain: 0.35, grain: 0.2 },
        textAboveLayers: true,
    },
    {
        id: 'scene-fog', category: 'horror', name: 'طريق الضباب', sample: 'لا عودة',
        paletteId: 'smoke-gray', background: { scene: 'foggyRoad', dim: 0.1 },
        title: { font: 'Blaka', weight: 400, size: 170, color: '#e8e8e8', effect: 'none', y: 130, shadow: true },
        subtitle: { font: 'Tajawal', weight: 700, size: 40, color: '#d0d0d0', y: 1350 },
        layers: { groundfog: 0.7, grain: 0.4, scratches: 0.3, vignette: 0.6 },
        grade: 'noir', gradeAmount: 0.5,
        textAboveLayers: true,
    },
    {
        id: 'scene-lanterns', category: 'religious', name: 'ليالي رمضان', sample: 'رمضانيات',
        paletteId: 'night-violet', background: { scene: 'lanterns', dim: 0 },
        title: { font: 'Aref Ruqaa', weight: 700, size: 150, color: '#f6d58a', effect: 'gold', y: 820, shadow: true },
        subtitle: { font: 'Amiri', weight: 700, size: 44, color: '#e6d6ff', y: 1320 },
        shapes: [{ kind: 'flourish', x: 500, y: 1040, width: 420, height: 64, fill: '#f6d58a', stroke: '#f6d58a', opacity: 0.85 }],
        layers: { sparkles: 0.4, grain: 0.15 },
        textAboveLayers: true,
    },
    {
        id: 'scene-arabesque', category: 'religious', name: 'زخرفة أرابيسك', sample: 'أصول الفقه',
        frame: { style: 'islamic', color: '#d4af6a', width: 5, margin: 30 },
        paletteId: 'emerald-night', background: { scene: 'arabesque', dim: 0.1 },
        title: { font: 'Amiri', weight: 700, size: 130, color: '#f0dfb5', effect: 'gold', y: 560, shadow: true, bg: 'plaque', bgColor: '#0d1a1a', bgStroke: '#d4af6a', bgOpacity: 0.95, bgPadding: 40 },
        subtitle: { font: 'Amiri', weight: 400, size: 44, color: '#e6c98a', y: 1300 },
        layers: { grain: 0.15 },
        textAboveLayers: true,
    },
    {
        id: 'scene-caravan', category: 'history', name: 'القافلة', sample: 'طريق الحرير',
        paletteId: 'desert-dusk', background: { scene: 'caravan', dim: 0 },
        title: { font: 'Reem Kufi', weight: 700, size: 145, color: '#3a1408', effect: 'none', y: 150, shadow: false },
        subtitle: { font: 'Cairo', weight: 700, size: 42, color: '#fff0d0', y: 1340 },
        layers: { dust: 0.4, grain: 0.25 },
    },
    {
        id: 'scene-aurora', category: 'novel', name: 'الشفق', sample: 'أضواء الشمال',
        paletteId: 'midnight-teal', background: { scene: 'aurora', dim: 0 },
        title: { font: 'Changa', weight: 700, size: 145, color: '#d8fff0', effect: 'neon', glowColor: '#3affb0', y: 640, shadow: false },
        subtitle: { font: 'Readex Pro', weight: 400, size: 40, color: '#b8e8ff', y: 1320 },
        layers: { stars: 0.3, grain: 0.15 },
        textAboveLayers: true,
    },
    {
        id: 'scene-ink', category: 'essay', name: 'بقعة حبر', sample: 'الكتابة',
        frame: { style: 'film', color: '#efe6d4', color2: '#0d0b0a', width: 6, margin: 0 },
        paletteId: 'ivory', background: { scene: 'inkSplash', dim: 0 },
        title: { font: 'Lalezar', weight: 400, size: 170, color: '#f5efe2', effect: 'none', y: 820, shadow: false },
        subtitle: { font: 'Tajawal', weight: 700, size: 44, color: '#0d0b0a', y: 1360, shadow: false },
        layers: { grain: 0.25 },
        textAboveLayers: true,
    },
    {
        id: 'scene-goldfoil', category: 'selfdev', name: 'الذهب', sample: 'عقلية الثراء',
        paletteId: 'charcoal-gold', background: { scene: 'goldFoil', dim: 0.15 },
        title: { font: 'Cairo', weight: 900, size: 150, color: '#120c04', effect: 'none', y: 560, shadow: false, bg: 'box', bgColor: '#f6e6b8', bgOpacity: 0.92, bgPadding: 30, bgRadius: 6 },
        subtitle: { font: 'Tajawal', weight: 700, size: 42, color: '#1a1206', y: 1340, shadow: false },
        layers: { sparkles: 0.3 },
    },
    {
        id: 'scene-deco', category: 'novel', name: 'آرت ديكو', sample: 'غاتسبي',
        frame: { style: 'deco', color: '#d4af6a', width: 4, margin: 36 },
        paletteId: 'charcoal-gold', background: { scene: 'artDeco', dim: 0.1 },
        title: { font: 'Reem Kufi', weight: 700, size: 140, color: '#e6c98a', effect: 'gold', y: 600, shadow: true },
        subtitle: { font: 'Tajawal', weight: 400, size: 40, color: '#d4af6a', y: 1340 },
        shapes: [{ kind: 'flourish', x: 500, y: 520, width: 440, height: 60, fill: '#d4af6a', stroke: '#d4af6a', opacity: 0.85 }],
        textAboveLayers: true,
    },
    {
        id: 'scene-storm-blue', category: 'horror', name: 'العاصفة', sample: 'ليلة العاصفة',
        paletteId: 'gunmetal', background: { scene: 'stormSky', dim: 0.05 },
        title: { font: 'Lalezar', weight: 400, size: 160, color: '#e6eeff', effect: 'glow', glowColor: '#9fbaff', y: 1000, shadow: false },
        subtitle: { font: 'Cairo', weight: 700, size: 40, color: '#c0ccee', y: 1340 },
        layers: { rain: 0.55, vignette: 0.5, grain: 0.25 },
        textAboveLayers: true,
    },
    {
        id: 'scene-mountains-night', category: 'poetry', name: 'جبال زرقاء', sample: 'قصائد المساء',
        paletteId: 'royal-navy', background: { scene: 'mountains', dim: 0.05, hue: 170, sat: 0.9 },
        title: { font: 'Aref Ruqaa', weight: 700, size: 140, color: '#eaf2ff', effect: 'glow', glowColor: '#8ab4ff', y: 160, shadow: false },
        subtitle: { font: 'Amiri', weight: 400, size: 44, color: '#d0dcf5', y: 1300 },
        layers: { stars: 0.4, grain: 0.15 },
    },
    {
        id: 'scene-bokeh', category: 'selfdev', name: 'أضواء النجاح', sample: 'لحظة التألّق',
        paletteId: 'amber', background: { scene: 'bokeh', dim: 0.1 },
        title: { font: 'El Messiri', weight: 700, size: 150, color: '#ffe8b0', effect: 'gold', y: 560, shadow: true },
        subtitle: { font: 'Tajawal', weight: 500, size: 42, color: '#ffd890', y: 1330 },
        textAboveLayers: true,
    },
    // ── الإصدار 2.5: أمني وعسكري وبحثي ──
    {
        id: 'sec-radar', category: 'security', name: 'الرادار', sample: 'عين لا تنام',
        frame: { style: 'tactical', color: '#3cff9a', width: 3, margin: 34, opacity: 0.8 },
        paletteId: 'midnight-teal', background: { scene: 'radar', dim: 0.05 },
        title: { font: 'Changa', weight: 800, size: 140, color: '#d8ffe6', effect: 'glow', glowColor: '#3cff9a', y: 120, shadow: false },
        subtitle: { font: 'Readex Pro', weight: 500, size: 38, color: '#9effc6', y: 1360, bg: 'corners', bgColor: '#021008', bgStroke: '#3cff9a', bgOpacity: 0.8, bgPadding: 20 },
        layers: { grain: 0.25, vignette: 0.5 },
        textAboveLayers: true,
    },
    {
        id: 'sec-dossier', category: 'security', name: 'الملف السري', sample: 'وثائق محظورة',
        frame: { style: 'classified', color: '#b31414', color2: '#f5efe2', width: 6, margin: 0 },
        paletteId: 'burnt-clay', background: { scene: 'dossier', dim: 0 },
        title: { font: 'Lalezar', weight: 400, size: 150, color: '#f5efe2', effect: 'none', y: 470, shadow: false, bg: 'tag', bgColor: '#2a2a2a', bgOpacity: 1, bgPadding: 26 },
        subtitle: { font: 'Cairo', weight: 800, size: 46, color: '#b31414', y: 1300, shadow: false, bg: 'stamp', bgColor: '#c9a66b', bgStroke: '#b31414', bgOpacity: 0.9, bgPadding: 26 },
        layers: { grain: 0.35, scratches: 0.25 },
        textAboveLayers: true,
    },
    {
        id: 'sec-camo', category: 'security', name: 'العمليات الخاصة', sample: 'القوات الخاصة',
        frame: { style: 'hazard', color: '#e8c21a', color2: '#111111', width: 6, margin: 0 },
        paletteId: 'gunmetal', background: { scene: 'camoWood', dim: 0.35 },
        title: { font: 'Blaka', weight: 400, size: 170, color: '#e9e4cf', effect: 'embossed', y: 520, shadow: true, ring: true, ringColor: '#14170d', ringWidth: 8 },
        subtitle: { font: 'Cairo', weight: 800, size: 44, color: '#1c1f14', y: 1320, shadow: false, bg: 'ribbon', bgColor: '#c8b88a', bgStroke: '#1c1f14', bgOpacity: 0.95, bgPadding: 18 },
        layers: { grain: 0.3, vignette: 0.6 },
        textAboveLayers: true,
    },
    {
        id: 'sec-desert', category: 'security', name: 'عاصفة الصحراء', sample: 'حرب الرمال',
        paletteId: 'desert-gold', background: { scene: 'camoDesert', dim: 0.15 },
        title: { font: 'Reem Kufi', weight: 700, size: 150, color: '#3a2a12', effect: 'none', y: 560, shadow: false, bg: 'torn', bgColor: '#efe3c4', bgOpacity: 0.95, bgPadding: 30 },
        subtitle: { font: 'Cairo', weight: 700, size: 42, color: '#2a1d0c', y: 1330, shadow: false },
        layers: { dust: 0.5, grain: 0.3 },
        textAboveLayers: true,
    },
    {
        id: 'sec-hud', category: 'security', name: 'المهمة', sample: 'المهمة صفر',
        frame: { style: 'tactical', color: '#7fdcff', width: 4, margin: 40 },
        paletteId: 'royal-navy', background: { scene: 'hud', dim: 0 },
        title: { font: 'Changa', weight: 800, size: 150, color: '#e8fbff', effect: 'chrome', y: 600, shadow: true },
        subtitle: { font: 'Readex Pro', weight: 500, size: 38, color: '#7fdcff', y: 1300, bg: 'glass', bgColor: '#0a3a5a', bgOpacity: 0.7, bgPadding: 22 },
        layers: { grain: 0.15 },
        textAboveLayers: true,
    },
    {
        id: 'sec-cyber', category: 'security', name: 'الاختراق', sample: 'الحرب السيبرانية',
        paletteId: 'emerald-night', background: { scene: 'cyber', dim: 0 },
        title: { font: 'Changa', weight: 800, size: 140, color: '#eafff2', effect: 'glitch', y: 900, shadow: true },
        subtitle: { font: 'Readex Pro', weight: 500, size: 38, color: '#3cff9a', y: 1330 },
        layers: { grain: 0.2, scratches: 0.15 },
        textAboveLayers: true,
    },
    {
        id: 'sec-night', category: 'security', name: 'عين الليل', sample: 'المراقبة',
        paletteId: 'emerald-night', background: { scene: 'nightVision', dim: 0 },
        title: { font: 'Blaka', weight: 400, size: 160, color: '#d9ffcc', effect: 'neon', glowColor: '#6cff4a', y: 130, shadow: false },
        subtitle: { font: 'Readex Pro', weight: 500, size: 38, color: '#b8ffa8', y: 1350 },
        layers: { grain: 0.4 },
        textAboveLayers: true,
    },
    {
        id: 'sec-battle', category: 'security', name: 'خط النار', sample: 'معركة المدينة',
        paletteId: 'burnt-clay', background: { scene: 'battlefield', dim: 0 },
        title: { font: 'Lalezar', weight: 400, size: 170, color: '#ffe6c8', effect: 'fire', y: 150, shadow: true },
        subtitle: { font: 'Cairo', weight: 700, size: 42, color: '#ffd0a0', y: 1350 },
        layers: { embers: 0.5, smoke: 0.3, grain: 0.3 },
        textAboveLayers: true,
    },
    {
        id: 'sec-map', category: 'security', name: 'الخريطة', sample: 'خطة الهجوم',
        paletteId: 'gunmetal', background: { scene: 'tacticalMap', dim: 0 },
        title: { font: 'Reem Kufi', weight: 700, size: 150, color: '#f2ecd2', effect: 'bronze', y: 560, shadow: true, bg: 'fade', bgColor: '#0e130c', bgOpacity: 0.85, bgPadding: 26 },
        subtitle: { font: 'Cairo', weight: 600, size: 40, color: '#d9d4b0', y: 1340 },
        layers: { grain: 0.25 },
        textAboveLayers: true,
    },
    {
        id: 'sec-satellite', category: 'security', name: 'من السماء', sample: 'رصد',
        paletteId: 'smoke-gray', background: { scene: 'satellite', dim: 0.2 },
        title: { font: 'Changa', weight: 800, size: 170, color: '#ffffff', effect: 'longShadow', y: 160, shadow: false },
        subtitle: { font: 'Readex Pro', weight: 600, size: 40, color: '#ffffff', y: 1340, bg: 'bars', bgColor: '#b31414', bgOpacity: 0.95, bgPadding: 14 },
        layers: { grain: 0.3, vignette: 0.5 },
        textAboveLayers: true,
    },
    {
        id: 'res-evidence', category: 'research', name: 'لوحة التحقيق', sample: 'القضية المفتوحة',
        paletteId: 'coffee', background: { scene: 'evidenceBoard', dim: 0.1 },
        title: { font: 'Aref Ruqaa', weight: 700, size: 140, color: '#1a1206', effect: 'none', y: 560, shadow: false, bg: 'torn', bgColor: '#f3ead2', bgOpacity: 1, bgPadding: 30 },
        subtitle: { font: 'Cairo', weight: 700, size: 42, color: '#ffffff', y: 1330, bg: 'bars', bgColor: '#b31414', bgOpacity: 0.95, bgPadding: 14 },
        layers: { grain: 0.25 },
        textAboveLayers: true,
    },
    {
        id: 'res-print', category: 'research', name: 'البصمة', sample: 'علم الأدلة الجنائية',
        paletteId: 'ink-blue', background: { scene: 'fingerprint', dim: 0 },
        title: { font: 'El Messiri', weight: 700, size: 135, color: '#e6f8ff', effect: 'ice', y: 130, shadow: true },
        subtitle: { font: 'Readex Pro', weight: 400, size: 38, color: '#9fdcff', y: 1350 },
        layers: { grain: 0.15 },
        textAboveLayers: true,
    },
    {
        id: 'res-dna', category: 'research', name: 'الشيفرة', sample: 'أسرار الجينات',
        paletteId: 'royal-navy', background: { scene: 'dna', dim: 0 },
        title: { font: 'Readex Pro', weight: 700, size: 140, color: '#ffffff', effect: 'glass', y: 600, shadow: true },
        subtitle: { font: 'Readex Pro', weight: 400, size: 38, color: '#bcd8ff', y: 1340, bg: 'ornament', bgColor: '#06173a', bgStroke: '#7fb4ff', bgOpacity: 0.9, bgPadding: 22 },
        layers: { grain: 0.1 },
        textAboveLayers: true,
    },
    {
        id: 'res-network', category: 'research', name: 'الشبكة', sample: 'الذكاء الاصطناعي',
        paletteId: 'royal-navy', background: { scene: 'network', dim: 0 },
        title: { font: 'Changa', weight: 700, size: 145, color: '#9fd0ff', effect: 'cinematic', y: 560, shadow: true },
        subtitle: { font: 'Readex Pro', weight: 400, size: 38, color: '#d6e8ff', y: 1340 },
        textAboveLayers: true,
    },
    {
        id: 'res-blueprint', category: 'research', name: 'المخطط', sample: 'هندسة المستقبل',
        frame: { style: 'double', color: '#e6f3ff', width: 4, margin: 34 },
        paletteId: 'royal-navy', background: { scene: 'blueprint', dim: 0 },
        title: { font: 'Reem Kufi', weight: 700, size: 140, color: '#ffffff', effect: 'outline', strokeColor: '#ffffff', strokeWidth: 3, outlineOnly: true, y: 120, shadow: false },
        subtitle: { font: 'Readex Pro', weight: 500, size: 38, color: '#e6f3ff', y: 1290, bg: 'frame', bgColor: '#0d3a6e', bgStroke: '#e6f3ff', bgOpacity: 0.9, bgPadding: 20 },
        textAboveLayers: true,
    },
    {
        id: 'res-circuit', category: 'research', name: 'الدائرة', sample: 'عالم الإلكترونيات',
        paletteId: 'emerald-night', background: { scene: 'circuit', dim: 0 },
        title: { font: 'Changa', weight: 800, size: 140, color: '#d8ffef', effect: 'goldFoil', y: 130, shadow: true },
        subtitle: { font: 'Readex Pro', weight: 500, size: 38, color: '#78ffc8', y: 1350 },
        layers: { grain: 0.15 },
        textAboveLayers: true,
    },
];
const STYLE_RESET = { effect: 'none', bg: 'none', secondColor: '', rotation: 0, letterSpacing: 0, ring: false, ring2: false };
/** تطبيق القالب على المستند مع الاحتفاظ بنص المستخدم وصوره */
function applyTemplateToDoc(doc, tpl) {
    const layers = {};
    for (const o of ALL_OVERLAYS) {
        const v = tpl.layers?.[o.id];
        layers[o.id] = v !== undefined ? { enabled: true, opacity: v } : { ...doc.layers[o.id], enabled: false };
    }
    return {
        ...doc,
        paletteId: tpl.customPalette ? 'custom' : tpl.paletteId,
        frame: tpl.frame ? { ...tpl.frame, fromTemplate: true } : doc.frame?.fromTemplate ? null : doc.frame,
        customPalette: tpl.customPalette || doc.customPalette,
        texts: Object.fromEntries(Object.entries(doc.texts).map(([k, t]) => {
            const style = tpl[k];
            if (!style)
                return [k, k === 'title' || k === 'subtitle' ? { ...t, ...STYLE_RESET } : t];
            const { text, ...rest } = style;
            const base = k === 'title' || k === 'subtitle' ? { ...t, ...STYLE_RESET, x: t.x } : t;
            return [k, { ...base, ...rest, ...(text && k !== 'title' ? { text } : {}) }];
        })),
        shapes: [
            ...(doc.shapes || []).filter((sh) => !sh.fromTemplate),
            ...(tpl.shapes || []).map((sp) => createShape(sp.kind, { ...sp, fromTemplate: true })),
        ],
        background: tpl.background
            ? {
                src: getSceneUrl(tpl.background.scene),
                scene: tpl.background.scene,
                scale: 1,
                offsetX: 0,
                offsetY: 0,
                opacity: 1,
                dim: tpl.background.dim ?? 0.12,
                paletteMix: tpl.background.paletteMix ?? 0,
                blend: tpl.background.blend || 'soft-light',
                hue: tpl.background.hue || 0,
                sat: tpl.background.sat ?? 1,
                bright: tpl.background.bright ?? 1,
                fromTemplate: true,
            }
            : doc.background?.fromTemplate
                ? null
                : doc.background,
        images: tpl.imageStyle
            ? doc.images.map((img) => ({ ...img, ...tpl.imageStyle, backdrop: { ...(img.backdrop || {}), ...(tpl.imageStyle.backdrop || {}) } }))
            : doc.images,
        layers,
        textAboveLayers: !!tpl.textAboveLayers,
        grade: tpl.grade ? { preset: tpl.grade, amount: tpl.gradeAmount ?? 0.6 } : { preset: 'none', amount: doc.grade?.amount ?? 0.6 },
    };
}
// ===== lib/aiBackground.js =====
// ─────────────────────────────────────────────────────────────
// توليد خلفية من وصف نصي — عبر Pollinations.ai (مجاني، بدون مفتاح)
// ─────────────────────────────────────────────────────────────
// ملاحظات:
// • هذه الميزة الوحيدة التي تتصل بخدمة خارجية (التوليد يحتاج خوادم GPU).
//   إزالة الخلفية ما زالت تتم داخل المتصفح بالكامل.
// • المستوى المجاني محدود بطلب واحد كل ~15 ثانية تقريباً.
// • الوصف بالإنجليزية يعطي نتائج أدق؛ لذلك القوالب السريعة تُرسل وصفاً إنجليزياً.
const AI_STYLE_SUFFIX = 'cinematic dark moody book cover background art, dramatic lighting, atmospheric, film grain, highly detailed, vertical composition, empty space at top for title, no text, no letters, no watermark';
const AI_PRESETS = [
    { label: 'مدينة مدمّرة تحت المطر ليلاً', prompt: 'ruined destroyed city at night under heavy rain, wet reflective streets, smoke' },
    { label: 'صحراء وقمر', prompt: 'vast desert dunes under a huge full moon, lone traveler silhouette, night' },
    { label: 'مسجد قديم عند الفجر', prompt: 'ancient mosque with minaret at dawn, golden mist, sun rays' },
    { label: 'غابة مظلمة وضباب', prompt: 'dark haunted forest with thick fog, twisted trees, faint light' },
    { label: 'قلعة على جبل', prompt: 'medieval fortress on a mountain cliff, stormy sky, eagles' },
    { label: 'ساحة معركة قديمة', prompt: 'ancient battlefield with banners and dust, horsemen silhouettes, sunset' },
    { label: 'بحر هائج وسفينة', prompt: 'stormy ocean with a lonely old sailing ship, lightning, giant waves' },
    { label: 'مكتبة قديمة', prompt: 'old abandoned library with dusty books, candle light, cobwebs' },
    { label: 'شارع ممطر بأضواء نيون', prompt: 'rainy narrow alley at night with neon lights, lone figure with umbrella, noir' },
    { label: 'فضاء وكواكب', prompt: 'deep space nebula with a giant planet, stars, lone astronaut' },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * @returns {Promise<string>} رابط blob: للصورة المولَّدة (آمن للتصدير من الكانفاس)
 */
async function generateAIBackground(prompt, { seed = Math.floor(Math.random() * 1e9), width = 1000, height = 1500, enhanceStyle = true } = {}) {
    const text = (prompt || '').trim();
    if (!text)
        throw new Error('اكتب وصفاً للخلفية أولاً');
    const full = enhanceStyle ? `${text}, ${AI_STYLE_SUFFIX}` : text;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}` +
        `?width=${width}&height=${height}&seed=${seed}&nologo=true`;
    for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 150000);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (res.status === 429 && attempt === 0) {
                await sleep(16000); // انتظر حد الاستخدام المجاني ثم أعد المحاولة مرة واحدة
                continue;
            }
            if (!res.ok)
                throw new Error(res.status === 429 ? 'الخدمة مشغولة — انتظر 15 ثانية وأعد المحاولة' : `فشل التوليد (رمز ${res.status})`);
            const blob = await res.blob();
            if (!blob.type.startsWith('image/'))
                throw new Error('الخدمة لم تُرجع صورة، أعد المحاولة');
            return URL.createObjectURL(blob);
        }
        catch (err) {
            if (err.name === 'AbortError')
                throw new Error('انتهت مهلة التوليد، أعد المحاولة');
            throw err;
        }
        finally {
            clearTimeout(timer);
        }
    }
    throw new Error('الخدمة مشغولة — أعد المحاولة بعد قليل');
}
// ===== lib/assetLibrary.js =====
// ─────────────────────────────────────────────────────────────
// مكتبة العناصر المجانية مفتوحة المصدر
// ─────────────────────────────────────────────────────────────
// • الأيقونات: Iconify — أكثر من 200 ألف أيقونة من مجموعات مفتوحة المصدر
//   (Material, Tabler, Phosphor, Game Icons…). تُحوَّل إلى PNG شفاف بأي لون.
// • صور PNG: ويكيميديا كومنز — ملفات PNG بتراخيص حرة (CC / ملكية عامة).
//   بعض التراخيص تتطلب ذكر صاحب العمل؛ يظهر الترخيص والمؤلف على كل صورة.
const ICON_SUGGESTIONS = [
    ['سيف', 'sword'], ['هلال', 'crescent'], ['مسجد', 'mosque'], ['كتاب', 'book'], ['تاج', 'crown'],
    ['جمجمة', 'skull'], ['طائر', 'bird'], ['شجرة', 'tree'], ['نجمة', 'star'], ['ريشة', 'feather'],
    ['درع', 'shield'], ['مفتاح', 'key'], ['عين', 'eye'], ['نار', 'fire'], ['قمر', 'moon'], ['حصان', 'horse'],
];
const PNG_SUGGESTIONS = [
    ['أسد', 'lion'], ['حصان', 'horse'], ['نسر', 'eagle'], ['شجرة', 'tree'], ['قلعة', 'castle'], ['فارس', 'knight'],
    ['سيف', 'sword'], ['ساعة', 'clock'], ['وردة', 'rose'], ['غراب', 'crow'], ['فانوس', 'lantern'], ['ذئب', 'wolf'],
];
/** يحوّل كلمة عربية معروفة إلى ما يقابلها بالإنجليزية (محركات البحث هذه تفهم الإنجليزية) */
function translateQuery(q, table) {
    const t = q.trim();
    const hit = table.find(([ar]) => ar === t);
    return hit ? hit[1] : t;
}
// ───────── Iconify ─────────
async function searchIcons(query, limit = 64) {
    const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok)
        throw new Error('تعذّر البحث في الأيقونات');
    const json = await res.json();
    return json.icons || [];
}
function iconSvgUrl(name, color = '#d4af6a') {
    const [prefix, icon] = name.split(':');
    return `https://api.iconify.design/${prefix}/${icon}.svg?height=512&color=${encodeURIComponent(color)}`;
}
/** يحوّل الأيقونة إلى PNG شفاف بدقة عالية (حتى تُصدَّر بوضوح) */
async function iconToPngUrl(name, color, size = 1024) {
    const svgText = await (await fetch(iconSvgUrl(name, color))).text();
    const svgUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    try {
        const img = await loadImage(svgUrl);
        const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(ratio >= 1 ? size : size * ratio);
        canvas.height = Math.round(ratio >= 1 ? size / ratio : size);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
        return URL.createObjectURL(blob);
    }
    finally {
        URL.revokeObjectURL(svgUrl);
    }
}
// ───────── ويكيميديا كومنز ─────────
const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, '').trim();
async function searchCommonsPNG(query, limit = 50, hintTransparent = true) {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        origin: '*',
        generator: 'search',
        gsrnamespace: '6',
        gsrsearch: `${query}${hintTransparent ? ' transparent' : ''} filemime:image/png`,
        gsrlimit: String(limit),
        prop: 'imageinfo',
        iiprop: 'url|size|mime|extmetadata',
        iiurlwidth: '330',
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!res.ok)
        throw new Error('تعذّر البحث في ويكيميديا');
    const json = await res.json();
    return Object.values(json.query?.pages || {})
        .map((p) => {
        const ii = p.imageinfo?.[0];
        if (!ii || ii.mime !== 'image/png')
            return null;
        return {
            id: p.pageid,
            title: p.title.replace(/^File:/, '').replace(/\.png$/i, ''),
            thumb: ii.thumburl || ii.url,
            full: ii.url,
            width: ii.width,
            license: stripHtml(ii.extmetadata?.LicenseShortName?.value) || 'ترخيص حر',
            artist: stripHtml(ii.extmetadata?.Artist?.value).slice(0, 60),
            page: ii.descriptionurl,
        };
    })
        .filter(Boolean);
}
/** يفحص الصورة المصغّرة: هل فيها شفافية حقيقية حول الأطراف؟ (نريد صور PNG مفرّغة فقط) */
function hasTransparency(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const S = 48;
                const c = document.createElement('canvas');
                c.width = S;
                c.height = S;
                const ctx = c.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, S, S);
                const d = ctx.getImageData(0, 0, S, S).data;
                let edge = 0, clear = 0;
                for (let y = 0; y < S; y++) {
                    for (let x = 0; x < S; x++) {
                        if (x > 3 && x < S - 4 && y > 3 && y < S - 4)
                            continue; // الأطراف فقط
                        edge++;
                        if (d[(y * S + x) * 4 + 3] < 40)
                            clear++;
                    }
                }
                resolve(clear / edge > 0.35);
            }
            catch {
                resolve(false);
            }
        };
        img.onerror = () => resolve(false);
        img.src = url;
    });
}
/** بحث + إبقاء الصور الشفافة فقط */
async function searchTransparentPNG(query, onProgress) {
    const [a, b] = await Promise.all([
        searchCommonsPNG(query, 50, true),
        searchCommonsPNG(query, 50, false).catch(() => []),
    ]);
    const seen = new Set();
    const all = [...a, ...b].filter((it) => !seen.has(it.id) && seen.add(it.id));
    const out = [];
    let done = 0;
    await Promise.all(all.map(async (it) => {
        if (await hasTransparency(it.thumb))
            out.push(it);
        onProgress?.(++done, all.length);
    }));
    return out;
}
/** ينزّل نسخة مناسبة الحجم من الصورة كرابط blob: محلي */
async function fetchCommonsImage(item) {
    const candidates = [];
    if (item.width > 1280 && item.thumb)
        candidates.push(item.thumb.replace(/\/\d+px-/, '/1280px-'));
    candidates.push(item.full);
    for (const url of candidates) {
        try {
            const res = await fetch(url);
            if (!res.ok)
                continue;
            return URL.createObjectURL(await res.blob());
        }
        catch {
            /* جرّب الرابط التالي */
        }
    }
    throw new Error('تعذّر تنزيل الصورة');
}
// ===== lib/project.js =====
// ─────────────────────────────────────────────────────────────
// حفظ المشروع وفتحه لاحقاً (ملف .cover.json يحتوي كل شيء بما فيه الصور)
// ─────────────────────────────────────────────────────────────
const APP_ID = 'cover-studio';
const VERSION = 2;
function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
    });
}
async function toDataURL(src) {
    if (!src || src.startsWith('data:'))
        return src;
    return blobToDataURL(await (await fetch(src)).blob());
}
async function toObjectURL(src) {
    if (!src || !src.startsWith('data:'))
        return src;
    return URL.createObjectURL(await (await fetch(src)).blob());
}
async function mapSources(doc, fn) {
    const out = JSON.parse(JSON.stringify(doc));
    for (const img of out.images) {
        img.src = await fn(img.src);
        if (img.originalSrc)
            img.originalSrc = img.originalSrc === doc.images.find((i) => i.id === img.id)?.src ? img.src : await fn(img.originalSrc);
    }
    for (const img of out.images)
        if (img.maskSrc)
            img.maskSrc = await fn(img.maskSrc);
    if (out.logo)
        out.logo.src = await fn(out.logo.src);
    if (out.background)
        out.background.src = await fn(out.background.src);
    return out;
}
async function serializeProject(doc) {
    const embedded = await mapSources(doc, toDataURL);
    return JSON.stringify({ app: APP_ID, version: VERSION, savedAt: new Date().toISOString(), doc: embedded });
}
/** يقرأ ملف المشروع ويدمجه مع القيم الافتراضية (لتوافق الملفات القديمة) */
async function parseProject(file, defaults) {
    let json;
    try {
        json = JSON.parse(await file.text());
    }
    catch {
        throw new Error('الملف ليس مشروع غلاف صالحاً');
    }
    if (json.app !== APP_ID || !json.doc)
        throw new Error('هذا الملف ليس من استوديو الأغلفة');
    const d = json.doc;
    const merged = {
        ...defaults,
        ...d,
        texts: Object.fromEntries(Object.keys(defaults.texts).map((k) => [k, { ...defaults.texts[k], ...(d.texts?.[k] || {}) }])),
        layers: { ...defaults.layers, ...(d.layers || {}) },
        images: d.images || [],
    };
    return mapSources(merged, toObjectURL);
}
function projectFileName(title) {
    const safe = (title || 'غلاف').replace(/[\\/:*?"<>|\n]+/g, ' ').trim().slice(0, 50) || 'غلاف';
    return `${safe}.cover.json`;
}
// ===== lib/grading.js =====
// ─────────────────────────────────────────────────────────────
// التدرّج اللوني السينمائي (Color Grading) لكامل الغلاف
// طبقات ألوان بأوضاع دمج تُرسم فوق التصميم — مثل LUT مبسّط
// ─────────────────────────────────────────────────────────────
const GRADES = [
    { id: 'none', label: 'بدون', swatch: ['#333', '#333'] },
    { id: 'tealOrange', label: 'سينمائي', swatch: ['#00808a', '#ff8a2a'] },
    { id: 'cold', label: 'بارد', swatch: ['#1b3a6b', '#6aa0ff'] },
    { id: 'warm', label: 'ذهبي دافئ', swatch: ['#5a2e00', '#ffb347'] },
    { id: 'noir', label: 'أبيض وأسود', swatch: ['#111', '#ddd'] },
    { id: 'bleach', label: 'باهت', swatch: ['#6d6a63', '#d8d0c0'] },
    { id: 'crimson', label: 'قرمزي', swatch: ['#3a0008', '#e0102e'] },
    { id: 'emerald', label: 'زمردي', swatch: ['#06321f', '#2fbf8a'] },
    { id: 'sepia', label: 'عتيق', swatch: ['#3b2412', '#c89a5e'] },
];
const DEFAULT_GRADE = { preset: 'none', amount: 0.6 };
function gradeLayers(grade, W, H) {
    const a = grade?.amount ?? 0.6;
    const vertical = (stops) => ({
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: 0, y: H },
        fillLinearGradientColorStops: stops,
    });
    switch (grade?.preset) {
        case 'tealOrange':
            return [
                { ...vertical([0, '#00808a', 0.55, '#1b3a4b', 1, '#ff8a2a']), blend: 'soft-light', opacity: a * 0.9 },
                { fill: '#ff9a40', blend: 'overlay', opacity: a * 0.08 },
            ];
        case 'cold':
            return [
                { fill: '#2a6cff', blend: 'soft-light', opacity: a * 0.6 },
                { fill: '#808080', blend: 'saturation', opacity: a * 0.3 },
            ];
        case 'warm':
            return [
                { fill: '#ffb347', blend: 'soft-light', opacity: a * 0.65 },
                { fill: '#5a2e00', blend: 'multiply', opacity: a * 0.12 },
            ];
        case 'noir':
            return [
                { fill: '#808080', blend: 'saturation', opacity: Math.min(1, a * 1.4) },
                { ...vertical([0, '#ffffff', 1, '#000000']), blend: 'soft-light', opacity: a * 0.35 },
            ];
        case 'bleach':
            return [
                { fill: '#808080', blend: 'saturation', opacity: a * 0.6 },
                { fill: '#d8d0c0', blend: 'soft-light', opacity: a * 0.45 },
            ];
        case 'crimson':
            return [
                { fill: '#b0001e', blend: 'soft-light', opacity: a * 0.75 },
                { fill: '#808080', blend: 'saturation', opacity: a * 0.25 },
            ];
        case 'emerald':
            return [{ fill: '#0f8a5f', blend: 'soft-light', opacity: a * 0.75 }];
        case 'sepia':
            return [
                { fill: '#808080', blend: 'saturation', opacity: a * 0.85 },
                { fill: '#c08040', blend: 'soft-light', opacity: a * 0.7 },
            ];
        default:
            return [];
    }
}
// ===== lib/decorShapes.js =====
// ─────────────────────────────────────────────────────────────
// عناصر زخرفية قابلة للتلوين: خطوط وفواصل، إطارات وزوايا، أشكال، زخارف ورموز
// كل شكل يُرسم حول (0,0) داخل صندوق w×h، ثم ctx.fillStrokeShape(shape)
// (يعمل مع سياق Konva ومع سياق Canvas العادي للمعاينات المصغّرة)
// ─────────────────────────────────────────────────────────────
const D_TAU = Math.PI * 2;
const D_K = 0.5522847498;
function dEllipse(ctx, rx, ry, cx = 0, cy = 0) {
    ctx.moveTo(cx + rx, cy);
    ctx.bezierCurveTo(cx + rx, cy + ry * D_K, cx + rx * D_K, cy + ry, cx, cy + ry);
    ctx.bezierCurveTo(cx - rx * D_K, cy + ry, cx - rx, cy + ry * D_K, cx - rx, cy);
    ctx.bezierCurveTo(cx - rx, cy - ry * D_K, cx - rx * D_K, cy - ry, cx, cy - ry);
    ctx.bezierCurveTo(cx + rx * D_K, cy - ry, cx + rx, cy - ry * D_K, cx + rx, cy);
}
function dPoly(ctx, pts) {
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
}
function dStarPts(n, R, r, rot = -Math.PI / 2) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
        const a = rot + (i * Math.PI) / n;
        const rr = i % 2 ? r : R;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    return pts;
}
function dRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}
function dSeeded(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const SHAPE_CATEGORIES = [
    { id: 'lines', label: 'خطوط وفواصل' },
    { id: 'frames', label: 'إطارات وزوايا' },
    { id: 'shapes', label: 'أشكال' },
    { id: 'ornaments', label: 'زخارف ورموز' },
];
const D_GOLD = '#d4af6a';
const D_NONE = 'rgba(0,0,0,0)';
// fill/stroke/strokeWidth: القيم الافتراضية — المستخدم يغيّرها
const SHAPE_LIBRARY = [
    // ── خطوط وفواصل ──
    {
        id: 'line', label: 'خط', cat: 'lines', w: 500, h: 20, fill: D_NONE, stroke: D_GOLD, strokeWidth: 4,
        draw(ctx, w, h, s) { ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.fillStrokeShape(s); },
    },
    {
        id: 'doubleLine', label: 'خط مزدوج', cat: 'lines', w: 500, h: 24, fill: D_NONE, stroke: D_GOLD, strokeWidth: 3,
        draw(ctx, w, h, s) {
            ctx.beginPath();
            ctx.moveTo(-w / 2, -h * 0.3);
            ctx.lineTo(w / 2, -h * 0.3);
            ctx.moveTo(-w / 2, h * 0.3);
            ctx.lineTo(w / 2, h * 0.3);
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'dots', label: 'نقاط', cat: 'lines', w: 500, h: 16, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            ctx.beginPath();
            const n = Math.max(3, Math.round(w / (h * 2.2)));
            for (let i = 0; i < n; i++) {
                const x = -w / 2 + h / 2 + (i * (w - h)) / (n - 1);
                dEllipse(ctx, h / 2, h / 2, x, 0);
            }
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'divider', label: 'فاصل بمعيّن', cat: 'lines', w: 560, h: 40, fill: D_GOLD, stroke: D_GOLD, strokeWidth: 2.5,
        draw(ctx, w, h, s) {
            const d = h / 2;
            ctx.beginPath();
            ctx.moveTo(-w / 2, 0);
            ctx.lineTo(-d * 2.2, 0);
            ctx.moveTo(d * 2.2, 0);
            ctx.lineTo(w / 2, 0);
            dPoly(ctx, [[0, -d], [d, 0], [0, d], [-d, 0]]);
            dEllipse(ctx, d * 0.32, d * 0.32, -d * 1.6, 0);
            dEllipse(ctx, d * 0.32, d * 0.32, d * 1.6, 0);
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'starDivider', label: 'فاصل بنجمة', cat: 'lines', w: 560, h: 60, fill: D_GOLD, stroke: D_GOLD, strokeWidth: 2,
        draw(ctx, w, h, s) {
            const R = h / 2;
            ctx.beginPath();
            ctx.moveTo(-w / 2, 0);
            ctx.lineTo(-R * 1.4, 0);
            ctx.moveTo(R * 1.4, 0);
            ctx.lineTo(w / 2, 0);
            ctx.moveTo(-w / 2 + 20, -6);
            ctx.lineTo(-R * 2, -6);
            ctx.moveTo(R * 2, 6);
            ctx.lineTo(w / 2 - 20, 6);
            dPoly(ctx, dStarPts(8, R, R * 0.55, -Math.PI / 2));
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'wave', label: 'خط متموّج', cat: 'lines', w: 500, h: 30, fill: D_NONE, stroke: D_GOLD, strokeWidth: 3,
        draw(ctx, w, h, s) {
            ctx.beginPath();
            const n = 6, seg = w / n;
            ctx.moveTo(-w / 2, 0);
            for (let i = 0; i < n; i++) {
                const x0 = -w / 2 + i * seg;
                ctx.bezierCurveTo(x0 + seg * 0.25, (i % 2 ? 1 : -1) * h / 2, x0 + seg * 0.75, (i % 2 ? 1 : -1) * h / 2, x0 + seg, 0);
            }
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'brush', label: 'ضربة فرشاة', cat: 'lines', w: 640, h: 120, fill: '#8a1c1c', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const r = dSeeded(7);
            ctx.beginPath();
            const n = 24;
            for (let i = 0; i <= n; i++) {
                const x = -w / 2 + (w * i) / n;
                const y = -h / 2 + (r() - 0.5) * h * 0.18 + (i === 0 || i === n ? h * 0.2 : 0);
                i ? ctx.lineTo(x, y) : ctx.moveTo(x + w * 0.02, y);
            }
            ctx.lineTo(w / 2 + w * 0.02, 0);
            for (let i = n; i >= 0; i--) {
                const x = -w / 2 + (w * i) / n;
                ctx.lineTo(x, h / 2 + (r() - 0.5) * h * 0.18 - (i === 0 || i === n ? h * 0.2 : 0));
            }
            ctx.lineTo(-w / 2 - w * 0.03, h * 0.05);
            ctx.closePath();
            ctx.fillStrokeShape(s);
        },
    },
    // ── إطارات وزوايا ──
    {
        id: 'frame', label: 'إطار', cat: 'frames', w: 820, h: 1300, fill: D_NONE, stroke: D_GOLD, strokeWidth: 4,
        draw(ctx, w, h, s) { ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.fillStrokeShape(s); },
    },
    {
        id: 'doubleFrame', label: 'إطار مزدوج', cat: 'frames', w: 820, h: 1300, fill: D_NONE, stroke: D_GOLD, strokeWidth: 3,
        draw(ctx, w, h, s) {
            ctx.beginPath();
            ctx.rect(-w / 2, -h / 2, w, h);
            ctx.rect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32);
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'roundFrame', label: 'إطار مستدير', cat: 'frames', w: 700, h: 300, fill: D_NONE, stroke: D_GOLD, strokeWidth: 4,
        draw(ctx, w, h, s) { ctx.beginPath(); dRoundRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.25); ctx.fillStrokeShape(s); },
    },
    {
        id: 'ornateFrame', label: 'إطار مزخرف', cat: 'frames', w: 820, h: 1300, fill: D_GOLD, stroke: D_GOLD, strokeWidth: 3,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2, c = Math.min(w, h) * 0.06;
            ctx.beginPath();
            ctx.moveTo(-hw + c, -hh);
            ctx.lineTo(hw - c, -hh);
            ctx.moveTo(hw, -hh + c);
            ctx.lineTo(hw, hh - c);
            ctx.moveTo(hw - c, hh);
            ctx.lineTo(-hw + c, hh);
            ctx.moveTo(-hw, hh - c);
            ctx.lineTo(-hw, -hh + c);
            for (const [x, y] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]])
                dPoly(ctx, [[x, y - c], [x + c, y], [x, y + c], [x - c, y]]);
            for (const [x, y] of [[0, -hh], [0, hh], [-hw, 0], [hw, 0]])
                dPoly(ctx, [[x, y - c * 0.6], [x + c * 0.6, y], [x, y + c * 0.6], [x - c * 0.6, y]]);
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'mihrabFrame', label: 'إطار محراب', cat: 'frames', w: 600, h: 820, fill: D_NONE, stroke: D_GOLD, strokeWidth: 5,
        draw(ctx, w, h, s) { traceBackdrop(ctx, 'mihrab', w, h); ctx.fillStrokeShape(s); },
    },
    {
        id: 'archFrame', label: 'إطار قوس', cat: 'frames', w: 600, h: 820, fill: D_NONE, stroke: D_GOLD, strokeWidth: 5,
        draw(ctx, w, h, s) { traceBackdrop(ctx, 'arch', w, h); ctx.fillStrokeShape(s); },
    },
    {
        id: 'ring', label: 'حلقة', cat: 'frames', w: 500, h: 500, fill: D_NONE, stroke: D_GOLD, strokeWidth: 5,
        draw(ctx, w, h, s) { ctx.beginPath(); dEllipse(ctx, w / 2, h / 2); ctx.fillStrokeShape(s); },
    },
    {
        id: 'corner', label: 'زاوية مزخرفة', cat: 'frames', w: 180, h: 180, fill: D_GOLD, stroke: D_GOLD, strokeWidth: 4,
        draw(ctx, w, h, s) {
            const x0 = -w / 2, y0 = -h / 2;
            ctx.beginPath();
            ctx.moveTo(x0, y0 + h);
            ctx.lineTo(x0, y0);
            ctx.lineTo(x0 + w, y0);
            ctx.moveTo(x0 + w * 0.18, y0 + h * 0.75);
            ctx.lineTo(x0 + w * 0.18, y0 + h * 0.18);
            ctx.lineTo(x0 + w * 0.75, y0 + h * 0.18);
            ctx.moveTo(x0 + w * 0.18, y0 + h * 0.42);
            ctx.quadraticCurveTo(x0 + w * 0.42, y0 + h * 0.42, x0 + w * 0.42, y0 + h * 0.18);
            dEllipse(ctx, w * 0.05, w * 0.05, x0 + w * 0.06 + w * 0.03, y0 + h * 0.09);
            dPoly(ctx, [[x0 + w * 0.3, y0 + h * 0.24], [x0 + w * 0.36, y0 + h * 0.3], [x0 + w * 0.3, y0 + h * 0.36], [x0 + w * 0.24, y0 + h * 0.3]]);
            ctx.fillStrokeShape(s);
        },
    },
    // ── أشكال ──
    {
        id: 'rect', label: 'مستطيل', cat: 'shapes', w: 500, h: 160, fill: '#8a1c1c', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) { ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.fillStrokeShape(s); },
    },
    {
        id: 'roundRect', label: 'مستطيل مستدير', cat: 'shapes', w: 500, h: 160, fill: '#2c7a5e', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) { ctx.beginPath(); dRoundRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.3); ctx.fillStrokeShape(s); },
    },
    {
        id: 'circle', label: 'دائرة', cat: 'shapes', w: 400, h: 400, fill: '#b3121f', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) { ctx.beginPath(); dEllipse(ctx, w / 2, h / 2); ctx.fillStrokeShape(s); },
    },
    {
        id: 'triangle', label: 'مثلث', cat: 'shapes', w: 400, h: 350, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) { ctx.beginPath(); dPoly(ctx, [[0, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]); ctx.fillStrokeShape(s); },
    },
    {
        id: 'diamond', label: 'معيّن', cat: 'shapes', w: 300, h: 400, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) { ctx.beginPath(); dPoly(ctx, [[0, -h / 2], [w / 2, 0], [0, h / 2], [-w / 2, 0]]); ctx.fillStrokeShape(s); },
    },
    {
        id: 'hexagon', label: 'سداسي', cat: 'shapes', w: 400, h: 360, fill: '#1e4f7a', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            ctx.beginPath();
            dPoly(ctx, Array.from({ length: 6 }, (_, i) => [Math.cos((i * D_TAU) / 6) * w / 2, Math.sin((i * D_TAU) / 6) * h / 2]));
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'ribbon', label: 'شريط لافتة', cat: 'shapes', w: 640, h: 110, fill: '#8a1c1c', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2, n = h * 0.45;
            ctx.beginPath();
            dPoly(ctx, [[-hw, -hh], [hw, -hh], [hw - n, 0], [hw, hh], [-hw, hh], [-hw + n, 0]]);
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'arrow', label: 'سهم', cat: 'shapes', w: 400, h: 160, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2, head = Math.min(w * 0.35, h);
            ctx.beginPath();
            dPoly(ctx, [[-hw, -hh * 0.35], [hw - head, -hh * 0.35], [hw - head, -hh], [hw, 0], [hw - head, hh], [hw - head, hh * 0.35], [-hw, hh * 0.35]]);
            ctx.fillStrokeShape(s);
        },
    },
    // ── زخارف ورموز ──
    {
        id: 'star8', label: 'نجمة ثمانية', cat: 'ornaments', w: 300, h: 300, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            ctx.beginPath();
            for (const rot of [0, Math.PI / 4]) {
                dPoly(ctx, [0, 1, 2, 3].map((k) => {
                    const a = rot + k * (Math.PI / 2) + Math.PI / 4;
                    return [(Math.cos(a) * w) / 2, (Math.sin(a) * h) / 2];
                }));
            }
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'rosette', label: 'وردة إسلامية', cat: 'ornaments', w: 320, h: 320, fill: D_NONE, stroke: D_GOLD, strokeWidth: 3,
        draw(ctx, w, h, s) {
            const R = Math.min(w, h) / 2;
            ctx.beginPath();
            for (const rot of [0, Math.PI / 4]) {
                dPoly(ctx, [0, 1, 2, 3].map((k) => {
                    const a = rot + k * (Math.PI / 2) + Math.PI / 4;
                    return [Math.cos(a) * R, Math.sin(a) * R];
                }));
            }
            dEllipse(ctx, R * 0.45, R * 0.45);
            dEllipse(ctx, R * 0.2, R * 0.2);
            dPoly(ctx, Array.from({ length: 8 }, (_, i) => {
                const a = (((i * 3) % 8) * D_TAU) / 8 + Math.PI / 8;
                return [Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72];
            }));
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'star5', label: 'نجمة', cat: 'ornaments', w: 300, h: 300, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) { ctx.beginPath(); dPoly(ctx, dStarPts(5, Math.min(w, h) / 2, Math.min(w, h) * 0.2)); ctx.fillStrokeShape(s); },
    },
    {
        id: 'seal', label: 'ختم مسنّن', cat: 'ornaments', w: 320, h: 320, fill: '#b3121f', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) { ctx.beginPath(); dPoly(ctx, dStarPts(18, Math.min(w, h) / 2, Math.min(w, h) * 0.43)); ctx.fillStrokeShape(s); },
    },
    {
        id: 'crescent', label: 'هلال', cat: 'ornaments', w: 300, h: 300, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const R = Math.min(w, h) / 2, d = R * 0.38, r = R * 0.86;
            const x = (R * R - r * r + d * d) / (2 * d);
            const y = Math.sqrt(Math.max(0, R * R - x * x));
            const t1 = Math.atan2(y, x);
            ctx.beginPath();
            ctx.arc(0, 0, R, t1, D_TAU - t1, false);
            ctx.arc(d, 0, r, Math.atan2(-y, x - d), Math.atan2(y, x - d), true);
            ctx.closePath();
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'flourish', label: 'زخرفة منحنية', cat: 'ornaments', w: 520, h: 90, fill: D_GOLD, stroke: D_GOLD, strokeWidth: 3,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2;
            ctx.beginPath();
            for (const sgn of [-1, 1]) {
                ctx.moveTo(sgn * hh * 0.6, 0);
                ctx.bezierCurveTo(sgn * hw * 0.3, -hh, sgn * hw * 0.55, hh, sgn * hw * 0.8, 0);
                ctx.quadraticCurveTo(sgn * hw * 0.9, -hh * 0.6, sgn * hw, -hh * 0.1);
            }
            dPoly(ctx, [[0, -hh * 0.5], [hh * 0.5, 0], [0, hh * 0.5], [-hh * 0.5, 0]]);
            ctx.fillStrokeShape(s);
        },
    },
    // ═════════ زخارف إضافية ═════════
    // ── خطوط ──
    {
        id: 'dashed', label: 'خط متقطّع', cat: 'lines', w: 500, h: 10, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            ctx.beginPath();
            const seg = h * 3, gap = h * 1.6;
            for (let x = -w / 2; x < w / 2; x += seg + gap)
                ctx.rect(x, -h / 2, Math.min(seg, w / 2 - x), h);
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'zigzag', label: 'خط متعرّج', cat: 'lines', w: 500, h: 30, fill: D_NONE, stroke: D_GOLD, strokeWidth: 3,
        draw(ctx, w, h, s) {
            ctx.beginPath();
            const n = 14;
            for (let i = 0; i <= n; i++) {
                const x = -w / 2 + (w * i) / n, y = i % 2 ? h / 2 : -h / 2;
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'arrowLine', label: 'خط بسهمين', cat: 'lines', w: 500, h: 40, fill: D_GOLD, stroke: D_GOLD, strokeWidth: 3,
        draw(ctx, w, h, s) {
            const a = h / 2;
            ctx.beginPath();
            ctx.moveTo(-w / 2 + a, 0);
            ctx.lineTo(w / 2 - a, 0);
            dPoly(ctx, [[w / 2, 0], [w / 2 - a * 1.6, -a], [w / 2 - a * 1.6, a]]);
            dPoly(ctx, [[-w / 2, 0], [-w / 2 + a * 1.6, -a], [-w / 2 + a * 1.6, a]]);
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'swash', label: 'خط خطّاطي', cat: 'lines', w: 560, h: 70, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2;
            ctx.beginPath();
            ctx.moveTo(-hw, hh * 0.2);
            ctx.bezierCurveTo(-hw * 0.4, -hh * 0.9, hw * 0.3, hh * 0.9, hw, -hh * 0.6);
            ctx.bezierCurveTo(hw * 0.3, hh * 0.4, -hw * 0.4, -hh * 0.3, -hw, hh * 0.2);
            ctx.closePath();
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'beadDivider', label: 'فاصل خرز', cat: 'lines', w: 560, h: 34, fill: D_GOLD, stroke: D_GOLD, strokeWidth: 2,
        draw(ctx, w, h, s) {
            const r = h / 2;
            ctx.beginPath();
            ctx.moveTo(-w / 2, 0);
            ctx.lineTo(w / 2, 0);
            for (const k of [-3, -2, -1, 0, 1, 2, 3]) {
                const x = k * r * 3.2, rr = k === 0 ? r : r * (0.75 - Math.abs(k) * 0.12);
                if (k === 0)
                    dPoly(ctx, [[x, -rr], [x + rr, 0], [x, rr], [x - rr, 0]]);
                else
                    dEllipse(ctx, rr, rr, x, 0);
            }
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'triDots', label: 'ثلاث نقاط', cat: 'lines', w: 120, h: 40, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const r = Math.min(h / 2, w / 7);
            ctx.beginPath();
            dEllipse(ctx, r, r, -w / 3, 0);
            dEllipse(ctx, r, r, 0, 0);
            dEllipse(ctx, r, r, w / 3, 0);
            ctx.fillStrokeShape(s);
        },
    },
    // ── إطارات ──
    {
        id: 'bracketFrame', label: 'إطار زوايا', cat: 'frames', w: 820, h: 1300, fill: D_NONE, stroke: D_GOLD, strokeWidth: 5,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2, L = Math.min(w, h) * 0.15;
            ctx.beginPath();
            for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
                ctx.moveTo(sx * hw, sy * hh + -sy * L);
                ctx.lineTo(sx * hw, sy * hh);
                ctx.lineTo(sx * hw - sx * L, sy * hh);
            }
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'octagonFrame', label: 'إطار ثماني', cat: 'frames', w: 600, h: 600, fill: D_NONE, stroke: D_GOLD, strokeWidth: 5,
        draw(ctx, w, h, s) {
            ctx.beginPath();
            dPoly(ctx, Array.from({ length: 8 }, (_, i) => [Math.cos(((i + 0.5) * D_TAU) / 8) * w / 2, Math.sin(((i + 0.5) * D_TAU) / 8) * h / 2]));
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'scallopFrame', label: 'إطار مموّج', cat: 'frames', w: 800, h: 1200, fill: D_NONE, stroke: D_GOLD, strokeWidth: 4,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2, r = 22;
            ctx.beginPath();
            const edge = (x0, y0, x1, y1) => {
                const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / (r * 2)));
                for (let i = 0; i < n; i++) {
                    const ax = x0 + ((x1 - x0) * i) / n, ay = y0 + ((y1 - y0) * i) / n;
                    const bx = x0 + ((x1 - x0) * (i + 1)) / n, by = y0 + ((y1 - y0) * (i + 1)) / n;
                    const nx = -(by - ay), ny = bx - ax;
                    ctx.quadraticCurveTo((ax + bx) / 2 + nx * 0.6, (ay + by) / 2 + ny * 0.6, bx, by);
                }
            };
            ctx.moveTo(-hw, -hh);
            edge(-hw, -hh, hw, -hh);
            edge(hw, -hh, hw, hh);
            edge(hw, hh, -hw, hh);
            edge(-hw, hh, -hw, -hh);
            ctx.closePath();
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'dotRing', label: 'حلقة منقّطة', cat: 'frames', w: 500, h: 500, fill: D_GOLD, stroke: D_GOLD, strokeWidth: 3,
        draw(ctx, w, h, s) {
            ctx.beginPath();
            dEllipse(ctx, w / 2, h / 2);
            for (let i = 0; i < 36; i++) {
                const a = (i * D_TAU) / 36;
                dEllipse(ctx, 5, 5, Math.cos(a) * (w / 2 - 18), Math.sin(a) * (h / 2 - 18));
            }
            ctx.moveTo(w / 2 - 34, 0);
            dEllipse(ctx, w / 2 - 34, h / 2 - 34);
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'shieldFrame', label: 'درع', cat: 'frames', w: 420, h: 520, fill: D_NONE, stroke: D_GOLD, strokeWidth: 5,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2;
            ctx.beginPath();
            ctx.moveTo(-hw, -hh);
            ctx.lineTo(hw, -hh);
            ctx.lineTo(hw, -hh * 0.1);
            ctx.bezierCurveTo(hw, hh * 0.5, hw * 0.4, hh * 0.8, 0, hh);
            ctx.bezierCurveTo(-hw * 0.4, hh * 0.8, -hw, hh * 0.5, -hw, -hh * 0.1);
            ctx.closePath();
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'cornerLeaf', label: 'زاوية نباتية', cat: 'frames', w: 200, h: 200, fill: D_GOLD, stroke: D_GOLD, strokeWidth: 3,
        draw(ctx, w, h, s) {
            const x0 = -w / 2, y0 = -h / 2;
            ctx.beginPath();
            ctx.moveTo(x0, y0 + h * 0.9);
            ctx.quadraticCurveTo(x0, y0, x0 + w * 0.9, y0);
            for (const t of [0.3, 0.55, 0.8]) {
                const lx = x0 + w * t * 0.25, ly = y0 + h * (1 - t) * 0.9;
                ctx.moveTo(lx, ly);
                ctx.quadraticCurveTo(lx + w * 0.14, ly - h * 0.02, lx + w * 0.16, ly - h * 0.12);
                ctx.quadraticCurveTo(lx + w * 0.02, ly - h * 0.1, lx, ly);
                const tx = x0 + w * (1 - t) * 0.9, ty = y0 + h * t * 0.25;
                ctx.moveTo(tx, ty);
                ctx.quadraticCurveTo(tx - w * 0.02, ty + h * 0.14, tx - w * 0.12, ty + h * 0.16);
                ctx.quadraticCurveTo(tx - w * 0.1, ty + h * 0.02, tx, ty);
            }
            dEllipse(ctx, w * 0.05, w * 0.05, x0 + w * 0.12, y0 + h * 0.12);
            ctx.fillStrokeShape(s);
        },
    },
    // ── أشكال ──
    {
        id: 'heart', label: 'قلب', cat: 'shapes', w: 320, h: 300, fill: '#c8102e', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2;
            ctx.beginPath();
            ctx.moveTo(0, hh);
            ctx.bezierCurveTo(-hw * 1.1, hh * 0.1, -hw * 0.9, -hh * 1.1, 0, -hh * 0.45);
            ctx.bezierCurveTo(hw * 0.9, -hh * 1.1, hw * 1.1, hh * 0.1, 0, hh);
            ctx.closePath();
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'cloud', label: 'غيمة', cat: 'shapes', w: 480, h: 260, fill: '#f0ede8', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2;
            ctx.beginPath();
            dEllipse(ctx, hw * 0.42, hh * 0.55, -hw * 0.45, hh * 0.25);
            dEllipse(ctx, hw * 0.5, hh * 0.8, -hw * 0.05, -hh * 0.1);
            dEllipse(ctx, hw * 0.4, hh * 0.6, hw * 0.45, hh * 0.2);
            ctx.rect(-hw * 0.75, hh * 0.1, hw * 1.5, hh * 0.7);
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'speech', label: 'فقاعة كلام', cat: 'shapes', w: 460, h: 300, fill: '#f0ede8', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2, bh = hh * 0.7;
            ctx.beginPath();
            dRoundRect(ctx, -hw, -hh, w, bh * 2, bh * 0.5);
            dPoly(ctx, [[-hw * 0.35, -hh + bh * 2 - 2], [-hw * 0.6, hh], [-hw * 0.05, -hh + bh * 2 - 2]]);
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'scroll', label: 'لفافة', cat: 'shapes', w: 680, h: 160, fill: '#c9a974', stroke: '#5a3a18', strokeWidth: 3,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2, r = hh * 0.55;
            ctx.beginPath();
            ctx.rect(-hw + r, -hh * 0.7, w - r * 2, hh * 1.4);
            dEllipse(ctx, r * 0.8, hh * 0.85, -hw + r, 0);
            dEllipse(ctx, r * 0.8, hh * 0.85, hw - r, 0);
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'semicircle', label: 'نصف دائرة', cat: 'shapes', w: 600, h: 300, fill: '#1e4f7a', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            ctx.beginPath();
            ctx.moveTo(-w / 2, h / 2);
            ctx.bezierCurveTo(-w / 2, -h * 0.85, w / 2, -h * 0.85, w / 2, h / 2);
            ctx.closePath();
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'drop', label: 'قطرة', cat: 'shapes', w: 220, h: 320, fill: '#2a7fd1', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2;
            ctx.beginPath();
            ctx.moveTo(0, -hh);
            ctx.bezierCurveTo(hw * 0.3, -hh * 0.4, hw, 0, hw, hh * 0.35);
            ctx.bezierCurveTo(hw, hh * 1.05, -hw, hh * 1.05, -hw, hh * 0.35);
            ctx.bezierCurveTo(-hw, 0, -hw * 0.3, -hh * 0.4, 0, -hh);
            ctx.fillStrokeShape(s);
        },
    },
    // ── زخارف ورموز ──
    {
        id: 'star12', label: 'نجمة اثنا عشرية', cat: 'ornaments', w: 320, h: 320, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) { ctx.beginPath(); dPoly(ctx, dStarPts(12, Math.min(w, h) / 2, Math.min(w, h) * 0.34)); ctx.fillStrokeShape(s); },
    },
    {
        id: 'lantern', label: 'فانوس', cat: 'ornaments', w: 180, h: 360, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2;
            ctx.beginPath();
            dEllipse(ctx, hw * 0.18, hw * 0.18, 0, -hh + hw * 0.18);
            dPoly(ctx, [[-hw * 0.5, -hh * 0.72], [hw * 0.5, -hh * 0.72], [hw * 0.75, -hh * 0.5], [-hw * 0.75, -hh * 0.5]]);
            dPoly(ctx, [[-hw * 0.75, -hh * 0.46], [hw * 0.75, -hh * 0.46], [hw, hh * 0.2], [hw * 0.55, hh * 0.62], [-hw * 0.55, hh * 0.62], [-hw, hh * 0.2]]);
            dPoly(ctx, [[-hw * 0.45, hh * 0.66], [hw * 0.45, hh * 0.66], [hw * 0.2, hh], [-hw * 0.2, hh]]);
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'mosque', label: 'مسجد', cat: 'ornaments', w: 520, h: 360, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2;
            ctx.beginPath();
            // القبة
            ctx.moveTo(-hw * 0.45, hh * 0.05);
            ctx.bezierCurveTo(-hw * 0.5, -hh * 0.75, hw * 0.5, -hh * 0.75, hw * 0.45, hh * 0.05);
            ctx.closePath();
            dPoly(ctx, [[-hw * 0.03, -hh * 0.62], [hw * 0.03, -hh * 0.62], [hw * 0.02, -hh * 0.85], [-hw * 0.02, -hh * 0.85]]);
            // المبنى
            ctx.rect(-hw * 0.6, hh * 0.05, hw * 1.2, hh * 0.95);
            // المئذنتان
            for (const sx of [-1, 1]) {
                ctx.rect(sx * hw * 0.82 - hw * 0.06, -hh * 0.6, hw * 0.12, hh * 1.6);
                dPoly(ctx, [[sx * hw * 0.82 - hw * 0.08, -hh * 0.6], [sx * hw * 0.82 + hw * 0.08, -hh * 0.6], [sx * hw * 0.82, -hh * 0.95]]);
            }
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'moonStar', label: 'هلال ونجمة', cat: 'ornaments', w: 320, h: 300, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const R = Math.min(w, h) / 2, d = R * 0.38, r = R * 0.86;
            const x = (R * R - r * r + d * d) / (2 * d);
            const y = Math.sqrt(Math.max(0, R * R - x * x));
            const t1 = Math.atan2(y, x);
            ctx.beginPath();
            ctx.arc(-R * 0.15, 0, R, t1, D_TAU - t1, false);
            ctx.arc(d - R * 0.15, 0, r, Math.atan2(-y, x - d), Math.atan2(y, x - d), true);
            ctx.closePath();
            ctx.save && ctx.save();
            const pts = dStarPts(5, R * 0.3, R * 0.12).map(([px, py]) => [px + R * 0.55, py - R * 0.05]);
            dPoly(ctx, pts);
            ctx.restore && ctx.restore();
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'sun', label: 'شمس', cat: 'ornaments', w: 320, h: 320, fill: '#ffb347', stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const R = Math.min(w, h) / 2;
            ctx.beginPath();
            dEllipse(ctx, R * 0.5, R * 0.5);
            for (let i = 0; i < 12; i++) {
                const a = (i * D_TAU) / 12, b = a + 0.13, c = a - 0.13;
                dPoly(ctx, [[Math.cos(c) * R * 0.6, Math.sin(c) * R * 0.6], [Math.cos(a) * R, Math.sin(a) * R], [Math.cos(b) * R * 0.6, Math.sin(b) * R * 0.6]]);
            }
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'openBook', label: 'كتاب مفتوح', cat: 'ornaments', w: 420, h: 260, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2;
            ctx.beginPath();
            for (const sx of [-1, 1]) {
                ctx.moveTo(sx * hw * 0.04, -hh * 0.75);
                ctx.quadraticCurveTo(sx * hw * 0.5, -hh, sx * hw, -hh * 0.8);
                ctx.lineTo(sx * hw, hh * 0.75);
                ctx.quadraticCurveTo(sx * hw * 0.5, hh * 0.55, sx * hw * 0.04, hh);
                ctx.closePath();
            }
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'quill', label: 'ريشة قلم', cat: 'ornaments', w: 160, h: 420, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const hw = w / 2, hh = h / 2;
            ctx.beginPath();
            ctx.moveTo(0, hh);
            ctx.quadraticCurveTo(-hw * 0.2, hh * 0.3, -hw, -hh * 0.4);
            ctx.quadraticCurveTo(-hw * 0.4, -hh, hw * 0.3, -hh);
            ctx.quadraticCurveTo(hw * 0.6, -hh * 0.2, 0, hh);
            ctx.closePath();
            ctx.fillStrokeShape(s);
        },
    },
    {
        id: 'flower', label: 'زهرة', cat: 'ornaments', w: 300, h: 300, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
        draw(ctx, w, h, s) {
            const R = Math.min(w, h) / 2;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const a = (i * D_TAU) / 8;
                const cx = Math.cos(a) * R * 0.55, cy = Math.sin(a) * R * 0.55;
                dEllipse(ctx, R * 0.32, R * 0.32, cx, cy);
            }
            ctx.fillStrokeShape(s);
        },
    },
];
const getShapeDef = (kind) => SHAPE_LIBRARY.find((s) => s.id === kind) || SHAPE_LIBRARY[0];
/** رسم معاينة مصغّرة على Canvas عادي */
function drawShapePreview(canvas, kind, colors = {}) {
    const def = getShapeDef(kind);
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const pad = 6;
    const sc = Math.min((W - pad * 2) / def.w, (H - pad * 2) / def.h);
    const fill = colors.fill ?? def.fill;
    const stroke = colors.stroke ?? def.stroke;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(def.strokeWidth, 1.5 / sc);
    ctx.lineJoin = 'round';
    ctx.fillStrokeShape = () => {
        if (fill && fill !== D_NONE)
            ctx.fill();
        if (stroke && stroke !== D_NONE && def.strokeWidth > 0)
            ctx.stroke();
    };
    def.draw(ctx, def.w, def.h, null);
    ctx.restore();
}
function createShape(kind, overrides = {}) {
    const def = getShapeDef(kind);
    return {
        id: `shp-${Math.random().toString(36).slice(2, 10)}`,
        kind,
        x: 500,
        y: 750,
        width: def.w,
        height: def.h,
        rotation: 0,
        opacity: 1,
        fill: def.fill,
        stroke: def.stroke,
        strokeWidth: def.strokeWidth,
        behind: false,
        ...overrides,
    };
}
const TRANSPARENT = D_NONE;
// ===== lib/scenes.js =====
// ─────────────────────────────────────────────────────────────
// خلفيات جاهزة مرسومة برمجياً (مشاهد وأنسجة) — بدون صور خارجية
// كل مشهد يُرسم بأي مقاس (معاينة صغيرة أو 1000×1500 للغلاف)
// ─────────────────────────────────────────────────────────────
function sceneRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const S_TAU = Math.PI * 2;
function vGrad(ctx, w, h, stops, y0 = 0, y1 = h) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}
function glow(ctx, x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, S_TAU);
    ctx.fill();
}
/** سلسلة جبال/كثبان: خط أفق متعرّج مملوء حتى الأسفل */
function ridge(ctx, w, h, baseY, amp, rough, color, r, smooth = false) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const n = smooth ? 6 : 40;
    let y = baseY;
    const pts = [];
    for (let i = 0; i <= n; i++) {
        y = baseY + (r() - 0.5) * amp + Math.sin(i * rough) * amp * 0.35;
        pts.push([(w * i) / n, y]);
    }
    ctx.lineTo(pts[0][0], pts[0][1]);
    if (smooth) {
        for (let i = 1; i < pts.length; i++) {
            const [px, py] = pts[i - 1], [x, yy] = pts[i];
            ctx.quadraticCurveTo(px + (x - px) * 0.5, py, (px + x) / 2, (py + yy) / 2);
        }
        ctx.lineTo(w, pts[pts.length - 1][1]);
    }
    else {
        pts.forEach(([x, yy]) => ctx.lineTo(x, yy));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
}
function stars(ctx, w, h, r, count, maxY) {
    for (let i = 0; i < count; i++) {
        const s = r();
        ctx.fillStyle = `rgba(255,250,235,${0.3 + s * 0.7})`;
        ctx.beginPath();
        ctx.arc(r() * w, r() * maxY, (0.4 + s * s * 1.6) * (w / 1000), 0, S_TAU);
        ctx.fill();
    }
}
function moon(ctx, x, y, R, color = '#f3ead2') {
    glow(ctx, x, y, R * 3.2, 'rgba(255,240,210,0.25)');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, S_TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,140,120,0.18)';
    [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.35, 0.12]].forEach(([dx, dy, rr]) => {
        ctx.beginPath();
        ctx.arc(x + dx * R, y + dy * R, rr * R, 0, S_TAU);
        ctx.fill();
    });
}
/** نقش تمويه بقع عضوية بأربعة ألوان */
function camo(ctx, w, h, r, cols) {
    ctx.fillStyle = cols[0];
    ctx.fillRect(0, 0, w, h);
    for (let c = 1; c < cols.length; c++) {
        ctx.fillStyle = cols[c];
        for (let i = 0; i < 38; i++) {
            const cx = r() * w, cy = r() * h, R = w * (0.04 + r() * 0.08);
            const n = 14, pts = [];
            for (let j = 0; j < n; j++) {
                const a = (j / n) * S_TAU;
                const rr = R * (0.55 + r() * 0.75);
                pts.push([cx + Math.cos(a) * rr * 1.6, cy + Math.sin(a) * rr]);
            }
            ctx.beginPath();
            pts.forEach(([x, y], j) => {
                const [nx, ny] = pts[(j + 1) % n];
                j ? ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2) : ctx.moveTo((x + nx) / 2, (y + ny) / 2);
            });
            ctx.closePath();
            ctx.fill();
        }
    }
}
const SCENES = [
    {
        id: 'mountains', label: 'جبال الغروب',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#1b1030'], [0.35, '#6b2c4a'], [0.55, '#e0794a'], [0.7, '#f3b36a']]);
            glow(ctx, w * 0.5, h * 0.62, w * 0.35, 'rgba(255,200,120,0.7)');
            ridge(ctx, w, h, h * 0.6, h * 0.08, 0.7, '#5a2a45', r);
            ridge(ctx, w, h, h * 0.68, h * 0.07, 1.1, '#3a1a33', r);
            ridge(ctx, w, h, h * 0.76, h * 0.06, 1.7, '#22101f', r);
            ridge(ctx, w, h, h * 0.86, h * 0.04, 2.3, '#120810', r);
        },
    },
    {
        id: 'dunes', label: 'كثبان تحت القمر',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#070b1a'], [0.5, '#1c2547'], [0.75, '#3b3a5a']]);
            stars(ctx, w, h, r, 500, h * 0.55);
            moon(ctx, w * 0.7, h * 0.2, w * 0.09);
            ridge(ctx, w, h, h * 0.66, h * 0.1, 0.8, '#5a4636', r, true);
            ridge(ctx, w, h, h * 0.75, h * 0.08, 1.3, '#3d2e22', r, true);
            ridge(ctx, w, h, h * 0.86, h * 0.06, 1.9, '#211810', r, true);
        },
    },
    {
        id: 'city', label: 'مدينة ليلية',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#05070f'], [0.6, '#16203d'], [0.85, '#3b2a4a']]);
            stars(ctx, w, h, r, 260, h * 0.45);
            glow(ctx, w * 0.5, h * 0.85, w * 0.7, 'rgba(255,140,80,0.25)');
            for (let layer = 0; layer < 3; layer++) {
                const shade = ['#141a2e', '#0d1122', '#070912'][layer];
                let x = -20;
                while (x < w) {
                    const bw = (40 + r() * 90) * (w / 1000);
                    const bh = h * (0.18 + r() * 0.32) * (1 - layer * 0.18);
                    const top = h - bh - layer * h * 0.02;
                    ctx.fillStyle = shade;
                    ctx.fillRect(x, top, bw, h - top);
                    if (layer > 0) {
                        for (let wy = top + 10; wy < h - 10; wy += 14 * (w / 1000)) {
                            for (let wx = x + 6; wx < x + bw - 6; wx += 11 * (w / 1000)) {
                                if (r() < 0.32) {
                                    ctx.fillStyle = r() < 0.8 ? 'rgba(255,210,140,0.85)' : 'rgba(160,210,255,0.8)';
                                    ctx.fillRect(wx, wy, 4 * (w / 1000), 6 * (w / 1000));
                                }
                            }
                        }
                    }
                    x += bw + 2;
                }
            }
        },
    },
    {
        id: 'sea', label: 'بحر هائج',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#0b1621'], [0.45, '#2a3e52'], [0.55, '#5d7387']]);
            glow(ctx, w * 0.3, h * 0.3, w * 0.5, 'rgba(200,220,235,0.25)');
            for (let i = 0; i < 9; i++) {
                const y = h * (0.5 + i * 0.06);
                const c = 40 - i * 3;
                ctx.fillStyle = `rgb(${c - 20},${c + 15},${c + 30})`;
                ctx.beginPath();
                ctx.moveTo(0, h);
                ctx.lineTo(0, y);
                const n = 10;
                for (let k = 0; k < n; k++) {
                    const x0 = (w * k) / n, x1 = (w * (k + 1)) / n;
                    ctx.quadraticCurveTo((x0 + x1) / 2, y - (20 + r() * 50) * (w / 1000) * (1 + i * 0.2), x1, y + (r() - 0.5) * 10);
                }
                ctx.lineTo(w, h);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(220,235,245,0.18)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        },
    },
    {
        id: 'forest', label: 'غابة ضبابية',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#cfd6d4'], [0.5, '#8fa09c'], [1, '#2c3a36']]);
            const tree = (x, base, th, color) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                const tw = th * 0.32;
                ctx.moveTo(x, base - th);
                for (let k = 1; k <= 4; k++) {
                    ctx.lineTo(x + (tw * k) / 4, base - th + (th * k) / 4.3);
                    ctx.lineTo(x + (tw * k) / 8, base - th + (th * k) / 4.3);
                }
                ctx.lineTo(x + tw * 0.1, base);
                ctx.lineTo(x - tw * 0.1, base);
                for (let k = 4; k >= 1; k--) {
                    ctx.lineTo(x - (tw * k) / 8, base - th + (th * k) / 4.3);
                    ctx.lineTo(x - (tw * k) / 4, base - th + (th * k) / 4.3);
                }
                ctx.closePath();
                ctx.fill();
            };
            const layers = ['rgba(110,128,124,0.6)', 'rgba(70,88,84,0.8)', '#2f3f3b', '#1a2422'];
            layers.forEach((col, li) => {
                const base = h * (0.62 + li * 0.11);
                for (let i = 0; i < 18; i++)
                    tree(r() * w * 1.1 - w * 0.05, base + r() * 20, h * (0.18 + li * 0.07) * (0.7 + r() * 0.6), col);
                const g = ctx.createLinearGradient(0, base - h * 0.15, 0, base + h * 0.05);
                g.addColorStop(0, 'rgba(210,218,216,0)');
                g.addColorStop(1, 'rgba(210,218,216,0.35)');
                ctx.fillStyle = g;
                ctx.fillRect(0, base - h * 0.15, w, h * 0.2);
            });
        },
    },
    {
        id: 'galaxy', label: 'مجرّة ونجوم',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#04030a'], [0.5, '#0d0a24'], [1, '#05030c']]);
            ctx.save();
            ctx.translate(w / 2, h * 0.45);
            ctx.rotate(-0.6);
            ctx.scale(1, 0.32);
            glow(ctx, 0, 0, w * 0.75, 'rgba(120,90,200,0.35)');
            glow(ctx, w * 0.1, 0, w * 0.45, 'rgba(230,140,200,0.25)');
            glow(ctx, -w * 0.15, 0, w * 0.3, 'rgba(120,200,255,0.25)');
            ctx.restore();
            stars(ctx, w, h, r, 1600, h);
            for (let i = 0; i < 25; i++)
                glow(ctx, r() * w, r() * h, (6 + r() * 14) * (w / 1000), 'rgba(255,250,240,0.8)');
        },
    },
    {
        id: 'mosques', label: 'مآذن وقباب',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#0f1a33'], [0.45, '#3a3a6a'], [0.7, '#c9734a'], [0.8, '#f2b462']]);
            glow(ctx, w * 0.5, h * 0.74, w * 0.45, 'rgba(255,190,110,0.6)');
            moon(ctx, w * 0.78, h * 0.16, w * 0.05);
            const base = h * 0.8, sil = '#120d14';
            ctx.fillStyle = sil;
            ctx.fillRect(0, base, w, h - base);
            const dome = (cx, R) => {
                ctx.beginPath();
                ctx.moveTo(cx - R, base);
                ctx.bezierCurveTo(cx - R * 1.1, base - R * 1.5, cx + R * 1.1, base - R * 1.5, cx + R, base);
                ctx.fill();
                ctx.fillRect(cx - R * 0.04, base - R * 1.45, R * 0.08, R * 0.3);
            };
            const minaret = (x, mh, mw) => {
                ctx.fillRect(x - mw / 2, base - mh, mw, mh);
                ctx.fillRect(x - mw * 0.8, base - mh * 0.7, mw * 1.6, mw * 0.35);
                ctx.beginPath();
                ctx.moveTo(x - mw * 0.6, base - mh);
                ctx.lineTo(x, base - mh - mw * 2.2);
                ctx.lineTo(x + mw * 0.6, base - mh);
                ctx.fill();
            };
            const k = w / 1000;
            dome(w * 0.5, 170 * k);
            dome(w * 0.28, 90 * k);
            dome(w * 0.72, 90 * k);
            ctx.fillRect(w * 0.18, base - 70 * k, w * 0.64, 70 * k);
            minaret(w * 0.12, 420 * k, 34 * k);
            minaret(w * 0.88, 420 * k, 34 * k);
            minaret(w * 0.36, 300 * k, 26 * k);
            minaret(w * 0.64, 300 * k, 26 * k);
            stars(ctx, w, h, r, 160, h * 0.4);
        },
    },
    {
        id: 'oldcity', label: 'قمر فوق مدينة قديمة',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#050913'], [0.6, '#1d2a3e'], [1, '#2b3346']]);
            moon(ctx, w * 0.5, h * 0.33, w * 0.24, '#efe3c3');
            stars(ctx, w, h, r, 300, h * 0.5);
            const base = h * 0.83, k = w / 1000;
            ctx.fillStyle = '#0a0d14';
            let x = 0;
            while (x < w) {
                const bw = (60 + r() * 120) * k, bh = (90 + r() * 200) * k;
                ctx.fillRect(x, base - bh, bw, h);
                if (r() < 0.35) {
                    ctx.beginPath();
                    ctx.moveTo(x, base - bh);
                    ctx.bezierCurveTo(x, base - bh - bw * 0.7, x + bw, base - bh - bw * 0.7, x + bw, base - bh);
                    ctx.fill();
                }
                if (r() < 0.25)
                    ctx.fillRect(x + bw * 0.4, base - bh - 120 * k, bw * 0.2, 120 * k);
                x += bw;
            }
        },
    },
    {
        id: 'marble', label: 'رخام أسود',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#141416'], [1, '#0a0a0b']]);
            for (let i = 0; i < 40; i++)
                glow(ctx, r() * w, r() * h, (100 + r() * 300) * (w / 1000), 'rgba(60,60,66,0.25)');
            const vein = (alpha, width) => {
                let x = r() * w, y = -20, a = Math.PI / 2 + (r() - 0.5);
                ctx.strokeStyle = `rgba(220,215,200,${alpha})`;
                ctx.lineWidth = width * (w / 1000);
                ctx.beginPath();
                ctx.moveTo(x, y);
                while (y < h + 20 && x > -50 && x < w + 50) {
                    a += (r() - 0.5) * 0.5;
                    x += Math.cos(a) * 14 * (w / 1000);
                    y += Math.abs(Math.sin(a)) * 14 * (w / 1000) + 2;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            };
            for (let i = 0; i < 8; i++)
                vein(0.25 + r() * 0.3, 1 + r() * 2.5);
            for (let i = 0; i < 16; i++)
                vein(0.08 + r() * 0.12, 0.6);
            for (let i = 0; i < 3; i++)
                vein(0.35, 1.5);
        },
    },
    {
        id: 'goldMarble', label: 'رخام بعروق ذهبية',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#ece7df'], [1, '#d9d2c6']]);
            for (let i = 0; i < 30; i++)
                glow(ctx, r() * w, r() * h, (120 + r() * 280) * (w / 1000), 'rgba(180,170,160,0.18)');
            const vein = (color, width) => {
                let x = r() * w, y = -20, a = Math.PI / 2 + (r() - 0.5) * 1.2;
                ctx.strokeStyle = color;
                ctx.lineWidth = width * (w / 1000);
                ctx.beginPath();
                ctx.moveTo(x, y);
                while (y < h + 20 && x > -60 && x < w + 60) {
                    a += (r() - 0.5) * 0.45;
                    x += Math.cos(a) * 16 * (w / 1000);
                    y += Math.abs(Math.sin(a)) * 16 * (w / 1000) + 2;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            };
            for (let i = 0; i < 5; i++)
                vein('rgba(196,150,60,0.85)', 2 + r() * 2.5);
            for (let i = 0; i < 12; i++)
                vein('rgba(120,110,100,0.25)', 0.8);
        },
    },
    {
        id: 'wood', label: 'خشب داكن',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#3a2414'], [1, '#24160c']]);
            const k = w / 1000;
            for (let i = 0; i < 160; i++) {
                const x = r() * w;
                ctx.strokeStyle = `rgba(${r() < 0.5 ? '20,10,4' : '110,70,40'},${0.1 + r() * 0.25})`;
                ctx.lineWidth = (0.6 + r() * 2.5) * k;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                for (let y = 0; y <= h; y += 40 * k)
                    ctx.lineTo(x + Math.sin(y * 0.004 + i) * 14 * k + (r() - 0.5) * 3, y);
                ctx.stroke();
            }
            for (let i = 0; i < 5; i++) {
                const cx = r() * w, cy = r() * h;
                for (let rr = 6; rr < 50; rr += 5) {
                    ctx.strokeStyle = 'rgba(20,10,4,0.35)';
                    ctx.lineWidth = 1.2 * k;
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, rr * 0.5 * k, rr * 1.6 * k, 0, 0, S_TAU);
                    ctx.stroke();
                }
            }
            for (let px = w / 4; px < w; px += w / 4) {
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.fillRect(px, 0, 3 * k, h);
            }
        },
    },
    {
        id: 'leather', label: 'جلد عتيق',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#5a2e1a'], [1, '#3a1c10']]);
            for (let i = 0; i < 60; i++)
                glow(ctx, r() * w, r() * h, (80 + r() * 200) * (w / 1000), `rgba(${r() < 0.5 ? '30,12,4' : '120,70,40'},0.2)`);
            for (let i = 0; i < 9000 * (w / 1000) ** 2; i++) {
                ctx.fillStyle = `rgba(0,0,0,${r() * 0.22})`;
                ctx.fillRect(r() * w, r() * h, 1.5, 1.5);
            }
            const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, 'rgba(0,0,0,0.6)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
            const k = w / 1000;
            ctx.strokeStyle = 'rgba(200,150,90,0.55)';
            ctx.setLineDash([10 * k, 8 * k]);
            ctx.lineWidth = 2 * k;
            ctx.strokeRect(40 * k, 40 * k, w - 80 * k, h - 80 * k);
            ctx.setLineDash([]);
        },
    },
    {
        id: 'tiles', label: 'بلاط إسلامي',
        draw(ctx, w, h) {
            ctx.fillStyle = '#0d3b4a';
            ctx.fillRect(0, 0, w, h);
            const cell = 125 * (w / 1000);
            const star = (cx, cy, R, rot, fill) => {
                ctx.beginPath();
                for (let i = 0; i < 16; i++) {
                    const a = rot + (i * Math.PI) / 8;
                    const rr = i % 2 ? R * 0.62 : R;
                    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
                    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.closePath();
                ctx.fillStyle = fill;
                ctx.fill();
                ctx.strokeStyle = 'rgba(240,230,200,0.85)';
                ctx.lineWidth = 2 * (w / 1000);
                ctx.stroke();
            };
            for (let y = 0; y <= h + cell; y += cell) {
                for (let x = 0; x <= w + cell; x += cell) {
                    star(x, y, cell * 0.46, Math.PI / 8, '#1d6f86');
                    star(x, y, cell * 0.22, 0, '#e2b14f');
                    ctx.fillStyle = '#9c2f2f';
                    ctx.beginPath();
                    ctx.arc(x + cell / 2, y + cell / 2, cell * 0.12, 0, S_TAU);
                    ctx.fill();
                }
            }
        },
    },
    {
        id: 'hexagons', label: 'خلايا سداسية',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#0b0f14'], [1, '#141c26']]);
            const R = 46 * (w / 1000), dx = R * Math.sqrt(3), dy = R * 1.5;
            for (let row = -1, y = 0; y < h + R; row++, y = row * dy) {
                for (let x = row % 2 ? dx / 2 : 0; x < w + dx; x += dx) {
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const a = Math.PI / 6 + (i * S_TAU) / 6;
                        ctx.lineTo(x + Math.cos(a) * R * 0.92, y + Math.sin(a) * R * 0.92);
                    }
                    ctx.closePath();
                    const lit = r();
                    ctx.fillStyle = lit > 0.93 ? 'rgba(212,175,106,0.55)' : `rgba(40,60,80,${0.15 + lit * 0.25})`;
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(120,160,200,0.18)';
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                }
            }
            glow(ctx, w * 0.5, h * 0.45, w * 0.6, 'rgba(60,120,200,0.18)');
        },
    },
    {
        id: 'watercolor', label: 'ألوان مائية',
        draw(ctx, w, h, r) {
            ctx.fillStyle = '#f4efe6';
            ctx.fillRect(0, 0, w, h);
            const cols = ['200,90,110', '90,140,200', '230,170,80', '120,180,150', '160,110,200'];
            for (let i = 0; i < 26; i++) {
                const c = cols[Math.floor(r() * cols.length)];
                const x = r() * w, y = r() * h, rad = (120 + r() * 260) * (w / 1000);
                for (let k = 0; k < 5; k++)
                    glow(ctx, x + (r() - 0.5) * rad * 0.5, y + (r() - 0.5) * rad * 0.5, rad * (0.6 + r() * 0.5), `rgba(${c},0.12)`);
            }
            for (let i = 0; i < 6000 * (w / 1000) ** 2; i++) {
                ctx.fillStyle = `rgba(120,100,80,${r() * 0.08})`;
                ctx.fillRect(r() * w, r() * h, 1.5, 1.5);
            }
        },
    },
    {
        id: 'mesh', label: 'تدرّج عصري',
        draw(ctx, w, h) {
            ctx.fillStyle = '#120d2a';
            ctx.fillRect(0, 0, w, h);
            glow(ctx, w * 0.15, h * 0.2, w * 0.8, 'rgba(255,80,140,0.75)');
            glow(ctx, w * 0.9, h * 0.35, w * 0.8, 'rgba(90,110,255,0.7)');
            glow(ctx, w * 0.4, h * 0.85, w * 0.9, 'rgba(255,170,60,0.6)');
            glow(ctx, w * 0.75, h * 0.95, w * 0.5, 'rgba(60,220,200,0.45)');
        },
    },
    {
        id: 'abstractWaves', label: 'أمواج تجريدية',
        draw(ctx, w, h) {
            vGrad(ctx, w, h, [[0, '#0b2140'], [1, '#04101f']]);
            const cols = ['#103a6b', '#1a5590', '#2a74b5', '#d4af6a', '#f0dfb5'];
            cols.forEach((c, i) => {
                const y0 = h * (0.45 + i * 0.1);
                ctx.fillStyle = c;
                ctx.beginPath();
                ctx.moveTo(0, h);
                ctx.lineTo(0, y0);
                ctx.bezierCurveTo(w * 0.3, y0 - h * 0.12, w * 0.6, y0 + h * 0.1, w, y0 - h * 0.05);
                ctx.lineTo(w, h);
                ctx.closePath();
                ctx.globalAlpha = i >= 3 ? 0.9 : 0.85;
                ctx.fill();
                ctx.globalAlpha = 1;
            });
        },
    },
    {
        id: 'velvet', label: 'مخمل أحمر',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#3a0610'], [1, '#1a0207']]);
            const k = w / 1000;
            for (let i = 0; i < 14; i++) {
                const x = (w * i) / 13 + (r() - 0.5) * 20;
                const g = ctx.createLinearGradient(x - 40 * k, 0, x + 40 * k, 0);
                g.addColorStop(0, 'rgba(0,0,0,0)');
                g.addColorStop(0.5, `rgba(${150 + r() * 60},20,40,0.35)`);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x - 40 * k, 0, 80 * k, h);
            }
            glow(ctx, w * 0.5, h * 0.25, w * 0.6, 'rgba(255,190,120,0.18)');
        },
    },
    // ═════════════ مشاهد جديدة ═════════════
    {
        id: 'library', label: 'مكتبة قديمة',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#120b06'], [0.5, '#24160c'], [1, '#0b0704']]);
            const k = w / 1000;
            const shelfH = 150 * k;
            for (let y = 40 * k, row = 0; y < h; y += shelfH, row++) {
                let x = 20 * k;
                while (x < w - 20 * k) {
                    const bw = (16 + r() * 26) * k;
                    const bh = shelfH * (0.62 + r() * 0.28);
                    const hue = [18, 28, 8, 40, 0, 200, 120][Math.floor(r() * 7)];
                    const l = 12 + r() * 18;
                    ctx.fillStyle = `hsl(${hue},${30 + r() * 35}%,${l}%)`;
                    const tilt = r() < 0.06;
                    ctx.save();
                    ctx.translate(x, y + shelfH - 12 * k);
                    if (tilt)
                        ctx.rotate(-0.12);
                    ctx.fillRect(0, -bh, bw, bh);
                    ctx.fillStyle = `rgba(212,175,106,${0.25 + r() * 0.35})`;
                    ctx.fillRect(bw * 0.15, -bh * 0.82, bw * 0.7, 2 * k);
                    ctx.fillRect(bw * 0.15, -bh * 0.2, bw * 0.7, 2 * k);
                    ctx.restore();
                    x += bw + (tilt ? 10 : 1.5) * k;
                }
                ctx.fillStyle = '#2a170b';
                ctx.fillRect(0, y + shelfH - 12 * k, w, 12 * k);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, y + shelfH, w, 6 * k);
            }
            glow(ctx, w * 0.5, h * 0.42, w * 0.9, 'rgba(255,170,80,0.28)');
            const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, h * 0.75);
            v.addColorStop(0, 'rgba(0,0,0,0)');
            v.addColorStop(1, 'rgba(0,0,0,0.85)');
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, w, h);
        },
    },
    {
        id: 'candle', label: 'شمعة في الظلام',
        draw(ctx, w, h) {
            ctx.fillStyle = '#050302';
            ctx.fillRect(0, 0, w, h);
            const cx = w * 0.5, cy = h * 0.6;
            glow(ctx, cx, cy - w * 0.08, w * 0.85, 'rgba(255,150,50,0.32)');
            glow(ctx, cx, cy - w * 0.08, w * 0.3, 'rgba(255,190,90,0.4)');
            const cw = w * 0.11, ch = h * 0.3;
            const g = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
            g.addColorStop(0, '#3a2a1a');
            g.addColorStop(0.35, '#e9d9b8');
            g.addColorStop(1, '#4a3420');
            ctx.fillStyle = g;
            ctx.fillRect(cx - cw / 2, cy, cw, ch);
            ctx.strokeStyle = '#111';
            ctx.lineWidth = w * 0.004;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx, cy - w * 0.025);
            ctx.stroke();
            const fy = cy - w * 0.07;
            const fl = ctx.createRadialGradient(cx, fy + w * 0.02, 0, cx, fy, w * 0.06);
            fl.addColorStop(0, '#fffbe8');
            fl.addColorStop(0.4, '#ffd27a');
            fl.addColorStop(1, 'rgba(255,120,20,0)');
            ctx.fillStyle = fl;
            ctx.beginPath();
            ctx.ellipse(cx, fy, w * 0.022, w * 0.055, 0, 0, S_TAU);
            ctx.fill();
            const fg = ctx.createLinearGradient(0, cy + ch, 0, h);
            fg.addColorStop(0, '#1a0f07');
            fg.addColorStop(1, '#030201');
            ctx.fillStyle = fg;
            ctx.fillRect(0, cy + ch, w, h - cy - ch);
        },
    },
    {
        id: 'ruins', label: 'أعمدة أثرية',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#1a1426'], [0.45, '#7a3b2e'], [0.7, '#d98a4a'], [1, '#2a170e']]);
            glow(ctx, w * 0.5, h * 0.66, w * 0.5, 'rgba(255,190,110,0.55)');
            const k = w / 1000;
            const base = h * 0.8;
            ctx.fillStyle = '#1a0e09';
            const cols = [[0.08, 0.5], [0.24, 0.42], [0.4, 0.3], [0.6, 0.33], [0.76, 0.47], [0.92, 0.25]];
            cols.forEach(([fx, top]) => {
                const cx = w * fx, cw = 62 * k, ty = h * top + r() * 40 * k;
                ctx.fillRect(cx - cw / 2, ty, cw, base - ty);
                ctx.fillRect(cx - cw * 0.75, ty - 14 * k, cw * 1.5, 18 * k);
                ctx.fillRect(cx - cw * 0.75, base - 16 * k, cw * 1.5, 16 * k);
            });
            ctx.fillRect(w * 0.36, h * 0.28, w * 0.28, 26 * k);
            ctx.fillRect(0, base, w, h - base);
            ridge(ctx, w, h, base + 20 * k, 20 * k, 2, '#0d0705', r);
        },
    },
    {
        id: 'oasis', label: 'واحة نخيل',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#2a1838'], [0.4, '#b0503e'], [0.6, '#f0a35a'], [0.62, '#5a3a2a'], [1, '#1a0f0a']]);
            glow(ctx, w * 0.62, h * 0.58, w * 0.3, 'rgba(255,220,150,0.8)');
            // ماء مع انعكاس
            ctx.fillStyle = 'rgba(255,190,120,0.25)';
            for (let i = 0; i < 40; i++)
                ctx.fillRect(w * (0.45 + r() * 0.35), h * (0.63 + r() * 0.1), w * (0.03 + r() * 0.1), 2 * (w / 1000));
            ridge(ctx, w, h, h * 0.78, h * 0.05, 1, '#1a0d08', r, true);
            const palm = (x, y, s, lean) => {
                ctx.strokeStyle = '#0c0604';
                ctx.fillStyle = '#0c0604';
                ctx.lineWidth = 9 * s;
                ctx.lineCap = 'round';
                const tx = x + lean * 120 * s, ty = y - 330 * s;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.quadraticCurveTo(x + lean * 20 * s, y - 180 * s, tx, ty);
                ctx.stroke();
                for (let i = 0; i < 9; i++) {
                    const a = -Math.PI / 2 + (i - 4) * 0.42 + (r() - 0.5) * 0.2;
                    const len = (130 + r() * 50) * s;
                    const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.6 + len * 0.45;
                    ctx.lineWidth = 3 * s;
                    ctx.beginPath();
                    ctx.moveTo(tx, ty);
                    ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - 30 * s, ex, ey);
                    ctx.stroke();
                    for (let j = 1; j < 10; j++) {
                        const t = j / 10;
                        const px = tx + (ex - tx) * t, py = ty + (ey - ty) * t - Math.sin(t * Math.PI) * 30 * s;
                        ctx.lineWidth = 2 * s;
                        ctx.beginPath();
                        ctx.moveTo(px, py);
                        ctx.lineTo(px + 14 * s * Math.cos(a + 1.2), py + 22 * s);
                        ctx.stroke();
                    }
                }
            };
            const k = w / 1000;
            palm(w * 0.18, h * 0.84, 1.15 * k, 0.25);
            palm(w * 0.32, h * 0.82, 0.8 * k, -0.15);
            palm(w * 0.88, h * 0.86, 1.0 * k, -0.3);
        },
    },
    {
        id: 'snowpeaks', label: 'جبال مثلجة',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#060b18'], [0.5, '#1d3354'], [0.8, '#6b86a8']]);
            stars(ctx, w, h, r, 350, h * 0.45);
            const peak = (bx, by, pw, ph, col, snow) => {
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.moveTo(bx - pw, h);
                ctx.lineTo(bx - pw * 0.4, by + ph * 0.5);
                ctx.lineTo(bx, by);
                ctx.lineTo(bx + pw * 0.35, by + ph * 0.4);
                ctx.lineTo(bx + pw, h);
                ctx.fill();
                ctx.fillStyle = snow;
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(bx - pw * 0.22, by + ph * 0.28);
                ctx.lineTo(bx - pw * 0.08, by + ph * 0.22);
                ctx.lineTo(bx + pw * 0.05, by + ph * 0.3);
                ctx.lineTo(bx + pw * 0.2, by + ph * 0.24);
                ctx.closePath();
                ctx.fill();
            };
            peak(w * 0.25, h * 0.42, w * 0.55, h * 0.5, '#2c3e5c', '#dfe9f5');
            peak(w * 0.75, h * 0.36, w * 0.6, h * 0.55, '#22324d', '#f2f6fb');
            peak(w * 0.5, h * 0.55, w * 0.45, h * 0.4, '#18253b', '#c8d6e8');
            ridge(ctx, w, h, h * 0.86, h * 0.03, 1.4, '#e9f0f8', r, true);
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            for (let i = 0; i < 260; i++) {
                ctx.beginPath();
                ctx.arc(r() * w, r() * h, r() * 2.2 * (w / 1000), 0, S_TAU);
                ctx.fill();
            }
        },
    },
    {
        id: 'seaSunrise', label: 'شروق على البحر',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#14203a'], [0.3, '#5a4a7a'], [0.5, '#f29a6a'], [0.56, '#ffd6a0'], [0.56, '#3a3550'], [1, '#0a0c18']]);
            glow(ctx, w * 0.5, h * 0.56, w * 0.45, 'rgba(255,200,120,0.6)');
            ctx.fillStyle = '#fff1c8';
            ctx.beginPath();
            ctx.arc(w * 0.5, h * 0.56, w * 0.09, Math.PI, 0);
            ctx.fill();
            for (let i = 0; i < 70; i++) {
                const y = h * 0.565 + Math.pow(r(), 1.6) * h * 0.42;
                const spread = (y - h * 0.56) / (h * 0.44);
                const len = w * (0.02 + r() * 0.12) * (1 + spread);
                ctx.fillStyle = `rgba(255,${190 + r() * 50},${120 + r() * 60},${0.5 - spread * 0.35})`;
                ctx.fillRect(w * 0.5 + (r() - 0.5) * w * (0.15 + spread * 0.6) - len / 2, y, len, (1.5 + spread * 3) * (w / 1000));
            }
        },
    },
    {
        id: 'rainyWindow', label: 'نافذة ممطرة',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#0b1220'], [1, '#1b2232']]);
            const cols = ['255,170,80', '255,120,90', '120,190,255', '255,220,140', '200,120,255'];
            for (let i = 0; i < 70; i++) {
                const c = cols[Math.floor(r() * cols.length)];
                glow(ctx, r() * w, h * (0.25 + r() * 0.7), w * (0.03 + r() * 0.09), `rgba(${c},${0.18 + r() * 0.3})`);
            }
            ctx.fillStyle = 'rgba(10,16,28,0.35)';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 520; i++) {
                const x = r() * w, y = r() * h, s = (1 + r() * r() * 7) * (w / 1000);
                ctx.fillStyle = 'rgba(200,220,255,0.18)';
                ctx.beginPath();
                ctx.ellipse(x, y, s, s * 1.25, 0, 0, S_TAU);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.beginPath();
                ctx.arc(x - s * 0.3, y - s * 0.4, s * 0.3, 0, S_TAU);
                ctx.fill();
                if (s > 4 * (w / 1000) && r() < 0.5) {
                    ctx.strokeStyle = 'rgba(200,220,255,0.12)';
                    ctx.lineWidth = s * 0.6;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + (r() - 0.5) * 10, y + h * (0.05 + r() * 0.15));
                    ctx.stroke();
                }
            }
        },
    },
    {
        id: 'goldenClouds', label: 'غيوم ذهبية',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#2a1a2e'], [0.5, '#a0583a'], [1, '#f2c27a']]);
            glow(ctx, w * 0.55, h * 0.75, w * 0.6, 'rgba(255,230,160,0.6)');
            for (let layer = 0; layer < 5; layer++) {
                const y0 = h * (0.15 + layer * 0.17);
                const tone = 40 + layer * 30;
                for (let i = 0; i < 34; i++) {
                    const x = r() * w * 1.2 - w * 0.1, y = y0 + (r() - 0.5) * h * 0.08, R = w * (0.06 + r() * 0.1);
                    const g = ctx.createRadialGradient(x, y - R * 0.3, 0, x, y, R);
                    g.addColorStop(0, `rgba(255,${180 + layer * 12},${tone + 60},0.3)`);
                    g.addColorStop(0.7, `rgba(${150 + layer * 20},${70 + layer * 25},${tone},0.25)`);
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = g;
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.scale(2.2, 0.8);
                    ctx.translate(-x, -y);
                    ctx.beginPath();
                    ctx.arc(x, y, R, 0, S_TAU);
                    ctx.fill();
                    ctx.restore();
                }
            }
        },
    },
    {
        id: 'foggyRoad', label: 'طريق في الضباب',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#5d6670'], [0.45, '#9aa3a8'], [1, '#1b1e22']]);
            const vy = h * 0.46;
            ctx.fillStyle = '#26292d';
            ctx.beginPath();
            ctx.moveTo(w * 0.48, vy);
            ctx.lineTo(w * 0.52, vy);
            ctx.lineTo(w * 0.95, h);
            ctx.lineTo(w * 0.05, h);
            ctx.fill();
            ctx.fillStyle = 'rgba(230,220,180,0.55)';
            for (let i = 0; i < 12; i++) {
                const t0 = Math.pow(i / 12, 1.8), t1 = Math.pow((i + 0.5) / 12, 1.8);
                const y0 = vy + (h - vy) * t0, y1 = vy + (h - vy) * t1;
                const hw0 = w * 0.004 * (1 + t0 * 4), hw1 = w * 0.004 * (1 + t1 * 4);
                ctx.beginPath();
                ctx.moveTo(w / 2 - hw0, y0);
                ctx.lineTo(w / 2 + hw0, y0);
                ctx.lineTo(w / 2 + hw1, y1);
                ctx.lineTo(w / 2 - hw1, y1);
                ctx.fill();
            }
            for (let side = -1; side <= 1; side += 2) {
                for (let i = 0; i < 9; i++) {
                    const t = Math.pow((i + 1) / 9, 1.6);
                    const x = w / 2 + side * (w * 0.06 + t * w * 0.55);
                    const y = vy + (h - vy) * t * 0.9;
                    const th = h * (0.06 + t * 0.55);
                    const a = 0.25 + t * 0.7;
                    ctx.fillStyle = `rgba(20,24,26,${a})`;
                    ctx.fillRect(x - 3 * t * (w / 300), y - th, 6 * t * (w / 300) + 2, th);
                    ctx.beginPath();
                    ctx.moveTo(x, y - th * 1.1);
                    ctx.lineTo(x - th * 0.18, y - th * 0.35);
                    ctx.lineTo(x + th * 0.18, y - th * 0.35);
                    ctx.fill();
                }
            }
            const f = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.7);
            f.addColorStop(0, 'rgba(170,178,184,0)');
            f.addColorStop(0.5, 'rgba(170,178,184,0.55)');
            f.addColorStop(1, 'rgba(170,178,184,0)');
            ctx.fillStyle = f;
            ctx.fillRect(0, 0, w, h);
        },
    },
    {
        id: 'goldFoil', label: 'رقائق ذهبية',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#6b4a1a'], [0.5, '#c9a04a'], [1, '#5a3c12']]);
            for (let i = 0; i < 380; i++) {
                const x = r() * w, y = r() * h, s = w * (0.02 + r() * 0.08);
                const l = r();
                ctx.fillStyle = l > 0.6 ? `rgba(255,236,170,${0.15 + r() * 0.3})` : `rgba(70,45,10,${0.1 + r() * 0.25})`;
                ctx.beginPath();
                ctx.moveTo(x, y);
                for (let j = 0; j < 4; j++)
                    ctx.lineTo(x + (r() - 0.5) * s * 2, y + (r() - 0.5) * s * 2);
                ctx.closePath();
                ctx.fill();
            }
            glow(ctx, w * 0.3, h * 0.25, w * 0.5, 'rgba(255,240,190,0.35)');
        },
    },
    {
        id: 'artDeco', label: 'آرت ديكو',
        draw(ctx, w, h) {
            ctx.fillStyle = '#0b0b0d';
            ctx.fillRect(0, 0, w, h);
            const k = w / 1000;
            const R = 110 * k;
            ctx.strokeStyle = 'rgba(222,188,120,0.9)';
            ctx.lineWidth = 2.4 * k;
            for (let row = 0; row * R * 0.5 < h + R; row++) {
                const y = row * R * 0.5;
                for (let col = -1; col * R < w + R; col++) {
                    const x = col * R + (row % 2 ? R / 2 : 0);
                    for (let ring = 1; ring <= 4; ring++) {
                        ctx.beginPath();
                        ctx.arc(x, y, (R / 2) * (ring / 4), Math.PI, 0);
                        ctx.stroke();
                    }
                    ctx.fillStyle = '#0b0b0d';
                }
            }
            const v = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.7);
            v.addColorStop(0, 'rgba(11,11,13,0.55)');
            v.addColorStop(0.5, 'rgba(11,11,13,0.05)');
            v.addColorStop(1, 'rgba(0,0,0,0.55)');
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, w, h);
        },
    },
    {
        id: 'smoke', label: 'دخان ملوّن',
        draw(ctx, w, h, r) {
            ctx.fillStyle = '#060508';
            ctx.fillRect(0, 0, w, h);
            const cols = ['180,60,255', '255,80,140', '60,160,255', '255,150,60'];
            ctx.globalCompositeOperation = 'lighter';
            for (let s = 0; s < 4; s++) {
                const c = cols[s];
                let x = w * (0.2 + r() * 0.6), y = h;
                for (let i = 0; i < 90; i++) {
                    x += (r() - 0.5) * w * 0.06 + Math.sin(i * 0.15 + s) * w * 0.012;
                    y -= h * 0.011;
                    glow(ctx, x, y, w * (0.04 + i * 0.0018), `rgba(${c},${0.05})`);
                }
            }
            ctx.globalCompositeOperation = 'source-over';
        },
    },
    {
        id: 'papyrus', label: 'ورق بردي',
        draw(ctx, w, h, r) {
            ctx.fillStyle = '#c9a96a';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 160; i++) {
                const x = r() * w;
                ctx.fillStyle = `rgba(${r() < 0.5 ? '120,85,35' : '235,210,150'},${0.08 + r() * 0.12})`;
                ctx.fillRect(x, 0, (2 + r() * 10) * (w / 1000), h);
            }
            for (let i = 0; i < 160; i++) {
                const y = r() * h;
                ctx.fillStyle = `rgba(${r() < 0.5 ? '120,85,35' : '235,210,150'},${0.05 + r() * 0.08})`;
                ctx.fillRect(0, y, w, (2 + r() * 8) * (w / 1000));
            }
            const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, h * 0.75);
            v.addColorStop(0, 'rgba(0,0,0,0)');
            v.addColorStop(1, 'rgba(70,40,10,0.65)');
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, w, h);
        },
    },
    {
        id: 'arabesque', label: 'أرابيسك كامل',
        draw(ctx, w, h) {
            ctx.fillStyle = '#0d1a1a';
            ctx.fillRect(0, 0, w, h);
            const k = w / 1000, S = 125 * k;
            ctx.strokeStyle = 'rgba(222,188,120,0.85)';
            ctx.lineWidth = 2.6 * k;
            const star = (cx, cy, R) => {
                ctx.beginPath();
                for (let i = 0; i <= 16; i++) {
                    const a = (i * Math.PI) / 8 - Math.PI / 2;
                    const rr = i % 2 ? R * 0.62 : R;
                    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
                    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
                }
                ctx.stroke();
            };
            for (let y = 0; y < h + S; y += S) {
                for (let x = 0; x < w + S; x += S) {
                    star(x, y, S * 0.48);
                    star(x, y, S * 0.28);
                    ctx.beginPath();
                    ctx.moveTo(x + S * 0.48, y);
                    ctx.lineTo(x + S * 0.52, y);
                    ctx.stroke();
                    ctx.save();
                    ctx.translate(x + S / 2, y + S / 2);
                    ctx.rotate(Math.PI / 4);
                    ctx.strokeRect(-S * 0.14, -S * 0.14, S * 0.28, S * 0.28);
                    ctx.restore();
                }
            }
            const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, h * 0.7);
            v.addColorStop(0, 'rgba(13,26,26,0.5)');
            v.addColorStop(1, 'rgba(0,0,0,0.5)');
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, w, h);
        },
    },
    {
        id: 'grainGradient', label: 'تدرّج حبيبي',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#1b1446'], [0.5, '#c2416b'], [1, '#f6a457']]);
            glow(ctx, w * 0.2, h * 0.3, w * 0.7, 'rgba(90,60,255,0.45)');
            glow(ctx, w * 0.85, h * 0.8, w * 0.6, 'rgba(255,210,120,0.4)');
            const img = ctx.getImageData(0, 0, w, h);
            const d = img.data;
            for (let i = 0; i < d.length; i += 4) {
                const n = (r() - 0.5) * 38;
                d[i] += n;
                d[i + 1] += n;
                d[i + 2] += n;
            }
            ctx.putImageData(img, 0, 0);
        },
    },
    {
        id: 'stormSky', label: 'سماء عاصفة',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#07090f'], [0.6, '#1d2433'], [1, '#0a0c12']]);
            for (let i = 0; i < 90; i++) {
                const x = r() * w, y = r() * h * 0.7, R = w * (0.08 + r() * 0.15);
                const g = ctx.createRadialGradient(x, y, 0, x, y, R);
                g.addColorStop(0, `rgba(${60 + r() * 40},${70 + r() * 40},${95 + r() * 40},0.35)`);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(x, y, R, 0, S_TAU);
                ctx.fill();
            }
            const bolt = (x, y, len, width, depth) => {
                ctx.lineWidth = width;
                ctx.beginPath();
                ctx.moveTo(x, y);
                let cx = x, cy = y;
                const steps = 14;
                for (let i = 0; i < steps; i++) {
                    cx += (r() - 0.5) * w * 0.06;
                    cy += len / steps;
                    ctx.lineTo(cx, cy);
                    if (depth < 2 && r() < 0.15) {
                        ctx.stroke();
                        bolt(cx, cy, len * 0.4, width * 0.5, depth + 1);
                        ctx.lineWidth = width;
                        ctx.beginPath();
                        ctx.moveTo(cx, cy);
                    }
                }
                ctx.stroke();
            };
            glow(ctx, w * 0.62, h * 0.35, w * 0.45, 'rgba(160,190,255,0.25)');
            ctx.strokeStyle = 'rgba(225,235,255,0.95)';
            ctx.shadowColor = '#9fbaff';
            ctx.shadowBlur = 25 * (w / 1000);
            bolt(w * 0.6, h * 0.12, h * 0.6, 4 * (w / 1000), 0);
            ctx.shadowBlur = 0;
            ridge(ctx, w, h, h * 0.88, h * 0.04, 1.5, '#040508', r);
        },
    },
    {
        id: 'lanterns', label: 'فوانيس رمضان',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#0a0718'], [0.7, '#24153a'], [1, '#120a1c']]);
            stars(ctx, w, h, r, 200, h);
            const k = w / 1000;
            const lantern = (x, len, s) => {
                ctx.strokeStyle = 'rgba(212,175,106,0.6)';
                ctx.lineWidth = 1.5 * k;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, len);
                ctx.stroke();
                const y = len;
                glow(ctx, x, y + 70 * s, 200 * s, 'rgba(255,170,60,0.35)');
                ctx.fillStyle = '#b8914a';
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x - 26 * s, y + 30 * s);
                ctx.lineTo(x + 26 * s, y + 30 * s);
                ctx.fill();
                const body = ctx.createLinearGradient(x - 34 * s, 0, x + 34 * s, 0);
                body.addColorStop(0, '#7a3a10');
                body.addColorStop(0.5, '#ffcf6a');
                body.addColorStop(1, '#7a3a10');
                ctx.fillStyle = body;
                ctx.beginPath();
                ctx.moveTo(x - 26 * s, y + 30 * s);
                ctx.lineTo(x - 36 * s, y + 80 * s);
                ctx.lineTo(x - 22 * s, y + 125 * s);
                ctx.lineTo(x + 22 * s, y + 125 * s);
                ctx.lineTo(x + 36 * s, y + 80 * s);
                ctx.lineTo(x + 26 * s, y + 30 * s);
                ctx.fill();
                ctx.strokeStyle = '#5a3a12';
                ctx.lineWidth = 2 * s;
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.moveTo(x + i * 14 * s, y + 32 * s);
                    ctx.lineTo(x + i * 12 * s, y + 123 * s);
                    ctx.stroke();
                }
                ctx.fillStyle = '#b8914a';
                ctx.beginPath();
                ctx.moveTo(x - 22 * s, y + 125 * s);
                ctx.lineTo(x, y + 150 * s);
                ctx.lineTo(x + 22 * s, y + 125 * s);
                ctx.fill();
            };
            lantern(w * 0.2, h * 0.12, 1.1 * k);
            lantern(w * 0.45, h * 0.04, 0.8 * k);
            lantern(w * 0.7, h * 0.18, 1.3 * k);
            lantern(w * 0.9, h * 0.06, 0.7 * k);
            ctx.fillStyle = '#f3ead2';
            ctx.beginPath();
            ctx.arc(w * 0.82, h * 0.72, w * 0.1, 0, S_TAU);
            ctx.fill();
            ctx.fillStyle = '#1b1030';
            ctx.beginPath();
            ctx.arc(w * 0.86, h * 0.7, w * 0.09, 0, S_TAU);
            ctx.fill();
        },
    },
    {
        id: 'aurora', label: 'شفق قطبي',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#020611'], [0.7, '#0a1a2a'], [1, '#02050a']]);
            stars(ctx, w, h, r, 450, h * 0.7);
            ctx.globalCompositeOperation = 'lighter';
            for (let band = 0; band < 3; band++) {
                const col = ['60,255,170', '90,200,255', '170,90,255'][band];
                for (let i = 0; i < 120; i++) {
                    const t = i / 120;
                    const x = t * w;
                    const y = h * (0.28 + band * 0.07) + Math.sin(t * 5 + band) * h * 0.07;
                    const g = ctx.createLinearGradient(x, y - h * 0.22, x, y);
                    g.addColorStop(0, 'rgba(0,0,0,0)');
                    g.addColorStop(1, `rgba(${col},${0.05 + r() * 0.04})`);
                    ctx.fillStyle = g;
                    ctx.fillRect(x, y - h * 0.22, w / 100, h * 0.22 + 4);
                }
            }
            ctx.globalCompositeOperation = 'source-over';
            ridge(ctx, w, h, h * 0.78, h * 0.08, 1.2, '#050a10', r);
            ridge(ctx, w, h, h * 0.88, h * 0.04, 2, '#020406', r);
        },
    },
    {
        id: 'oldPaper', label: 'ورق عتيق',
        draw(ctx, w, h, r) {
            ctx.fillStyle = '#e4d3b0';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 26; i++)
                glow(ctx, r() * w, r() * h, w * (0.05 + r() * 0.18), `rgba(150,105,50,${0.06 + r() * 0.1})`);
            const img = ctx.getImageData(0, 0, w, h);
            const d = img.data;
            for (let i = 0; i < d.length; i += 4) {
                const n = (r() - 0.5) * 16;
                d[i] += n;
                d[i + 1] += n;
                d[i + 2] += n;
            }
            ctx.putImageData(img, 0, 0);
            const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, h * 0.72);
            v.addColorStop(0, 'rgba(0,0,0,0)');
            v.addColorStop(1, 'rgba(90,55,15,0.6)');
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, w, h);
        },
    },
    {
        id: 'bokeh', label: 'أضواء ذهبية',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#0a0805'], [1, '#1a120a']]);
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 110; i++) {
                const x = r() * w, y = r() * h, R = w * (0.015 + r() * r() * 0.08);
                const a = 0.08 + r() * 0.25;
                ctx.fillStyle = `rgba(255,${170 + r() * 60},${70 + r() * 60},${a})`;
                ctx.beginPath();
                ctx.arc(x, y, R, 0, S_TAU);
                ctx.fill();
                ctx.strokeStyle = `rgba(255,220,150,${a * 0.8})`;
                ctx.lineWidth = 1.5 * (w / 1000);
                ctx.stroke();
            }
            ctx.globalCompositeOperation = 'source-over';
        },
    },
    {
        id: 'caravan', label: 'قافلة في الصحراء',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#3a1a20'], [0.45, '#d0603a'], [0.62, '#ffc070'], [1, '#ffd890']]);
            glow(ctx, w * 0.3, h * 0.6, w * 0.3, 'rgba(255,240,190,0.9)');
            ridge(ctx, w, h, h * 0.7, h * 0.07, 0.9, '#7a3a20', r, true);
            ridge(ctx, w, h, h * 0.8, h * 0.05, 1.4, '#3a180c', r, true);
            const k = w / 1000;
            const camel = (x, y, s) => {
                ctx.fillStyle = '#1a0a05';
                ctx.strokeStyle = '#1a0a05';
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.ellipse(x, y, 42 * s, 20 * s, 0, 0, S_TAU);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(x + 2 * s, y - 18 * s, 18 * s, 16 * s, 0, 0, S_TAU);
                ctx.fill();
                ctx.lineWidth = 8 * s;
                ctx.beginPath();
                ctx.moveTo(x - 36 * s, y - 5 * s);
                ctx.quadraticCurveTo(x - 60 * s, y - 20 * s, x - 62 * s, y - 45 * s);
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(x - 68 * s, y - 46 * s, 12 * s, 6 * s, -0.2, 0, S_TAU);
                ctx.fill();
                ctx.lineWidth = 5 * s;
                [-28, -18, 22, 32].forEach((dx) => { ctx.beginPath(); ctx.moveTo(x + dx * s, y + 10 * s); ctx.lineTo(x + dx * s + 2 * s, y + 58 * s); ctx.stroke(); });
                ctx.lineWidth = 6 * s;
                ctx.beginPath();
                ctx.moveTo(x + 2 * s, y - 34 * s);
                ctx.lineTo(x + 2 * s, y - 62 * s);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(x + 2 * s, y - 68 * s, 7 * s, 0, S_TAU);
                ctx.fill();
            };
            [[0.3, 0.73, 1], [0.48, 0.725, 0.9], [0.64, 0.72, 0.8], [0.78, 0.716, 0.7]].forEach(([fx, fy, s]) => camel(w * fx, h * fy, s * k));
        },
    },
    {
        id: 'inkSplash', label: 'حبر على ورق',
        draw(ctx, w, h, r) {
            ctx.fillStyle = '#efe6d4';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#0d0b0a';
            const blob = (cx, cy, R, n) => {
                const ph = [r() * 6, r() * 6, r() * 6];
                const pts = [];
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * S_TAU;
                    const rr = R * (0.82 + 0.12 * Math.sin(a * 3 + ph[0]) + 0.08 * Math.sin(a * 7 + ph[1]) + 0.05 * Math.sin(a * 13 + ph[2]));
                    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
                }
                ctx.beginPath();
                pts.forEach(([x, y], i) => {
                    const [nx, ny] = pts[(i + 1) % n];
                    if (i === 0)
                        ctx.moveTo((x + nx) / 2, (y + ny) / 2);
                    else
                        ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
                });
                ctx.quadraticCurveTo(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
                ctx.closePath();
                ctx.fill();
            };
            blob(w * 0.55, h * 0.62, w * 0.32, 60);
            for (let i = 0; i < 70; i++) {
                const a = r() * S_TAU, d = w * (0.3 + r() * 0.35);
                blob(w * 0.55 + Math.cos(a) * d, h * 0.62 + Math.sin(a) * d, w * (0.004 + r() * r() * 0.03), 12);
            }
        },
    },
    // ═════════════ أمنية وعسكرية وبحثية ═════════════
    {
        id: 'radar', label: 'شاشة رادار', cat: 'security',
        draw(ctx, w, h, r) {
            ctx.fillStyle = '#020a05';
            ctx.fillRect(0, 0, w, h);
            const cx = w / 2, cy = h * 0.5, R = w * 0.46, k = w / 1000;
            ctx.strokeStyle = 'rgba(60,255,140,0.07)';
            ctx.lineWidth = 1 * k;
            for (let x = 0; x < w; x += 40 * k) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            for (let y = 0; y < h; y += 40 * k) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            glow(ctx, cx, cy, R * 1.1, 'rgba(30,200,100,0.12)');
            ctx.strokeStyle = 'rgba(80,255,150,0.45)';
            ctx.lineWidth = 2 * k;
            for (let i = 1; i <= 5; i++) {
                ctx.beginPath();
                ctx.arc(cx, cy, (R * i) / 5, 0, S_TAU);
                ctx.stroke();
            }
            ctx.lineWidth = 1 * k;
            for (let a = 0; a < 12; a++) {
                const t = (a * Math.PI) / 6;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(t) * R, cy + Math.sin(t) * R);
                ctx.stroke();
            }
            for (let a = 0; a < 72; a++) {
                const t = (a * Math.PI) / 36, l = a % 6 ? 10 : 22;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(t) * R, cy + Math.sin(t) * R);
                ctx.lineTo(cx + Math.cos(t) * (R - l * k), cy + Math.sin(t) * (R - l * k));
                ctx.stroke();
            }
            const sweep = -0.6;
            for (let i = 0; i < 60; i++) {
                const a0 = sweep - (i * 0.9) / 60;
                ctx.fillStyle = `rgba(60,255,140,${0.22 * (1 - i / 60)})`;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, R, a0 - 0.016, a0);
                ctx.closePath();
                ctx.fill();
            }
            ctx.strokeStyle = 'rgba(160,255,200,0.9)';
            ctx.lineWidth = 2.5 * k;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
            ctx.stroke();
            for (let i = 0; i < 9; i++) {
                const a = r() * S_TAU, d = R * (0.2 + r() * 0.75);
                glow(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 14 * k, 'rgba(120,255,170,0.9)');
            }
        },
    },
    {
        id: 'tacticalMap', label: 'خريطة تكتيكية', cat: 'security',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#1c2418'], [1, '#0e130c']]);
            const k = w / 1000;
            // خطوط كنتور: منحنيات مغلقة مشوّهة حول عدة قمم
            const peaks = [[0.3, 0.3], [0.72, 0.55], [0.4, 0.8]].map(([x, y]) => [x * w, y * h]);
            peaks.forEach(([px, py], pi) => {
                const ph = r() * 10;
                for (let ring = 1; ring < 16; ring++) {
                    const base = ring * 34 * k;
                    ctx.strokeStyle = ring % 5 === 0 ? 'rgba(190,200,140,0.45)' : 'rgba(170,185,120,0.2)';
                    ctx.lineWidth = (ring % 5 === 0 ? 2 : 1) * k;
                    ctx.beginPath();
                    for (let i = 0; i <= 90; i++) {
                        const a = (i / 90) * S_TAU;
                        const rr = base * (1 + 0.18 * Math.sin(a * 3 + ph + pi) + 0.1 * Math.sin(a * 5 + ring * 0.3));
                        const x = px + Math.cos(a) * rr * 1.2, y = py + Math.sin(a) * rr;
                        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                    }
                    ctx.stroke();
                }
            });
            ctx.strokeStyle = 'rgba(220,220,180,0.18)';
            ctx.lineWidth = 1 * k;
            for (let x = 0; x < w; x += 125 * k) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            for (let y = 0; y < h; y += 125 * k) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            // مسار وأهداف
            ctx.strokeStyle = 'rgba(255,90,60,0.85)';
            ctx.lineWidth = 4 * k;
            ctx.setLineDash([18 * k, 12 * k]);
            ctx.beginPath();
            ctx.moveTo(w * 0.12, h * 0.9);
            ctx.bezierCurveTo(w * 0.3, h * 0.6, w * 0.6, h * 0.75, w * 0.7, h * 0.45);
            ctx.stroke();
            ctx.setLineDash([]);
            [[0.7, 0.45], [0.3, 0.3]].forEach(([x, y]) => {
                ctx.strokeStyle = 'rgba(255,90,60,0.95)';
                ctx.lineWidth = 3 * k;
                ctx.beginPath();
                ctx.arc(x * w, y * h, 26 * k, 0, S_TAU);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x * w - 40 * k, y * h);
                ctx.lineTo(x * w + 40 * k, y * h);
                ctx.moveTo(x * w, y * h - 40 * k);
                ctx.lineTo(x * w, y * h + 40 * k);
                ctx.stroke();
            });
            const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, h * 0.75);
            v.addColorStop(0, 'rgba(0,0,0,0)');
            v.addColorStop(1, 'rgba(0,0,0,0.7)');
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, w, h);
        },
    },
    {
        id: 'camoWood', label: 'تمويه غابي', cat: 'military',
        draw(ctx, w, h, r) { camo(ctx, w, h, r, ['#4b5320', '#2f3a1e', '#6b5a3a', '#1c1f14']); },
    },
    {
        id: 'camoDesert', label: 'تمويه صحراوي', cat: 'military',
        draw(ctx, w, h, r) { camo(ctx, w, h, r, ['#c2a878', '#a68a5b', '#8a6f45', '#d9c49a']); },
    },
    {
        id: 'camoDigital', label: 'تمويه رقمي', cat: 'military',
        draw(ctx, w, h, r) {
            const cols = ['#5b6340', '#3d452b', '#7a7656', '#272b1c'];
            const px = Math.round(w / 90);
            ctx.fillStyle = cols[0];
            ctx.fillRect(0, 0, w, h);
            for (let c = 1; c < 4; c++) {
                for (let i = 0; i < 160; i++) {
                    let x = Math.floor((r() * w) / px) * px, y = Math.floor((r() * h) / px) * px;
                    ctx.fillStyle = cols[c];
                    for (let j = 0; j < 14; j++) {
                        ctx.fillRect(x, y, px * (1 + Math.floor(r() * 3)), px * (1 + Math.floor(r() * 2)));
                        x += (Math.floor(r() * 3) - 1) * px;
                        y += (Math.floor(r() * 3) - 1) * px;
                    }
                }
            }
        },
    },
    {
        id: 'hud', label: 'واجهة تكتيكية', cat: 'security',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#03101a'], [1, '#061c2a']]);
            const k = w / 1000, c = 'rgba(90,220,255,';
            glow(ctx, w / 2, h / 2, w * 0.6, 'rgba(40,160,220,0.18)');
            ctx.strokeStyle = c + '0.6)';
            ctx.lineWidth = 2 * k;
            const cx = w / 2, cy = h * 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, w * 0.22, 0, S_TAU);
            ctx.stroke();
            ctx.setLineDash([6 * k, 8 * k]);
            ctx.beginPath();
            ctx.arc(cx, cy, w * 0.3, 0, S_TAU);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineWidth = 3 * k;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.arc(cx, cy, w * 0.36, (i * Math.PI) / 2 + 0.25, (i * Math.PI) / 2 + 1.3);
                ctx.stroke();
            }
            ctx.lineWidth = 1.5 * k;
            ctx.beginPath();
            ctx.moveTo(cx - w * 0.45, cy);
            ctx.lineTo(cx - w * 0.08, cy);
            ctx.moveTo(cx + w * 0.08, cy);
            ctx.lineTo(cx + w * 0.45, cy);
            ctx.moveTo(cx, cy - w * 0.45);
            ctx.lineTo(cx, cy - w * 0.08);
            ctx.moveTo(cx, cy + w * 0.08);
            ctx.lineTo(cx, cy + w * 0.45);
            ctx.stroke();
            // أقواس الزوايا
            const m = 50 * k, L = 120 * k;
            ctx.lineWidth = 4 * k;
            ctx.strokeStyle = c + '0.8)';
            [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]].forEach(([x, y, sx, sy]) => {
                ctx.beginPath();
                ctx.moveTo(x, y + sy * L);
                ctx.lineTo(x, y);
                ctx.lineTo(x + sx * L, y);
                ctx.stroke();
            });
            // مسطرة بوصلة
            ctx.lineWidth = 1.5 * k;
            ctx.strokeStyle = c + '0.55)';
            for (let i = 0; i <= 40; i++) {
                const x = w * 0.2 + (w * 0.6 * i) / 40, l = i % 5 ? 10 : 22;
                ctx.beginPath();
                ctx.moveTo(x, h * 0.08);
                ctx.lineTo(x, h * 0.08 + l * k);
                ctx.stroke();
            }
            // أعمدة بيانات
            for (let i = 0; i < 18; i++) {
                ctx.fillStyle = c + (0.2 + r() * 0.5) + ')';
                ctx.fillRect(w * 0.06 + i * 14 * k, h * 0.9 - r() * 90 * k, 8 * k, 4 * k + r() * 90 * k);
            }
            for (let i = 0; i < 6; i++) {
                ctx.fillStyle = c + '0.35)';
                ctx.fillRect(w * 0.7, h * (0.82 + i * 0.022), w * (0.08 + r() * 0.16), 6 * k);
            }
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            for (let y = 0; y < h; y += 4 * k)
                ctx.fillRect(0, y, w, 1.5 * k);
        },
    },
    {
        id: 'dossier', label: 'ملف سرّي', cat: 'security',
        draw(ctx, w, h, r) {
            ctx.fillStyle = '#c9a66b';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 20; i++)
                glow(ctx, r() * w, r() * h, w * (0.1 + r() * 0.2), `rgba(120,80,30,${0.05 + r() * 0.08})`);
            const k = w / 1000;
            // ورقة داخلية بخطوط محجوبة
            ctx.save();
            ctx.translate(w * 0.5, h * 0.55);
            ctx.rotate(-0.03);
            ctx.fillStyle = '#efe8d8';
            ctx.shadowColor = 'rgba(0,0,0,0.35)';
            ctx.shadowBlur = 20 * k;
            ctx.fillRect(-w * 0.38, -h * 0.36, w * 0.76, h * 0.72);
            ctx.shadowBlur = 0;
            for (let y = -h * 0.3; y < h * 0.32; y += 34 * k) {
                let x = -w * 0.33;
                while (x < w * 0.32) {
                    const len = (40 + r() * 140) * k;
                    ctx.fillStyle = r() < 0.35 ? '#111' : 'rgba(60,55,50,0.35)';
                    ctx.fillRect(x, y, Math.min(len, w * 0.33 - x), r() < 0.35 ? 20 * k : 6 * k);
                    x += len + 14 * k;
                }
            }
            ctx.restore();
            // ختم أحمر وشريط
            ctx.save();
            ctx.translate(w * 0.7, h * 0.22);
            ctx.rotate(-0.25);
            ctx.strokeStyle = 'rgba(180,20,20,0.75)';
            ctx.lineWidth = 8 * k;
            ctx.strokeRect(-150 * k, -55 * k, 300 * k, 110 * k);
            ctx.lineWidth = 3 * k;
            ctx.strokeRect(-135 * k, -42 * k, 270 * k, 84 * k);
            ctx.restore();
            ctx.fillStyle = '#9a7b45';
            ctx.fillRect(0, h * 0.07, w * 0.35, 40 * k);
        },
    },
    {
        id: 'fingerprint', label: 'بصمة', cat: 'research',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#04080e'], [1, '#0a1622']]);
            const k = w / 1000, cx = w * 0.5, cy = h * 0.52;
            ctx.strokeStyle = 'rgba(80,200,255,0.55)';
            ctx.lineCap = 'round';
            for (let i = 1; i < 42; i++) {
                const rr = i * 9 * k;
                ctx.lineWidth = 3 * k;
                ctx.beginPath();
                let started = false;
                for (let a = 0; a <= S_TAU; a += 0.04) {
                    if (Math.sin(a * 3 + i * 0.7) > 0.93 && r() < 0.5) {
                        started = false;
                        continue;
                    } // انقطاعات طبيعية
                    const x = cx + Math.cos(a) * rr * 0.78 * (1 + 0.05 * Math.sin(a * 2 + i * 0.2));
                    const y = cy + Math.sin(a) * rr * (1 + 0.08 * Math.cos(a * 3));
                    if (y > cy + h * 0.32) {
                        started = false;
                        continue;
                    }
                    started ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                    started = true;
                }
                ctx.stroke();
            }
            const sy = cy - h * 0.05;
            const g = ctx.createLinearGradient(0, sy - 60 * k, 0, sy + 6 * k);
            g.addColorStop(0, 'rgba(80,220,255,0)');
            g.addColorStop(1, 'rgba(120,240,255,0.55)');
            ctx.fillStyle = g;
            ctx.fillRect(0, sy - 60 * k, w, 66 * k);
            ctx.fillStyle = 'rgba(180,250,255,0.9)';
            ctx.fillRect(0, sy, w, 3 * k);
        },
    },
    {
        id: 'nightVision', label: 'رؤية ليلية', cat: 'security',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#0b2a0b'], [0.6, '#123d12'], [1, '#061806']]);
            const k = w / 1000;
            // مبانٍ ضبابية
            for (let i = 0; i < 9; i++) {
                ctx.fillStyle = `rgba(20,${60 + r() * 40},20,0.8)`;
                const bw = w * (0.08 + r() * 0.12);
                ctx.fillRect(r() * w, h * (0.45 + r() * 0.2), bw, h);
            }
            glow(ctx, w * 0.6, h * 0.45, w * 0.5, 'rgba(160,255,140,0.25)');
            const img = ctx.getImageData(0, 0, w, h);
            const d = img.data;
            for (let i = 0; i < d.length; i += 4) {
                const n = (r() - 0.5) * 60;
                d[i] += n * 0.4;
                d[i + 1] += n;
                d[i + 2] += n * 0.3;
            }
            ctx.putImageData(img, 0, 0);
            const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.62);
            v.addColorStop(0, 'rgba(0,0,0,0)');
            v.addColorStop(1, 'rgba(0,0,0,0.95)');
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = 'rgba(190,255,170,0.7)';
            ctx.lineWidth = 2 * k;
            ctx.beginPath();
            ctx.moveTo(w / 2 - 60 * k, h / 2);
            ctx.lineTo(w / 2 + 60 * k, h / 2);
            ctx.moveTo(w / 2, h / 2 - 60 * k);
            ctx.lineTo(w / 2, h / 2 + 60 * k);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,60,40,0.9)';
            ctx.beginPath();
            ctx.arc(w * 0.1, h * 0.06, 12 * k, 0, S_TAU);
            ctx.fill();
        },
    },
    {
        id: 'cyber', label: 'أمن سيبراني', cat: 'security',
        draw(ctx, w, h, r) {
            ctx.fillStyle = '#020806';
            ctx.fillRect(0, 0, w, h);
            const k = w / 1000, fs = 22 * k;
            ctx.font = `${fs}px monospace`;
            ctx.textAlign = 'center';
            for (let x = fs / 2; x < w; x += fs * 1.1) {
                const len = 8 + r() * 50, y0 = r() * h;
                for (let j = 0; j < len; j++) {
                    const a = j / len;
                    ctx.fillStyle = j === Math.floor(len) - 1 ? 'rgba(200,255,220,0.95)' : `rgba(40,255,120,${0.05 + a * 0.5})`;
                    ctx.fillText(r() < 0.5 ? '0' : '1', x, (y0 + j * fs) % h);
                }
            }
            glow(ctx, w / 2, h * 0.45, w * 0.45, 'rgba(0,0,0,0.75)');
            // قفل
            const cx = w / 2, cy = h * 0.45;
            ctx.strokeStyle = 'rgba(80,255,160,0.95)';
            ctx.lineWidth = 14 * k;
            ctx.shadowColor = '#3cff9a';
            ctx.shadowBlur = 30 * k;
            ctx.beginPath();
            ctx.arc(cx, cy - 50 * k, 70 * k, Math.PI, 0);
            ctx.stroke();
            ctx.strokeRect(cx - 105 * k, cy - 50 * k, 210 * k, 170 * k);
            ctx.beginPath();
            ctx.arc(cx, cy + 20 * k, 16 * k, 0, S_TAU);
            ctx.moveTo(cx, cy + 36 * k);
            ctx.lineTo(cx, cy + 75 * k);
            ctx.stroke();
            ctx.shadowBlur = 0;
        },
    },
    {
        id: 'circuit', label: 'دائرة إلكترونية', cat: 'research',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#04140f'], [1, '#021009']]);
            const k = w / 1000, step = 40 * k;
            ctx.lineCap = 'round';
            for (let n = 0; n < 70; n++) {
                let x = Math.round((r() * w) / step) * step, y = Math.round((r() * h) / step) * step;
                const a = 0.25 + r() * 0.55;
                ctx.strokeStyle = `rgba(70,230,170,${a})`;
                ctx.lineWidth = 3 * k;
                ctx.beginPath();
                ctx.moveTo(x, y);
                let dir = Math.floor(r() * 4);
                for (let s = 0; s < 4 + r() * 8; s++) {
                    const len = step * (1 + Math.floor(r() * 4));
                    const dx = [1, 0, -1, 0][dir], dy = [0, 1, 0, -1][dir];
                    if (r() < 0.5) {
                        x += dx * len;
                        y += dy * len;
                    }
                    else {
                        x += dx * len * 0.7 + (dir % 2 ? len * 0.7 : 0);
                        y += dy * len * 0.7 + (dir % 2 ? 0 : len * 0.7);
                    }
                    ctx.lineTo(x, y);
                    dir = (dir + (r() < 0.5 ? 1 : 3)) % 4;
                }
                ctx.stroke();
                ctx.fillStyle = `rgba(120,255,200,${a + 0.2})`;
                ctx.beginPath();
                ctx.arc(x, y, 7 * k, 0, S_TAU);
                ctx.fill();
                ctx.fillStyle = '#021009';
                ctx.beginPath();
                ctx.arc(x, y, 3 * k, 0, S_TAU);
                ctx.fill();
            }
            ctx.fillStyle = '#0b2a20';
            ctx.strokeStyle = 'rgba(120,255,200,0.8)';
            ctx.lineWidth = 3 * k;
            ctx.fillRect(w * 0.35, h * 0.42, w * 0.3, w * 0.3);
            ctx.strokeRect(w * 0.35, h * 0.42, w * 0.3, w * 0.3);
            glow(ctx, w * 0.5, h * 0.42 + w * 0.15, w * 0.35, 'rgba(60,255,170,0.18)');
        },
    },
    {
        id: 'evidenceBoard', label: 'لوحة التحقيق', cat: 'research',
        draw(ctx, w, h, r) {
            ctx.fillStyle = '#7a5532';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 9000; i++) {
                ctx.fillStyle = `rgba(${r() < 0.5 ? '40,25,10' : '200,160,110'},${0.15 + r() * 0.2})`;
                ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3);
            }
            const k = w / 1000;
            const pins = [];
            for (let i = 0; i < 9; i++) {
                const x = w * (0.12 + (i % 3) * 0.36) + (r() - 0.5) * 80 * k, y = h * (0.12 + Math.floor(i / 3) * 0.32) + (r() - 0.5) * 80 * k;
                const pw = (150 + r() * 70) * k, ph = (r() < 0.5 ? 1.2 : 0.8) * pw;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate((r() - 0.5) * 0.25);
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 14 * k;
                ctx.shadowOffsetY = 6 * k;
                ctx.fillStyle = r() < 0.4 ? '#e9e2cf' : r() < 0.5 ? '#3a3a3a' : '#f3e7a0';
                ctx.fillRect(-pw / 2, 0, pw, ph);
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                for (let l = 0; l < 5; l++)
                    ctx.fillRect(-pw * 0.38, ph * (0.2 + l * 0.14), pw * (0.4 + r() * 0.35), 4 * k);
                ctx.restore();
                pins.push([x, y + 10 * k]);
            }
            ctx.strokeStyle = 'rgba(200,20,20,0.9)';
            ctx.lineWidth = 3.5 * k;
            [[0, 4], [4, 8], [1, 4], [4, 6], [2, 5], [3, 7]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(...pins[a]); ctx.quadraticCurveTo((pins[a][0] + pins[b][0]) / 2, (pins[a][1] + pins[b][1]) / 2 + 30 * k, ...pins[b]); ctx.stroke(); });
            pins.forEach(([x, y]) => { ctx.fillStyle = '#c0161a'; ctx.beginPath(); ctx.arc(x, y, 10 * k, 0, S_TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - 3 * k, y - 3 * k, 3 * k, 0, S_TAU); ctx.fill(); });
            const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, h * 0.75);
            v.addColorStop(0, 'rgba(0,0,0,0)');
            v.addColorStop(1, 'rgba(0,0,0,0.7)');
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, w, h);
        },
    },
    {
        id: 'battlefield', label: 'ساحة معركة', cat: 'military',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#1a0f0c'], [0.45, '#7a2f12'], [0.7, '#d0672a'], [1, '#1a0b05']]);
            for (let i = 0; i < 70; i++) {
                const x = r() * w, y = h * (0.15 + r() * 0.55), R = w * (0.06 + r() * 0.16);
                const g = ctx.createRadialGradient(x, y, 0, x, y, R);
                g.addColorStop(0, `rgba(${30 + r() * 30},${20 + r() * 20},${15 + r() * 15},0.45)`);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(x, y, R, 0, S_TAU);
                ctx.fill();
            }
            glow(ctx, w * 0.35, h * 0.68, w * 0.25, 'rgba(255,170,60,0.55)');
            // مبانٍ مدمّرة
            const base = h * 0.78, k = w / 1000;
            ctx.fillStyle = '#0c0705';
            let x = 0;
            while (x < w) {
                const bw = (60 + r() * 140) * k, bh = (80 + r() * 260) * k;
                ctx.beginPath();
                ctx.moveTo(x, base);
                ctx.lineTo(x, base - bh);
                for (let j = 1; j <= 5; j++)
                    ctx.lineTo(x + (bw * j) / 5, base - bh + (r() - 0.3) * bh * 0.35);
                ctx.lineTo(x + bw, base);
                ctx.closePath();
                ctx.fill();
                x += bw + r() * 30 * k;
            }
            ctx.fillRect(0, base, w, h - base);
            ctx.fillStyle = 'rgba(255,180,90,0.8)';
            for (let i = 0; i < 160; i++) {
                ctx.globalAlpha = r();
                ctx.fillRect(r() * w, r() * h * 0.85, 2 * k, 2 * k + r() * 5 * k);
            }
            ctx.globalAlpha = 1;
        },
    },
    {
        id: 'dna', label: 'حمض نووي', cat: 'research',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#020818'], [1, '#06173a']]);
            for (let i = 0; i < 40; i++)
                glow(ctx, r() * w, r() * h, w * (0.01 + r() * 0.05), `rgba(80,150,255,${0.08 + r() * 0.15})`);
            const k = w / 1000, cx = w * 0.5, amp = w * 0.2;
            ctx.save();
            ctx.translate(cx, h / 2);
            ctx.rotate(-0.35);
            ctx.translate(-cx, -h / 2);
            const N = 46;
            for (let i = 0; i < N; i++) {
                const y = -h * 0.1 + (h * 1.2 * i) / N, ph = i * 0.42;
                const x1 = cx + Math.sin(ph) * amp, x2 = cx - Math.sin(ph) * amp;
                const front = Math.cos(ph);
                ctx.strokeStyle = `rgba(140,200,255,${0.25 + 0.3 * Math.abs(front)})`;
                ctx.lineWidth = 3 * k;
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x2, y);
                ctx.stroke();
                [[x1, front], [x2, -front]].forEach(([x, f]) => {
                    const R = (9 + 6 * f) * k;
                    glow(ctx, x, y, R * 3, `rgba(90,180,255,${0.25 + 0.25 * f})`);
                    ctx.fillStyle = f > 0 ? '#cfe6ff' : '#4d7fc0';
                    ctx.beginPath();
                    ctx.arc(x, y, R, 0, S_TAU);
                    ctx.fill();
                });
            }
            ctx.restore();
        },
    },
    {
        id: 'network', label: 'شبكة بيانات', cat: 'research',
        draw(ctx, w, h, r) {
            vGrad(ctx, w, h, [[0, '#050a1a'], [1, '#0a1430']]);
            const k = w / 1000;
            const pts = Array.from({ length: 70 }, () => [r() * w, r() * h, r()]);
            for (let i = 0; i < pts.length; i++)
                for (let j = i + 1; j < pts.length; j++) {
                    const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
                    if (d < 190 * k) {
                        ctx.strokeStyle = `rgba(110,170,255,${0.7 * (1 - d / (190 * k))})`;
                        ctx.lineWidth = 1.5 * k;
                        ctx.beginPath();
                        ctx.moveTo(pts[i][0], pts[i][1]);
                        ctx.lineTo(pts[j][0], pts[j][1]);
                        ctx.stroke();
                    }
                }
            pts.forEach(([x, y, s]) => { glow(ctx, x, y, (10 + s * 26) * k, 'rgba(120,190,255,0.5)'); ctx.fillStyle = '#d6e8ff'; ctx.beginPath(); ctx.arc(x, y, (2 + s * 4) * k, 0, S_TAU); ctx.fill(); });
        },
    },
    {
        id: 'blueprint', label: 'مخطط هندسي', cat: 'research',
        draw(ctx, w, h, r) {
            ctx.fillStyle = '#0d3a6e';
            ctx.fillRect(0, 0, w, h);
            const k = w / 1000;
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1 * k;
            for (let x = 0; x < w; x += 25 * k) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            for (let y = 0; y < h; y += 25 * k) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            for (let x = 0; x < w; x += 125 * k) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            for (let y = 0; y < h; y += 125 * k) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(230,245,255,0.7)';
            ctx.lineWidth = 2.5 * k;
            const cx = w * 0.5, cy = h * 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, w * 0.28, 0, S_TAU);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, w * 0.12, 0, S_TAU);
            ctx.stroke();
            for (let i = 0; i < 12; i++) {
                const a = (i * Math.PI) / 6;
                ctx.save();
                ctx.translate(cx + Math.cos(a) * w * 0.28, cy + Math.sin(a) * w * 0.28);
                ctx.rotate(a);
                ctx.strokeRect(-14 * k, -24 * k, 28 * k, 48 * k);
                ctx.restore();
            }
            ctx.setLineDash([12 * k, 8 * k, 3 * k, 8 * k]);
            ctx.lineWidth = 1.5 * k;
            ctx.beginPath();
            ctx.moveTo(cx - w * 0.4, cy);
            ctx.lineTo(cx + w * 0.4, cy);
            ctx.moveTo(cx, cy - w * 0.4);
            ctx.lineTo(cx, cy + w * 0.4);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(cx - w * 0.28, cy + w * 0.36);
            ctx.lineTo(cx + w * 0.28, cy + w * 0.36);
            ctx.stroke();
            [-1, 1].forEach((s) => { ctx.beginPath(); ctx.moveTo(cx + s * w * 0.28, cy + w * 0.33); ctx.lineTo(cx + s * w * 0.28, cy + w * 0.39); ctx.stroke(); });
            ctx.strokeRect(w * 0.08, h * 0.82, w * 0.84, h * 0.12);
            ctx.beginPath();
            ctx.moveTo(w * 0.6, h * 0.82);
            ctx.lineTo(w * 0.6, h * 0.94);
            ctx.stroke();
        },
    },
    {
        id: 'satellite', label: 'صورة أقمار صناعية', cat: 'security',
        draw(ctx, w, h, r) {
            ctx.fillStyle = '#3a3a30';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 400; i++) {
                ctx.fillStyle = `rgba(${90 + r() * 60},${85 + r() * 50},${60 + r() * 40},0.35)`;
                ctx.fillRect(r() * w, r() * h, r() * 80, r() * 80);
            }
            const k = w / 1000;
            // شوارع ومبانٍ من الأعلى
            ctx.strokeStyle = 'rgba(200,195,170,0.5)';
            ctx.lineWidth = 14 * k;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(0, r() * h);
                ctx.lineTo(w, r() * h);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(r() * w, 0);
                ctx.lineTo(r() * w, h);
                ctx.stroke();
            }
            for (let i = 0; i < 160; i++) {
                ctx.fillStyle = `rgba(${40 + r() * 40},${40 + r() * 40},${40 + r() * 30},0.85)`;
                ctx.fillRect(r() * w, r() * h, (20 + r() * 50) * k, (20 + r() * 50) * k);
            }
            ctx.fillStyle = 'rgba(0,30,10,0.25)';
            ctx.fillRect(0, 0, w, h);
            // تحديد هدف
            ctx.strokeStyle = 'rgba(255,60,40,0.95)';
            ctx.lineWidth = 4 * k;
            ctx.strokeRect(w * 0.42, h * 0.4, w * 0.18, w * 0.14);
            ctx.lineWidth = 2 * k;
            ctx.beginPath();
            ctx.moveTo(w * 0.6, h * 0.4);
            ctx.lineTo(w * 0.78, h * 0.3);
            ctx.lineTo(w * 0.95, h * 0.3);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1 * k;
            ctx.beginPath();
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(w / 2, h);
            ctx.moveTo(0, h / 2);
            ctx.lineTo(w, h / 2);
            ctx.stroke();
        },
    },
];
const sceneCache = new Map();
/** يرسم المشهد بدقة الغلاف ويعيده رابط صورة (يُخزَّن بعد أول مرة) */
function getSceneUrl(id, W = 1000, H = 1500) {
    const key = `${id}@${W}`;
    if (sceneCache.has(key))
        return sceneCache.get(key);
    const scene = SCENES.find((s) => s.id === id);
    if (!scene)
        return null;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    scene.draw(c.getContext('2d'), W, H, sceneRng([...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 11)));
    const url = c.toDataURL('image/jpeg', 0.92);
    sceneCache.set(key, url);
    return url;
}
/** معاينة مصغّرة على canvas موجود */
function drawScenePreview(canvas, id) {
    const scene = SCENES.find((s) => s.id === id);
    if (!scene)
        return;
    scene.draw(canvas.getContext('2d'), canvas.width, canvas.height, sceneRng([...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 11)));
}
// ===== lib/mockup.js =====
// ─────────────────────────────────────────────────────────────
// مولّد المجسّمات: يحوّل الغلاف إلى كتاب ثلاثي الأبعاد، كتاب مسطّح،
// مجلة مفتوحة أو دفتر سلكي — رسم 2D خالص داخل الجهاز
// ─────────────────────────────────────────────────────────────
const MOCKUP_KINDS = [
    { id: 'book3d', label: 'كتاب قائم', icon: '📕' },
    { id: 'flat', label: 'كتاب مسطّح', icon: '📘' },
    { id: 'magazine', label: 'مجلة مفتوحة', icon: '📖' },
    { id: 'notebook', label: 'دفتر سلكي', icon: '📓' },
];
const MOCKUP_BACKDROPS = [
    { id: 'studio', label: 'استوديو داكن', sw: 'radial-gradient(circle,#4a4038,#0b0907)' },
    { id: 'light', label: 'فاتح', sw: 'radial-gradient(circle,#ffffff,#cfc9c0)' },
    { id: 'wood', label: 'طاولة خشب', sw: 'linear-gradient(135deg,#8a5a34,#4a2c16)' },
    { id: 'concrete', label: 'إسمنت', sw: 'linear-gradient(135deg,#9a9893,#5e5c58)' },
    { id: 'navy', label: 'كحلي', sw: 'radial-gradient(circle,#2a3a5a,#070b16)' },
    { id: 'transparent', label: 'شفاف', sw: 'repeating-conic-gradient(#555 0 25%,#333 0 50%) 0 0/12px 12px' },
];
const MW = 2400;
const MH = 1800;
function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}
function rand(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function paintBackdrop(ctx, W, H, kind) {
    if (kind === 'transparent')
        return;
    if (kind === 'light' || kind === 'studio' || kind === 'navy') {
        const [a, b] = kind === 'light' ? ['#fbfaf7', '#c9c3b9'] : kind === 'navy' ? ['#2c3c5e', '#05080f'] : ['#4a4038', '#0a0807'];
        const g = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.5, W * 0.75);
        g.addColorStop(0, a);
        g.addColorStop(1, b);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        return;
    }
    if (kind === 'wood') {
        ctx.fillStyle = '#6e4526';
        ctx.fillRect(0, 0, W, H);
        const r = rand(7);
        const plank = H / 5;
        for (let p = 0; p < 6; p++) {
            const y0 = p * plank;
            ctx.fillStyle = `rgba(${p % 2 ? '40,20,8' : '150,95,50'},0.12)`;
            ctx.fillRect(0, y0, W, plank);
            for (let i = 0; i < 70; i++) {
                const y = y0 + r() * plank;
                ctx.strokeStyle = `rgba(${r() < 0.5 ? '45,22,8' : '170,110,60'},${0.08 + r() * 0.18})`;
                ctx.lineWidth = 1 + r() * 3;
                ctx.beginPath();
                ctx.moveTo(0, y);
                const ph = r() * 10, amp = 2 + r() * 6;
                for (let x = 0; x <= W; x += 40)
                    ctx.lineTo(x, y + Math.sin(x / (180 + r() * 40) + ph) * amp);
                ctx.stroke();
            }
            ctx.fillStyle = 'rgba(20,8,2,0.55)';
            ctx.fillRect(0, y0, W, 3);
        }
        const v = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75);
        v.addColorStop(0, 'rgba(255,220,170,0.12)');
        v.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, W, H);
        return;
    }
    // إسمنت
    ctx.fillStyle = '#86847f';
    ctx.fillRect(0, 0, W, H);
    const r = rand(11);
    for (let i = 0; i < 26000; i++) {
        ctx.fillStyle = `rgba(${r() < 0.5 ? '40,40,40' : '230,230,225'},${0.04 + r() * 0.1})`;
        ctx.fillRect(r() * W, r() * H, 1 + r() * 4, 1 + r() * 4);
    }
    const v = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75);
    v.addColorStop(0, 'rgba(255,255,255,0.1)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
}
/** ظل ناعم لشكل دون رسم الشكل نفسه */
function softShadow(ctx, tracePath, blur, alpha, dx = 0, dy = 0) {
    const OFF = 20000;
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${alpha})`;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = OFF + dx;
    ctx.shadowOffsetY = dy;
    // الإزاحة في إحداثيات الشاشة حتى يبقى الظل صحيحاً مع الدوران
    const m = ctx.getTransform();
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e - OFF, m.f);
    ctx.beginPath();
    tracePath(ctx);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
}
/** متوسط لون الصورة (لتلوين صفحة المجلة والكعب) */
function averageColor(img) {
    const c = mkCanvas(16, 24);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, 16, 24);
    const d = x.getImageData(0, 0, 16, 24).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
    }
    const n = d.length / 4;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}
function roundRectPath(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
// ─────────────── كتاب قائم ثلاثي الأبعاد ───────────────
function drawBook3D(ctx, img, { angle = 28 }) {
    const th = (angle * Math.PI) / 180;
    const bookH = MH * 0.74;
    const bookW = bookH * (img.width / img.height);
    const p = Math.sin(th) * 0.1; // قوة المنظور
    const nearH = bookH * (1 + p);
    const farH = bookH * (1 - p);
    const frontW = bookW * Math.cos(th);
    const spineW = bookW * 0.075 * (0.6 + Math.sin(th) * 1.6);
    const total = spineW + frontW;
    const x0 = MW / 2 - total / 2;
    const cy = MH * 0.47;
    const xL = x0 + spineW;
    const xR = xL + frontW;
    const spineFarH = nearH * (1 - p * 0.5);
    // الظل على الأرض
    softShadow(ctx, (c) => {
        c.moveTo(x0, cy + spineFarH / 2);
        c.lineTo(xR, cy + farH / 2);
        c.lineTo(xR + frontW * 0.35, cy + farH / 2 + 20);
        c.lineTo(x0 + 40, cy + nearH / 2 + 30);
        c.closePath();
    }, 60, 0.75, 0, 10);
    softShadow(ctx, (c) => { c.rect(x0, cy + nearH / 2 - 6, total, 12); }, 14, 0.9);
    // الكعب: أقصى يسار الغلاف مشدود + تظليل
    const spineSrcW = Math.max(2, img.width * 0.04);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, cy - spineFarH / 2);
    ctx.lineTo(xL, cy - nearH / 2);
    ctx.lineTo(xL, cy + nearH / 2);
    ctx.lineTo(x0, cy + spineFarH / 2);
    ctx.closePath();
    ctx.clip();
    const steps = Math.ceil(spineW);
    for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const h = spineFarH + (nearH - spineFarH) * t;
        ctx.drawImage(img, t * spineSrcW, 0, Math.max(1, spineSrcW / steps), img.height, x0 + i, cy - h / 2, 1.6, h);
    }
    const sg = ctx.createLinearGradient(x0, 0, xL, 0);
    sg.addColorStop(0, 'rgba(0,0,0,0.65)');
    sg.addColorStop(0.55, 'rgba(0,0,0,0.25)');
    sg.addColorStop(0.85, 'rgba(255,255,255,0.12)');
    sg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = sg;
    ctx.fillRect(x0, 0, spineW + 1, MH);
    ctx.restore();
    // الوجه الأمامي بمنظور صحيح
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xL, cy - nearH / 2);
    ctx.lineTo(xR, cy - farH / 2);
    ctx.lineTo(xR, cy + farH / 2);
    ctx.lineTo(xL, cy + nearH / 2);
    ctx.closePath();
    ctx.clip();
    const zL = 1 / nearH, zR = 1 / farH;
    const cols = Math.ceil(frontW);
    for (let i = 0; i < cols; i++) {
        const t = i / cols;
        const u = (t / zR) / ((1 - t) / zL + t / zR);
        const h = nearH + (farH - nearH) * t;
        const sx = Math.min(img.width - 1, u * img.width);
        ctx.drawImage(img, sx, 0, Math.max(1, img.width / cols), img.height, xL + i, cy - h / 2, 1.6, h);
    }
    // الإضاءة: مفصل الغلاف + تدرّج + لمعة قطرية
    const lg = ctx.createLinearGradient(xL, 0, xR, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0.18)');
    lg.addColorStop(0.025, 'rgba(0,0,0,0.38)');
    lg.addColorStop(0.05, 'rgba(255,255,255,0.14)');
    lg.addColorStop(0.09, 'rgba(255,255,255,0)');
    lg.addColorStop(0.7, 'rgba(0,0,0,0.05)');
    lg.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = lg;
    ctx.fillRect(xL, 0, frontW + 2, MH);
    const sh = ctx.createLinearGradient(xL, cy - nearH / 2, xR, cy + farH / 2);
    sh.addColorStop(0, 'rgba(255,255,255,0)');
    sh.addColorStop(0.42, 'rgba(255,255,255,0)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0.13)');
    sh.addColorStop(0.58, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(xL, 0, frontW + 2, MH);
    ctx.restore();
    // حافة الأوراق السفلية الرفيعة
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xL, cy + nearH / 2);
    ctx.lineTo(xR, cy + farH / 2);
    ctx.stroke();
}
// ─────────────── كتاب مسطّح ───────────────
function drawFlatBook(ctx, img) {
    const h = MH * 0.78;
    const w = h * (img.width / img.height);
    const x = MW / 2 - w / 2 - 10;
    const y = MH / 2 - h / 2 - 10;
    const depth = 22;
    softShadow(ctx, (c) => c.rect(x + 10, y + 20, w + depth, h + depth), 70, 0.7, 30, 40);
    // كتلة الأوراق
    for (let i = depth; i > 0; i -= 2) {
        ctx.fillStyle = i % 4 ? '#ebe5d9' : '#d8d1c3';
        ctx.fillRect(x + i, y + i, w, h);
    }
    ctx.fillStyle = '#3a3128';
    ctx.fillRect(x + depth, y + depth, w, h);
    for (let i = depth - 2; i > 2; i -= 3) {
        ctx.fillStyle = i % 2 ? '#f4efe4' : '#e2dccf';
        ctx.fillRect(x + w, y + i, i, h - i + 1);
        ctx.fillRect(x + i, y + h, w - i + 1, i);
    }
    ctx.drawImage(img, x, y, w, h);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(0.03, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.05, 'rgba(0,0,0,0.25)');
    g.addColorStop(0.08, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    const sh = ctx.createLinearGradient(x, y, x + w, y + h);
    sh.addColorStop(0, 'rgba(255,255,255,0.10)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = sh;
    ctx.fillRect(x, y, w, h);
}
// ─────────────── مجلة مفتوحة ───────────────
function articlePage(img, pw, ph, title) {
    const c = mkCanvas(pw, ph);
    const x = c.getContext('2d');
    x.fillStyle = '#f7f4ee';
    x.fillRect(0, 0, pw, ph);
    const [r, g, b] = averageColor(img);
    const accent = `rgb(${Math.round(r * 0.8)},${Math.round(g * 0.8)},${Math.round(b * 0.8)})`;
    const m = pw * 0.08;
    // صورة مقصوصة من الغلاف
    const ih = ph * 0.38;
    const scale = Math.max((pw - m * 2) / img.width, ih / img.height);
    const sw = (pw - m * 2) / scale, sh = ih / scale;
    x.drawImage(img, (img.width - sw) / 2, (img.height - sh) * 0.35, sw, sh, m, m, pw - m * 2, ih);
    // عنوان المقال
    x.fillStyle = accent;
    x.fillRect(pw - m - pw * 0.25, m + ih + ph * 0.03, pw * 0.25, ph * 0.008);
    x.fillStyle = '#1a1714';
    x.textAlign = 'right';
    x.direction = 'rtl';
    x.font = `700 ${Math.round(ph * 0.045)}px "Amiri","Cairo",serif`;
    x.fillText(title || 'عنوان المقال', pw - m, m + ih + ph * 0.1);
    // أعمدة النص
    const colW = (pw - m * 2 - m * 0.6) / 2;
    const top = m + ih + ph * 0.14;
    const rr = rand(3);
    for (let col = 0; col < 2; col++) {
        const cx = pw - m - col * (colW + m * 0.6);
        for (let y = top; y < ph - m; y += ph * 0.022) {
            const len = colW * (y > ph - m - ph * 0.03 ? 0.5 : 0.82 + rr() * 0.18);
            x.fillStyle = 'rgba(40,36,32,0.45)';
            x.fillRect(cx - len, y, len, ph * 0.007);
        }
    }
    return c;
}
function drawMagazine(ctx, img, { spread = false, title }) {
    const ph = MH * 0.8;
    const pw = ph * (img.width / img.height);
    const sw = pw * 2;
    ctx.save();
    ctx.translate(MW / 2, MH / 2);
    ctx.rotate((-3 * Math.PI) / 180);
    const x0 = -sw / 2, y0 = -ph / 2;
    softShadow(ctx, (c) => c.rect(x0 + 10, y0 + 20, sw, ph), 80, 0.7, 20, 40);
    // سماكة الصفحات تحت كل صفحة
    for (let i = 10; i > 0; i -= 2) {
        ctx.fillStyle = i % 4 ? '#e6e0d4' : '#cfc8ba';
        ctx.fillRect(x0 - i * 0.6, y0 + i, pw, ph);
        ctx.fillRect(x0 + pw + i * 0.6, y0 + i, pw, ph);
    }
    let left, right;
    if (spread) {
        const full = mkCanvas(Math.round(sw), Math.round(ph));
        const fx = full.getContext('2d');
        const sc = Math.max(sw / img.width, ph / img.height);
        const dw = img.width * sc, dh = img.height * sc;
        fx.drawImage(img, (sw - dw) / 2, (ph - dh) / 2, dw, dh);
        left = { src: full, sx: 0, sw: Math.round(pw) };
        right = { src: full, sx: Math.round(pw), sw: Math.round(pw) };
    }
    else {
        left = { src: articlePage(img, Math.round(pw), Math.round(ph), title), sx: 0, sw: Math.round(pw) };
        right = { src: img, sx: 0, sw: img.width };
    }
    // الصفحتان مع انحناء خفيف للحافة العلوية والسفلية قرب الكعب
    const bend = ph * 0.012;
    const pagePath = (side) => {
        const xa = side < 0 ? x0 : x0 + pw, xb = side < 0 ? x0 + pw : x0 + sw;
        const gx = side < 0 ? xb : xa; // جهة الكعب
        const ox = side < 0 ? xa : xb;
        ctx.beginPath();
        ctx.moveTo(ox, y0);
        ctx.quadraticCurveTo((ox + gx) / 2, y0 - bend, gx, y0 + bend);
        ctx.lineTo(gx, y0 + ph - bend);
        ctx.quadraticCurveTo((ox + gx) / 2, y0 + ph + bend, ox, y0 + ph);
        ctx.closePath();
    };
    [[-1, left], [1, right]].forEach(([side, pg]) => {
        ctx.save();
        pagePath(side);
        ctx.clip();
        const dx = side < 0 ? x0 : x0 + pw;
        const srcH = pg.src === img ? img.height : pg.src.height;
        ctx.drawImage(pg.src, pg.sx, 0, pg.sw, srcH, dx, y0 - bend, pw, ph + bend * 2);
        // ظل الكعب وإضاءة الانحناء
        const gx = x0 + pw;
        const gg = ctx.createLinearGradient(gx, 0, gx + side * pw * 0.22, 0);
        gg.addColorStop(0, 'rgba(0,0,0,0.55)');
        gg.addColorStop(0.08, 'rgba(0,0,0,0.25)');
        gg.addColorStop(0.3, 'rgba(255,255,255,0.10)');
        gg.addColorStop(0.55, 'rgba(255,255,255,0)');
        gg.addColorStop(1, 'rgba(0,0,0,0.06)');
        ctx.fillStyle = gg;
        ctx.fillRect(x0, y0 - bend * 2, sw, ph + bend * 4);
        ctx.restore();
    });
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 + pw, y0 + bend);
    ctx.lineTo(x0 + pw, y0 + ph - bend);
    ctx.stroke();
    ctx.restore();
}
// ─────────────── دفتر سلكي ───────────────
function drawNotebook(ctx, img, { band = true }) {
    const h = MH * 0.78;
    const w = h * (img.width / img.height);
    ctx.save();
    ctx.translate(MW / 2, MH / 2 + 30);
    ctx.rotate((2.5 * Math.PI) / 180);
    const x = -w / 2, y = -h / 2;
    const R = w * 0.035;
    softShadow(ctx, (c) => roundRectPath(c, x + 6, y + 14, w + 10, h + 10, R), 70, 0.7, 25, 40);
    // أوراق
    for (let i = 12; i > 0; i -= 3) {
        ctx.beginPath();
        roundRectPath(ctx, x + i * 0.5, y + i, w, h, R);
        ctx.fillStyle = i % 2 ? '#f2eee6' : '#ddd7cb';
        ctx.fill();
    }
    // الغلاف
    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, R);
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    const sh = ctx.createLinearGradient(x, y, x + w, y + h);
    sh.addColorStop(0, 'rgba(255,255,255,0.12)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = sh;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    // الشريط المطاطي
    if (band) {
        const bx = x + w * 0.86, bw = w * 0.035;
        softShadow(ctx, (c) => c.rect(bx, y - 6, bw, h + 12), 10, 0.6, 4, 0);
        const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        bg.addColorStop(0, '#0e0d0c');
        bg.addColorStop(0.5, '#3a3734');
        bg.addColorStop(1, '#0e0d0c');
        ctx.fillStyle = bg;
        ctx.fillRect(bx, y - 6, bw, h + 12);
    }
    // الثقوب والسلك الحلزوني في الأعلى
    const n = Math.round(w / 52);
    const step = w / (n + 1);
    for (let i = 1; i <= n; i++) {
        const hx = x + step * i, hy = y + h * 0.028;
        ctx.fillStyle = '#141210';
        ctx.beginPath();
        ctx.ellipse(hx, hy, step * 0.13, step * 0.11, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    for (let i = 1; i <= n; i++) {
        const hx = x + step * i, hy = y + h * 0.028;
        const g = ctx.createLinearGradient(hx - step * 0.3, 0, hx + step * 0.3, 0);
        g.addColorStop(0, '#5d5e60');
        g.addColorStop(0.45, '#f0f1f3');
        g.addColorStop(1, '#4a4b4d');
        ctx.strokeStyle = g;
        ctx.lineWidth = step * 0.09;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx - step * 0.12, hy);
        ctx.bezierCurveTo(hx - step * 0.22, hy - h * 0.06, hx + step * 0.28, hy - h * 0.065, hx + step * 0.12, hy + step * 0.02);
        ctx.stroke();
    }
    ctx.restore();
}
/**
 * يرسم المجسّم ويعيد لوحة 2400×1800
 * @param cover HTMLCanvasElement | HTMLImageElement للغلاف
 */
function renderMockup(cover, { kind = 'book3d', backdrop = 'studio', angle = 28, spread = false, band = true, title = '' } = {}) {
    const c = mkCanvas(MW, MH);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    paintBackdrop(ctx, MW, MH, backdrop);
    if (kind === 'flat')
        drawFlatBook(ctx, cover);
    else if (kind === 'magazine')
        drawMagazine(ctx, cover, { spread, title });
    else if (kind === 'notebook')
        drawNotebook(ctx, cover, { band });
    else
        drawBook3D(ctx, cover, { angle });
    return c;
}
// ===== hooks/useArabicFonts.js =====
/**
 * يحمّل الخطوط الأساسية عند البدء، ويحمّل أي خط آخر عند استخدامه فقط (ensureFont).
 * fontsVersion يزيد كلما اكتمل خط ← تُعاد قياسات النصوص على الكانفاس.
 */
function useArabicFonts() {
    const [version, setVersion] = useState(0);
    const [loadedCount, setLoadedCount] = useState(0);
    useEffect(() => {
        let alive = true;
        CORE_FONTS.forEach((f) => {
            loadGoogleFont(f.family).then(() => {
                if (!alive)
                    return;
                setVersion((v) => v + 1);
                setLoadedCount((c) => c + 1);
            });
        });
        return () => {
            alive = false;
        };
    }, []);
    const ensureFont = useCallback((family) => {
        if (!family || isFontLoaded(family))
            return;
        loadGoogleFont(family).then(() => setVersion((v) => v + 1));
    }, []);
    return { fontsVersion: version, allLoaded: loadedCount >= CORE_FONTS.length, ensureFont };
}
// ===== hooks/useHTMLImage.js =====
/** يحوّل رابط صورة (blob: أو data:) إلى HTMLImageElement جاهز لـ Konva */
function useHTMLImage(src) {
    const [image, setImage] = useState(null);
    useEffect(() => {
        if (!src) {
            setImage(null);
            return;
        }
        let alive = true;
        const img = new window.Image();
        img.decoding = 'async';
        img.onload = () => alive && setImage(img);
        img.onerror = () => alive && setImage(null);
        img.src = src;
        return () => {
            alive = false;
        };
    }, [src]);
    return image;
}
// ===== hooks/useHistory.js =====
const LIMIT = 80;
const MERGE_WINDOW = 800; // ms — تحريك منزلق أو كتابة متواصلة = خطوة تراجع واحدة
/**
 * سجل تراجع/إعادة للتصميم كاملاً.
 * set(updater, { key }) — التعديلات المتتالية بنفس key خلال 800ms تُدمج في خطوة واحدة.
 */
function useHistory(initial) {
    const [state, setState] = useState(() => ({
        past: [],
        present: typeof initial === 'function' ? initial() : initial,
        future: [],
    }));
    const last = useRef({ key: null, t: 0 });
    const set = useCallback((updater, { key = null } = {}) => {
        const now = Date.now();
        const merge = key !== null && last.current.key === key && now - last.current.t < MERGE_WINDOW;
        last.current = { key, t: now };
        setState((s) => {
            const next = typeof updater === 'function' ? updater(s.present) : updater;
            if (next === s.present)
                return s;
            if (merge)
                return { ...s, present: next, future: [] };
            return { past: [...s.past, s.present].slice(-LIMIT), present: next, future: [] };
        });
    }, []);
    const undo = useCallback(() => {
        last.current = { key: null, t: 0 };
        setState((s) => s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s);
    }, []);
    const redo = useCallback(() => {
        last.current = { key: null, t: 0 };
        setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
    }, []);
    return {
        present: state.present,
        set,
        undo,
        redo,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0,
    };
}
// ===== components/ui.jsx =====
function Section({ title, hint, children, action }) {
    return (React.createElement("section", { className: "rounded-2xl border border-white/5 bg-ink-800/70 p-4 space-y-4" },
        (title || action) && (React.createElement("header", { className: "flex items-center justify-between gap-3" },
            React.createElement("div", null,
                React.createElement("h3", { className: "text-[13px] font-bold tracking-wide text-gold-300" }, title),
                hint && React.createElement("p", { className: "mt-0.5 text-[11px] text-stone-500" }, hint)),
            action)),
        children));
}
// مجموعة خصائص قابلة للطي — تتذكر حالتها (مفتوحة/مطوية) طوال الجلسة
const GROUP_STATE = {};
function PropGroup({ id, title, icon, summary, defaultOpen = false, children }) {
    const [open, setOpen] = useState(() => (id && id in GROUP_STATE ? GROUP_STATE[id] : defaultOpen));
    const toggle = () => {
        const next = !open;
        if (id)
            GROUP_STATE[id] = next;
        setOpen(next);
    };
    return (React.createElement("div", { className: `overflow-hidden rounded-xl border transition-colors ${open ? 'border-gold-500/20 bg-ink-900/70' : 'border-white/5 bg-ink-900/40'}` },
        React.createElement("button", { type: "button", onClick: toggle, className: "flex w-full items-center gap-2.5 px-3 py-2.5 text-start" },
            icon && React.createElement("span", { className: `grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[14px] ${open ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-800 text-stone-400'}` }, icon),
            React.createElement("span", { className: "min-w-0 flex-1" },
                React.createElement("span", { className: `block text-[12.5px] font-bold ${open ? 'text-gold-200' : 'text-stone-300'}` }, title),
                !open && summary && React.createElement("span", { className: "block truncate text-[10.5px] text-stone-500" }, summary)),
            React.createElement("span", { className: `text-[10px] text-stone-500 transition-transform ${open ? '-rotate-90' : ''}` }, "\u25C0")),
        open && React.createElement("div", { className: "space-y-3.5 border-t border-white/5 px-3 pb-3.5 pt-3" }, children)));
}
function FieldLabel({ children, value }) {
    return (React.createElement("div", { className: "mb-1.5 flex items-center justify-between text-[12px] text-stone-400" },
        React.createElement("span", null, children),
        value !== undefined && React.createElement("span", { className: "tabular-nums text-stone-500", dir: "ltr" }, value)));
}
// ———————————————————————————————————————————————
// منزلق لمسي هادئ: لا يقفز عند اللمس، لا يتأثر بالتمرير العمودي،
// السحب نسبي وبطيء للدقة، مع − / + وإدخال رقمي وإرجاع للأصل
// ———————————————————————————————————————————————
const SLIDER_SENSITIVITY = 0.35; // سحب عرض المسار كاملاً = 35% من المدى
const DRAG_START_PX = 9;
function sliderHaptic(strong) {
    try {
        if (window.AndroidBridge?.haptic)
            window.AndroidBridge.haptic(strong ? 1 : 0);
        else if (navigator.vibrate)
            navigator.vibrate(strong ? 12 : 6);
    }
    catch (e) { }
}
function snapToStep(v, min, max, step) {
    const n = Math.round((v - min) / step) * step + min;
    const decimals = (String(step).split('.')[1] || '').length;
    return Math.min(max, Math.max(min, parseFloat(n.toFixed(Math.min(decimals + 1, 6)))));
}
function TouchSlider({ value, min, max, step = 1, onChange, disabled, className = '' }) {
    const trackRef = useRef(null);
    const drag = useRef(null);
    const raf = useRef(0);
    const pending = useRef(null);
    const [active, setActive] = useState(false);
    const range = max - min || 1;
    const pct = Math.min(1, Math.max(0, (value - min) / range));
    const emit = (v) => {
        pending.current = v;
        if (raf.current)
            return;
        raf.current = requestAnimationFrame(() => {
            raf.current = 0;
            if (pending.current !== null)
                onChange(pending.current);
        });
    };
    const onPointerDown = (e) => {
        if (disabled)
            return;
        if (e.pointerType === 'mouse' && e.button !== 0)
            return;
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: value, engaged: false, last: value, type: e.pointerType };
    };
    const onPointerMove = (e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId)
            return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.engaged) {
            if (Math.abs(dy) > DRAG_START_PX && Math.abs(dy) > Math.abs(dx)) {
                drag.current = null;
                return;
            }
            if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) < Math.abs(dy) * 1.3)
                return;
            d.engaged = true;
            d.x = e.clientX; // ابدأ من هنا حتى لا تقفز القيمة
            try {
                trackRef.current?.setPointerCapture(e.pointerId);
            }
            catch (err) { }
            setActive(true);
            return;
        }
        e.preventDefault();
        const width = trackRef.current?.clientWidth || 200;
        const rtl = getComputedStyle(trackRef.current).direction === 'rtl';
        const move = (rtl ? -(e.clientX - d.x) : e.clientX - d.x) / width;
        const fine = e.shiftKey ? 0.25 : 1;
        const next = snapToStep(d.start + move * range * SLIDER_SENSITIVITY * fine, min, max, step);
        if (next !== d.last) {
            if (next === min || next === max)
                sliderHaptic(false);
            d.last = next;
            emit(next);
        }
    };
    const end = (e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId)
            return;
        drag.current = null;
        setActive(false);
    };
    return (React.createElement("div", { ref: trackRef, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end, style: { touchAction: 'pan-y' }, className: `relative h-8 select-none ${disabled ? 'opacity-35' : 'cursor-ew-resize'} ${className}` },
        React.createElement("div", { className: "absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-ink-600" },
            React.createElement("div", { className: "absolute inset-y-0 start-0 rounded-full bg-gradient-to-l from-gold-300 to-gold-600", style: { width: `${pct * 100}%` } })),
        React.createElement("div", { className: `absolute top-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink-800 bg-gold-400 shadow transition-[width,height] ${active ? 'h-6 w-6 ring-4 ring-gold-400/25' : 'h-[18px] w-[18px]'}`, style: { insetInlineStart: `calc(${pct * 100}% - ${active ? 12 : 9}px)` } })));
}
function StepButton({ dir, onStep, disabled }) {
    const st = useRef({ timer: null, repeating: false, down: false, x: 0, y: 0 });
    const clear = () => { clearTimeout(st.current.timer); clearInterval(st.current.timer); st.current.timer = null; };
    const onDown = (e) => {
        if (disabled)
            return;
        const s = st.current;
        s.down = true;
        s.repeating = false;
        s.x = e.clientX;
        s.y = e.clientY;
        clear();
        s.timer = setTimeout(() => {
            s.repeating = true;
            onStep(dir);
            s.timer = setInterval(() => onStep(dir), 80);
        }, 450);
    };
    const onUp = () => {
        const s = st.current;
        if (s.down && !s.repeating && !disabled)
            onStep(dir); // نقرة قصيرة = خطوة واحدة
        s.down = false;
        clear();
    };
    const onCancel = () => { st.current.down = false; clear(); };
    const onMove = (e) => {
        const s = st.current;
        if (s.down && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10)
            onCancel(); // المستخدم يمرّر
    };
    useEffect(() => clear, []);
    return (React.createElement("button", { type: "button", disabled: disabled, onPointerDown: onDown, onPointerUp: onUp, onPointerMove: onMove, onPointerLeave: onCancel, onPointerCancel: onCancel, onContextMenu: (e) => e.preventDefault(), className: "grid h-8 w-8 shrink-0 select-none place-items-center rounded-lg border border-white/10 bg-ink-900 text-[16px] leading-none text-stone-300 active:bg-gold-400/20 active:text-gold-200 disabled:opacity-30", style: { touchAction: 'pan-y' }, "aria-label": dir > 0 ? 'زيادة' : 'إنقاص' }, dir > 0 ? '+' : '−'));
}
function RangeField({ label, value, min, max, step = 1, onChange, format, disabled, defaultValue, compact }) {
    const initial = useRef(defaultValue ?? value);
    const valueRef = useRef(value);
    valueRef.current = value;
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const lastTap = useRef(0);
    const stepBy = (dir) => {
        const next = snapToStep((valueRef.current ?? min) + dir * step, min, max, step);
        if (next !== valueRef.current) {
            valueRef.current = next;
            onChange(next);
            if (next === min || next === max)
                sliderHaptic(false);
        }
    };
    const reset = () => {
        if (disabled)
            return;
        onChange(initial.current);
        sliderHaptic(true);
    };
    const onLabelTap = () => {
        const now = Date.now();
        if (now - lastTap.current < 350)
            reset();
        lastTap.current = now;
    };
    const commit = () => {
        setEditing(false);
        const n = parseFloat(String(draft).replace(/[^\d.\-]/g, ''));
        if (!Number.isFinite(n))
            return;
        // إن كانت القيمة المعروضة نسبة مئوية لقيمة بين 0 و1
        const shown = format ? format(value) : String(value);
        const isPercentOfUnit = max <= 1 && /%/.test(String(shown));
        onChange(snapToStep(isPercentOfUnit ? n / 100 : n, min, max, step));
    };
    const changed = Math.abs((value ?? 0) - initial.current) > step / 2;
    return (React.createElement("div", { className: `block ${disabled ? 'pointer-events-none' : ''}` },
        React.createElement("div", { className: "mb-0.5 flex items-center justify-between text-[12px] text-stone-400" },
            React.createElement("button", { type: "button", onClick: onLabelTap, className: "flex items-center gap-1.5 text-start", title: "\u0646\u0642\u0631\u062A\u0627\u0646 \u0644\u0625\u0631\u062C\u0627\u0639 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0623\u0635\u0644\u064A\u0629" },
                React.createElement("span", null, label),
                changed && !disabled && React.createElement("span", { className: "h-1.5 w-1.5 rounded-full bg-gold-400/70" })),
            editing ? (React.createElement("input", { autoFocus: true, dir: "ltr", inputMode: "decimal", value: draft, onChange: (e) => setDraft(e.target.value), onBlur: commit, onKeyDown: (e) => { if (e.key === 'Enter')
                    e.currentTarget.blur(); if (e.key === 'Escape')
                    setEditing(false); }, className: "w-20 rounded-md border border-gold-500/50 bg-ink-950 px-2 py-0.5 text-center text-[12px] text-gold-100 outline-none" })) : (React.createElement("button", { type: "button", dir: "ltr", onClick: () => { if (disabled)
                    return; setDraft(String(format ? format(value) : value).replace(/[^\d.\-]/g, '')); setEditing(true); }, className: "rounded-md px-1.5 py-0.5 tabular-nums text-stone-400 hover:bg-white/5 hover:text-gold-200", title: "\u0627\u0636\u063A\u0637 \u0644\u0643\u062A\u0627\u0628\u0629 \u0627\u0644\u0631\u0642\u0645" }, format ? format(value) : value))),
        React.createElement("div", { className: "flex items-center gap-2" },
            !compact && React.createElement(StepButton, { dir: -1, onStep: stepBy, disabled: disabled || value <= min }),
            React.createElement(TouchSlider, { value: value, min: min, max: max, step: step, onChange: onChange, disabled: disabled, className: "flex-1" }),
            !compact && React.createElement(StepButton, { dir: 1, onStep: stepBy, disabled: disabled || value >= max }))));
}
function SelectField({ label, value, onChange, options, styleFor }) {
    return (React.createElement("label", { className: "block" },
        label && React.createElement(FieldLabel, null, label),
        React.createElement("select", { value: value, onChange: (e) => onChange(e.target.value), className: "w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-stone-200 outline-none transition focus:border-gold-500/60" }, options.map((o) => (React.createElement("option", { key: o.value, value: o.value, style: styleFor?.(o) }, o.label))))));
}
function TextAreaField({ label, value, onChange, rows = 2, style, inputRef }) {
    return (React.createElement("label", { className: "block" },
        label && React.createElement(FieldLabel, null, label),
        React.createElement("textarea", { ref: inputRef, rows: rows, value: value, onChange: (e) => onChange(e.target.value), style: style, className: "w-full resize-none rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-base leading-relaxed text-stone-100 outline-none transition focus:border-gold-500/60" })));
}
function ColorField({ label, value, onChange }) {
    return (React.createElement("label", { className: "flex items-center justify-between gap-3" },
        React.createElement("span", { className: "text-[12px] text-stone-400" }, label),
        React.createElement("span", { className: "flex items-center gap-2" },
            React.createElement("span", { className: "text-[11px] uppercase text-stone-500", dir: "ltr" }, value),
            React.createElement("input", { type: "color", className: "swatch", value: value, onChange: (e) => onChange(e.target.value) }))));
}
function Toggle({ checked, onChange, label, small }) {
    return (React.createElement("button", { type: "button", role: "switch", "aria-checked": checked, onClick: () => onChange(!checked), className: "flex items-center gap-3 text-right" },
        React.createElement("span", { className: `relative inline-flex shrink-0 rounded-full transition ${small ? 'h-5 w-9' : 'h-6 w-11'} ${checked ? 'bg-gold-500' : 'bg-ink-600'}` },
            React.createElement("span", { className: `absolute top-0.5 rounded-full bg-ink-950 shadow transition-all ${small ? 'h-4 w-4' : 'h-5 w-5'} ${checked ? (small ? 'right-[18px]' : 'right-[22px]') : 'right-0.5'}` })),
        label && React.createElement("span", { className: "text-[13px] text-stone-300" }, label)));
}
function Button({ children, onClick, variant = 'ghost', disabled, className = '', title }) {
    const styles = {
        primary: 'bg-gold-400 text-ink-950 hover:bg-gold-300 font-bold',
        ghost: 'border border-white/10 bg-ink-900 text-stone-300 hover:border-gold-500/50 hover:text-gold-200',
        danger: 'border border-red-900/50 bg-red-950/30 text-red-300 hover:bg-red-950/60',
    };
    return (React.createElement("button", { type: "button", title: title, onClick: onClick, disabled: disabled, className: `rounded-xl px-3 py-2 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}` }, children));
}
function UploadDrop({ accept = 'image/*', onFile, disabled, title, subtitle }) {
    const inputRef = useRef(null);
    const handle = (files) => {
        const file = files?.[0];
        if (file && file.type.startsWith('image/'))
            onFile(file);
    };
    return (React.createElement("div", { role: "button", tabIndex: 0, onClick: () => !disabled && inputRef.current?.click(), onKeyDown: (e) => e.key === 'Enter' && !disabled && inputRef.current?.click(), onDragOver: (e) => e.preventDefault(), onDrop: (e) => {
            e.preventDefault();
            if (!disabled)
                handle(e.dataTransfer.files);
        }, className: `group grid place-items-center rounded-2xl border border-dashed px-4 py-6 text-center transition ${disabled
            ? 'cursor-wait border-white/10 opacity-50'
            : 'cursor-pointer border-gold-600/40 hover:border-gold-400 hover:bg-gold-400/5'}` },
        React.createElement("div", { className: "mb-2 grid h-10 w-10 place-items-center rounded-full bg-gold-400/10 text-xl text-gold-300" }, "\uFF0B"),
        React.createElement("div", { className: "text-sm font-bold text-stone-200" }, title),
        subtitle && React.createElement("div", { className: "mt-1 text-[11px] text-stone-500" }, subtitle),
        React.createElement("input", { ref: inputRef, type: "file", accept: accept, hidden: true, onChange: (e) => {
                handle(e.target.files);
                e.target.value = '';
            } })));
}
function ProgressBar({ percent, label }) {
    return (React.createElement("div", { className: "space-y-2" },
        React.createElement("div", { className: "flex justify-between text-[12px] text-stone-400" },
            React.createElement("span", null, label),
            React.createElement("span", { dir: "ltr" },
                percent,
                "%")),
        React.createElement("div", { className: "h-1.5 overflow-hidden rounded-full bg-ink-600" },
            React.createElement("div", { className: "h-full rounded-full bg-gradient-to-l from-gold-300 to-gold-600 transition-all", style: { width: `${percent}%` } }))));
}
// ===== components/TransformableImage.jsx =====
/** شكل ملوّن خلف الصورة (محراب، قوس، دائرة، توهّج…) يتحرك معها */
function Backdrop({ item }) {
    const bd = item.backdrop;
    if (!bd || bd.shape === 'none')
        return null;
    const w = item.width * bd.width;
    const h = item.height * bd.height;
    const y = bd.offsetY * item.height;
    const scene = (ctx, shape) => {
        traceBackdrop(ctx, bd.shape, w, h);
        ctx.fillStrokeShape(shape);
    };
    let fill;
    if (bd.shape === 'glow') {
        fill = {
            fillRadialGradientStartPoint: { x: 0, y: 0 },
            fillRadialGradientEndPoint: { x: 0, y: 0 },
            fillRadialGradientStartRadius: 0,
            fillRadialGradientEndRadius: Math.max(w, h) / 2,
            fillRadialGradientColorStops: [0, rgba(bd.color, 1), 0.45, rgba(bd.color, 0.55), 1, rgba(bd.color, 0)],
        };
    }
    else if (bd.fade > 0) {
        fill = {
            fillLinearGradientStartPoint: { x: 0, y: -h / 2 },
            fillLinearGradientEndPoint: { x: 0, y: h / 2 },
            fillLinearGradientColorStops: [0, rgba(bd.color, 1), Math.max(0, 1 - bd.fade), rgba(bd.color, 1), 1, rgba(bd.color, 0)],
        };
    }
    else {
        fill = { fill: bd.color };
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Shape, { y: y, sceneFunc: scene, ...fill, opacity: bd.opacity, stroke: bd.stroke ? bd.strokeColor : undefined, strokeWidth: bd.stroke ? 4 : 0, strokeEnabled: !!bd.stroke }),
        bd.pattern > 0 && bd.shape !== 'glow' && (React.createElement(Shape, { y: y, sceneFunc: scene, fillPatternImage: getOverlayCanvas('islamic'), fillPatternRepeat: "repeat", fillPatternScale: { x: 0.55 / OVERLAY_SCALE, y: 0.55 / OVERLAY_SCALE }, opacity: bd.pattern, listening: false }))));
}
/**
 * عنصر صوري (صورة/شعار) داخل مجموعة قابلة للسحب والتكبير والتدوير.
 * المجموعة تضم: الشكل الخلفي + الصورة (مع المرشحات والتلاشي والظل/التوهّج).
 * الإحداثيات (x, y) تمثل مركز العنصر.
 */
function TransformableImage({ item, onSelect, onDragEnd, onOpenProps }) {
    const image = useHTMLImage(item.src);
    const imgRef = useRef(null);
    const fadeBottom = item.fadeBottom || 0;
    const fadeEdges = item.fadeEdges || 0;
    const source = useMemo(() => (image && (fadeBottom > 0 || fadeEdges > 0) ? makeFadedImage(image, fadeBottom, fadeEdges) : image), [image, fadeBottom, fadeEdges]);
    const { filters, attrs } = useMemo(() => buildImageFilters(item.fx), [item.fx]);
    const mode = item.shadowMode || (item.shadow ? 'ground' : 'none');
    const shadow = mode === 'ground'
        ? { shadowEnabled: true, shadowColor: '#000', shadowBlur: 45, shadowOpacity: 0.75, shadowOffsetX: 0, shadowOffsetY: 18 }
        : mode === 'glow'
            ? { shadowEnabled: true, shadowColor: item.glowColor || '#ffffff', shadowBlur: item.glowSize ?? 60, shadowOpacity: 1, shadowOffsetX: 0, shadowOffsetY: 0 }
            : { shadowEnabled: false };
    // المرشحات تعمل على نسخة مخزّنة (cache) — نعيد بناءها عند أي تغيير
    useEffect(() => {
        const node = imgRef.current;
        if (!node)
            return;
        if (filters.length)
            node.cache({ pixelRatio: 2 });
        else
            node.clearCache();
        node.getLayer()?.batchDraw();
    }, [source, filters, attrs, item.width, item.height, mode, item.glowColor, item.glowSize]);
    if (!source)
        return null;
    return (React.createElement(Group, { id: item.id, name: "element", x: item.x, y: item.y, rotation: item.rotation, scaleX: item.scale, scaleY: item.scale, opacity: item.opacity, visible: item.visible !== false, listening: !item.locked, draggable: !item.locked, onMouseDown: (e) => onSelect(item.id, e.evt?.shiftKey), onTap: () => onSelect(item.id), onDblClick: () => onOpenProps?.(item.id), onDblTap: () => onOpenProps?.(item.id), onDragEnd: onDragEnd },
        React.createElement(Backdrop, { item: item }),
        React.createElement(KonvaImage, { ref: imgRef, image: source, width: item.width, height: item.height, offsetX: item.width / 2, offsetY: item.height / 2, filters: filters, ...attrs, ...shadow })));
}
// ===== components/TransformableShape.jsx =====
/** عنصر زخرفي قابل للتلوين والسحب والتمديد والتدوير */
function TransformableShape({ item, onSelect, onDragEnd, onOpenProps }) {
    const def = getShapeDef(item.kind);
    const w = item.width, h = item.height;
    const hasStroke = item.strokeWidth > 0 && item.stroke && item.stroke !== 'rgba(0,0,0,0)';
    return (React.createElement(Group, { id: item.id, name: "element", shapeW: w, shapeH: h, x: item.x, y: item.y, rotation: item.rotation, opacity: item.opacity, visible: item.visible !== false, listening: !item.locked, draggable: !item.locked, onMouseDown: (e) => onSelect(item.id, e.evt?.shiftKey), onTap: () => onSelect(item.id), onDblClick: () => onOpenProps?.(item.id), onDblTap: () => onOpenProps?.(item.id), onDragEnd: onDragEnd },
        React.createElement(Rect, { x: -w / 2, y: -h / 2, width: w, height: h, fill: "rgba(0,0,0,0.01)" }),
        React.createElement(Shape, { sceneFunc: (ctx, shape) => def.draw(ctx, w, h, shape), fill: item.fill, stroke: hasStroke ? item.stroke : undefined, strokeWidth: hasStroke ? item.strokeWidth : 0, strokeEnabled: hasStroke, lineJoin: "round", lineCap: "round", shadowEnabled: !!item.shadow, shadowColor: "#000", shadowBlur: item.shadow ? 20 : 0, shadowOpacity: item.shadow ? 0.7 : 0, shadowOffsetY: item.shadow ? 6 : 0, listening: false })));
}
// ===== components/FontPicker.jsx =====
/** منتقي خطوط مرئي: كل خط يُعرض بشكله الحقيقي، مقسّماً حسب النوع */
function FontPicker({ value, onChange, sample = 'أبجد هوز' }) {
    const [open, setOpen] = useState(false);
    const [cat, setCat] = useState(() => getFontMeta(value)?.category || 'calligraphy');
    const [, setTick] = useState(0);
    // تحميل خطوط النوع المعروض فقط عند فتح المنتقي
    useEffect(() => {
        if (!open)
            return;
        let alive = true;
        ARABIC_FONTS.filter((f) => f.category === cat).forEach((f) => loadGoogleFont(f.family).then(() => alive && setTick((t) => t + 1)));
        return () => {
            alive = false;
        };
    }, [open, cat]);
    const current = getFontMeta(value);
    return (React.createElement("div", null,
        React.createElement("button", { type: "button", onClick: () => setOpen((o) => !o), className: `flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-right transition ${open ? 'border-gold-500/60 bg-ink-900' : 'border-white/10 bg-ink-900 hover:border-gold-500/40'}` },
            React.createElement("span", { className: "min-w-0" },
                React.createElement("span", { className: "block text-[11px] text-stone-500" }, "\u0627\u0644\u062E\u0637"),
                React.createElement("span", { className: "block truncate text-[19px] leading-tight text-stone-100", style: { fontFamily: `"${value}"` } }, current?.label || value)),
            React.createElement("span", { className: `text-[10px] text-stone-500 transition ${open ? 'rotate-90' : ''}` }, "\u25C0")),
        open && (React.createElement("div", { className: "mt-2 space-y-2 rounded-xl border border-white/10 bg-ink-900 p-2" },
            React.createElement("div", { className: "scroll-thin flex gap-1 overflow-x-auto pb-1" }, FONT_CATEGORIES.map((c) => (React.createElement("button", { key: c.id, type: "button", onClick: () => setCat(c.id), className: `shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] transition ${cat === c.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-800 text-stone-400'}` }, c.label)))),
            React.createElement("div", { className: "grid grid-cols-2 gap-1.5" }, ARABIC_FONTS.filter((f) => f.category === cat).map((f) => (React.createElement("button", { key: f.family, type: "button", onClick: () => {
                    onChange(f.family);
                    setOpen(false);
                }, className: `rounded-lg border px-2 py-2 text-center transition ${value === f.family ? 'border-gold-400 bg-gold-400/10' : 'border-white/5 bg-ink-800 hover:border-white/20'}` },
                React.createElement("span", { className: "block truncate text-[20px] leading-snug text-stone-100", style: { fontFamily: `"${f.family}"` } }, sample),
                React.createElement("span", { className: "block truncate text-[10.5px] text-stone-500" }, f.label)))))))));
}
// ===== components/CoverCanvas.jsx =====
function paletteFill(palette) {
    const [base, light, edge] = palette.colors;
    if (palette.type === 'spot' || palette.type === 'corner') {
        const cx = palette.type === 'spot' ? COVER_W / 2 : COVER_W * 0.95;
        const cy = palette.type === 'spot' ? COVER_H * 0.08 : COVER_H * 0.05;
        return {
            fillRadialGradientStartPoint: { x: cx, y: cy },
            fillRadialGradientEndPoint: { x: cx, y: cy },
            fillRadialGradientStartRadius: 0,
            fillRadialGradientEndRadius: COVER_H * (palette.type === 'spot' ? 1.0 : 1.15),
            fillRadialGradientColorStops: [0, light, 0.45, base, 1, edge],
        };
    }
    if (palette.type === 'horizon') {
        return {
            fillLinearGradientStartPoint: { x: 0, y: 0 },
            fillLinearGradientEndPoint: { x: 0, y: COVER_H },
            fillLinearGradientColorStops: [0, base, 0.62, light, 1, edge],
        };
    }
    if (palette.type === 'radial') {
        return {
            fillRadialGradientStartPoint: { x: COVER_W / 2, y: COVER_H * 0.4 },
            fillRadialGradientEndPoint: { x: COVER_W / 2, y: COVER_H * 0.4 },
            fillRadialGradientStartRadius: 0,
            fillRadialGradientEndRadius: COVER_H * 0.78,
            fillRadialGradientColorStops: [0, light, 0.55, base, 1, edge],
        };
    }
    return {
        fillLinearGradientStartPoint: { x: COVER_W * 0.1, y: 0 },
        fillLinearGradientEndPoint: { x: COVER_W * 0.45, y: COVER_H },
        fillLinearGradientColorStops: [0, light, 0.5, base, 1, edge],
    };
}
/** صورة الخلفية الكاملة (مرفوعة أو مولّدة بالذكاء الاصطناعي) — تملأ الغلاف بنمط cover */
/** تلوين الخلفية: تدوير الألوان + التشبّع + السطوع (يُحسب مرة لكل تغيير) */
function useRecolored(img, hue = 0, sat = 1, bright = 1) {
    return useMemo(() => {
        if (!img || (!hue && sat === 1 && bright === 1))
            return img;
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        if ('filter' in ctx) {
            ctx.filter = `hue-rotate(${hue}deg) saturate(${sat}) brightness(${bright})`;
            ctx.drawImage(img, 0, 0);
            return c;
        }
        // بديل يدوي للمتصفحات القديمة: مصفوفة تدوير الألوان
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const d = data.data;
        const a = (hue * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
        const m = [
            0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
            0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283,
            0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
        ];
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            let nr = m[0] * r + m[1] * g + m[2] * b, ng = m[3] * r + m[4] * g + m[5] * b, nb = m[6] * r + m[7] * g + m[8] * b;
            const l = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;
            nr = (l + (nr - l) * sat) * bright;
            ng = (l + (ng - l) * sat) * bright;
            nb = (l + (nb - l) * sat) * bright;
            d[i] = nr;
            d[i + 1] = ng;
            d[i + 2] = nb;
        }
        ctx.putImageData(data, 0, 0);
        return c;
    }, [img, hue, sat, bright]);
}
function BackgroundImage({ bg, palette }) {
    const raw = useHTMLImage(bg.src);
    const img = useRecolored(raw, bg.hue || 0, bg.sat ?? 1, bg.bright ?? 1);
    if (!img || !raw)
        return null;
    const base = Math.max(COVER_W / raw.naturalWidth, COVER_H / raw.naturalHeight) * bg.scale;
    const w = raw.naturalWidth * base;
    const h = raw.naturalHeight * base;
    const x = (COVER_W - w) / 2 + (bg.offsetX * (w - COVER_W)) / 2;
    const y = (COVER_H - h) / 2 + (bg.offsetY * (h - COVER_H)) / 2;
    return (React.createElement(React.Fragment, null,
        React.createElement(KonvaImage, { name: "background", image: img, x: x, y: y, width: w, height: h, opacity: bg.opacity }),
        bg.paletteMix > 0 && (React.createElement(Rect, { name: "background", width: COVER_W, height: COVER_H, ...paletteFill(palette), opacity: bg.paletteMix, globalCompositeOperation: bg.blend || 'soft-light' })),
        bg.dim > 0 && React.createElement(Rect, { name: "background", width: COVER_W, height: COVER_H, fill: "#000", opacity: bg.dim })));
}
/** مولّد أرقام شبه عشوائية ثابت (حتى لا يرتجف الشكل عند كل رسم) */
function seeded(seed) {
    let a = (seed >>> 0) || 1;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** تفتيح/تغميق لون سداسي: amount من -1 إلى 1 */
function shade(hex, amount) {
    let h = String(hex || '#000').replace('#', '');
    if (h.length === 3)
        h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16) || 0;
    const target = amount >= 0 ? 255 : 0;
    const k = Math.abs(amount);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (target - v) * k));
    return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
}
/** شكل خلف النص: شريط لكل سطر، صندوق، إطار بيضاوي، لوحة زخرفية، هالة، خط سفلي */
function TextBackground({ t, lines, lh }) {
    const type = t.bg || 'none';
    if (type === 'none')
        return null;
    const pad = t.bgPadding ?? 16;
    const color = t.bgColor || '#000000';
    const op = t.bgOpacity ?? 0.85;
    const glyphH = t.size * 1.15;
    const blockW = Math.max(1, ...lines.map((l) => l.width));
    const blockH = lines.length * lh;
    const top = (lh - glyphH) / 2 - pad;
    const boxH = blockH - (lh - glyphH) + pad * 2;
    switch (type) {
        case 'bars':
            return lines.map((l, i) => (React.createElement(Rect, { key: i, x: -l.width / 2 - pad, y: i * lh + (lh - glyphH) / 2 - pad * 0.35, width: l.width + pad * 2, height: glyphH + pad * 0.7, fill: color, opacity: op, cornerRadius: t.bgRadius || 0 })));
        case 'box':
            return React.createElement(Rect, { x: -blockW / 2 - pad, y: top, width: blockW + pad * 2, height: boxH, fill: color, opacity: op, cornerRadius: t.bgRadius || 0 });
        case 'pill':
            return (React.createElement(Rect, { x: -blockW / 2 - pad * 1.6, y: top, width: blockW + pad * 3.2, height: boxH, cornerRadius: boxH / 2, stroke: t.bgStroke || color, strokeWidth: Math.max(1.5, t.size * 0.025), fill: rgba(color, 0.18 * op), opacity: op }));
        case 'plaque': {
            const w = blockW + pad * 2 + boxH * 0.3;
            const cy = top + boxH / 2;
            const dotX = w / 2 + boxH * 0.18 + boxH * 0.22;
            return (React.createElement(React.Fragment, null,
                React.createElement(Shape, { y: cy, sceneFunc: (ctx, shape) => {
                        tracePlaque(ctx, w, boxH);
                        ctx.fillStrokeShape(shape);
                    }, fillLinearGradientStartPoint: { x: 0, y: -boxH / 2 }, fillLinearGradientEndPoint: { x: 0, y: boxH / 2 }, fillLinearGradientColorStops: [0, rgba(color, 1), 1, rgba(color, 0.82)], stroke: t.bgStroke, strokeWidth: Math.max(2, t.size * 0.03), opacity: op }),
                React.createElement(Circle, { x: -dotX, y: cy, radius: boxH * 0.07, fill: t.bgStroke || color, opacity: op }),
                React.createElement(Circle, { x: dotX, y: cy, radius: boxH * 0.07, fill: t.bgStroke || color, opacity: op })));
        }
        case 'glass':
            return (React.createElement(Rect, { x: -blockW / 2 - pad * 1.4, y: top, width: blockW + pad * 2.8, height: boxH, cornerRadius: Math.min(28, boxH * 0.22), fillLinearGradientStartPoint: { x: 0, y: 0 }, fillLinearGradientEndPoint: { x: 0, y: boxH }, fillLinearGradientColorStops: [0, rgba(color, 0.42 * op), 0.5, rgba(color, 0.22 * op), 1, rgba(color, 0.32 * op)], stroke: `rgba(255,255,255,${0.5 * op})`, strokeWidth: Math.max(1.5, t.size * 0.014), shadowColor: "#000", shadowBlur: t.size * 0.4, shadowOpacity: 0.45, shadowOffsetY: t.size * 0.06, shadowForStrokeEnabled: false }));
        case 'fade': {
            const W = blockW + pad * 10;
            return (React.createElement(Rect, { x: -W / 2, y: top, width: W, height: boxH, fillLinearGradientStartPoint: { x: 0, y: 0 }, fillLinearGradientEndPoint: { x: W, y: 0 }, fillLinearGradientColorStops: [0, rgba(color, 0), 0.22, rgba(color, op * 0.9), 0.5, rgba(color, op), 0.78, rgba(color, op * 0.9), 1, rgba(color, 0)] }));
        }
        case 'brush': {
            const W = blockW + pad * 4;
            const H = boxH * 1.05;
            const seed = (t.text || '').length * 31 + Math.round(t.size);
            return (React.createElement(Shape, { y: top + boxH / 2, opacity: op, fill: color, sceneFunc: (ctx, shape) => {
                    const r = seeded(seed);
                    const x0 = -W / 2, x1 = W / 2;
                    const steps = 26;
                    ctx.beginPath();
                    ctx.moveTo(x0 + W * 0.02, -H * 0.42);
                    for (let i = 1; i <= steps; i++) {
                        const x = x0 + (W * i) / steps;
                        ctx.lineTo(x - W * 0.01, -H * (0.44 + (r() - 0.5) * 0.12) - Math.sin(i * 0.5) * H * 0.03);
                    }
                    // طرف خشن
                    for (let j = 0; j < 7; j++)
                        ctx.lineTo(x1 + W * (0.01 + r() * 0.05) * (j % 2 ? 1 : 0.3), -H * 0.4 + (H * 0.8 * (j + 1)) / 7);
                    for (let i = steps; i >= 0; i--) {
                        const x = x0 + (W * i) / steps;
                        ctx.lineTo(x + W * 0.01, H * (0.46 + (r() - 0.5) * 0.14) + Math.cos(i * 0.4) * H * 0.03);
                    }
                    for (let j = 0; j < 7; j++)
                        ctx.lineTo(x0 - W * (0.01 + r() * 0.06) * (j % 2 ? 1 : 0.4), H * 0.4 - (H * 0.8 * (j + 1)) / 7);
                    ctx.closePath();
                    ctx.fillShape(shape);
                    // خطوط جافة متقطعة عند الحواف
                    const native = ctx._context;
                    const prevAlpha = native.globalAlpha;
                    native.globalAlpha = prevAlpha * 0.55;
                    for (let k = 0; k < 9; k++) {
                        const yy = (r() < 0.5 ? -1 : 1) * H * (0.48 + r() * 0.08);
                        const xs = x0 + r() * W * 0.7;
                        ctx.beginPath();
                        ctx.rect(xs, yy, W * (0.1 + r() * 0.25), Math.max(1, H * 0.02));
                        ctx.fillShape(shape);
                    }
                    native.globalAlpha = prevAlpha;
                } }));
        }
        case 'ribbon': {
            const W = blockW + pad * 2.4;
            const H = boxH;
            const tail = H * 0.9;
            const drop = H * 0.28;
            const dark = shade(color, -0.35);
            return (React.createElement(React.Fragment, null,
                [-1, 1].map((side) => (React.createElement(Shape, { key: side, opacity: op, y: top, fill: shade(color, -0.12), sceneFunc: (ctx, shape) => {
                        const xe = side * (W / 2 - H * 0.2);
                        const xo = side * (W / 2 + tail);
                        ctx.beginPath();
                        ctx.moveTo(xe, drop);
                        ctx.lineTo(xo, drop);
                        ctx.lineTo(xo - side * H * 0.32, drop + H / 2);
                        ctx.lineTo(xo, drop + H);
                        ctx.lineTo(xe, drop + H);
                        ctx.closePath();
                        ctx.fillShape(shape);
                    } }))),
                [-1, 1].map((side) => (React.createElement(Shape, { key: `f${side}`, opacity: op, y: top, fill: dark, sceneFunc: (ctx, shape) => {
                        const xe = side * (W / 2);
                        ctx.beginPath();
                        ctx.moveTo(xe, H);
                        ctx.lineTo(xe - side * H * 0.2, drop + H);
                        ctx.lineTo(xe - side * H * 0.2, H);
                        ctx.closePath();
                        ctx.fillShape(shape);
                    } }))),
                React.createElement(Rect, { x: -W / 2, y: top, width: W, height: H, opacity: op, fillLinearGradientStartPoint: { x: 0, y: 0 }, fillLinearGradientEndPoint: { x: 0, y: H }, fillLinearGradientColorStops: [0, shade(color, 0.18), 0.5, color, 1, shade(color, -0.15)], shadowColor: "#000", shadowBlur: t.size * 0.25, shadowOpacity: 0.5, shadowOffsetY: t.size * 0.05 }),
                React.createElement(Rect, { x: -W / 2, y: top + H * 0.09, width: W, height: Math.max(1, t.size * 0.012), fill: t.bgStroke || '#fff', opacity: op * 0.7 }),
                React.createElement(Rect, { x: -W / 2, y: top + H * 0.91, width: W, height: Math.max(1, t.size * 0.012), fill: t.bgStroke || '#fff', opacity: op * 0.7 })));
        }
        case 'frame': {
            const W = blockW + pad * 3, sw = Math.max(1.5, t.size * 0.02), gap = Math.max(5, t.size * 0.07);
            return (React.createElement(React.Fragment, null,
                React.createElement(Rect, { x: -W / 2, y: top, width: W, height: boxH, fill: rgba(color, 0.55 * op), stroke: t.bgStroke, strokeWidth: sw }),
                React.createElement(Rect, { x: -W / 2 + gap, y: top + gap, width: W - gap * 2, height: boxH - gap * 2, stroke: t.bgStroke, strokeWidth: sw * 0.5, opacity: op })));
        }
        case 'corners': {
            const W = blockW + pad * 3, L = Math.min(W, boxH) * 0.28, sw = Math.max(2, t.size * 0.028);
            const x0 = -W / 2, x1 = W / 2, y0 = top, y1 = top + boxH;
            const c = t.bgStroke || color;
            return (React.createElement(React.Fragment, null,
                React.createElement(Rect, { x: x0, y: y0, width: W, height: boxH, fill: rgba(color, 0.35 * op) }),
                [
                    [x0, y0 + L, x0, y0, x0 + L, y0],
                    [x1 - L, y0, x1, y0, x1, y0 + L],
                    [x0, y1 - L, x0, y1, x0 + L, y1],
                    [x1 - L, y1, x1, y1, x1, y1 - L],
                ].map((pts, i) => (React.createElement(Line, { key: i, points: pts, stroke: c, strokeWidth: sw, lineCap: "square", opacity: Math.min(1, op + 0.15) })))));
        }
        case 'ornament': {
            const W = blockW + pad * 6, sw = Math.max(1.2, t.size * 0.014), d = Math.max(5, t.size * 0.07);
            const c = t.bgStroke || color;
            const row = (y) => (React.createElement(React.Fragment, null,
                React.createElement(Rect, { x: -W / 2, y: y - sw / 2, width: W, height: sw, fillLinearGradientStartPoint: { x: 0, y: 0 }, fillLinearGradientEndPoint: { x: W, y: 0 }, fillLinearGradientColorStops: [0, rgba(c, 0), 0.3, rgba(c, op), 0.7, rgba(c, op), 1, rgba(c, 0)] }),
                React.createElement(Rect, { x: 0, y: y, width: d * 1.4, height: d * 1.4, offsetX: d * 0.7, offsetY: d * 0.7, rotation: 45, fill: c, opacity: op }),
                React.createElement(Circle, { x: -W * 0.36, y: y, radius: d * 0.28, fill: c, opacity: op }),
                React.createElement(Circle, { x: W * 0.36, y: y, radius: d * 0.28, fill: c, opacity: op })));
            return (React.createElement(React.Fragment, null,
                row(top + pad * 0.2),
                row(top + boxH - pad * 0.2)));
        }
        case 'stamp': {
            const R = Math.max(blockW / 2, boxH / 2) + pad;
            const c = t.bgStroke || color;
            const sw = Math.max(2, t.size * 0.03);
            return (React.createElement(Group, { x: 0, y: top + boxH / 2, rotation: -8, opacity: op },
                React.createElement(Circle, { radius: R, fill: rgba(color, 0.25), stroke: c, strokeWidth: sw }),
                React.createElement(Circle, { radius: R - sw * 3, stroke: c, strokeWidth: sw * 0.5, dash: [sw * 1.5, sw] }),
                React.createElement(Circle, { radius: R + sw * 2.5, stroke: c, strokeWidth: sw * 0.45 }),
                [-1, 1].map((s) => (React.createElement(Shape, { key: s, x: s * (R - sw * 6), fill: c, sceneFunc: (ctx, shape) => {
                        const r1 = sw * 2.2, r2 = sw;
                        ctx.beginPath();
                        for (let i = 0; i < 10; i++) {
                            const a = (i * Math.PI) / 5 - Math.PI / 2;
                            const rr = i % 2 ? r2 : r1;
                            i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
                        }
                        ctx.closePath();
                        ctx.fillShape(shape);
                    } })))));
        }
        case 'torn': {
            const W = blockW + pad * 3;
            const H = boxH * 1.1;
            const seed = (t.text || '').length * 17 + 7;
            return (React.createElement(Shape, { y: top + boxH / 2, rotation: -1.5, fill: color, opacity: op, shadowColor: "#000", shadowBlur: t.size * 0.3, shadowOpacity: 0.55, shadowOffsetY: t.size * 0.06, sceneFunc: (ctx, shape) => {
                    const r = seeded(seed);
                    const n = 34;
                    ctx.beginPath();
                    ctx.moveTo(-W / 2, -H / 2);
                    for (let i = 1; i <= n; i++)
                        ctx.lineTo(-W / 2 + (W * i) / n, -H / 2 + (r() - 0.5) * H * 0.09);
                    ctx.lineTo(W / 2 + (r() - 0.5) * 6, H / 2);
                    for (let i = n - 1; i >= 0; i--)
                        ctx.lineTo(-W / 2 + (W * i) / n, H / 2 + (r() - 0.5) * H * 0.1);
                    ctx.closePath();
                    ctx.fillShape(shape);
                } }));
        }
        case 'tag': {
            const W = blockW + pad * 3.2;
            const rv = Math.max(3, t.size * 0.045);
            const inset = rv * 2.4;
            return (React.createElement(Group, { opacity: op },
                React.createElement(Rect, { x: -W / 2, y: top, width: W, height: boxH, cornerRadius: rv * 1.5, fillLinearGradientStartPoint: { x: 0, y: 0 }, fillLinearGradientEndPoint: { x: W * 0.3, y: boxH }, fillLinearGradientColorStops: [0, shade(color, 0.3), 0.45, color, 0.55, shade(color, -0.2), 1, shade(color, 0.1)], stroke: shade(color, -0.5), strokeWidth: Math.max(1.5, t.size * 0.015), shadowColor: "#000", shadowBlur: t.size * 0.3, shadowOpacity: 0.6, shadowOffsetY: t.size * 0.05 }),
                [
                    [-W / 2 + inset, top + inset],
                    [W / 2 - inset, top + inset],
                    [-W / 2 + inset, top + boxH - inset],
                    [W / 2 - inset, top + boxH - inset],
                ].map(([x, y], i) => (React.createElement(Circle, { key: i, x: x, y: y, radius: rv, fillRadialGradientStartPoint: { x: -rv * 0.3, y: -rv * 0.3 }, fillRadialGradientEndPoint: { x: 0, y: 0 }, fillRadialGradientStartRadius: 0, fillRadialGradientEndRadius: rv, fillRadialGradientColorStops: [0, '#ffffff', 0.5, shade(color, 0.2), 1, shade(color, -0.6)] })))));
        }
        case 'arch': {
            const W = blockW + pad * 2.6;
            const H = boxH + W * 0.5;
            const y1 = top + boxH + pad * 0.6;
            return (React.createElement(Shape, { opacity: op, fillLinearGradientStartPoint: { x: 0, y: y1 - H }, fillLinearGradientEndPoint: { x: 0, y: y1 }, fillLinearGradientColorStops: [0, shade(color, 0.15), 1, color], stroke: t.bgStroke, strokeWidth: Math.max(1.5, t.size * 0.018), sceneFunc: (ctx, shape) => {
                    ctx.beginPath();
                    ctx.moveTo(-W / 2, y1);
                    ctx.lineTo(-W / 2, y1 - H + W / 2);
                    ctx.arc(0, y1 - H + W / 2, W / 2, Math.PI, 0, false);
                    ctx.lineTo(W / 2, y1);
                    ctx.closePath();
                    ctx.fillStrokeShape(shape);
                } }));
        }
        case 'halo':
            return (React.createElement(Ellipse, { x: 0, y: blockH / 2, radiusX: blockW * 0.62 + pad * 2, radiusY: blockH * 0.85 + pad * 2, fillRadialGradientStartPoint: { x: 0, y: 0 }, fillRadialGradientEndPoint: { x: 0, y: 0 }, fillRadialGradientStartRadius: 0, fillRadialGradientEndRadius: blockW * 0.62 + pad * 2, fillRadialGradientColorStops: [0, rgba(color, op), 0.55, rgba(color, op * 0.45), 1, rgba(color, 0)], listening: false }));
        case 'underline': {
            const y = blockH - (lh - glyphH) / 2 + pad * 0.4;
            return React.createElement(Rect, { x: -blockW / 2, y: y, width: blockW, height: Math.max(3, t.size * 0.05), fill: color, opacity: op, cornerRadius: 2 });
        }
        default:
            return null;
    }
}
/** مجموعة نص كاملة: الخلفية + الطبقات السفلية للتأثير + النص (أو كل سطر بلونه) */
function TextGroup({ id, t, fontsVersion, onSelect, onDragEnd, onOpenProps }) {
    const lines = useMemo(() => measureLines(t), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t.text, t.font, t.weight, t.size, t.width, t.letterSpacing, fontsVersion]);
    const lh = t.size * t.lineHeight;
    const perLine = lines.length > 1 && (!!t.secondColor || needsPerLine(t.effect));
    const pieces = perLine
        ? lines.map((l, i) => ({ text: l.text, y: i * lh, color: i > 0 && t.secondColor ? t.secondColor : t.color }))
        : [{ text: t.text, y: 0, color: t.color }];
    const k = `${id}-${t.font}-${t.weight}-${t.effect}-${perLine}-${fontsVersion}`;
    const common = {
        fontFamily: t.font,
        fontStyle: String(t.weight),
        fontSize: t.size,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing || 0,
        align: 'center',
        width: t.width,
        offsetX: t.width / 2,
        x: 0,
        wrap: perLine ? 'none' : 'word',
    };
    return (React.createElement(Group, { id: `text-${id}`, x: t.x, y: t.y, rotation: t.rotation || 0, opacity: t.opacity ?? 1, name: "element", visible: t.visible !== false, listening: !t.locked, draggable: !t.locked, onMouseDown: (e) => onSelect(`text-${id}`, e.evt?.shiftKey), onTap: () => onSelect(`text-${id}`), onDblClick: () => onOpenProps?.(`text-${id}`), onDblTap: () => onOpenProps?.(`text-${id}`), onDragEnd: onDragEnd },
        React.createElement(TextBackground, { t: t, lines: lines, lh: lh }),
        pieces.map((p, pi) => {
            const tp = { ...t, text: p.text, color: p.color };
            const { main, under, over } = buildTextLayers(tp, { lh, lines: perLine ? 1 : lines.length, w: t.width });
            const back = [...buildRingLayers(tp), ...under];
            return [
                ...back.map(({ dy = 0, dx = 0, ...u }, i) => (React.createElement(Text, { key: `${k}-${pi}-u${i}`, ...common, text: p.text, x: dx, y: p.y + dy, ...u, listening: false }))),
                React.createElement(Text, { key: `${k}-${pi}`, ...common, text: p.text, y: p.y, ...main }),
                ...(over || []).map(({ dy = 0, dx = 0, ...o }, i) => (React.createElement(Text, { key: `${k}-${pi}-o${i}`, ...common, text: p.text, x: dx, y: p.y + dy, ...o, listening: false }))),
            ];
        })));
}
const FRAME_STYLES = [
    { id: 'none', label: 'بدون' },
    { id: 'line', label: 'خط رفيع' },
    { id: 'double', label: 'خط مزدوج' },
    { id: 'gold', label: 'ذهبي فاخر' },
    { id: 'thick', label: 'حافة عريضة' },
    { id: 'inset', label: 'إطار مستدير' },
    { id: 'corners', label: 'زوايا زخرفية' },
    { id: 'deco', label: 'آرت ديكو' },
    { id: 'islamic', label: 'نجوم إسلامية' },
    { id: 'dashed', label: 'متقطّع' },
    { id: 'tactical', label: 'تكتيكي' },
    { id: 'hazard', label: 'شريط تحذير' },
    { id: 'classified', label: 'شريط سرّي' },
    { id: 'film', label: 'شريط سينمائي' },
];
const DEFAULT_FRAME = { style: 'none', color: '#d4af6a', color2: '#111111', width: 6, margin: 36, opacity: 1 };
/** إطار حول التصميم كاملاً — فوق كل الطبقات */
function DesignFrame({ frame }) {
    const f = { ...DEFAULT_FRAME, ...(frame || {}) };
    if (!f.style || f.style === 'none')
        return null;
    const W = COVER_W, H = COVER_H, m = f.margin, sw = f.width, c = f.color, c2 = f.color2;
    const common = { listening: false, opacity: f.opacity };
    switch (f.style) {
        case 'line':
            return React.createElement(Rect, { ...common, x: m, y: m, width: W - m * 2, height: H - m * 2, stroke: c, strokeWidth: sw });
        case 'double':
            return (React.createElement(Group, { ...common },
                React.createElement(Rect, { x: m, y: m, width: W - m * 2, height: H - m * 2, stroke: c, strokeWidth: sw }),
                React.createElement(Rect, { x: m + sw * 2.5, y: m + sw * 2.5, width: W - (m + sw * 2.5) * 2, height: H - (m + sw * 2.5) * 2, stroke: c, strokeWidth: Math.max(1, sw * 0.4) })));
        case 'gold': {
            const g = { strokeLinearGradientStartPoint: { x: 0, y: 0 }, strokeLinearGradientEndPoint: { x: W, y: H }, strokeLinearGradientColorStops: [0, '#fff3c4', 0.25, '#c9972f', 0.5, '#f8e08e', 0.75, '#8a6420', 1, '#f2d27c'] };
            return (React.createElement(Group, { ...common },
                React.createElement(Rect, { x: m, y: m, width: W - m * 2, height: H - m * 2, strokeWidth: sw * 2, ...g, shadowColor: "#000", shadowBlur: sw * 2, shadowOpacity: 0.6 }),
                React.createElement(Rect, { x: m + sw * 3, y: m + sw * 3, width: W - (m + sw * 3) * 2, height: H - (m + sw * 3) * 2, strokeWidth: Math.max(1, sw * 0.4), ...g })));
        }
        case 'thick':
            return (React.createElement(Group, { ...common },
                React.createElement(Shape, { fill: c, fillRule: "evenodd", sceneFunc: (ctx, shape) => {
                        const b = Math.max(m, sw * 3);
                        ctx.beginPath();
                        ctx.rect(0, 0, W, H);
                        // فتحة بعكس اتجاه الرسم — تعمل مع أي قاعدة تعبئة
                        ctx.moveTo(b, b);
                        ctx.lineTo(b, H - b);
                        ctx.lineTo(W - b, H - b);
                        ctx.lineTo(W - b, b);
                        ctx.closePath();
                        ctx.fillShape(shape);
                    } }),
                React.createElement(Rect, { x: Math.max(m, sw * 3) + sw, y: Math.max(m, sw * 3) + sw, width: W - (Math.max(m, sw * 3) + sw) * 2, height: H - (Math.max(m, sw * 3) + sw) * 2, stroke: c, strokeWidth: Math.max(1, sw * 0.35) })));
        case 'inset':
            return React.createElement(Rect, { ...common, x: m, y: m, width: W - m * 2, height: H - m * 2, cornerRadius: Math.min(120, m * 2.4), stroke: c, strokeWidth: sw });
        case 'dashed':
            return React.createElement(Rect, { ...common, x: m, y: m, width: W - m * 2, height: H - m * 2, stroke: c, strokeWidth: sw, dash: [sw * 4, sw * 2.5] });
        case 'corners': {
            const L = 160, o = sw * 2.6;
            return (React.createElement(Group, { ...common }, [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].map(([cx, cy, sx, sy], i) => (React.createElement(Group, { key: i },
                React.createElement(Line, { points: [cx, cy + sy * L, cx, cy, cx + sx * L, cy], stroke: c, strokeWidth: sw, lineCap: "square" }),
                React.createElement(Line, { points: [cx + sx * o, cy + sy * L * 0.7, cx + sx * o, cy + sy * o, cx + sx * L * 0.7, cy + sy * o], stroke: c, strokeWidth: Math.max(1, sw * 0.4) }),
                React.createElement(Rect, { x: cx + sx * o * 2.4, y: cy + sy * o * 2.4, width: sw * 2.6, height: sw * 2.6, offsetX: sw * 1.3, offsetY: sw * 1.3, rotation: 45, fill: c }))))));
        }
        case 'deco': {
            const s = 34;
            const corner = (x, y, sx, sy) => [x, y + sy * s * 4, x + sx * s, y + sy * s * 4, x + sx * s, y + sy * s * 2, x + sx * s * 2, y + sy * s * 2, x + sx * s * 2, y + sy * s, x + sx * s * 4, y + sy * s, x + sx * s * 4, y];
            return (React.createElement(Group, { ...common },
                React.createElement(Rect, { x: m, y: m, width: W - m * 2, height: H - m * 2, stroke: c, strokeWidth: Math.max(1, sw * 0.5) }),
                [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].map(([x, y, sx, sy], i) => (React.createElement(Group, { key: i },
                    React.createElement(Line, { points: corner(x + sx * sw * 2, y + sy * sw * 2, sx, sy), stroke: c, strokeWidth: sw }),
                    React.createElement(Line, { points: corner(x + sx * sw * 5, y + sy * sw * 5, sx, sy).map((v) => v), stroke: c, strokeWidth: Math.max(1, sw * 0.4) })))),
                React.createElement(Line, { points: [W / 2 - 120, m, W / 2 + 120, m], stroke: c, strokeWidth: sw * 2.2 }),
                React.createElement(Line, { points: [W / 2 - 120, H - m, W / 2 + 120, H - m], stroke: c, strokeWidth: sw * 2.2 })));
        }
        case 'islamic': {
            const band = Math.max(28, sw * 6);
            return (React.createElement(Group, { ...common },
                React.createElement(Rect, { x: m, y: m, width: W - m * 2, height: H - m * 2, stroke: c, strokeWidth: Math.max(1, sw * 0.4) }),
                React.createElement(Rect, { x: m + band, y: m + band, width: W - (m + band) * 2, height: H - (m + band) * 2, stroke: c, strokeWidth: Math.max(1, sw * 0.4) }),
                React.createElement(Shape, { stroke: c, strokeWidth: Math.max(1, sw * 0.35), sceneFunc: (ctx, shape) => {
                        const R = band * 0.38;
                        const star = (cx, cy) => {
                            ctx.moveTo(cx + R, cy);
                            for (let i = 1; i <= 16; i++) {
                                const a = (i * Math.PI) / 8;
                                const rr = i % 2 ? R * 0.6 : R;
                                ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
                            }
                        };
                        ctx.beginPath();
                        const mid = m + band / 2;
                        const nx = Math.floor((W - m * 2) / band), ny = Math.floor((H - m * 2) / band);
                        for (let i = 0; i < nx; i++) {
                            const x = m + band / 2 + (i * (W - m * 2 - band)) / (nx - 1);
                            star(x, mid);
                            star(x, H - mid);
                        }
                        for (let j = 1; j < ny - 1; j++) {
                            const y = m + band / 2 + (j * (H - m * 2 - band)) / (ny - 1);
                            star(mid, y);
                            star(W - mid, y);
                        }
                        ctx.strokeShape(shape);
                    } })));
        }
        case 'tactical': {
            const L = 110;
            const br = [
                [m, m + L, m, m, m + L, m],
                [W - m - L, m, W - m, m, W - m, m + L],
                [m, H - m - L, m, H - m, m + L, H - m],
                [W - m - L, H - m, W - m, H - m, W - m, H - m - L],
            ];
            const ticks = [];
            for (let i = 1; i < 20; i++) {
                const y = m + ((H - m * 2) * i) / 20, l = i % 5 ? 10 : 24;
                ticks.push([m, y, m + l, y], [W - m, y, W - m - l, y]);
            }
            for (let i = 1; i < 14; i++) {
                const x = m + ((W - m * 2) * i) / 14, l = i % 7 ? 10 : 24;
                ticks.push([x, m, x, m + l], [x, H - m, x, H - m - l]);
            }
            return (React.createElement(Group, { ...common },
                br.map((p, i) => React.createElement(Line, { key: i, points: p, stroke: c, strokeWidth: sw })),
                ticks.map((p, i) => React.createElement(Line, { key: `t${i}`, points: p, stroke: c, strokeWidth: Math.max(1, sw * 0.3), opacity: 0.75 }))));
        }
        case 'hazard': {
            const b = Math.max(40, sw * 7);
            const stripes = (y) => (React.createElement(Shape, { y: y, sceneFunc: (ctx, shape) => {
                    ctx.beginPath();
                    ctx.rect(0, 0, W, b);
                    ctx.closePath();
                    ctx.fillStrokeShape(shape);
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(0, 0, W, b);
                    ctx.clip();
                    ctx.beginPath();
                    for (let x = -b; x < W + b; x += b * 1.2) {
                        ctx.moveTo(x, b);
                        ctx.lineTo(x + b * 0.6, b);
                        ctx.lineTo(x + b * 0.6 + b, 0);
                        ctx.lineTo(x + b, 0);
                        ctx.closePath();
                    }
                    ctx.setAttr('fillStyle', c2);
                    ctx.fill();
                    ctx.restore();
                }, fill: c }));
            return (React.createElement(Group, { ...common },
                stripes(m * 0.3),
                stripes(H - b - m * 0.3)));
        }
        case 'classified': {
            const b = Math.max(46, sw * 7);
            return (React.createElement(Group, { ...common }, [m * 0.4, H - b - m * 0.4].map((y, i) => (React.createElement(Group, { key: i, y: y },
                React.createElement(Rect, { width: W, height: b, fill: c }),
                React.createElement(Rect, { y: b * 0.15, width: W, height: 2, fill: c2 }),
                React.createElement(Rect, { y: b * 0.85 - 2, width: W, height: 2, fill: c2 }))))));
        }
        case 'film': {
            const b = Math.max(48, sw * 8);
            const holes = [];
            const hs = b * 0.42;
            for (let y = hs; y < H - hs; y += hs * 2)
                holes.push(y);
            return (React.createElement(Group, { ...common }, [0, W - b].map((x, i) => (React.createElement(Group, { key: i, x: x },
                React.createElement(Rect, { width: b, height: H, fill: c2 }),
                holes.map((y, j) => (React.createElement(Rect, { key: j, x: b * 0.29, y: y, width: b * 0.42, height: hs * 1.1, cornerRadius: 4, fill: c }))))))));
        }
        default:
            return null;
    }
}
const SAFE_MARGIN = 60;
const SNAP = 8;
const CoverCanvas = forwardRef(function CoverCanvas({ texts, images, shapes = [], logo, palette, background, layers, grade, textAboveLayers, frame, selectedIds, onSelect, onCommit, onOpenProps, fontsVersion, snapping = true, zoom = 1, onZoomChange }, ref) {
    const wrapRef = useRef(null);
    const stageRef = useRef(null);
    const layerRef = useRef(null);
    const trRef = useRef(null);
    const snapTargets = useRef(null);
    const [fit, setFit] = useState(0.4);
    const [guides, setGuides] = useState([]);
    const scale = fit * zoom;
    // ملاءمة المعاينة للمساحة المتاحة
    useEffect(() => {
        const el = wrapRef.current;
        if (!el)
            return;
        const doFit = () => {
            const pad = el.clientWidth < 700 ? 24 : 64;
            setFit(Math.max(0.08, Math.min((el.clientWidth - pad) / COVER_W, (el.clientHeight - pad) / COVER_H)));
        };
        doFit();
        const ro = new ResizeObserver(doFit);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const findNode = (id) => stageRef.current?.findOne(`#${id}`);
    const selectedNodes = () => selectedIds.map(findNode).filter(Boolean);
    // ربط أداة التحويل بالعناصر المحددة (غير المقفلة)
    useEffect(() => {
        const tr = trRef.current;
        if (!tr)
            return;
        tr.nodes(selectedIds.map(findNode).filter((n) => n && n.listening() && n.visible()));
        tr.getLayer()?.batchDraw();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIds, images, shapes, logo, texts, fontsVersion]);
    const readPatch = (node) => {
        const id = node.id();
        const patch = { x: node.x(), y: node.y(), rotation: node.rotation() };
        if (id.startsWith('shp-')) {
            // الزخارف تتمدد بحرية: نحوّل المقياس إلى عرض/ارتفاع ثم نعيد المقياس إلى 1
            patch.width = Math.max(4, node.getAttr('shapeW') * Math.abs(node.scaleX()));
            patch.height = Math.max(2, node.getAttr('shapeH') * Math.abs(node.scaleY()));
            node.scale({ x: 1, y: 1 });
            return { id, patch };
        }
        if (!id.startsWith('text-'))
            patch.scale = Math.max(0.05, node.scaleX());
        return { id, patch };
    };
    const handleDragEnd = (e) => {
        setGuides([]);
        snapTargets.current = null;
        const node = e.target;
        const nodes = new Set([node]);
        if (selectedIds.includes(node.id()))
            selectedNodes().forEach((n) => nodes.add(n));
        onCommit([...nodes].map(readPatch));
    };
    // ── المحاذاة الذكية أثناء السحب ──
    const elementIds = [
        ...images.map((i) => i.id),
        ...shapes.filter((s) => s.visible !== false).map((s) => s.id),
        ...(logo ? ['logo'] : []),
        ...Object.keys(texts).filter((k) => texts[k].visible !== false).map((k) => `text-${k}`),
    ];
    const handleDragStart = (e) => {
        if (!snapping || selectedIds.length > 1 || !e.target.id())
            return;
        const layer = layerRef.current;
        const vs = [0, SAFE_MARGIN, COVER_W / 2, COVER_W - SAFE_MARGIN, COVER_W];
        const hs = [0, SAFE_MARGIN, COVER_H / 2, COVER_H - SAFE_MARGIN, COVER_H];
        for (const id of elementIds) {
            if (id === e.target.id())
                continue;
            const n = findNode(id);
            if (!n || !n.visible())
                continue;
            const r = n.getClientRect({ relativeTo: layer, skipShadow: true });
            vs.push(r.x, r.x + r.width / 2, r.x + r.width);
            hs.push(r.y, r.y + r.height / 2, r.y + r.height);
        }
        snapTargets.current = { vs, hs };
    };
    const handleDragMove = (e) => {
        const t = snapTargets.current;
        const node = e.target;
        if (!t || !node.id())
            return;
        const r = node.getClientRect({ relativeTo: layerRef.current, skipShadow: true });
        const best = (edges, targets) => {
            let res = null;
            for (const ed of edges)
                for (const tg of targets) {
                    const d = tg - ed;
                    if (Math.abs(d) <= SNAP && (!res || Math.abs(d) < Math.abs(res.d)))
                        res = { d, pos: tg };
                }
            return res;
        };
        const bx = best([r.x, r.x + r.width / 2, r.x + r.width], t.vs);
        const by = best([r.y, r.y + r.height / 2, r.y + r.height], t.hs);
        const g = [];
        if (bx) {
            node.x(node.x() + bx.d);
            g.push({ v: true, pos: bx.pos });
        }
        if (by) {
            node.y(node.y() + by.d);
            g.push({ v: false, pos: by.pos });
        }
        setGuides(g);
    };
    useImperativeHandle(ref, () => ({
        getStage: () => stageRef.current,
        /** نسخة فورية من التصميم للمشاهدة (بدون ترميز PNG — أسرع بكثير) */
        previewCanvas(logicalRatio = 1) {
            const stage = stageRef.current;
            const tr = trRef.current;
            const previous = tr ? tr.nodes() : [];
            tr?.nodes([]);
            setGuides([]);
            stage.draw();
            try {
                return stage.toCanvas({ pixelRatio: logicalRatio / (stage.scaleX() || 1) });
            }
            finally {
                tr?.nodes(previous);
                stage.draw();
            }
        },
        async exportPNG(pixelRatio = 2) {
            const stage = stageRef.current;
            const tr = trRef.current;
            const previous = tr ? tr.nodes() : [];
            tr?.nodes([]);
            setGuides([]);
            stage.draw();
            try {
                return await exportStageToBlob(stage, { pixelRatio });
            }
            finally {
                tr?.nodes(previous);
                stage.draw();
            }
        },
        /** محاذاة العناصر المحددة إلى الغلاف */
        align(type) {
            const layer = layerRef.current;
            const patches = selectedNodes().map((n) => {
                const r = n.getClientRect({ relativeTo: layer, skipShadow: true });
                let dx = 0, dy = 0;
                if (type === 'centerH')
                    dx = COVER_W / 2 - (r.x + r.width / 2);
                if (type === 'centerV')
                    dy = COVER_H / 2 - (r.y + r.height / 2);
                if (type === 'left')
                    dx = SAFE_MARGIN - r.x;
                if (type === 'right')
                    dx = COVER_W - SAFE_MARGIN - (r.x + r.width);
                if (type === 'top')
                    dy = SAFE_MARGIN - r.y;
                if (type === 'bottom')
                    dy = COVER_H - SAFE_MARGIN - (r.y + r.height);
                return { id: n.id(), patch: { x: n.x() + dx, y: n.y() + dy } };
            });
            if (patches.length)
                onCommit(patches);
        },
    }));
    const overlays = useMemo(() => ALL_OVERLAYS.filter((o) => layers[o.id]?.enabled).map((o) => ({
        id: o.id,
        blend: o.blend,
        opacity: layers[o.id].opacity,
        canvas: getOverlayCanvas(o.id),
    })), [layers]);
    const grading = gradeLayers(grade, COVER_W, COVER_H);
    const selectedTexts = selectedIds.some((id) => id.startsWith('text-'));
    const onlyShapes = selectedIds.length > 0 && selectedIds.every((id) => id.startsWith('shp-'));
    const shapeNodes = (behind) => shapes
        .filter((sh) => !!sh.behind === behind)
        .map((sh) => React.createElement(TransformableShape, { key: sh.id, item: sh, onSelect: onSelect, onDragEnd: handleDragEnd, onOpenProps: onOpenProps }));
    const textNodes = Object.entries(texts).map(([key, t]) => (React.createElement(TextGroup, { key: key, id: key, t: t, fontsVersion: fontsVersion, onSelect: onSelect, onDragEnd: handleDragEnd, onOpenProps: onOpenProps })));
    const handleStageDown = (e) => {
        const target = e.target;
        if (target === target.getStage() || target.name() === 'background')
            onSelect(null);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { ref: wrapRef, className: "scroll-thin absolute inset-0 overflow-auto" },
            React.createElement("div", { className: "flex min-h-full min-w-full items-center justify-center p-3 lg:p-8", style: { width: 'max-content', height: 'max-content' } },
                React.createElement("div", { className: "shrink-0 shadow-cover", style: { width: COVER_W * scale, height: COVER_H * scale } },
                    React.createElement(Stage, { ref: stageRef, width: COVER_W * scale, height: COVER_H * scale, scaleX: scale, scaleY: scale, onMouseDown: handleStageDown, onTouchStart: handleStageDown },
                        React.createElement(Layer, { ref: layerRef, onDragStart: handleDragStart, onDragMove: handleDragMove },
                            React.createElement(Rect, { name: "background", x: 0, y: 0, width: COVER_W, height: COVER_H, ...paletteFill(palette) }),
                            background && React.createElement(BackgroundImage, { bg: background, palette: palette }),
                            shapeNodes(true),
                            images.map((img) => (React.createElement(TransformableImage, { key: img.id, item: img, onSelect: onSelect, onDragEnd: handleDragEnd, onOpenProps: onOpenProps }))),
                            logo && React.createElement(TransformableImage, { item: logo, onSelect: onSelect, onDragEnd: handleDragEnd, onOpenProps: onOpenProps }),
                            shapeNodes(false),
                            !textAboveLayers && textNodes,
                            overlays.map((o) => (React.createElement(KonvaImage, { key: o.id, image: o.canvas, x: 0, y: 0, width: COVER_W, height: COVER_H, opacity: o.opacity, globalCompositeOperation: o.blend, listening: false }))),
                            grading.map(({ blend, ...g }, i) => (React.createElement(Rect, { key: `grade-${i}`, x: 0, y: 0, width: COVER_W, height: COVER_H, ...g, globalCompositeOperation: blend, listening: false }))),
                            textAboveLayers && textNodes,
                            React.createElement(DesignFrame, { frame: frame }),
                            React.createElement(Transformer, { ref: trRef, rotateEnabled: true, keepRatio: !onlyShapes, enabledAnchors: selectedTexts
                                    ? []
                                    : onlyShapes
                                        ? ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
                                        : ['top-left', 'top-right', 'bottom-left', 'bottom-right'], anchorFill: "#d4af6a", anchorStroke: "#0d0b09", anchorSize: 12, anchorCornerRadius: 6, borderStroke: "#d4af6a", borderDash: [6, 4], rotateAnchorOffset: 36, rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315], rotationSnapTolerance: 4, onTransformEnd: () => onCommit(selectedNodes().map(readPatch)), boundBoxFunc: (oldBox, newBox) => (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 4 ? oldBox : newBox) })),
                        React.createElement(Layer, { listening: false }, guides.map((g, i) => (React.createElement(Line, { key: i, points: g.v ? [g.pos, 0, g.pos, COVER_H] : [0, g.pos, COVER_W, g.pos], stroke: "#ff3d7f", strokeWidth: 1.2 / scale, dash: [6 / scale, 4 / scale] }))))))))));
});
// ===== components/tabs/TemplatesTab.jsx =====
const GOLD_CSS = 'linear-gradient(180deg,#fff4c8 0%,#e6c46a 30%,#9c7426 50%,#f2d47c 62%,#b8892f 85%,#76531a 100%)';
/** خلفية المشهد داخل بطاقة القالب */
function TplScene({ id }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current)
            drawScenePreview(ref.current, id);
    }, [id]);
    return React.createElement("canvas", { ref: ref, width: 90, height: 135, className: "pointer-events-none absolute inset-0 h-full w-full" });
}
function bgStyle(t) {
    switch (t.bg) {
        case 'bars':
        case 'box':
            return { background: t.bgColor, padding: '1px 6px', borderRadius: t.bgRadius || 0, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' };
        case 'plaque':
            return { background: t.bgColor, padding: '2px 10px', borderRadius: 6, border: `1px solid ${t.bgStroke}` };
        case 'pill':
            return { border: `1px solid ${t.bgStroke}`, padding: '1px 10px', borderRadius: 999 };
        case 'halo':
            return { textShadow: `0 0 14px ${t.bgColor}` };
        default:
            return {};
    }
}
function titleStyle(t) {
    const base = { fontFamily: `"${t.font}"`, fontWeight: t.weight, lineHeight: 1.25 };
    switch (t.effect) {
        case 'gold':
            return { ...base, backgroundImage: GOLD_CSS, WebkitBackgroundClip: 'text', color: 'transparent' };
        case 'gradient':
            return { ...base, backgroundImage: `linear-gradient(180deg,${t.color},${t.color2})`, WebkitBackgroundClip: 'text', color: 'transparent' };
        case 'glow':
            return { ...base, color: t.color, textShadow: `0 0 10px ${t.glowColor}, 0 0 22px ${t.glowColor}` };
        case 'outline':
            return { ...base, color: t.color, WebkitTextStroke: `${Math.max(1, t.strokeWidth / 5)}px ${t.strokeColor}`, paintOrder: 'stroke fill' };
        case 'engraved':
            return { ...base, color: t.color, textShadow: '0 1px 0 rgba(255,255,255,.3), 0 -1px 1px rgba(0,0,0,.8)' };
        default:
            return { ...base, color: t.color, textShadow: '0 2px 8px rgba(0,0,0,.8)' };
    }
}
function TemplatesTab({ onApplyTemplate, activeTemplateId }) {
    const [cat, setCat] = useState('all');
    const [, setFontTick] = useState(0);
    // تحميل خطوط القوالب لعرض المعاينات بأشكالها الحقيقية
    useEffect(() => {
        let alive = true;
        const fonts = new Set(TEMPLATES.flatMap((t) => [t.title?.font, t.subtitle?.font]).filter(Boolean));
        fonts.forEach((f) => loadGoogleFont(f).then(() => alive && setFontTick((n) => n + 1)));
        return () => {
            alive = false;
        };
    }, []);
    const list = cat === 'all' ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat);
    return (React.createElement(Section, { title: "\u0627\u0644\u0642\u0648\u0627\u0644\u0628 \u0627\u0644\u062C\u0627\u0647\u0632\u0629", hint: "\u0646\u0642\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u062A\u0636\u0628\u0637 \u0627\u0644\u062E\u0637\u0648\u0637 \u0648\u0627\u0644\u0623\u0644\u0648\u0627\u0646 \u0648\u0627\u0644\u0637\u0628\u0642\u0627\u062A \u2014 \u0646\u0635\u0648\u0635\u0643 \u0648\u0635\u0648\u0631\u0643 \u062A\u0628\u0642\u0649 \u0643\u0645\u0627 \u0647\u064A\u060C \u0648\u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0628\u0632\u0631 \u21B6" },
        React.createElement("div", { className: "flex flex-wrap gap-1.5" }, TEMPLATE_CATEGORIES.map((c) => (React.createElement("button", { key: c.id, type: "button", onClick: () => setCat(c.id), className: `rounded-full px-3 py-1 text-[12px] transition ${cat === c.id ? 'bg-gold-400 font-bold text-ink-950' : 'border border-white/10 bg-ink-900 text-stone-400 hover:text-stone-200'}` }, c.label)))),
        React.createElement("div", { className: "grid grid-cols-2 gap-3" }, list.map((tpl) => {
            const palette = tpl.customPalette ? tpl.customPalette : getPalette(tpl.paletteId);
            const category = TEMPLATE_CATEGORIES.find((c) => c.id === tpl.category)?.label;
            return (React.createElement("button", { key: tpl.id, type: "button", onClick: () => onApplyTemplate(tpl), className: `group overflow-hidden rounded-xl border text-right transition ${activeTemplateId === tpl.id ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-white/10 hover:border-gold-500/50'}` },
                React.createElement("div", { className: "relative flex aspect-[2/3] flex-col items-center justify-between overflow-hidden px-2 py-4 text-center", style: { background: paletteToCss(palette), boxShadow: 'inset 0 0 50px rgba(0,0,0,.6)' } },
                    tpl.background?.scene && React.createElement(TplScene, { id: tpl.background.scene }),
                    tpl.layers?.frame && React.createElement("div", { className: "pointer-events-none absolute inset-2 rounded-sm border border-gold-400/60" }),
                    tpl.layers?.thinframe && React.createElement("div", { className: "pointer-events-none absolute inset-2 border border-white/50" }),
                    tpl.layers?.torn && React.createElement("div", { className: "pointer-events-none absolute inset-0", style: { boxShadow: 'inset 0 0 0 5px #0a0908, inset 0 0 18px 8px rgba(0,0,0,.9)' } }),
                    tpl.imageStyle?.backdrop?.shape === 'mihrab' && (React.createElement("div", { className: "pointer-events-none absolute bottom-0 left-1/2 h-[55%] w-[55%] -translate-x-1/2 rounded-t-[50%] opacity-80", style: { background: `linear-gradient(${tpl.imageStyle.backdrop.color}, transparent)` } })),
                    tpl.tag?.visible && (React.createElement("div", { className: "absolute right-2 top-2 bg-stone-300 px-1.5 text-[8px] font-bold text-stone-900" }, tpl.tag.text || 'مقال')),
                    React.createElement("div", { className: "relative z-10 whitespace-pre-line text-[20px]" },
                        React.createElement("span", { style: { ...titleStyle({ color: '#fff', color2: '#fff', glowColor: '#fff', strokeColor: '#000', strokeWidth: 5, ...tpl.title }), ...bgStyle(tpl.title) } }, tpl.title.secondColor ? (React.createElement(React.Fragment, null,
                            tpl.sample.split('\n')[0],
                            '\n',
                            React.createElement("span", { style: { color: tpl.title.secondColor } }, tpl.sample.split('\n')[1]))) : (tpl.sample))),
                    React.createElement("div", { className: "relative z-10 text-[9px] opacity-80", style: { fontFamily: `"${tpl.subtitle.font}"`, color: tpl.subtitle.color } }, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0624\u0644\u0641")),
                React.createElement("div", { className: "flex items-center justify-between bg-ink-900 px-2.5 py-2" },
                    React.createElement("span", { className: "text-[12px] text-stone-200" }, tpl.name),
                    React.createElement("span", { className: "text-[10px] text-stone-500" }, category))));
        }))));
}
// ===== components/tabs/TypographyTab.jsx =====
const TEXT_SLOTS = [
    { id: 'title', label: 'عنوان الكتاب', hint: 'خط زخرفي فخم: عارف رقعة، أميري، ريم كوفي' },
    { id: 'subtitle', label: 'النص الفرعي / المؤلف', hint: 'خط حديث: تجوال، القاهرة، المراعي' },
    { id: 'tag', label: 'وسم صغير', hint: 'مثل: مقال، رواية، الجزء الأول — يوضع في زاوية الغلاف' },
    { id: 'publisher', label: 'دار النشر', hint: 'أسفل الغلاف — يمكن إضافة سطر لاتيني متباعد الأحرف' },
    { id: 'date', label: 'التاريخ', hint: 'الشهر والسنة الهجرية — زاوية الغلاف السفلية' },
];
function ChipGroup({ items, value, onChange, cols = 3 }) {
    return (React.createElement("div", { className: `grid gap-1.5 ${cols === 4 ? 'grid-cols-4' : 'grid-cols-3'}` }, items.map((it) => (React.createElement("button", { key: it.id, type: "button", onClick: () => onChange(it.id), className: `rounded-lg px-1.5 py-2 text-[11.5px] transition ${value === it.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-800 text-stone-400 hover:text-stone-200'}` }, it.label)))));
}
/** معاينة حية لتأثير واحد بخط النص الحالي وألوانه */
function EffectTile({ t, effect, label, active, onPick, sample }) {
    const ref = useRef(null);
    useEffect(() => {
        const c = ref.current;
        if (!c)
            return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        c.width = 150 * dpr;
        c.height = 64 * dpr;
        const draw = () => {
            try {
                paintEffectPreview(c, { ...t, effect }, sample);
            }
            catch (e) { }
        };
        draw();
        let alive = true;
        document.fonts?.load?.(`${t.weight || 700} 40px "${t.font}"`).then(() => alive && draw()).catch(() => { });
        return () => { alive = false; };
    }, [t.font, t.weight, t.color, t.color2, t.glowColor, t.strokeColor, t.strokeWidth, t.shadow, t.ring, t.ringColor, t.ringWidth, t.ring2, t.ring2Color, t.ring2Width, t.ringStyle, effect, sample]);
    return (React.createElement("button", { type: "button", onClick: () => onPick(effect), className: `overflow-hidden rounded-xl border text-center transition ${active ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-white/10 hover:border-white/25'}` },
        React.createElement("canvas", { ref: ref, className: "block h-16 w-full", style: { background: 'radial-gradient(circle at 50% 40%, #2b2119, #0b0907)' } }),
        React.createElement("span", { className: `block py-1 text-[11px] ${active ? 'bg-gold-400/15 text-gold-200' : 'bg-ink-900 text-stone-400'}` }, label)));
}
function EffectGallery({ value, onPick }) {
    const current = TEXT_EFFECTS.find((e) => e.id === value.effect);
    const [group, setGroup] = useState(current?.group || 'metal');
    const sample = (String(value.text || 'العنوان').split(/\s+/)[0] || 'العنوان').slice(0, 9);
    return (React.createElement("div", { className: "space-y-2" },
        React.createElement("div", { className: "scroll-thin flex gap-1.5 overflow-x-auto pb-0.5" }, EFFECT_GROUPS.map((g) => (React.createElement("button", { key: g.id, type: "button", onClick: () => setGroup(g.id), className: `shrink-0 rounded-full px-3 py-1 text-[11.5px] ${group === g.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-900 text-stone-400'}` }, g.label)))),
        React.createElement("div", { className: "grid grid-cols-2 gap-2" }, TEXT_EFFECTS.filter((e) => e.group === group).map((e) => (React.createElement(EffectTile, { key: e.id, t: value, effect: e.id, label: e.label, active: value.effect === e.id, onPick: onPick, sample: sample }))))));
}
function TextBlockEditor({ slot, value, onChange, onSelect, open, onToggleOpen, focusSignal }) {
    const id = slot.id;
    const font = getFontMeta(value.font);
    const weightOptions = (font?.weights || [400]).map((w) => ({ value: String(w), label: WEIGHT_LABELS[w] || w }));
    const set = (patch) => onChange(id, patch);
    const visible = value.visible !== false;
    const boxRef = useRef(null);
    const textRef = useRef(null);
    // النقر المزدوج على النص في الغلاف ← افتح خصائصه وركّز على حقل الكتابة
    useEffect(() => {
        if (!focusSignal || !open)
            return;
        boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const t = setTimeout(() => {
            textRef.current?.focus();
            textRef.current?.select();
        }, 250);
        return () => clearTimeout(t);
    }, [focusSignal, open]);
    return (React.createElement("section", { ref: boxRef, className: `scroll-mt-4 rounded-2xl border bg-ink-800/70 ${open ? 'border-gold-500/30' : 'border-white/5'}` },
        React.createElement("header", { className: "flex items-center justify-between gap-2 p-3" },
            React.createElement("button", { type: "button", onClick: onToggleOpen, className: "flex min-w-0 flex-1 items-center gap-2 text-right" },
                React.createElement("span", { className: `text-[10px] text-stone-500 transition ${open ? 'rotate-90' : ''}` }, "\u25C0"),
                React.createElement("span", { className: "min-w-0" },
                    React.createElement("span", { className: `block text-[13px] font-bold ${visible ? 'text-gold-300' : 'text-stone-500'}` }, slot.label),
                    React.createElement("span", { className: "block truncate text-[11px] text-stone-500" }, value.text.replace(/\n/g, ' · ') || '—'))),
            React.createElement(Toggle, { checked: visible, onChange: (v) => set({ visible: v }), small: true })),
        open && (React.createElement("div", { className: "space-y-4 border-t border-white/5 p-4" },
            React.createElement("p", { className: "text-[11px] text-stone-500" }, slot.hint),
            React.createElement(TextAreaField, { inputRef: textRef, value: value.text, rows: id === 'title' || id === 'subtitle' ? 2 : 2, onChange: (text) => set({ text }), style: { fontFamily: `"${value.font}"`, fontWeight: value.weight } }),
            id === 'date' && (React.createElement(Button, { onClick: () => set({ text: hijriNow() }), className: "w-full text-[12px]" }, "\u0625\u062F\u0631\u0627\u062C \u0627\u0644\u0634\u0647\u0631 \u0648\u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0647\u062C\u0631\u064A\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629")),
            React.createElement(PropGroup, { id: "t-font", icon: "\u0639", title: "\u0627\u0644\u062E\u0637 \u0648\u0627\u0644\u062D\u062C\u0645", defaultOpen: true, summary: `${value.font} · ${value.size}px` },
                React.createElement(FontPicker, { value: value.font, sample: (value.text || 'أبجد').split('\n')[0].slice(0, 12) || 'أبجد', onChange: (fontName) => set({ font: fontName, weight: closestWeight(fontName, value.weight) }) }),
                React.createElement(SelectField, { label: "\u0627\u0644\u0648\u0632\u0646", value: String(value.weight), options: weightOptions, onChange: (w) => set({ weight: Number(w) }) }),
                React.createElement(RangeField, { label: "\u0627\u0644\u062D\u062C\u0645", min: 12, max: 260, value: value.size, onChange: (size) => set({ size }), format: (v) => `${v}px` }),
                React.createElement(RangeField, { label: "\u062A\u0628\u0627\u0639\u062F \u0627\u0644\u0623\u0633\u0637\u0631", min: 0.8, max: 2.2, step: 0.05, value: value.lineHeight, onChange: (lineHeight) => set({ lineHeight }), format: (v) => v.toFixed(2) }),
                React.createElement(RangeField, { label: "\u062A\u0628\u0627\u0639\u062F \u0627\u0644\u0623\u062D\u0631\u0641 (\u0644\u0644\u0627\u062A\u064A\u0646\u064A \u0641\u0642\u0637)", min: 0, max: 40, value: value.letterSpacing || 0, onChange: (letterSpacing) => set({ letterSpacing }) })),
            React.createElement(PropGroup, { id: "t-color", icon: "\u25D0", title: "\u0627\u0644\u0623\u0644\u0648\u0627\u0646", defaultOpen: true, summary: value.secondColor ? 'لونان' : value.color },
                React.createElement(ColorField, { label: value.effect === 'gradient' ? 'لون البداية' : 'اللون', value: value.color, onChange: (color) => set({ color }) }),
                React.createElement("div", { className: "flex items-center justify-between gap-3" },
                    React.createElement(Toggle, { checked: !!value.secondColor, onChange: (on) => set({ secondColor: on ? '#5fb39a' : '' }), label: "\u0644\u0648\u0646 \u0645\u062E\u062A\u0644\u0641 \u0644\u0644\u0633\u0637\u0631 \u0627\u0644\u062B\u0627\u0646\u064A", small: true }),
                    value.secondColor && (React.createElement("input", { type: "color", className: "swatch", value: value.secondColor, onChange: (e) => set({ secondColor: e.target.value }) })))),
            React.createElement(PropGroup, { id: "t-box", icon: "\u2B1A", title: "\u0627\u0644\u0635\u0646\u062F\u0648\u0642 \u0648\u0627\u0644\u0645\u0648\u0636\u0639", summary: `عرض ${value.width} · ${Math.round(value.rotation || 0)}°` },
                React.createElement(RangeField, { label: "\u0639\u0631\u0636 \u0635\u0646\u062F\u0648\u0642 \u0627\u0644\u0646\u0635", min: 120, max: COVER_W, step: 10, value: value.width, onChange: (width) => set({ width }) }),
                React.createElement(RangeField, { label: "\u0627\u0644\u0645\u0648\u0636\u0639 \u0627\u0644\u0623\u0641\u0642\u064A", min: 0, max: COVER_W, value: Math.round(value.x), onChange: (x) => set({ x }) }),
                React.createElement(RangeField, { label: "\u0627\u0644\u0645\u0648\u0636\u0639 \u0627\u0644\u0639\u0645\u0648\u062F\u064A", min: 0, max: COVER_H - 20, value: Math.round(value.y), onChange: (y) => set({ y }) }),
                React.createElement(RangeField, { label: "\u0627\u0644\u062A\u062F\u0648\u064A\u0631", min: -30, max: 30, value: Math.round(value.rotation || 0), onChange: (rotation) => set({ rotation }), format: (v) => `${v}°`, defaultValue: 0 }),
                React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                    React.createElement(Button, { onClick: () => set({ x: COVER_W / 2, rotation: 0 }), className: "text-[12px]" }, "\u062A\u0648\u0633\u064A\u0637 \u0623\u0641\u0642\u064A"),
                    React.createElement(Button, { onClick: () => onSelect(`text-${id}`), className: "text-[12px]" }, "\u062A\u062D\u062F\u064A\u062F \u0639\u0644\u0649 \u0627\u0644\u063A\u0644\u0627\u0641"))),
            React.createElement(PropGroup, { id: "t-bg", icon: "\u25AD", title: "\u0634\u0643\u0644 \u062E\u0644\u0641 \u0627\u0644\u0646\u0635", summary: TEXT_BACKGROUNDS.find((b) => b.id === (value.bg || 'none'))?.label },
                React.createElement(ChipGroup, { items: TEXT_BACKGROUNDS, value: value.bg || 'none', onChange: (bg) => set({ bg }), cols: 3 }),
                value.bg && value.bg !== 'none' && (React.createElement(React.Fragment, null,
                    React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u0634\u0643\u0644", value: value.bgColor, onChange: (bgColor) => set({ bgColor }) }),
                    ['pill', 'plaque', 'frame', 'corners', 'ornament', 'stamp', 'ribbon', 'arch'].includes(value.bg) && (React.createElement(ColorField, { label: value.bg === 'ribbon' ? 'لون الخيوط' : 'لون الإطار والزخرفة', value: value.bgStroke, onChange: (bgStroke) => set({ bgStroke }) })),
                    React.createElement(RangeField, { label: "\u0627\u0644\u0634\u0641\u0627\u0641\u064A\u0629", min: 0.05, max: 1, step: 0.01, value: value.bgOpacity, onChange: (bgOpacity) => set({ bgOpacity }), format: (v) => `${Math.round(v * 100)}%` }),
                    React.createElement(RangeField, { label: "\u0627\u0644\u0647\u0627\u0645\u0634", min: 0, max: 60, value: value.bgPadding, onChange: (bgPadding) => set({ bgPadding }) }),
                    (value.bg === 'bars' || value.bg === 'box') && (React.createElement(RangeField, { label: "\u0627\u0633\u062A\u062F\u0627\u0631\u0629 \u0627\u0644\u0632\u0648\u0627\u064A\u0627", min: 0, max: 40, value: value.bgRadius || 0, onChange: (bgRadius) => set({ bgRadius }) }))))),
            React.createElement(PropGroup, { id: "t-fx", icon: "\u2726", title: "\u0627\u0644\u062A\u0623\u062B\u064A\u0631 \u0648\u0627\u0644\u0636\u0648\u0621", summary: `${TEXT_EFFECTS.find((e) => e.id === value.effect)?.label || 'بدون'}${value.shadow ? ' · ظل' : ''}` },
                React.createElement(EffectGallery, { value: value, onPick: (effect) => set({ effect }) }),
                value.effect === 'gradient' && React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u0646\u0647\u0627\u064A\u0629", value: value.color2, onChange: (color2) => set({ color2 }) }),
                value.effect === 'retro' && React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u0638\u0644 \u0627\u0644\u0645\u0644\u0648\u0651\u0646", value: value.color2, onChange: (color2) => set({ color2 }) }),
                (value.effect === 'glow' || value.effect === 'neon') && (React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u062A\u0648\u0647\u0651\u062C", value: value.glowColor, onChange: (glowColor) => set({ glowColor }) })),
                value.effect === 'extrude' && React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u0639\u0645\u0642", value: value.color2, onChange: (color2) => set({ color2 }) }),
                value.effect === 'double' && (React.createElement(React.Fragment, null,
                    React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u062D\u062F\u0651 \u0627\u0644\u062F\u0627\u062E\u0644\u064A", value: value.strokeColor, onChange: (strokeColor) => set({ strokeColor }) }),
                    React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u062D\u062F\u0651 \u0627\u0644\u062E\u0627\u0631\u062C\u064A", value: value.color2, onChange: (color2) => set({ color2 }) }),
                    React.createElement(RangeField, { label: "\u0627\u0644\u0633\u0645\u0627\u0643\u0629", min: 1, max: 16, value: value.strokeWidth, onChange: (strokeWidth) => set({ strokeWidth }) }))),
                value.effect === 'outline' && (React.createElement(React.Fragment, null,
                    React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u062D\u062F\u0651", value: value.strokeColor, onChange: (strokeColor) => set({ strokeColor }) }),
                    React.createElement(RangeField, { label: "\u0633\u0645\u0627\u0643\u0629 \u0627\u0644\u062D\u062F\u0651", min: 1, max: 24, value: value.strokeWidth, onChange: (strokeWidth) => set({ strokeWidth }) }),
                    React.createElement(Toggle, { checked: !!value.outlineOnly, onChange: (outlineOnly) => set({ outlineOnly }), label: "\u062D\u062F\u0651 \u0641\u0642\u0637 (\u0646\u0635 \u0645\u0641\u0631\u063A)", small: true }))),
                value.effect === 'engraved' && React.createElement("p", { className: "text-[11px] text-stone-500" }, "\u064A\u0628\u062F\u0648 \u0623\u0641\u0636\u0644 \u0628\u0644\u0648\u0646 \u0646\u0635 \u0623\u063A\u0645\u0642 \u0642\u0644\u064A\u0644\u0627\u064B \u0645\u0646 \u0627\u0644\u062E\u0644\u0641\u064A\u0629."),
                React.createElement(Toggle, { checked: !!value.shadow, onChange: (shadow) => set({ shadow }), label: "\u0638\u0644 \u0633\u064A\u0646\u0645\u0627\u0626\u064A", small: true })),
            React.createElement(PropGroup, { id: "t-ring", icon: "\u25CE", title: "\u062D\u062F\u0651 \u0645\u0644\u0648\u0651\u0646 \u062D\u0648\u0644 \u0627\u0644\u0646\u0635", summary: value.ring ? (value.ring2 ? 'حدّان' : 'حدّ واحد') : 'بدون' },
                React.createElement(Toggle, { checked: !!value.ring, onChange: (ring) => set({ ring }), label: "\u0625\u0638\u0647\u0627\u0631 \u062D\u062F\u0651 \u062D\u0648\u0644 \u0627\u0644\u062D\u0631\u0648\u0641", small: true }),
                value.ring && (React.createElement(React.Fragment, null,
                    React.createElement(ChipGroup, { items: [{ id: 'solid', label: 'حدّ صلب' }, { id: 'soft', label: 'هالة ناعمة' }], value: value.ringStyle || 'solid', onChange: (ringStyle) => set({ ringStyle }), cols: 2 }),
                    React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u062D\u062F\u0651", value: value.ringColor, onChange: (ringColor) => set({ ringColor }) }),
                    React.createElement(RangeField, { label: "\u0627\u0644\u0633\u0645\u0627\u0643\u0629", min: 1, max: 30, value: value.ringWidth ?? 6, onChange: (ringWidth) => set({ ringWidth }), defaultValue: 6 }),
                    React.createElement(Toggle, { checked: !!value.ring2, onChange: (ring2) => set({ ring2 }), label: "\u062D\u062F\u0651 \u062B\u0627\u0646\u064D \u062E\u0627\u0631\u062C\u064A", small: true }),
                    value.ring2 && (React.createElement(React.Fragment, null,
                        React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u062D\u062F\u0651 \u0627\u0644\u062B\u0627\u0646\u064A", value: value.ring2Color, onChange: (ring2Color) => set({ ring2Color }) }),
                        React.createElement(RangeField, { label: "\u0633\u0645\u0627\u0643\u0629 \u0627\u0644\u062D\u062F\u0651 \u0627\u0644\u062B\u0627\u0646\u064A", min: 1, max: 30, value: value.ring2Width ?? 4, onChange: (ring2Width) => set({ ring2Width }), defaultValue: 4 }))))))))));
}
function TypographyTab({ texts, onChangeText, onSelect, openSlot, onOpenSlot, focusSignal }) {
    const [localOpen, setLocalOpen] = useState('title');
    const open = openSlot !== undefined ? openSlot : localOpen;
    const setOpen = onOpenSlot || setLocalOpen;
    return (React.createElement(React.Fragment, null,
        TEXT_SLOTS.filter((s) => texts[s.id]).map((slot) => (React.createElement(TextBlockEditor, { key: slot.id, slot: slot, value: texts[slot.id], onChange: onChangeText, onSelect: onSelect, open: open === slot.id, onToggleOpen: () => setOpen(open === slot.id ? null : slot.id), focusSignal: open === slot.id ? focusSignal : 0 }))),
        React.createElement(Section, null,
            React.createElement("p", { className: "text-[11px] leading-relaxed text-stone-500" }, "\u0627\u0633\u062D\u0628 \u0623\u064A \u0646\u0635 \u0645\u0628\u0627\u0634\u0631\u0629 \u0639\u0644\u0649 \u0627\u0644\u063A\u0644\u0627\u0641. \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0628\u062C\u0627\u0646\u0628 \u0643\u0644 \u0646\u0635 \u064A\u064F\u0638\u0647\u0631\u0647 \u0623\u0648 \u064A\u062E\u0641\u064A\u0647. \u062A\u0628\u0627\u0639\u062F \u0627\u0644\u0623\u062D\u0631\u0641 \u064A\u0641\u0643\u0651\u0643 \u0627\u0644\u062D\u0631\u0648\u0641 \u0627\u0644\u0639\u0631\u0628\u064A\u0629\u060C \u0641\u0627\u0633\u062A\u062E\u062F\u0645\u0647 \u0644\u0644\u0646\u0635 \u0627\u0644\u0644\u0627\u062A\u064A\u0646\u064A \u0641\u0642\u0637."))));
}
// ===== components/tabs/CompositingTab.jsx =====
function FiltersEditor({ item, paletteLight, onChange }) {
    const fx = { ...DEFAULT_FX, ...(item.fx || {}) };
    const set = (patch) => onChange(item.id, { fx: { ...fx, ...patch } });
    return (React.createElement(PropGroup, { id: "i-fx", icon: "\u25D1", title: "\u0627\u0644\u0645\u0631\u0634\u062D\u0627\u062A \u0648\u0627\u0644\u0623\u0644\u0648\u0627\u0646", summary: FILTER_PRESETS.find((p) => p.id === fx.preset)?.label },
        React.createElement("div", { className: "grid grid-cols-3 gap-1.5" }, FILTER_PRESETS.map((p) => (React.createElement("button", { key: p.id, type: "button", onClick: () => set({ preset: p.id }), className: `rounded-lg px-2 py-2 text-[12px] transition ${fx.preset === p.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-800 text-stone-400 hover:text-stone-200'}` }, p.label)))),
        React.createElement(RangeField, { label: "\u0627\u0644\u0633\u0637\u0648\u0639", min: -0.5, max: 0.5, step: 0.01, value: fx.brightness, onChange: (brightness) => set({ brightness }), format: (v) => Math.round(v * 100) }),
        React.createElement(RangeField, { label: "\u0627\u0644\u062A\u0628\u0627\u064A\u0646", min: -50, max: 60, value: fx.contrast, onChange: (contrast) => set({ contrast }) }),
        React.createElement(RangeField, { label: "\u0627\u0644\u062A\u0634\u0628\u0651\u0639", min: -2, max: 1, step: 0.05, value: fx.saturation, onChange: (saturation) => set({ saturation }), format: (v) => v.toFixed(2) }),
        React.createElement(RangeField, { label: "\u062F\u0645\u062C \u0627\u0644\u0644\u0648\u0646", min: 0, max: 0.7, step: 0.01, value: fx.tint, onChange: (tint) => set({ tint }), format: (v) => `${Math.round(v * 100)}%` }),
        React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u062F\u0645\u062C", value: fx.tintColor, onChange: (tintColor) => set({ tintColor }) }),
        React.createElement(RangeField, { label: "\u0641\u0633\u064A\u0641\u0633\u0627\u0621 (\u0628\u0643\u0633\u0644\u0629)", min: 0, max: 40, value: fx.pixelSize || 0, onChange: (pixelSize) => set({ pixelSize }) }),
        React.createElement(RangeField, { label: "\u0636\u0628\u0627\u0628\u064A\u0629", min: 0, max: 30, value: fx.blur || 0, onChange: (blur) => set({ blur }) }),
        React.createElement("div", { className: "grid grid-cols-2 gap-2" },
            React.createElement(Button, { onClick: () => set({ tintColor: paletteLight, tint: Math.max(fx.tint, 0.25) }), className: "text-[12px]" }, "\u2726 \u062F\u0645\u062C \u0645\u0639 \u0644\u0648\u0646 \u0627\u0644\u062E\u0644\u0641\u064A\u0629"),
            React.createElement(Button, { onClick: () => onChange(item.id, { fx: { ...DEFAULT_FX } }), className: "text-[12px]" }, "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0636\u0628\u0637"))));
}
function Chips({ items, value, onChange }) {
    return (React.createElement("div", { className: "grid grid-cols-4 gap-1.5" }, items.map((it) => (React.createElement("button", { key: it.id, type: "button", onClick: () => onChange(it.id), className: `rounded-lg px-1 py-2 text-[11.5px] transition ${value === it.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-800 text-stone-400 hover:text-stone-200'}` }, it.label)))));
}
const SHADOW_MODES = [
    { id: 'none', label: 'بدون' },
    { id: 'ground', label: 'ظل أرضي' },
    { id: 'glow', label: 'توهّج خلفي' },
];
/** الظل/التوهّج + تلاشي الحواف + الشكل الملوّن خلف العنصر */
function AppearanceEditor({ item, onChange, paletteLight }) {
    const mode = item.shadowMode || (item.shadow ? 'ground' : 'none');
    const bd = { ...DEFAULT_BACKDROP, ...(item.backdrop || {}) };
    const setBd = (patch) => onChange(item.id, { backdrop: { ...bd, ...patch } });
    const pickShape = (shape) => {
        const def = BACKDROP_SHAPES.find((b) => b.id === shape);
        setBd(def && def.w ? { shape, width: def.w, height: def.h, offsetY: def.y } : { shape });
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(PropGroup, { id: "i-light", icon: "\u2600", title: "\u0627\u0644\u0638\u0644 \u0648\u0627\u0644\u0636\u0648\u0621 \u0648\u0627\u0644\u062A\u0644\u0627\u0634\u064A", summary: SHADOW_MODES.find((m) => m.id === mode)?.label },
            React.createElement("div", { className: "grid grid-cols-3 gap-1.5" }, SHADOW_MODES.map((m) => (React.createElement("button", { key: m.id, type: "button", onClick: () => onChange(item.id, { shadowMode: m.id, shadow: m.id === 'ground' }), className: `rounded-lg px-1 py-2 text-[12px] transition ${mode === m.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-800 text-stone-400 hover:text-stone-200'}` }, m.label)))),
            mode === 'glow' && (React.createElement(React.Fragment, null,
                React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u062A\u0648\u0647\u0651\u062C", value: item.glowColor || '#ffffff', onChange: (glowColor) => onChange(item.id, { glowColor }) }),
                React.createElement(RangeField, { label: "\u0642\u0648\u0629 \u0627\u0644\u062A\u0648\u0647\u0651\u062C", min: 10, max: 150, value: item.glowSize ?? 60, onChange: (glowSize) => onChange(item.id, { glowSize }) }))),
            React.createElement(RangeField, { label: "\u062A\u0644\u0627\u0634\u064A \u0627\u0644\u0623\u0633\u0641\u0644 (\u062F\u0645\u062C \u0645\u0639 \u0627\u0644\u062E\u0644\u0641\u064A\u0629)", min: 0, max: 0.8, step: 0.01, value: item.fadeBottom || 0, onChange: (fadeBottom) => onChange(item.id, { fadeBottom }), format: (v) => `${Math.round(v * 100)}%` }),
            React.createElement(RangeField, { label: "\u062A\u0644\u0627\u0634\u064A \u0627\u0644\u0623\u0637\u0631\u0627\u0641", min: 0, max: 0.9, step: 0.01, value: item.fadeEdges || 0, onChange: (fadeEdges) => onChange(item.id, { fadeEdges }), format: (v) => `${Math.round(v * 100)}%` })),
        React.createElement(PropGroup, { id: "i-backdrop", icon: "\u25E0", title: "\u0634\u0643\u0644 \u0645\u0644\u0648\u0651\u0646 \u062E\u0644\u0641 \u0627\u0644\u0639\u0646\u0635\u0631", summary: BACKDROP_SHAPES.find((b) => b.id === bd.shape)?.label },
            React.createElement(Chips, { items: BACKDROP_SHAPES, value: bd.shape, onChange: pickShape }),
            bd.shape !== 'none' && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "flex items-center gap-2" },
                    React.createElement("div", { className: "flex-1" },
                        React.createElement(ColorField, { label: "\u0627\u0644\u0644\u0648\u0646", value: bd.color, onChange: (color) => setBd({ color }) })),
                    React.createElement(Button, { onClick: () => setBd({ color: paletteLight }), className: "!px-2 text-[11px]" }, "\u0644\u0648\u0646 \u0627\u0644\u062E\u0644\u0641\u064A\u0629")),
                React.createElement(RangeField, { label: "\u0627\u0644\u0634\u0641\u0627\u0641\u064A\u0629", min: 0.05, max: 1, step: 0.01, value: bd.opacity, onChange: (opacity) => setBd({ opacity }), format: (v) => `${Math.round(v * 100)}%` }),
                React.createElement(RangeField, { label: "\u0627\u0644\u0639\u0631\u0636", min: 0.3, max: 2.5, step: 0.01, value: bd.width, onChange: (width) => setBd({ width }), format: (v) => `${Math.round(v * 100)}%` }),
                React.createElement(RangeField, { label: "\u0627\u0644\u0627\u0631\u062A\u0641\u0627\u0639", min: 0.3, max: 2.5, step: 0.01, value: bd.height, onChange: (height) => setBd({ height }), format: (v) => `${Math.round(v * 100)}%` }),
                React.createElement(RangeField, { label: "\u0625\u0632\u0627\u062D\u0629 \u0639\u0645\u0648\u062F\u064A\u0629", min: -0.8, max: 0.8, step: 0.01, value: bd.offsetY, onChange: (offsetY) => setBd({ offsetY }), format: (v) => Math.round(v * 100) }),
                bd.shape !== 'glow' && (React.createElement(React.Fragment, null,
                    React.createElement(RangeField, { label: "\u062A\u0644\u0627\u0634\u064A \u0627\u0644\u0634\u0643\u0644 \u0645\u0646 \u0627\u0644\u0623\u0633\u0641\u0644", min: 0, max: 0.9, step: 0.01, value: bd.fade, onChange: (fade) => setBd({ fade }), format: (v) => `${Math.round(v * 100)}%` }),
                    React.createElement(RangeField, { label: "\u0632\u062E\u0631\u0641\u0629 \u062F\u0627\u062E\u0644 \u0627\u0644\u0634\u0643\u0644", min: 0, max: 1, step: 0.01, value: bd.pattern, onChange: (pattern) => setBd({ pattern }), format: (v) => `${Math.round(v * 100)}%` }),
                    React.createElement(Toggle, { checked: !!bd.stroke, onChange: (stroke) => setBd({ stroke }), label: "\u0625\u0637\u0627\u0631 \u0630\u0647\u0628\u064A \u062D\u0648\u0644 \u0627\u0644\u0634\u0643\u0644", small: true }),
                    bd.stroke && React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u0625\u0637\u0627\u0631", value: bd.strokeColor, onChange: (strokeColor) => setBd({ strokeColor }) }))))))));
}
function CompositingTab({ images, selectedId, onSelect, onAddImage, onChangeNode, onRemoveImage, onMoveImage, autoColors, onToggleAutoColors, onSuggestColors, paletteLight, onOpenCutout, focusSignal, }) {
    const [autoRemove, setAutoRemove] = useState(true);
    const [quality, setQuality] = useState(getCutQuality);
    const editorRef = useRef(null);
    const [job, setJob] = useState({ status: 'idle', label: '', percent: 0, error: null });
    const busy = job.status === 'working';
    const selected = images.find((i) => i.id === selectedId);
    // النقر المزدوج على صورة في الغلاف ← انتقل مباشرة إلى خصائصها
    useEffect(() => {
        if (focusSignal && editorRef.current)
            editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [focusSignal, selectedId]);
    const runRemoval = async (input) => {
        setJob({ status: 'working', label: 'تحميل محرك التفريغ…', percent: 0, error: null });
        try {
            const { blob, maskUrl } = await removeImageBackgroundDetailed(input, (p) => setJob((j) => ({ ...j, label: p.label, percent: p.percent })));
            setJob({ status: 'done', label: '', percent: 100, error: null });
            return { src: URL.createObjectURL(blob), maskSrc: maskUrl };
        }
        catch (err) {
            console.error(err);
            setJob({ status: 'error', label: '', percent: 0, error: err?.message || 'خطأ غير معروف' });
            return null;
        }
    };
    const handleFile = async (file) => {
        const originalUrl = URL.createObjectURL(file);
        if (!autoRemove) {
            onAddImage(originalUrl, { name: file.name, cutout: false, originalSrc: originalUrl });
            return;
        }
        const res = await runRemoval(file);
        onAddImage(res?.src || originalUrl, { name: file.name, cutout: !!res, originalSrc: originalUrl, maskSrc: res?.maskSrc });
    };
    const removeFromSelected = async () => {
        if (!selected)
            return;
        const res = await runRemoval(selected.originalSrc || selected.src);
        if (res)
            onChangeNode(selected.id, { src: res.src, maskSrc: res.maskSrc, cutout: true, originalSrc: selected.originalSrc || selected.src });
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Section, { title: "\u0631\u0641\u0639 \u0635\u0648\u0631\u0629", hint: "\u0634\u062E\u0635\u060C \u0639\u0646\u0635\u0631\u060C \u0645\u0628\u0646\u0649\u2026 \u062A\u064F\u0641\u0631\u064E\u0651\u063A \u062F\u0627\u062E\u0644 \u0645\u062A\u0635\u0641\u062D\u0643 \u062F\u0648\u0646 \u0631\u0641\u0639\u0647\u0627 \u0644\u0623\u064A \u062E\u0627\u062F\u0645" },
            React.createElement(UploadDrop, { onFile: handleFile, disabled: busy, title: busy ? 'جارٍ المعالجة…' : 'اسحب الصورة هنا أو اضغط للاختيار', subtitle: "PNG \u00B7 JPG \u00B7 WEBP" }),
            React.createElement(Toggle, { checked: autoRemove, onChange: setAutoRemove, label: "\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u062E\u0644\u0641\u064A\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B (AI \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u062A\u0635\u0641\u062D)", small: true }),
            autoRemove && (React.createElement("div", null,
                React.createElement(FieldLabel, null, "\u062C\u0648\u062F\u0629 \u0627\u0644\u0642\u0635"),
                React.createElement("div", { className: "grid grid-cols-3 gap-1.5" }, QUALITY_MODES.map((q) => (React.createElement("button", { key: q.id, type: "button", onClick: () => {
                        setQuality(q.id);
                        setCutQuality(q.id);
                    }, className: `rounded-lg py-2 text-[12px] transition ${quality === q.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-800 text-stone-400 hover:text-stone-200'}` }, q.label)))))),
            React.createElement(Toggle, { checked: autoColors, onChange: onToggleAutoColors, label: "\u0627\u0642\u062A\u0631\u0627\u062D \u0627\u0644\u0623\u0644\u0648\u0627\u0646 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0645\u0646 \u0627\u0644\u0635\u0648\u0631\u0629", small: true }),
            busy && React.createElement(ProgressBar, { percent: job.percent, label: job.label }),
            job.status === 'error' && (React.createElement("p", { className: "rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-[12px] text-red-300" },
                "\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u062A\u0641\u0631\u064A\u063A: ",
                job.error,
                ". \u062A\u0623\u0643\u062F \u0645\u0646 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0639\u0646\u062F \u0623\u0648\u0644 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0644\u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0646\u0645\u0648\u0630\u062C.")),
            React.createElement("p", { className: "text-[11px] leading-relaxed text-stone-500" }, "\u0623\u0648\u0644 \u062A\u0641\u0631\u064A\u063A \u064A\u0633\u062A\u063A\u0631\u0642 \u0648\u0642\u062A\u0627\u064B \u0623\u0637\u0648\u0644 \u0644\u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629\u060C \u062B\u0645 \u064A\u064F\u062E\u0632\u064E\u0651\u0646 \u0641\u064A \u0627\u0644\u0645\u062A\u0635\u0641\u062D.")),
        images.length > 0 && (React.createElement(Section, { title: "\u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0639\u0644\u0649 \u0627\u0644\u063A\u0644\u0627\u0641", hint: "\u0627\u0636\u063A\u0637 \u0639\u0646\u0635\u0631\u0627\u064B \u0644\u062A\u062D\u062F\u064A\u062F\u0647\u060C \u0623\u0648 \u062D\u062F\u0651\u062F\u0647 \u0645\u0628\u0627\u0634\u0631\u0629 \u0639\u0644\u0649 \u0627\u0644\u0643\u0627\u0646\u0641\u0627\u0633" },
            React.createElement("div", { className: "grid grid-cols-4 gap-2" }, images.map((img) => (React.createElement("button", { key: img.id, type: "button", title: img.credit || img.name, onClick: () => onSelect(img.id), className: `relative aspect-square overflow-hidden rounded-xl border bg-[conic-gradient(#1f1b16_25%,#15120f_0_50%,#1f1b16_0_75%,#15120f_0)] bg-[length:12px_12px] transition ${img.id === selectedId ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-white/10 hover:border-white/30'}` },
                React.createElement("img", { src: img.src, alt: img.name, className: "h-full w-full object-contain p-1" }),
                img.cutout && (React.createElement("span", { className: "absolute bottom-1 right-1 rounded bg-gold-500 px-1 text-[9px] font-bold text-ink-950" }, "\u0634\u0641\u0627\u0641\u0629")))))))),
        selected && (React.createElement("div", { ref: editorRef, className: "scroll-mt-4" },
            React.createElement(Section, { title: "\u062A\u062D\u0631\u064A\u0631 \u0627\u0644\u0639\u0646\u0635\u0631 \u0627\u0644\u0645\u062D\u062F\u062F", hint: "\u0646\u0642\u0631\u062A\u0627\u0646 \u0639\u0644\u0649 \u0623\u064A \u0635\u0648\u0631\u0629 \u0641\u064A \u0627\u0644\u063A\u0644\u0627\u0641 \u062A\u0641\u062A\u062D \u062E\u0635\u0627\u0626\u0635\u0647\u0627 \u0647\u0646\u0627 \u0645\u0628\u0627\u0634\u0631\u0629" },
                React.createElement(Button, { variant: "primary", onClick: () => onOpenCutout(selected.id), className: "w-full" }, "\u2702 \u062A\u062D\u0633\u064A\u0646 \u0627\u0644\u0642\u0635 \u064A\u062F\u0648\u064A\u0627\u064B (\u0645\u0645\u062D\u0627\u0629 / \u0627\u0633\u062A\u0639\u0627\u062F\u0629 / \u0627\u0644\u062D\u0648\u0627\u0641)"),
                React.createElement(PropGroup, { id: "i-size", icon: "\u2922", title: "\u0627\u0644\u062D\u062C\u0645 \u0648\u0627\u0644\u062F\u0648\u0631\u0627\u0646 \u0648\u0627\u0644\u0634\u0641\u0627\u0641\u064A\u0629", defaultOpen: true, summary: `${Math.round(selected.scale * 100)}% · ${Math.round(selected.rotation)}°` },
                    React.createElement(RangeField, { label: "\u0627\u0644\u062D\u062C\u0645", min: 0.1, max: 3, step: 0.01, value: selected.scale, onChange: (scale) => onChangeNode(selected.id, { scale }), format: (v) => `${Math.round(v * 100)}%` }),
                    React.createElement(RangeField, { label: "\u0627\u0644\u062A\u062F\u0648\u064A\u0631", min: -180, max: 180, value: Math.round(selected.rotation), onChange: (rotation) => onChangeNode(selected.id, { rotation }), format: (v) => `${v}°`, defaultValue: 0 }),
                    React.createElement(RangeField, { label: "\u0627\u0644\u0634\u0641\u0627\u0641\u064A\u0629", min: 0, max: 1, step: 0.01, value: selected.opacity, onChange: (opacity) => onChangeNode(selected.id, { opacity }), format: (v) => `${Math.round(v * 100)}%`, defaultValue: 1 }),
                    React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                        React.createElement(Button, { onClick: () => onMoveImage(selected.id, 1) }, "\u2B06 \u0625\u0644\u0649 \u0627\u0644\u0623\u0645\u0627\u0645"),
                        React.createElement(Button, { onClick: () => onMoveImage(selected.id, -1) }, "\u2B07 \u0625\u0644\u0649 \u0627\u0644\u062E\u0644\u0641"))),
                React.createElement(AppearanceEditor, { item: selected, onChange: onChangeNode, paletteLight: paletteLight }),
                React.createElement(FiltersEditor, { item: selected, paletteLight: paletteLight, onChange: onChangeNode }),
                React.createElement(PropGroup, { id: "i-actions", icon: "\u22EF", title: "\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0623\u062E\u0631\u0649", summary: "\u0623\u0644\u0648\u0627\u0646 \u0645\u0646 \u0627\u0644\u0635\u0648\u0631\u0629\u060C \u0627\u0644\u0623\u0635\u0644\u060C \u062D\u0630\u0641" },
                    React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                        React.createElement(Button, { onClick: () => onSuggestColors(selected.src), className: "col-span-2" }, "\uD83C\uDFA8 \u0627\u0642\u062A\u0631\u0627\u062D \u0623\u0644\u0648\u0627\u0646 \u0627\u0644\u063A\u0644\u0627\u0641 \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u0635\u0648\u0631\u0629"),
                        !selected.cutout && (React.createElement(Button, { variant: "primary", onClick: removeFromSelected, disabled: busy, className: "col-span-2" }, "\u2726 \u0625\u0632\u0627\u0644\u0629 \u062E\u0644\u0641\u064A\u0629 \u0647\u0630\u0647 \u0627\u0644\u0635\u0648\u0631\u0629")),
                        selected.cutout && selected.originalSrc && selected.originalSrc !== selected.src && (React.createElement(Button, { onClick: () => onChangeNode(selected.id, { src: selected.originalSrc, cutout: false }), className: "col-span-2" }, "\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0623\u0635\u0644\u064A\u0629")),
                        React.createElement(Button, { variant: "danger", onClick: () => onRemoveImage(selected.id), className: "col-span-2" }, "\u062D\u0630\u0641 \u0627\u0644\u0639\u0646\u0635\u0631"))),
                selected.credit && React.createElement("p", { className: "text-[11px] leading-relaxed text-stone-500" },
                    "\u0627\u0644\u0645\u0635\u062F\u0631: ",
                    selected.credit))))));
}
// ===== components/tabs/LibraryTab.jsx =====
function LibraryTab({ onAddImage }) {
    const [mode, setMode] = useState('icons'); // icons | png
    const [query, setQuery] = useState('');
    const [color, setColor] = useState('#d4af6a');
    const [results, setResults] = useState([]);
    const [status, setStatus] = useState({ loading: false, error: null, adding: null });
    const suggestions = mode === 'icons' ? ICON_SUGGESTIONS : PNG_SUGGESTIONS;
    const search = async (q) => {
        const term = translateQuery(q, suggestions);
        if (!term)
            return;
        setStatus({ loading: true, error: null, adding: null });
        try {
            const list = mode === 'icons'
                ? await searchIcons(term)
                : await searchTransparentPNG(term, (done, total) => setStatus((st) => ({ ...st, progress: `فحص الشفافية ${done}/${total}` })));
            setResults(list);
            setStatus({
                loading: false,
                adding: null,
                error: list.length ? null : mode === 'icons' ? 'لا توجد نتائج — جرّب كلمة إنجليزية (مثل: sword, lion, moon)' : 'لا توجد صور PNG شفافة لهذه الكلمة — جرّب كلمة إنجليزية أخرى',
            });
        }
        catch (err) {
            setStatus({ loading: false, error: err.message, adding: null });
        }
    };
    useEffect(() => {
        setResults([]);
        setStatus({ loading: false, error: null, adding: null });
    }, [mode]);
    const addIcon = async (name) => {
        setStatus((s) => ({ ...s, adding: name }));
        try {
            const src = await iconToPngUrl(name, color);
            await onAddImage(src, { name, cutout: true, credit: `أيقونة ${name.split(':')[0]} عبر Iconify (مفتوحة المصدر)`, suggestColors: false });
        }
        catch {
            setStatus((s) => ({ ...s, error: 'تعذّر إضافة الأيقونة' }));
        }
        finally {
            setStatus((s) => ({ ...s, adding: null }));
        }
    };
    const addPng = async (item) => {
        setStatus((s) => ({ ...s, adding: item.id }));
        try {
            const src = await fetchCommonsImage(item);
            const credit = `${item.title} — ${item.artist || 'ويكيميديا كومنز'} (${item.license})`;
            await onAddImage(src, { name: item.title, cutout: true, credit });
        }
        catch (err) {
            setStatus((s) => ({ ...s, error: err.message }));
        }
        finally {
            setStatus((s) => ({ ...s, adding: null }));
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Section, { title: "\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0645\u062C\u0627\u0646\u064A\u0629", hint: "\u0623\u064A\u0642\u0648\u0646\u0627\u062A \u0648\u0635\u0648\u0631 PNG \u0634\u0641\u0627\u0641\u0629 \u0641\u0642\u0637 \u0645\u0646 \u0645\u0635\u0627\u062F\u0631 \u0645\u0641\u062A\u0648\u062D\u0629" },
            React.createElement("div", { className: "grid grid-cols-2 gap-1 rounded-xl bg-ink-900 p-1" }, [['icons', 'أيقونات'], ['png', 'صور PNG']].map(([id, label]) => (React.createElement("button", { key: id, type: "button", onClick: () => setMode(id), className: `rounded-lg py-2 text-[13px] transition ${mode === id ? 'bg-gold-400 font-bold text-ink-950' : 'text-stone-400'}` }, label)))),
            React.createElement("form", { className: "flex gap-2", onSubmit: (e) => {
                    e.preventDefault();
                    search(query);
                } },
                React.createElement("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: mode === 'icons' ? 'ابحث: sword, crown, moon…' : 'ابحث: lion, castle, rose…', className: "min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-stone-100 outline-none placeholder:text-stone-600 focus:border-gold-500/60" }),
                React.createElement("button", { type: "submit", className: "rounded-xl bg-gold-400 px-4 text-sm font-bold text-ink-950 hover:bg-gold-300" }, "\u0628\u062D\u062B")),
            React.createElement("div", { className: "flex flex-wrap gap-1.5" }, suggestions.map(([ar, en]) => (React.createElement("button", { key: en, type: "button", onClick: () => {
                    setQuery(ar);
                    search(en);
                }, className: "rounded-full border border-white/10 bg-ink-900 px-2.5 py-1 text-[11px] text-stone-400 transition hover:border-gold-500/50 hover:text-gold-200" }, ar)))),
            mode === 'icons' && React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u0623\u064A\u0642\u0648\u0646\u0629", value: color, onChange: setColor }),
            status.loading && React.createElement("p", { className: "text-[12px] text-stone-400" }, status.progress || 'جارٍ البحث…'),
            status.error && React.createElement("p", { className: "text-[12px] text-red-300" }, status.error)),
        results.length > 0 && (React.createElement(Section, { title: `النتائج (${results.length})`, hint: mode === 'icons' ? 'اضغط على أي عنصر لإضافته إلى الغلاف' : 'صور PNG شفافة فقط (فُحصت تلقائياً) — اضغط لإضافتها' },
            mode === 'icons' ? (React.createElement("div", { className: "grid grid-cols-6 gap-1.5" }, results.map((name) => (React.createElement("button", { key: name, type: "button", title: name, disabled: !!status.adding, onClick: () => addIcon(name), className: `grid aspect-square place-items-center rounded-lg border bg-ink-900 p-1.5 transition hover:border-gold-400 ${status.adding === name ? 'animate-pulse border-gold-400' : 'border-white/5'}` },
                React.createElement("img", { src: iconSvgUrl(name, color), alt: name, loading: "lazy", className: "h-full w-full object-contain" })))))) : (React.createElement("div", { className: "grid grid-cols-3 gap-2" }, results.map((item) => (React.createElement("button", { key: item.id, type: "button", title: `${item.title}\n${item.artist}\n${item.license}`, disabled: !!status.adding, onClick: () => addPng(item), className: `overflow-hidden rounded-lg border bg-[conic-gradient(#1f1b16_25%,#15120f_0_50%,#1f1b16_0_75%,#15120f_0)] bg-[length:12px_12px] text-right transition hover:border-gold-400 ${status.adding === item.id ? 'animate-pulse border-gold-400' : 'border-white/5'}` },
                React.createElement("img", { src: item.thumb, alt: item.title, loading: "lazy", className: "aspect-square w-full object-contain p-1" }),
                React.createElement("div", { className: "truncate bg-ink-900 px-1.5 py-1 text-[9px] text-stone-500", dir: "ltr" }, item.license)))))),
            React.createElement("p", { className: "text-[11px] leading-relaxed text-stone-500" }, mode === 'icons'
                ? 'الأيقونات من مجموعات مفتوحة المصدر عبر Iconify، وتُضاف كـ PNG شفاف بدقة 1024px.'
                : 'الصور من ويكيميديا كومنز بتراخيص حرة. بعضها يشترط ذكر اسم المؤلف — يظهر المصدر عند تحديد العنصر.')))));
}
// ===== components/tabs/LogoTab.jsx =====
const MARGIN = 90;
const POSITIONS = [
    ['top', 'right'], ['top', 'center'], ['top', 'left'],
    ['middle', 'right'], ['middle', 'center'], ['middle', 'left'],
    ['bottom', 'right'], ['bottom', 'center'], ['bottom', 'left'],
];
function positionFor(logo, v, hz) {
    const w = logo.width * logo.scale;
    const h = logo.height * logo.scale;
    const x = hz === 'left' ? MARGIN + w / 2 : hz === 'right' ? COVER_W - MARGIN - w / 2 : COVER_W / 2;
    const y = v === 'top' ? MARGIN + h / 2 : v === 'bottom' ? COVER_H - MARGIN - h / 2 : COVER_H / 2;
    return { x, y, rotation: 0 };
}
function LogoTab({ logo, onSetLogo, onChangeNode, onRemoveLogo, onSelect }) {
    return (React.createElement(React.Fragment, null,
        React.createElement(Section, { title: "\u0634\u0639\u0627\u0631 \u062F\u0627\u0631 \u0627\u0644\u0646\u0634\u0631", hint: "\u064A\u064F\u0641\u0636\u064E\u0651\u0644 PNG \u0628\u062E\u0644\u0641\u064A\u0629 \u0634\u0641\u0627\u0641\u0629" },
            React.createElement(UploadDrop, { accept: "image/png,image/svg+xml,image/webp", onFile: (file) => onSetLogo(URL.createObjectURL(file)), title: logo ? 'استبدال الشعار' : 'رفع الشعار', subtitle: "PNG \u0634\u0641\u0627\u0641 \u00B7 SVG \u00B7 WEBP" })),
        logo && (React.createElement(Section, { title: "\u0627\u0644\u0645\u0648\u0642\u0639 \u0648\u0627\u0644\u062D\u062C\u0645", action: React.createElement(Button, { onClick: () => onSelect('logo'), className: "!px-2.5 !py-1 text-[11px]" }, "\u062A\u062D\u062F\u064A\u062F \u0639\u0644\u0649 \u0627\u0644\u063A\u0644\u0627\u0641") },
            React.createElement("div", null,
                React.createElement("div", { className: "mb-2 text-[12px] text-stone-400" }, "\u0645\u0648\u0636\u0639 \u0633\u0631\u064A\u0639"),
                React.createElement("div", { className: "mx-auto grid w-40 grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-ink-900 p-2", style: { aspectRatio: '2 / 3' } }, POSITIONS.map(([v, hz]) => (React.createElement("button", { key: `${v}-${hz}`, type: "button", title: `${v} ${hz}`, onClick: () => onChangeNode('logo', positionFor(logo, v, hz)), className: "grid place-items-center rounded-md bg-white/5 transition hover:bg-gold-400/30" },
                    React.createElement("span", { className: "h-1.5 w-1.5 rounded-full bg-gold-400" })))))),
            React.createElement(RangeField, { label: "\u0627\u0644\u062D\u062C\u0645", min: 0.1, max: 3, step: 0.01, value: logo.scale, onChange: (scale) => onChangeNode('logo', { scale }), format: (v) => `${Math.round(v * 100)}%` }),
            React.createElement(RangeField, { label: "\u0627\u0644\u062A\u062F\u0648\u064A\u0631", min: -180, max: 180, value: Math.round(logo.rotation), onChange: (rotation) => onChangeNode('logo', { rotation }), format: (v) => `${v}°` }),
            React.createElement(RangeField, { label: "\u0627\u0644\u0634\u0641\u0627\u0641\u064A\u0629", min: 0, max: 1, step: 0.01, value: logo.opacity, onChange: (opacity) => onChangeNode('logo', { opacity }), format: (v) => `${Math.round(v * 100)}%` }),
            React.createElement(AppearanceEditor, { item: logo, onChange: onChangeNode, paletteLight: "#d4af6a" }),
            React.createElement(Button, { variant: "danger", onClick: onRemoveLogo, className: "w-full" }, "\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0634\u0639\u0627\u0631")))));
}
// ===== components/tabs/PalettesTab.jsx =====
const TINTS = [
    { label: 'الأصل', hue: 0, sat: 1, sw: 'linear-gradient(135deg,#d98a4a,#3a1a33)' },
    { label: 'ليلي', hue: 200, sat: 0.9, sw: 'linear-gradient(135deg,#2a5a9a,#0a1a33)' },
    { label: 'زمردي', hue: 110, sat: 1, sw: 'linear-gradient(135deg,#3aa070,#0a2a1a)' },
    { label: 'بنفسجي', hue: -70, sat: 1, sw: 'linear-gradient(135deg,#8a4ad9,#1a0a33)' },
    { label: 'قرمزي', hue: -25, sat: 1.25, sw: 'linear-gradient(135deg,#d93a3a,#330a0a)' },
    { label: 'ذهبي', hue: 18, sat: 1.15, sw: 'linear-gradient(135deg,#e6c070,#3a2a0a)' },
    { label: 'رمادي', hue: 0, sat: 0, sw: 'linear-gradient(135deg,#aaa,#222)' },
    { label: 'سيبيا', hue: 25, sat: 0.35, sw: 'linear-gradient(135deg,#b89a70,#2a1e10)' },
];
const BLEND_OPTIONS = [
    { value: 'soft-light', label: 'ضوء ناعم' },
    { value: 'overlay', label: 'تراكب' },
    { value: 'multiply', label: 'تعتيم (ضرب)' },
    { value: 'color', label: 'تلوين' },
    { value: 'source-over', label: 'عادي' },
];
function ScenePreview({ id }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current)
            drawScenePreview(ref.current, id);
    }, [id]);
    return React.createElement("canvas", { ref: ref, width: 100, height: 150, className: "aspect-[2/3] w-full" });
}
/** خلفيات جاهزة مرسومة داخل التطبيق — تعمل دون إنترنت */
const TEXTURE_SCENES = new Set(['marble', 'goldMarble', 'wood', 'leather', 'tiles', 'hexagons', 'watercolor', 'mesh', 'abstractWaves', 'velvet', 'goldFoil', 'artDeco', 'smoke', 'papyrus', 'arabesque', 'grainGradient', 'oldPaper', 'bokeh', 'inkSplash']);
const SCENE_TABS = [
    { id: 'scenes', label: 'مشاهد' },
    { id: 'security', label: 'أمني وعسكري' },
    { id: 'textures', label: 'أنسجة وفن' },
    { id: 'all', label: 'الكل' },
];
function SceneGallery({ onPick, activeScene }) {
    const [busy, setBusy] = useState(null);
    const [tab, setTab] = useState('scenes');
    const list = SCENES.filter((sc) => {
        if (tab === 'all')
            return true;
        if (tab === 'security')
            return !!sc.cat;
        if (sc.cat)
            return false;
        return (tab === 'textures') === TEXTURE_SCENES.has(sc.id);
    });
    return (React.createElement(Section, { title: "\u062E\u0644\u0641\u064A\u0627\u062A \u062C\u0627\u0647\u0632\u0629", hint: `${SCENES.length} مشهداً ونسيجاً مرسومة داخل التطبيق — تعمل دون إنترنت، وكل خلفية قابلة للتلوين` },
        React.createElement("div", { className: "grid grid-cols-4 gap-1.5" }, SCENE_TABS.map((t) => (React.createElement("button", { key: t.id, type: "button", onClick: () => setTab(t.id), className: `rounded-lg py-1.5 text-[12px] ${tab === t.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-900 text-stone-400'}` }, t.label)))),
        React.createElement("div", { className: "grid grid-cols-3 gap-2" }, list.map((sc) => (React.createElement("button", { key: sc.id, type: "button", disabled: !!busy, onClick: () => {
                setBusy(sc.id);
                // نؤجل قليلاً ليظهر مؤشر التحميل قبل الرسم بدقة كاملة
                setTimeout(() => {
                    onPick(getSceneUrl(sc.id), sc.id);
                    setBusy(null);
                }, 30);
            }, className: `overflow-hidden rounded-xl border text-right transition ${activeScene === sc.id ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-white/10 hover:border-white/30'} ${busy === sc.id ? 'animate-pulse' : ''}` },
            React.createElement(ScenePreview, { id: sc.id }),
            React.createElement("div", { className: "truncate bg-ink-900 px-2 py-1.5 text-[11px] text-stone-300" }, sc.label)))))));
}
function AIGenerator({ onResult }) {
    const [prompt, setPrompt] = useState('');
    const [enhance, setEnhance] = useState(true);
    const [state, setState] = useState({ busy: false, error: null, started: 0 });
    const run = async (text) => {
        setState({ busy: true, error: null, started: Date.now() });
        try {
            const url = await generateAIBackground(text, { enhanceStyle: enhance });
            onResult(url);
            setState({ busy: false, error: null, started: 0 });
        }
        catch (err) {
            setState({ busy: false, error: err.message, started: 0 });
        }
    };
    return (React.createElement(Section, { title: "\u2726 \u062A\u0648\u0644\u064A\u062F \u062E\u0644\u0641\u064A\u0629 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A", hint: "\u0627\u0643\u062A\u0628 \u0648\u0635\u0641 \u0627\u0644\u0645\u0634\u0647\u062F\u060C \u0623\u0648 \u0627\u062E\u062A\u0631 \u0641\u0643\u0631\u0629 \u062C\u0627\u0647\u0632\u0629" },
        React.createElement("textarea", { rows: 3, value: prompt, onChange: (e) => setPrompt(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: ruined city at night under heavy rain \u2014 \u0623\u0648 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629: \u0645\u062F\u064A\u0646\u0629 \u0645\u062F\u0645\u0651\u0631\u0629 \u062A\u062D\u062A \u0627\u0644\u0645\u0637\u0631 \u0644\u064A\u0644\u0627\u064B", className: "w-full resize-none rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm leading-relaxed text-stone-100 outline-none placeholder:text-stone-600 focus:border-gold-500/60" }),
        React.createElement("div", { className: "flex flex-wrap gap-1.5" }, AI_PRESETS.map((p) => (React.createElement("button", { key: p.label, type: "button", disabled: state.busy, onClick: () => {
                setPrompt(p.prompt);
                run(p.prompt);
            }, className: "rounded-full border border-white/10 bg-ink-900 px-2.5 py-1 text-[11px] text-stone-400 transition hover:border-gold-500/50 hover:text-gold-200 disabled:opacity-40" }, p.label)))),
        React.createElement(Toggle, { checked: enhance, onChange: setEnhance, label: "\u0625\u0636\u0627\u0641\u0629 \u0637\u0627\u0628\u0639 \u0633\u064A\u0646\u0645\u0627\u0626\u064A \u062F\u0627\u0643\u0646 \u0644\u0644\u0648\u0635\u0641 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B", small: true }),
        React.createElement(Button, { variant: "primary", onClick: () => run(prompt), disabled: state.busy || !prompt.trim(), className: "w-full" }, state.busy ? 'جارٍ التوليد… (قد يستغرق 15–60 ثانية)' : 'توليد الخلفية'),
        state.busy && (React.createElement("div", { className: "h-1.5 overflow-hidden rounded-full bg-ink-600" },
            React.createElement("div", { className: "h-full w-1/3 animate-pulse rounded-full bg-gold-400" }))),
        state.error && React.createElement("p", { className: "rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-[12px] text-red-300" }, state.error),
        React.createElement("p", { className: "text-[11px] leading-relaxed text-stone-500" }, "\u064A\u062A\u0645 \u0627\u0644\u062A\u0648\u0644\u064A\u062F \u0639\u0628\u0631 \u062E\u062F\u0645\u0629 Pollinations \u0627\u0644\u0645\u062C\u0627\u0646\u064A\u0629 (\u062A\u062D\u062A\u0627\u062C \u0625\u0646\u062A\u0631\u0646\u062A). \u0627\u0644\u0648\u0635\u0641 \u0628\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u064A\u0639\u0637\u064A \u0646\u062A\u0627\u0626\u062C \u0623\u062F\u0642. \u0643\u0644 \u0636\u063A\u0637\u0629 \u062A\u0639\u0637\u064A \u0635\u0648\u0631\u0629 \u0645\u062E\u062A\u0644\u0641\u0629.")));
}
function PalettesTab({ paletteId, customPalette, onChangePalette, background, onSetBackground, onChangeBackground, onRemoveBackground, onSuggestColors, }) {
    const options = [
        ...(customPalette ? [{ value: 'custom', label: `★ ${customPalette.name || 'نمط مخصص'}` }] : []),
        ...PALETTES.map((p, i) => ({ value: p.id, label: `${i + 1}. ${p.name}` })),
    ];
    const bgSection = (React.createElement(Section, { title: background ? "الخلفية الحالية — تلوين وضبط" : "صورة خلفية كاملة", hint: "\u0627\u0631\u0641\u0639 \u0635\u0648\u0631\u0629\u060C \u0623\u0648 \u0627\u062E\u062A\u0631 \u0645\u0634\u0647\u062F\u0627\u064B \u062C\u0627\u0647\u0632\u0627\u064B \u062B\u0645 \u0644\u0648\u0651\u0646\u0647 \u0645\u0646 \u0647\u0646\u0627" },
        React.createElement(UploadDrop, { onFile: (file) => onSetBackground(URL.createObjectURL(file)), title: background ? 'استبدال صورة الخلفية' : 'رفع صورة خلفية', subtitle: "JPG \u00B7 PNG \u00B7 WEBP" }),
        background && (React.createElement(React.Fragment, null,
            React.createElement(PropGroup, { id: "bg-tint", icon: "\uD83C\uDFA8", title: "\u062A\u0644\u0648\u064A\u0646 \u0627\u0644\u062E\u0644\u0641\u064A\u0629", defaultOpen: true, summary: background.hue || (background.sat ?? 1) !== 1 ? 'ملوّنة' : 'الألوان الأصلية' },
                React.createElement("div", { className: "grid grid-cols-4 gap-1.5" }, TINTS.map((t) => {
                    const on = (background.hue || 0) === t.hue && (background.sat ?? 1) === t.sat;
                    return (React.createElement("button", { key: t.label, type: "button", onClick: () => onChangeBackground({ hue: t.hue, sat: t.sat, bright: 1 }), className: `overflow-hidden rounded-lg border text-[10.5px] ${on ? 'border-gold-400 text-gold-200' : 'border-white/10 text-stone-400'}` },
                        React.createElement("span", { className: "block h-6", style: { background: t.sw } }),
                        React.createElement("span", { className: "block bg-ink-900 py-1" }, t.label)));
                })),
                React.createElement(RangeField, { label: "\u062F\u0631\u062C\u0629 \u0627\u0644\u0644\u0648\u0646", min: -180, max: 180, value: background.hue || 0, onChange: (hue) => onChangeBackground({ hue }), format: (v) => `${v}°`, defaultValue: 0 }),
                React.createElement(RangeField, { label: "\u0627\u0644\u062A\u0634\u0628\u0651\u0639", min: 0, max: 2, step: 0.05, value: background.sat ?? 1, onChange: (sat) => onChangeBackground({ sat }), format: (v) => `${Math.round(v * 100)}%`, defaultValue: 1 }),
                React.createElement(RangeField, { label: "\u0627\u0644\u0625\u0636\u0627\u0621\u0629", min: 0.4, max: 1.6, step: 0.02, value: background.bright ?? 1, onChange: (bright) => onChangeBackground({ bright }), format: (v) => `${Math.round(v * 100)}%`, defaultValue: 1 })),
            React.createElement(PropGroup, { id: "bg-frame", icon: "\u2922", title: "\u0627\u0644\u0625\u0637\u0627\u0631 \u0648\u0627\u0644\u062A\u0639\u062A\u064A\u0645", summary: `${Math.round(background.scale * 100)}% · تعتيم ${Math.round(background.dim * 100)}%` },
                React.createElement(RangeField, { label: "\u0627\u0644\u062A\u0643\u0628\u064A\u0631", min: 1, max: 3, step: 0.01, value: background.scale, onChange: (scale) => onChangeBackground({ scale }), format: (v) => `${Math.round(v * 100)}%`, defaultValue: 1 }),
                React.createElement(RangeField, { label: "\u0625\u0632\u0627\u062D\u0629 \u0623\u0641\u0642\u064A\u0629", min: -1, max: 1, step: 0.01, value: background.offsetX, onChange: (offsetX) => onChangeBackground({ offsetX }), format: (v) => Math.round(v * 100), defaultValue: 0 }),
                React.createElement(RangeField, { label: "\u0625\u0632\u0627\u062D\u0629 \u0639\u0645\u0648\u062F\u064A\u0629", min: -1, max: 1, step: 0.01, value: background.offsetY, onChange: (offsetY) => onChangeBackground({ offsetY }), format: (v) => Math.round(v * 100), defaultValue: 0 }),
                React.createElement(RangeField, { label: "\u062A\u0639\u062A\u064A\u0645 \u0627\u0644\u0635\u0648\u0631\u0629", min: 0, max: 0.9, step: 0.01, value: background.dim, onChange: (dim) => onChangeBackground({ dim }), format: (v) => `${Math.round(v * 100)}%` }),
                React.createElement(RangeField, { label: "\u0645\u0632\u062C \u0627\u0644\u0646\u0645\u0637 \u0627\u0644\u0644\u0648\u0646\u064A \u0641\u0648\u0642\u0647\u0627", min: 0, max: 1, step: 0.01, value: background.paletteMix, onChange: (paletteMix) => onChangeBackground({ paletteMix }), format: (v) => `${Math.round(v * 100)}%` }),
                React.createElement(SelectField, { label: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0645\u0632\u062C", value: background.blend, options: BLEND_OPTIONS, onChange: (blend) => onChangeBackground({ blend }) })),
            React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                React.createElement(Button, { onClick: () => onSuggestColors(background.src), className: "text-[12px]" }, "\uD83C\uDFA8 \u0623\u0644\u0648\u0627\u0646 \u0645\u0646 \u0627\u0644\u062E\u0644\u0641\u064A\u0629"),
                React.createElement(Button, { variant: "danger", onClick: onRemoveBackground, className: "text-[12px]" }, "\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u062E\u0644\u0641\u064A\u0629"))))));
    return (React.createElement(React.Fragment, null,
        background && bgSection,
        React.createElement(SceneGallery, { activeScene: background?.scene, onPick: (src, scene) => onSetBackground(src, { scene }) }),
        React.createElement(AIGenerator, { onResult: (src) => onSetBackground(src, { generated: true }) }),
        !background && bgSection,
        React.createElement(Section, { title: "\u0627\u0644\u0646\u0645\u0637 \u0627\u0644\u0644\u0648\u0646\u064A", hint: `${PALETTES.length} نمطاً لونياً + النمط المقترح من صورك` },
            React.createElement(SelectField, { value: paletteId, onChange: onChangePalette, options: options }),
            React.createElement("div", { className: "grid grid-cols-3 gap-2.5" },
                customPalette && (React.createElement(PaletteCard, { palette: { id: 'custom', ...customPalette }, active: paletteId === 'custom', onClick: () => onChangePalette('custom'), star: true })),
                PALETTES.map((p) => (React.createElement(PaletteCard, { key: p.id, palette: p, active: p.id === paletteId, onClick: () => onChangePalette(p.id) })))))));
}
function PaletteCard({ palette, active, onClick, star }) {
    return (React.createElement("button", { type: "button", onClick: onClick, className: `overflow-hidden rounded-xl border text-right transition ${active ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-white/10 hover:border-white/30'}` },
        React.createElement("div", { className: "aspect-[2/3]", style: { background: paletteToCss(palette) } }),
        React.createElement("div", { className: "truncate bg-ink-900 px-2 py-1.5 text-[11px] text-stone-300" },
            star && '★ ',
            palette.name)));
}
// ===== components/tabs/LayersTab.jsx =====
function LayersTab({ layers, onChangeLayer, onResetLayers, textAboveLayers, onToggleTextAbove, grade, onChangeGrade }) {
    return (React.createElement(React.Fragment, null,
        React.createElement(Section, { title: "\u0627\u0644\u062A\u062F\u0631\u0651\u062C \u0627\u0644\u0644\u0648\u0646\u064A \u0627\u0644\u0633\u064A\u0646\u0645\u0627\u0626\u064A", hint: "\u064A\u0644\u0648\u0651\u0646 \u0627\u0644\u063A\u0644\u0627\u0641 \u0643\u0627\u0645\u0644\u0627\u064B \u0643\u0645\u0627 \u0641\u064A \u0623\u0641\u0644\u0627\u0645 \u0627\u0644\u0633\u064A\u0646\u0645\u0627" },
            React.createElement("div", { className: "grid grid-cols-3 gap-2" }, GRADES.map((g) => (React.createElement("button", { key: g.id, type: "button", onClick: () => onChangeGrade({ preset: g.id }), className: `overflow-hidden rounded-xl border text-center transition ${grade.preset === g.id ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-white/10 hover:border-white/30'}` },
                React.createElement("div", { className: "h-8", style: { background: `linear-gradient(135deg, ${g.swatch[0]}, ${g.swatch[1]})` } }),
                React.createElement("div", { className: "bg-ink-900 py-1 text-[11px] text-stone-300" }, g.label))))),
            grade.preset !== 'none' && (React.createElement(RangeField, { label: "\u0642\u0648\u0629 \u0627\u0644\u062A\u062F\u0631\u0651\u062C", min: 0.05, max: 1, step: 0.01, value: grade.amount, onChange: (amount) => onChangeGrade({ amount }), format: (v) => `${Math.round(v * 100)}%` }))),
        React.createElement(Section, { title: "\u0627\u0644\u0637\u0628\u0642\u0627\u062A \u0648\u0627\u0644\u0645\u0624\u062B\u0631\u0627\u062A", hint: "\u062A\u064F\u0637\u0628\u064E\u0651\u0642 \u0641\u0648\u0642 \u0627\u0644\u062A\u0635\u0645\u064A\u0645 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0628\u0623\u0648\u0636\u0627\u0639 \u062F\u0645\u062C \u0633\u064A\u0646\u0645\u0627\u0626\u064A\u0629", action: React.createElement(Button, { onClick: onResetLayers, className: "!px-2.5 !py-1 text-[11px]" }, "\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0643\u0644") },
            React.createElement(Toggle, { checked: textAboveLayers, onChange: onToggleTextAbove, label: "\u0625\u0628\u0642\u0627\u0621 \u0627\u0644\u0646\u0635\u0648\u0635 \u0641\u0648\u0642 \u0627\u0644\u0645\u0624\u062B\u0631\u0627\u062A (\u0648\u0636\u0648\u062D \u0623\u0639\u0644\u0649)", small: true })),
        OVERLAY_GROUPS.map((group) => (React.createElement(Section, { key: group.id, title: group.label },
            React.createElement("div", { className: "space-y-3" }, group.items.map((item) => {
                const state = layers[item.id];
                return (React.createElement("div", { key: item.id, className: `rounded-xl border p-3 transition ${state.enabled ? 'border-gold-500/30 bg-gold-400/5' : 'border-white/5 bg-ink-900/60'}` },
                    React.createElement("div", { className: "flex items-center justify-between gap-3" },
                        React.createElement(Toggle, { checked: state.enabled, onChange: (enabled) => onChangeLayer(item.id, { enabled }), label: item.label, small: true }),
                        React.createElement("span", { className: "text-[11px] tabular-nums text-stone-500", dir: "ltr" },
                            Math.round(state.opacity * 100),
                            "%")),
                    React.createElement(TouchSlider, { className: "mt-2", min: 0, max: 1, step: 0.01, value: state.opacity, disabled: !state.enabled, onChange: (v) => onChangeLayer(item.id, { opacity: v }) })));
            })))))));
}
// ===== components/tabs/ElementsTab.jsx =====
function IconBtn({ children, onClick, active, title, disabled }) {
    return (React.createElement("button", { type: "button", title: title, disabled: disabled, onClick: (e) => {
            e.stopPropagation();
            onClick();
        }, className: `grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px] transition disabled:opacity-25 ${active ? 'text-gold-300' : 'text-stone-500 hover:bg-white/5 hover:text-stone-200'}` }, children));
}
function Row({ selected, onClick, thumb, label, sub, visible, locked, onToggleVisible, onToggleLock, extra }) {
    return (React.createElement("div", { role: "button", tabIndex: 0, onClick: onClick, className: `flex items-center gap-2 rounded-xl border px-2 py-1.5 transition ${selected ? 'border-gold-400/60 bg-gold-400/10' : 'border-transparent hover:bg-white/5'} ${visible ? '' : 'opacity-50'}` },
        React.createElement("div", { className: "grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-[conic-gradient(#1f1b16_25%,#15120f_0_50%,#1f1b16_0_75%,#15120f_0)] bg-[length:10px_10px] text-[13px] text-gold-300" }, thumb),
        React.createElement("div", { className: "min-w-0 flex-1" },
            React.createElement("div", { className: "truncate text-[12.5px] text-stone-200" }, label),
            sub && React.createElement("div", { className: "truncate text-[10.5px] text-stone-500" }, sub)),
        extra,
        React.createElement(IconBtn, { onClick: onToggleLock, active: locked, title: locked ? 'فك القفل' : 'قفل (يمنع التحريك)' }, locked ? '🔒' : '🔓'),
        React.createElement(IconBtn, { onClick: onToggleVisible, active: visible, title: visible ? 'إخفاء' : 'إظهار' }, visible ? '👁' : '◌')));
}
function ElementsTab({ texts, images, shapes = [], logo, selectedIds, onSelect, onChangeText, onChangeNode, onMoveImage, onRemoveImage, onDuplicate }) {
    const isSel = (id) => selectedIds.includes(id);
    const pick = (id, e) => onSelect(id, e?.shiftKey);
    const ordered = [...images].reverse(); // الأعلى أولاً
    return (React.createElement(React.Fragment, null,
        React.createElement(Section, { title: "\u0627\u0644\u0639\u0646\u0627\u0635\u0631", hint: "\u0627\u0636\u063A\u0637 \u0644\u0644\u062A\u062D\u062F\u064A\u062F \u00B7 \u0627\u0644\u0642\u0641\u0644 \u064A\u0645\u0646\u0639 \u0627\u0644\u062A\u062D\u0631\u064A\u0643 \u0628\u0627\u0644\u062E\u0637\u0623 \u00B7 \u0627\u0644\u0639\u064A\u0646 \u062A\u064F\u062E\u0641\u064A \u0627\u0644\u0639\u0646\u0635\u0631" },
            React.createElement("div", { className: "space-y-1" },
                React.createElement("div", { className: "px-1 pb-1 text-[11px] font-bold text-stone-500" }, "\u0627\u0644\u0646\u0635\u0648\u0635"),
                TEXT_SLOTS.filter((s) => texts[s.id]).map((slot) => {
                    const t = texts[slot.id];
                    const id = `text-${slot.id}`;
                    return (React.createElement(Row, { key: slot.id, selected: isSel(id), onClick: (e) => t.visible !== false && pick(id, e), thumb: React.createElement("span", { style: { fontFamily: `"${t.font}"`, color: t.color } }, "\u0623"), label: slot.label, sub: t.text.replace(/\n/g, ' · '), visible: t.visible !== false, locked: !!t.locked, onToggleVisible: () => onChangeText(slot.id, { visible: t.visible === false }), onToggleLock: () => onChangeText(slot.id, { locked: !t.locked }) }));
                }),
                logo && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "px-1 pb-1 pt-3 text-[11px] font-bold text-stone-500" }, "\u0627\u0644\u0634\u0639\u0627\u0631"),
                    React.createElement(Row, { selected: isSel('logo'), onClick: (e) => pick('logo', e), 
                        // eslint-disable-next-line @next/next/no-img-element
                        thumb: React.createElement("img", { src: logo.src, alt: "", className: "h-full w-full object-contain p-0.5" }), label: "\u0627\u0644\u0634\u0639\u0627\u0631", visible: logo.visible !== false, locked: !!logo.locked, onToggleVisible: () => onChangeNode('logo', { visible: logo.visible === false }), onToggleLock: () => onChangeNode('logo', { locked: !logo.locked }) }))),
                shapes.length > 0 && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "px-1 pb-1 pt-3 text-[11px] font-bold text-stone-500" },
                        "\u0627\u0644\u0632\u062E\u0627\u0631\u0641 (",
                        shapes.length,
                        ")"),
                    [...shapes].reverse().map((sh) => (React.createElement(Row, { key: sh.id, selected: isSel(sh.id), onClick: (e) => pick(sh.id, e), thumb: React.createElement("span", { style: { color: sh.fill && sh.fill !== 'rgba(0,0,0,0)' ? sh.fill : sh.stroke } }, "\u2724"), label: getShapeDef(sh.kind).label, sub: sh.behind ? 'خلف الصور' : 'أمام الصور', visible: sh.visible !== false, locked: !!sh.locked, onToggleVisible: () => onChangeNode(sh.id, { visible: sh.visible === false }), onToggleLock: () => onChangeNode(sh.id, { locked: !sh.locked }), extra: React.createElement(IconBtn, { onClick: () => onDuplicate([sh.id]), title: "\u062A\u0643\u0631\u0627\u0631" }, "\u29C9") }))))),
                React.createElement("div", { className: "px-1 pb-1 pt-3 text-[11px] font-bold text-stone-500" },
                    "\u0627\u0644\u0635\u0648\u0631 \u0648\u0627\u0644\u0639\u0646\u0627\u0635\u0631 (",
                    images.length,
                    ")"),
                ordered.length === 0 && React.createElement("p", { className: "px-1 text-[11px] text-stone-600" }, "\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0648\u0631 \u0628\u0639\u062F \u2014 \u0623\u0636\u0641\u0647\u0627 \u0645\u0646 \u062A\u0628\u0648\u064A\u0628 \u00AB\u0627\u0644\u0635\u0648\u0631\u00BB \u0623\u0648 \u00AB\u0627\u0644\u0645\u0643\u062A\u0628\u0629\u00BB."),
                ordered.map((img, i) => (React.createElement(Row, { key: img.id, selected: isSel(img.id), onClick: (e) => pick(img.id, e), 
                    // eslint-disable-next-line @next/next/no-img-element
                    thumb: React.createElement("img", { src: img.src, alt: "", className: "h-full w-full object-contain p-0.5" }), label: img.name, sub: img.backdrop?.shape && img.backdrop.shape !== 'none' ? 'مع شكل خلفي' : img.cutout ? 'شفافة' : 'صورة', visible: img.visible !== false, locked: !!img.locked, onToggleVisible: () => onChangeNode(img.id, { visible: img.visible === false }), onToggleLock: () => onChangeNode(img.id, { locked: !img.locked }), extra: React.createElement(React.Fragment, null,
                        React.createElement(IconBtn, { onClick: () => onMoveImage(img.id, 1), disabled: i === 0, title: "\u0644\u0644\u0623\u0645\u0627\u0645" }, "\u25B2"),
                        React.createElement(IconBtn, { onClick: () => onMoveImage(img.id, -1), disabled: i === ordered.length - 1, title: "\u0644\u0644\u062E\u0644\u0641" }, "\u25BC"),
                        React.createElement(IconBtn, { onClick: () => onDuplicate([img.id]), title: "\u062A\u0643\u0631\u0627\u0631" }, "\u29C9"),
                        React.createElement(IconBtn, { onClick: () => onRemoveImage(img.id), title: "\u062D\u0630\u0641" }, "\u2715")) })))))));
}
// ===== components/tabs/ShapesTab.jsx =====
function Preview({ kind, fill, stroke }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current)
            drawShapePreview(ref.current, kind, { fill, stroke });
    }, [kind, fill, stroke]);
    return React.createElement("canvas", { ref: ref, width: 120, height: 72, className: "h-[54px] w-full" });
}
const SWATCHES = ['#d4af6a', '#f0ede8', '#000000', '#b3121f', '#8a1c1c', '#2c7a5e', '#1e4f7a', '#5a34c4', '#c8102e', '#ffb347'];
function Swatches({ onPick }) {
    return (React.createElement("div", { className: "flex flex-wrap gap-1.5" }, SWATCHES.map((c) => (React.createElement("button", { key: c, type: "button", onClick: () => onPick(c), className: "h-6 w-6 rounded-full border border-white/20", style: { background: c } })))));
}
/** تبويب الزخارف: إضافة عناصر قابلة للتلوين + تحرير العنصر المحدد */
const FRAME_ICONS = { none: '∅', line: '▢', double: '⧈', gold: '✦', thick: '▣', inset: '▢', corners: '⌜', deco: '◫', islamic: '✶', dashed: '⬚', tactical: '⌖', hazard: '⚠', classified: '▤', film: '🎞' };
const TWO_COLOR_FRAMES = new Set(['hazard', 'classified', 'film']);
function FrameSection({ frame, onChange }) {
    const f = { ...DEFAULT_FRAME, ...(frame || {}) };
    const set = (patch) => onChange({ ...f, ...patch, fromTemplate: false });
    return (React.createElement(Section, { title: "\u0625\u0637\u0627\u0631 \u062D\u0648\u0644 \u0627\u0644\u062A\u0635\u0645\u064A\u0645", hint: "\u062D\u0627\u0641\u0629 \u062A\u062D\u064A\u0637 \u0628\u0627\u0644\u063A\u0644\u0627\u0641 \u0643\u0627\u0645\u0644\u0627\u064B \u2014 \u062A\u0638\u0647\u0631 \u0641\u0648\u0642 \u0643\u0644 \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0648\u0641\u064A \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0635\u062F\u0651\u0631\u0629" },
        React.createElement("div", { className: "grid grid-cols-4 gap-1.5" }, FRAME_STYLES.map((st) => (React.createElement("button", { key: st.id, type: "button", onClick: () => set({ style: st.id }), className: `rounded-lg border px-1 py-1.5 text-[10.5px] leading-tight ${f.style === st.id ? 'border-gold-400 bg-gold-400/15 text-gold-200' : 'border-white/10 bg-ink-900 text-stone-400'}` },
            React.createElement("span", { className: "block text-[16px] leading-none" }, FRAME_ICONS[st.id] || '▢'),
            React.createElement("span", { className: "mt-1 block truncate" }, st.label))))),
        f.style !== 'none' && (React.createElement("div", { className: "space-y-3" },
            React.createElement(ColorField, { label: TWO_COLOR_FRAMES.has(f.style) ? 'اللون الأول' : 'لون الإطار', value: f.color, onChange: (color) => set({ color }) }),
            React.createElement(Swatches, { onPick: (color) => set({ color }) }),
            TWO_COLOR_FRAMES.has(f.style) && React.createElement(ColorField, { label: "\u0627\u0644\u0644\u0648\u0646 \u0627\u0644\u062B\u0627\u0646\u064A", value: f.color2, onChange: (color2) => set({ color2 }) }),
            React.createElement(RangeField, { label: "\u0627\u0644\u0633\u0645\u0627\u0643\u0629", min: 1, max: 30, value: f.width, onChange: (width) => set({ width }), defaultValue: DEFAULT_FRAME.width }),
            React.createElement(RangeField, { label: "\u0627\u0644\u0628\u0639\u062F \u0639\u0646 \u0627\u0644\u062D\u0627\u0641\u0629", min: 0, max: 160, value: f.margin, onChange: (margin) => set({ margin }), defaultValue: DEFAULT_FRAME.margin }),
            React.createElement(RangeField, { label: "\u0627\u0644\u0634\u0641\u0627\u0641\u064A\u0629", min: 0.1, max: 1, step: 0.01, value: f.opacity, onChange: (opacity) => set({ opacity }), format: (v) => `${Math.round(v * 100)}%`, defaultValue: 1 })))));
}
function ShapesTab({ shapes, selectedId, onAddShape, onChangeShape, onRemoveShape, onDuplicate, focusSignal, frame, onChangeFrame }) {
    const [cat, setCat] = useState('lines');
    const selected = shapes.find((s) => s.id === selectedId);
    const editorRef = useRef(null);
    useEffect(() => {
        if (focusSignal && selected && editorRef.current)
            editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusSignal, selectedId]);
    const set = (patch) => selected && onChangeShape(selected.id, patch);
    const noFill = selected && (!selected.fill || selected.fill === TRANSPARENT);
    return (React.createElement(React.Fragment, null,
        selected && (React.createElement("div", { ref: editorRef, className: "scroll-mt-4" },
            React.createElement(Section, { title: "\u062A\u062D\u0631\u064A\u0631 \u0627\u0644\u0632\u062E\u0631\u0641\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629", hint: "\u0646\u0642\u0631\u062A\u0627\u0646 \u0639\u0644\u0649 \u0623\u064A \u0632\u062E\u0631\u0641\u0629 \u0641\u064A \u0627\u0644\u063A\u0644\u0627\u0641 \u062A\u0641\u062A\u062D \u062E\u0635\u0627\u0626\u0635\u0647\u0627 \u0647\u0646\u0627" },
                React.createElement("div", { className: "rounded-xl border border-white/5 bg-ink-900 p-2" },
                    React.createElement(Preview, { kind: selected.kind, fill: selected.fill, stroke: selected.stroke })),
                React.createElement(PropGroup, { id: "s-color", icon: "\u25D0", title: "\u0627\u0644\u0623\u0644\u0648\u0627\u0646 \u0648\u0627\u0644\u062D\u062F\u0651", defaultOpen: true, summary: noFill ? 'بدون تعبئة' : selected.fill },
                    React.createElement("div", { className: "flex items-center justify-between" },
                        React.createElement("span", { className: "text-[12px] text-stone-400" }, "\u0644\u0648\u0646 \u0627\u0644\u062A\u0639\u0628\u0626\u0629"),
                        React.createElement(Toggle, { checked: !noFill, onChange: (on) => set({ fill: on ? '#d4af6a' : TRANSPARENT }), label: noFill ? 'بدون' : '', small: true })),
                    !noFill && (React.createElement(React.Fragment, null,
                        React.createElement(ColorField, { label: "\u0627\u0644\u0644\u0648\u0646", value: selected.fill, onChange: (fill) => set({ fill }) }),
                        React.createElement(Swatches, { onPick: (fill) => set({ fill }) }))),
                    React.createElement(RangeField, { label: "\u0633\u0645\u0627\u0643\u0629 \u0627\u0644\u062D\u062F\u0651", min: 0, max: 30, step: 0.5, value: selected.strokeWidth, onChange: (strokeWidth) => set({ strokeWidth, stroke: selected.stroke === TRANSPARENT ? '#d4af6a' : selected.stroke }) }),
                    selected.strokeWidth > 0 && (React.createElement(React.Fragment, null,
                        React.createElement(ColorField, { label: "\u0644\u0648\u0646 \u0627\u0644\u062D\u062F\u0651", value: selected.stroke === TRANSPARENT ? '#d4af6a' : selected.stroke, onChange: (stroke) => set({ stroke }) }),
                        React.createElement(Swatches, { onPick: (stroke) => set({ stroke }) })))),
                React.createElement(PropGroup, { id: "s-size", icon: "\u2922", title: "\u0627\u0644\u062D\u062C\u0645 \u0648\u0627\u0644\u062F\u0648\u0631\u0627\u0646 \u0648\u0627\u0644\u0634\u0641\u0627\u0641\u064A\u0629", defaultOpen: true, summary: `${Math.round(selected.width)}×${Math.round(selected.height)}` },
                    React.createElement(RangeField, { label: "\u0627\u0644\u0639\u0631\u0636", min: 10, max: 1200, value: Math.round(selected.width), onChange: (width) => set({ width }) }),
                    React.createElement(RangeField, { label: "\u0627\u0644\u0627\u0631\u062A\u0641\u0627\u0639", min: 4, max: 1600, value: Math.round(selected.height), onChange: (height) => set({ height }) }),
                    React.createElement(RangeField, { label: "\u0627\u0644\u062A\u062F\u0648\u064A\u0631", min: -180, max: 180, value: Math.round(selected.rotation), onChange: (rotation) => set({ rotation }), format: (v) => `${v}°`, defaultValue: 0 }),
                    React.createElement(RangeField, { label: "\u0627\u0644\u0634\u0641\u0627\u0641\u064A\u0629", min: 0.05, max: 1, step: 0.01, value: selected.opacity, onChange: (opacity) => set({ opacity }), format: (v) => `${Math.round(v * 100)}%` })),
                React.createElement(Toggle, { checked: !!selected.shadow, onChange: (shadow) => set({ shadow }), label: "\u0638\u0644", small: true }),
                React.createElement(Toggle, { checked: !!selected.behind, onChange: (behind) => set({ behind }), label: "\u062E\u0644\u0641 \u0627\u0644\u0635\u0648\u0631", small: true }),
                React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                    React.createElement(Button, { onClick: () => set({ x: 500 }) }, "\u062A\u0648\u0633\u064A\u0637 \u0623\u0641\u0642\u064A"),
                    React.createElement(Button, { onClick: () => onDuplicate([selected.id]) }, "\u29C9 \u062A\u0643\u0631\u0627\u0631"),
                    React.createElement(Button, { variant: "danger", onClick: () => onRemoveShape(selected.id), className: "col-span-2" }, "\u062D\u0630\u0641 \u0627\u0644\u0632\u062E\u0631\u0641\u0629"))))),
        onChangeFrame && React.createElement(FrameSection, { frame: frame, onChange: onChangeFrame }),
        React.createElement(Section, { title: "\u0625\u0636\u0627\u0641\u0629 \u0632\u062E\u0631\u0641\u0629", hint: "\u062E\u0637\u0648\u0637 \u0648\u0641\u0648\u0627\u0635\u0644 \u0648\u0625\u0637\u0627\u0631\u0627\u062A \u0648\u0632\u0648\u0627\u064A\u0627 \u0648\u0623\u0634\u0643\u0627\u0644 \u0648\u0631\u0645\u0648\u0632 \u2014 \u0643\u0644\u0647\u0627 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062A\u0644\u0648\u064A\u0646 \u0648\u0627\u0644\u062A\u0645\u062F\u064A\u062F" },
            React.createElement("div", { className: "scroll-thin flex gap-1 overflow-x-auto pb-1" }, SHAPE_CATEGORIES.map((c) => (React.createElement("button", { key: c.id, type: "button", onClick: () => setCat(c.id), className: `shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[12px] transition ${cat === c.id ? 'bg-gold-400 font-bold text-ink-950' : 'border border-white/10 bg-ink-900 text-stone-400'}` }, c.label)))),
            React.createElement("div", { className: "grid grid-cols-3 gap-2" }, SHAPE_LIBRARY.filter((s) => s.cat === cat).map((s) => (React.createElement("button", { key: s.id, type: "button", onClick: () => onAddShape(s.id), className: "rounded-xl border border-white/10 bg-ink-900 p-1.5 transition hover:border-gold-500/50" },
                React.createElement(Preview, { kind: s.id }),
                React.createElement("div", { className: "mt-1 truncate text-[11px] text-stone-400" }, s.label))))))));
}
// ===== components/ControlPanel.jsx =====
const PANEL_TABS = [
    { id: 'templates', label: 'القوالب', icon: '★' },
    { id: 'typography', label: 'النصوص', icon: 'ت' },
    { id: 'compositing', label: 'الصور', icon: '◐' },
    { id: 'shapes', label: 'الزخارف', icon: '✤' },
    { id: 'library', label: 'المكتبة', icon: '✚' },
    { id: 'palettes', label: 'الخلفيات', icon: '▦' },
    { id: 'layers', label: 'المؤثرات', icon: '☄' },
    { id: 'logo', label: 'الشعار', icon: '◈' },
    { id: 'elements', label: 'العناصر', icon: '❏' },
];
function ControlPanel(props) {
    const [localTab] = useState('templates');
    const tab = props.activeTab || localTab;
    const current = PANEL_TABS.find((t) => t.id === tab);
    // على الهاتف: لوحة أسفل التصميم (التصميم يبقى ظاهراً في الأعلى) — على الحاسوب: مثبتة بجانبه
    return (React.createElement("aside", { className: `w-full shrink-0 flex-col border-t border-white/10 bg-ink-900 transition-[height] duration-200 lg:flex lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0 lg:border-white/5 ${props.open ? 'flex' : 'hidden'} ${props.tall ? 'h-[68%]' : 'h-[44%]'}` },
        React.createElement("div", { className: "flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-3 py-2 lg:px-4 lg:py-3" },
            React.createElement("div", { className: "flex items-center gap-2 text-[14px] font-bold text-gold-300 lg:text-[15px]" },
                React.createElement("span", null, current?.icon),
                current?.label),
            React.createElement("div", { className: "flex items-center gap-1 lg:hidden" },
                React.createElement("button", { type: "button", onClick: props.onToggleTall, className: "rounded-lg px-2.5 py-1 text-[12px] text-stone-400 hover:bg-white/5", title: "\u062A\u0643\u0628\u064A\u0631/\u062A\u0635\u063A\u064A\u0631 \u0627\u0644\u0644\u0648\u062D\u0629" }, props.tall ? '⬇ تصغير' : '⬆ تكبير'),
                React.createElement("button", { type: "button", onClick: props.onClose, className: "rounded-lg px-2.5 py-1 text-[12px] text-stone-400 hover:bg-white/5", title: "\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0644\u0648\u062D\u0629" }, "\u2715"))),
        React.createElement("div", { className: "scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-3 lg:p-4" },
            tab === 'elements' && (React.createElement(ElementsTab, { texts: props.texts, images: props.images, shapes: props.shapes, logo: props.logo, selectedIds: props.selectedIds, onSelect: props.onSelect, onChangeText: props.onChangeText, onChangeNode: props.onChangeNode, onMoveImage: props.onMoveImage, onRemoveImage: props.onRemoveImage, onDuplicate: props.onDuplicate })),
            tab === 'shapes' && (React.createElement(ShapesTab, { shapes: props.shapes, selectedId: props.selectedId, onAddShape: props.onAddShape, onChangeShape: props.onChangeNode, onRemoveShape: props.onRemoveShape, onDuplicate: props.onDuplicate, focusSignal: props.focusSignal, frame: props.frame, onChangeFrame: props.onChangeFrame })),
            tab === 'templates' && React.createElement(TemplatesTab, { onApplyTemplate: props.onApplyTemplate, activeTemplateId: props.activeTemplateId }),
            tab === 'typography' && (React.createElement(TypographyTab, { texts: props.texts, onChangeText: props.onChangeText, onSelect: props.onSelect, openSlot: props.openSlot, onOpenSlot: props.onOpenSlot, focusSignal: props.focusSignal })),
            tab === 'compositing' && (React.createElement(CompositingTab, { images: props.images, selectedId: props.selectedId, onSelect: props.onSelect, onAddImage: props.onAddImage, onChangeNode: props.onChangeNode, onRemoveImage: props.onRemoveImage, onMoveImage: props.onMoveImage, autoColors: props.autoColors, onToggleAutoColors: props.onToggleAutoColors, onSuggestColors: props.onSuggestColors, paletteLight: props.paletteLight, onOpenCutout: props.onOpenCutout, focusSignal: props.focusSignal })),
            tab === 'library' && React.createElement(LibraryTab, { onAddImage: props.onAddImage }),
            tab === 'palettes' && (React.createElement(PalettesTab, { paletteId: props.paletteId, customPalette: props.customPalette, onChangePalette: props.onChangePalette, background: props.background, onSetBackground: props.onSetBackground, onChangeBackground: props.onChangeBackground, onRemoveBackground: props.onRemoveBackground, onSuggestColors: props.onSuggestColors })),
            tab === 'layers' && (React.createElement(LayersTab, { layers: props.layers, onChangeLayer: props.onChangeLayer, onResetLayers: props.onResetLayers, textAboveLayers: props.textAboveLayers, onToggleTextAbove: props.onToggleTextAbove, grade: props.grade, onChangeGrade: props.onChangeGrade })),
            tab === 'logo' && (React.createElement(LogoTab, { logo: props.logo, onSetLogo: props.onSetLogo, onChangeNode: props.onChangeNode, onRemoveLogo: props.onRemoveLogo, onSelect: props.onSelect })))));
}
// ===== components/SideRail.jsx =====
function RailButton({ icon, label, onClick, active, disabled, gold, badge }) {
    return (React.createElement("button", { type: "button", onClick: onClick, disabled: disabled, title: label, className: `relative flex w-full shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] leading-tight transition disabled:opacity-25 ${gold
            ? 'bg-gold-400 font-bold text-ink-950 hover:bg-gold-300'
            : active
                ? 'bg-gold-400/15 text-gold-300'
                : 'text-stone-400 hover:bg-white/5 hover:text-stone-200'}` },
        React.createElement("span", { className: "text-[17px] leading-none" }, icon),
        React.createElement("span", { className: "w-full truncate px-0.5 text-center" }, label),
        badge > 0 && (React.createElement("span", { className: "absolute left-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold-500 px-1 text-[9px] font-bold text-ink-950" }, badge))));
}
/** العمود الجانبي الأيمن: تبويبات القوائم + الأوامر — بالطول لترك أكبر مساحة للتصميم */
function SideRail({ tab, panelOpen, onTab, layersCount, onWizard, onShuffle, onUndo, onRedo, canUndo, canRedo, onPreview, onMockup, onOpen, onSave, onExport, exporting, }) {
    return (React.createElement("nav", { className: "scroll-thin z-40 flex h-full w-16 shrink-0 flex-col items-center gap-1 overflow-y-auto border-l border-white/5 bg-ink-900 px-1.5 py-2" },
        React.createElement("div", { className: "mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 text-lg font-bold text-ink-950", title: "\u0627\u0633\u062A\u0648\u062F\u064A\u0648 \u0627\u0644\u0623\u063A\u0644\u0641\u0629 \u2014 \u062A\u0637\u0648\u064A\u0631 \u0623\u0628\u0648 \u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u0627\u0644\u0634\u0627\u0645\u064A" }, "\u063A"),
        PANEL_TABS.map((t) => (React.createElement(RailButton, { key: t.id, icon: t.icon, label: t.label, active: tab === t.id && panelOpen, badge: t.id === 'layers' ? layersCount : 0, onClick: () => onTab(t.id) }))),
        React.createElement("div", { className: "my-1 h-px w-8 shrink-0 bg-white/10" }),
        React.createElement(RailButton, { icon: "\u2726", label: "\u0627\u0644\u0645\u0639\u0627\u0644\u062C", onClick: onWizard }),
        React.createElement(RailButton, { icon: "\uD83C\uDFB2", label: "\u062A\u0635\u0645\u064A\u0645 \u0622\u062E\u0631", onClick: onShuffle }),
        React.createElement(RailButton, { icon: "\u21B6", label: "\u062A\u0631\u0627\u062C\u0639", onClick: onUndo, disabled: !canUndo }),
        React.createElement(RailButton, { icon: "\u21B7", label: "\u0625\u0639\u0627\u062F\u0629", onClick: onRedo, disabled: !canRedo }),
        React.createElement(RailButton, { icon: "\uD83D\uDC41", label: "\u0645\u0634\u0627\u0647\u062F\u0629", onClick: onPreview }),
        React.createElement(RailButton, { icon: "\uD83D\uDCD6", label: "\u0645\u062C\u0633\u0651\u0645", onClick: onMockup }),
        React.createElement(RailButton, { icon: "\uD83D\uDCC2", label: "\u0641\u062A\u062D", onClick: onOpen }),
        React.createElement(RailButton, { icon: "\uD83D\uDCBE", label: "\u062D\u0641\u0638", onClick: onSave }),
        React.createElement(RailButton, { icon: "\u2B07", label: exporting ? '…' : 'تحميل', onClick: onExport, gold: true, disabled: exporting })));
}
// ===== components/TopBar.jsx =====
const ALIGN = [
    { id: 'right', icon: '⇥', title: 'محاذاة لليمين' },
    { id: 'centerH', icon: '⇔', title: 'توسيط أفقي' },
    { id: 'left', icon: '⇤', title: 'محاذاة لليسار' },
    { id: 'top', icon: '⤒', title: 'محاذاة للأعلى' },
    { id: 'centerV', icon: '⇕', title: 'توسيط عمودي' },
    { id: 'bottom', icon: '⤓', title: 'محاذاة للأسفل' },
];
function Btn({ children, onClick, title, danger, active }) {
    return (React.createElement("button", { type: "button", title: title, onClick: onClick, className: `grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-1.5 text-[15px] transition ${danger ? 'text-red-300 hover:bg-red-950/60' : active ? 'bg-gold-400/20 text-gold-300' : 'text-stone-300 hover:bg-white/10 hover:text-gold-200'}` }, children));
}
const Sep = () => React.createElement("span", { className: "mx-0.5 h-5 w-px shrink-0 bg-white/10" });
/**
 * شريط رفيع أعلى مساحة التصميم (لا يغطي التصميم):
 * أدوات العنصر المحدد (محاذاة، أسهم تحريك، مغناطيس، تكرار، قفل، حذف) + التكبير.
 */
function TopBar({ count, label, onAlign, onNudge, onDuplicate, canDuplicate, onDelete, onLock, onDeselect, onOpenProps, snapping, onToggleSnapping, multiSelect, onToggleMulti, zoom, onZoom, }) {
    return (React.createElement("div", { className: "scroll-thin flex h-12 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-white/5 bg-ink-900/90 px-2" },
        count > 0 ? (React.createElement(React.Fragment, null,
            React.createElement("button", { type: "button", onClick: onOpenProps, className: "shrink-0 whitespace-nowrap rounded-lg bg-gold-400/10 px-2.5 py-1.5 text-[12px] text-gold-300", title: "\u0641\u062A\u062D \u0627\u0644\u062E\u0635\u0627\u0626\u0635" },
                "\u270E ",
                count > 1 ? `${count} عناصر` : label),
            React.createElement(Sep, null),
            ALIGN.map((a) => (React.createElement(Btn, { key: a.id, title: a.title, onClick: () => onAlign(a.id) }, a.icon))),
            React.createElement(Sep, null),
            React.createElement(Btn, { title: "\u062A\u062D\u0631\u064A\u0643 \u0644\u0644\u0623\u0639\u0644\u0649", onClick: () => onNudge(0, -4) }, "\u2191"),
            React.createElement(Btn, { title: "\u062A\u062D\u0631\u064A\u0643 \u0644\u0644\u0623\u0633\u0641\u0644", onClick: () => onNudge(0, 4) }, "\u2193"),
            React.createElement(Btn, { title: "\u062A\u062D\u0631\u064A\u0643 \u0644\u0644\u064A\u0645\u064A\u0646", onClick: () => onNudge(4, 0) }, "\u2192"),
            React.createElement(Btn, { title: "\u062A\u062D\u0631\u064A\u0643 \u0644\u0644\u064A\u0633\u0627\u0631", onClick: () => onNudge(-4, 0) }, "\u2190"),
            React.createElement(Sep, null),
            React.createElement(Btn, { title: snapping ? 'المحاذاة الذكية مفعّلة' : 'المحاذاة الذكية معطّلة', onClick: onToggleSnapping, active: snapping }, "\uD83E\uDDF2"),
            canDuplicate && React.createElement(Btn, { title: "\u062A\u0643\u0631\u0627\u0631", onClick: onDuplicate }, "\u29C9"),
            React.createElement(Btn, { title: "\u0642\u0641\u0644", onClick: onLock }, "\uD83D\uDD12"),
            React.createElement(Btn, { title: "\u062D\u0630\u0641 / \u0625\u062E\u0641\u0627\u0621", onClick: onDelete, danger: true }, "\uD83D\uDDD1"),
            React.createElement(Btn, { title: "\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u062D\u062F\u064A\u062F", onClick: onDeselect }, "\u2715"))) : (React.createElement(React.Fragment, null,
            React.createElement("span", { className: "shrink-0 whitespace-nowrap px-1 text-[11.5px] text-stone-500" }, "\u0627\u0636\u063A\u0637 \u0639\u0646\u0635\u0631\u0627\u064B \u0644\u062A\u062D\u062F\u064A\u062F\u0647 \u00B7 \u0646\u0642\u0631\u062A\u0627\u0646 \u0644\u062E\u0635\u0627\u0626\u0635\u0647"),
            React.createElement(Btn, { title: snapping ? 'المحاذاة الذكية مفعّلة' : 'المحاذاة الذكية معطّلة', onClick: onToggleSnapping, active: snapping }, "\uD83E\uDDF2"))),
        React.createElement(Btn, { title: "\u062A\u062D\u062F\u064A\u062F \u0645\u062A\u0639\u062F\u062F \u0628\u0627\u0644\u0644\u0645\u0633", onClick: onToggleMulti, active: multiSelect }, "\u29C8"),
        React.createElement("div", { className: "mr-auto flex shrink-0 items-center gap-0.5 pr-2" },
            React.createElement(Btn, { title: "\u062A\u0635\u063A\u064A\u0631", onClick: () => onZoom(-1) }, "\u2212"),
            React.createElement("button", { type: "button", onClick: () => onZoom(0), className: "w-12 shrink-0 text-center text-[12px] tabular-nums text-stone-300", dir: "ltr", title: "\u0645\u0644\u0627\u0621\u0645\u0629" },
                Math.round(zoom * 100),
                "%"),
            React.createElement(Btn, { title: "\u062A\u0643\u0628\u064A\u0631", onClick: () => onZoom(1) }, "+"))));
}
// ===== components/QuickBar.jsx =====
const QB_SELECT = 'h-8 shrink-0 rounded-lg border border-white/10 bg-ink-950 px-2 text-[12px] text-stone-200 outline-none focus:border-gold-500/60';
function QbLabel({ children }) {
    return React.createElement("span", { className: "shrink-0 text-[10.5px] text-stone-500" }, children);
}
/**
 * شريط سريع رفيع أسفل شريط الأدوات (لا يغطي التصميم):
 * للنص: الخط، الحجم، اللون، التأثير، الظل.  للصورة/الزخرفة: الحجم والشفافية.
 */
function QuickBar({ kind, value, onChange }) {
    if (!value)
        return null;
    if (kind === 'text') {
        const size = value.size || 40;
        const stepSize = (dir) => onChange({ size: Math.max(12, Math.min(260, size + dir * 2)) });
        return (React.createElement("div", { className: "scroll-thin flex h-11 shrink-0 items-center gap-2 overflow-x-auto border-b border-white/5 bg-ink-800/80 px-2" },
            React.createElement("select", { className: `${QB_SELECT} max-w-[128px]`, value: value.font, onChange: (e) => onChange({ font: e.target.value, weight: closestWeight(e.target.value, value.weight) }), style: { fontFamily: `"${value.font}"` } }, ARABIC_FONTS.map((f) => (React.createElement("option", { key: f.family, value: f.family }, f.label)))),
            React.createElement("div", { className: "flex shrink-0 items-center gap-1" },
                React.createElement(StepButton, { dir: -1, onStep: stepSize, disabled: size <= 12 }),
                React.createElement("span", { className: "w-9 text-center text-[12px] tabular-nums text-stone-200", dir: "ltr" }, size),
                React.createElement(StepButton, { dir: 1, onStep: stepSize, disabled: size >= 260 })),
            React.createElement("label", { className: "flex shrink-0 items-center gap-1.5" },
                React.createElement(QbLabel, null, "\u0644\u0648\u0646"),
                React.createElement("input", { type: "color", className: "h-7 w-7 cursor-pointer rounded-md border border-white/15 bg-transparent p-0", value: value.color, onChange: (e) => onChange({ color: e.target.value }) })),
            React.createElement("select", { className: QB_SELECT, value: value.effect || 'none', onChange: (e) => onChange({ effect: e.target.value }) }, TEXT_EFFECTS.map((fx) => (React.createElement("option", { key: fx.id, value: fx.id },
                "\u2726 ",
                fx.label)))),
            React.createElement("button", { type: "button", onClick: () => onChange({ shadow: !value.shadow }), className: `h-8 shrink-0 rounded-lg px-2.5 text-[12px] ${value.shadow ? 'bg-gold-400/20 text-gold-200' : 'border border-white/10 text-stone-400'}` }, "\u0638\u0644")));
    }
    // صورة / زخرفة / شعار
    const isShape = kind === 'shape';
    const scale = value.scale ?? 1;
    const opacity = value.opacity ?? 1;
    const stepScale = (dir) => {
        if (isShape) {
            const f = dir > 0 ? 1.05 : 1 / 1.05;
            onChange({ width: Math.max(10, value.width * f), height: Math.max(4, value.height * f) });
        }
        else
            onChange({ scale: Math.max(0.1, Math.min(3, Math.round((scale + dir * 0.03) * 100) / 100)) });
    };
    const stepOpacity = (dir) => onChange({ opacity: Math.max(0.05, Math.min(1, Math.round((opacity + dir * 0.05) * 100) / 100)) });
    return (React.createElement("div", { className: "scroll-thin flex h-11 shrink-0 items-center gap-3 overflow-x-auto border-b border-white/5 bg-ink-800/80 px-2" },
        React.createElement("div", { className: "flex shrink-0 items-center gap-1" },
            React.createElement(QbLabel, null, "\u0627\u0644\u062D\u062C\u0645"),
            React.createElement(StepButton, { dir: -1, onStep: stepScale }),
            !isShape && React.createElement("span", { className: "w-10 text-center text-[12px] tabular-nums text-stone-200", dir: "ltr" },
                Math.round(scale * 100),
                "%"),
            React.createElement(StepButton, { dir: 1, onStep: stepScale })),
        React.createElement("div", { className: "flex shrink-0 items-center gap-1" },
            React.createElement(QbLabel, null, "\u0627\u0644\u0634\u0641\u0627\u0641\u064A\u0629"),
            React.createElement(StepButton, { dir: -1, onStep: stepOpacity, disabled: opacity <= 0.05 }),
            React.createElement("span", { className: "w-10 text-center text-[12px] tabular-nums text-stone-200", dir: "ltr" },
                Math.round(opacity * 100),
                "%"),
            React.createElement(StepButton, { dir: 1, onStep: stepOpacity, disabled: opacity >= 1 })),
        React.createElement("button", { type: "button", onClick: () => onChange({ rotation: 0 }), className: "h-8 shrink-0 rounded-lg border border-white/10 px-2.5 text-[12px] text-stone-400" }, "\u062A\u0635\u0641\u064A\u0631 \u0627\u0644\u062F\u0648\u0631\u0627\u0646"),
        isShape && (React.createElement("label", { className: "flex shrink-0 items-center gap-1.5" },
            React.createElement(QbLabel, null, "\u0644\u0648\u0646"),
            React.createElement("input", { type: "color", className: "h-7 w-7 cursor-pointer rounded-md border border-white/15 bg-transparent p-0", value: value.fill && value.fill.startsWith('#') ? value.fill : '#d4af6a', onChange: (e) => onChange({ fill: e.target.value }) })))));
}
// ===== components/QuickWizard.jsx =====
/**
 * معالج الغلاف السريع: العنوان + المؤلف + النوع (+ صورة / خلفية AI اختيارية)
 * ← يصمّم الغلاف كاملاً بنقرة واحدة.
 */
function QuickWizard({ onRun, onClose }) {
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [category, setCategory] = useState('horror');
    const [file, setFile] = useState(null);
    const [removeBg, setRemoveBg] = useState(true);
    const [useAI, setUseAI] = useState(false);
    const [aiPrompt, setAiPrompt] = useState(AI_PRESETS[0].prompt);
    const [progress, setProgress] = useState(null);
    const busy = !!progress;
    const run = async () => {
        setProgress({ label: 'جارٍ التصميم…', percent: 5 });
        try {
            await onRun({ title: title.trim(), author: author.trim(), category, file, removeBg, aiPrompt: useAI ? aiPrompt : '' }, (label, percent) => setProgress({ label, percent: percent ?? 50 }));
            onClose();
        }
        catch (err) {
            setProgress(null);
            alert(err?.message || 'حدث خطأ');
        }
    };
    const input = 'w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-[15px] text-stone-100 outline-none placeholder:text-stone-600 focus:border-gold-500/60';
    return (React.createElement("div", { className: "fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" },
        React.createElement("div", { className: "scroll-thin max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-gold-500/20 bg-ink-900 p-6 shadow-2xl" },
            React.createElement("div", { className: "mb-5 flex items-start justify-between gap-4" },
                React.createElement("div", null,
                    React.createElement("h2", { className: "text-xl font-bold text-gold-300" }, "\u2726 \u0627\u0644\u0645\u0639\u0627\u0644\u062C \u0627\u0644\u0633\u0631\u064A\u0639"),
                    React.createElement("p", { className: "mt-1 text-[13px] text-stone-400" }, "\u0627\u0643\u062A\u0628 \u0628\u064A\u0627\u0646\u0627\u062A \u0643\u062A\u0627\u0628\u0643 \u0648\u0627\u062E\u062A\u0631 \u0646\u0648\u0639\u0647\u060C \u0648\u0633\u0646\u0635\u0645\u0651\u0645 \u0627\u0644\u063A\u0644\u0627\u0641 \u0644\u0643 \u2014 \u062B\u0645 \u0639\u062F\u0651\u0644 \u0645\u0627 \u062A\u0634\u0627\u0621.")),
                !busy && (React.createElement("button", { type: "button", onClick: onClose, className: "rounded-lg px-2 py-1 text-stone-500 hover:bg-white/5 hover:text-stone-200" }, "\u2715"))),
            React.createElement("div", { className: "space-y-4" },
                React.createElement("label", { className: "block" },
                    React.createElement("span", { className: "mb-1.5 block text-[12px] text-stone-400" }, "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0643\u062A\u0627\u0628"),
                    React.createElement("input", { className: input, value: title, onChange: (e) => setTitle(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u0638\u0644\u0627\u0644 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0623\u062E\u064A\u0631\u0629", autoFocus: true })),
                React.createElement("label", { className: "block" },
                    React.createElement("span", { className: "mb-1.5 block text-[12px] text-stone-400" }, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0624\u0644\u0641 \u0623\u0648 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0641\u0631\u0639\u064A"),
                    React.createElement("input", { className: input, value: author, onChange: (e) => setAuthor(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u0631\u0648\u0627\u064A\u0629 \u2014 \u0623\u062D\u0645\u062F \u0645\u062D\u0645\u062F" })),
                React.createElement("div", null,
                    React.createElement("span", { className: "mb-1.5 block text-[12px] text-stone-400" }, "\u0646\u0648\u0639 \u0627\u0644\u0643\u062A\u0627\u0628"),
                    React.createElement("div", { className: "grid grid-cols-3 gap-2" }, TEMPLATE_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (React.createElement("button", { key: c.id, type: "button", onClick: () => setCategory(c.id), className: `rounded-xl py-2.5 text-[13px] transition ${category === c.id ? 'bg-gold-400 font-bold text-ink-950' : 'border border-white/10 bg-ink-800 text-stone-300 hover:border-gold-500/40'}` }, c.label))))),
                React.createElement("div", { className: "rounded-2xl border border-white/5 bg-ink-800/60 p-4" },
                    React.createElement("span", { className: "mb-2 block text-[12px] text-stone-400" }, "\u0635\u0648\u0631\u0629 \u0631\u0626\u064A\u0633\u064A\u0629 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A) \u2014 \u0634\u062E\u0635 \u0623\u0648 \u0639\u0646\u0635\u0631"),
                    React.createElement("label", { className: "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gold-600/40 px-4 py-3 hover:border-gold-400" },
                        React.createElement("span", { className: "text-lg text-gold-300" }, "\uFF0B"),
                        React.createElement("span", { className: "truncate text-[13px] text-stone-300" }, file ? file.name : 'اختر صورة'),
                        React.createElement("input", { type: "file", accept: "image/*", hidden: true, onChange: (e) => setFile(e.target.files?.[0] || null) })),
                    file && (React.createElement("div", { className: "mt-3" },
                        React.createElement(Toggle, { checked: removeBg, onChange: setRemoveBg, label: "\u0625\u0632\u0627\u0644\u0629 \u062E\u0644\u0641\u064A\u0629 \u0627\u0644\u0635\u0648\u0631\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B", small: true })))),
                React.createElement("div", { className: "rounded-2xl border border-white/5 bg-ink-800/60 p-4" },
                    React.createElement(Toggle, { checked: useAI, onChange: setUseAI, label: "\u062A\u0648\u0644\u064A\u062F \u062E\u0644\u0641\u064A\u0629 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)", small: true }),
                    useAI && (React.createElement("div", { className: "mt-3 space-y-2" },
                        React.createElement("select", { value: aiPrompt, onChange: (e) => setAiPrompt(e.target.value), className: "w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-stone-200 outline-none" }, AI_PRESETS.map((p) => (React.createElement("option", { key: p.label, value: p.prompt }, p.label)))),
                        React.createElement("p", { className: "text-[11px] text-stone-500" }, "\u064A\u0633\u062A\u063A\u0631\u0642 15\u201360 \u062B\u0627\u0646\u064A\u0629 \u0648\u064A\u062D\u062A\u0627\u062C \u0625\u0646\u062A\u0631\u0646\u062A.")))),
                busy ? (React.createElement(ProgressBar, { percent: progress.percent, label: progress.label })) : (React.createElement("button", { type: "button", onClick: run, className: "w-full rounded-2xl bg-gradient-to-l from-gold-300 to-gold-500 py-3.5 text-[15px] font-bold text-ink-950 shadow-[0_10px_40px_rgba(212,175,106,.3)] transition hover:brightness-110" }, "\u0635\u0645\u0651\u0645 \u0627\u0644\u063A\u0644\u0627\u0641")),
                !busy && (React.createElement("button", { type: "button", onClick: onClose, className: "w-full text-[12px] text-stone-500 hover:text-stone-300" }, "\u062A\u062E\u0637\u064E\u0651 \u0648\u0627\u0628\u062F\u0623 \u0628\u063A\u0644\u0627\u0641 \u0641\u0627\u0631\u063A"))))));
}
// ===== components/CutoutEditor.jsx =====
const PREVIEW_MAX = 1000;
const UNDO_LIMIT = 10;
const BACKDROPS = [
    { id: 'checker', label: 'شفاف' },
    { id: '#000000', label: 'أسود' },
    { id: '#ffffff', label: 'أبيض' },
    { id: '#c8102e', label: 'أحمر' },
    { id: '#1e6bd6', label: 'أزرق' },
];
/**
 * محرر القص اليدوي: فرشاة ممحاة/استعادة + تحسين الحواف + إعادة الكشف بدقة عالية.
 * يحفظ: الصورة المفرّغة + القناع (لإعادة التحرير لاحقاً).
 */
function CutoutEditor({ item, onSave, onClose }) {
    const viewRef = useRef(null);
    const work = useRef({ original: null, base: null, edits: null, prevOriginal: null, scale: 1 });
    const undoStack = useRef([]);
    const drawing = useRef(null);
    const raf = useRef(0);
    const [status, setStatus] = useState({ loading: true, label: 'تحميل الصورة…', percent: 0, error: null });
    const [params, setParams] = useState({ ...DEFAULT_REFINE, ...(item.cutParams || {}) });
    const [tool, setTool] = useState('erase');
    const [brush, setBrush] = useState(40);
    const [softness, setSoftness] = useState(0.5);
    const [backdrop, setBackdrop] = useState('checker');
    const [showMask, setShowMask] = useState(false);
    const [undoCount, setUndoCount] = useState(0);
    const [saving, setSaving] = useState(false);
    const [cursor, setCursor] = useState(null);
    // ── رسم المعاينة (مخفّضة الدقة لسرعة الاستجابة) ──
    const render = useCallback(() => {
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() => {
            const w = work.current;
            const view = viewRef.current;
            if (!w.original || !view)
                return;
            const pw = w.prevOriginal.width, ph = w.prevOriginal.height;
            if (view.width !== pw)
                view.width = pw;
            if (view.height !== ph)
                view.height = ph;
            const ctx = view.getContext('2d');
            ctx.clearRect(0, 0, pw, ph);
            const mask = combineMask(w.base, w.edits, pw, ph);
            if (showMask) {
                ctx.drawImage(mask, 0, 0);
                return;
            }
            ctx.drawImage(refineCutout(w.prevOriginal, mask, params, w.scale), 0, 0);
        });
    }, [params, showMask]);
    useEffect(() => {
        render();
    }, [render]);
    const setupFrom = (original, base) => {
        const scale = Math.min(1, PREVIEW_MAX / Math.max(original.width, original.height));
        work.current = {
            original,
            base,
            edits: makeCanvas(original.width, original.height),
            prevOriginal: toWorkCanvas(original, Math.max(original.width, original.height) * scale),
            scale,
        };
        undoStack.current = [];
        setUndoCount(0);
    };
    const runAI = async (quality) => {
        setStatus({ loading: true, label: 'تحميل محرك التفريغ…', percent: 0, error: null });
        try {
            const { original, mask } = await aiMask(item.originalSrc || item.src, (p) => setStatus((s) => ({ ...s, label: p.label, percent: p.percent })), quality);
            setupFrom(original, mask);
            setStatus({ loading: false, label: '', percent: 100, error: null });
            render();
        }
        catch (err) {
            setStatus({ loading: false, label: '', percent: 0, error: err?.message || 'تعذّر الكشف' });
        }
    };
    // ── التحميل الأولي ──
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                if (item.maskSrc) {
                    const original = toWorkCanvas(await loadImage(item.originalSrc || item.src));
                    const maskImg = await loadImage(item.maskSrc);
                    const base = makeCanvas(original.width, original.height);
                    base.getContext('2d').drawImage(maskImg, 0, 0, base.width, base.height);
                    if (!alive)
                        return;
                    setupFrom(original, base);
                    setStatus({ loading: false, label: '', percent: 100, error: null });
                    render();
                }
                else if (item.cutout && !item.originalSrc) {
                    // لدينا الصورة المفرّغة فقط (من المكتبة مثلاً) — نستخدم شفافيتها كقناع
                    const img = await loadImage(item.src);
                    const original = toWorkCanvas(img);
                    if (!alive)
                        return;
                    setupFrom(original, alphaToMask(original, original.width, original.height));
                    setStatus({ loading: false, label: '', percent: 100, error: null });
                    render();
                }
                else {
                    await runAI(getCutQuality());
                }
            }
            catch (err) {
                if (alive)
                    setStatus({ loading: false, label: '', percent: 0, error: err?.message || 'تعذّر تحميل الصورة' });
            }
        })();
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // ── الفرشاة ──
    const toWork = (e) => {
        const rect = viewRef.current.getBoundingClientRect();
        const w = work.current.original;
        return {
            x: ((e.clientX - rect.left) / rect.width) * w.width,
            y: ((e.clientY - rect.top) / rect.height) * w.height,
            ratio: w.width / rect.width,
        };
    };
    const stamp = (x, y, radius) => {
        const ctx = work.current.edits.getContext('2d');
        const color = tool === 'erase' ? '0,0,0' : '255,255,255';
        const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
        g.addColorStop(0, `rgba(${color},1)`);
        g.addColorStop(Math.max(0.01, 1 - softness), `rgba(${color},1)`);
        g.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    };
    const onPointerDown = (e) => {
        if (status.loading || !work.current.edits)
            return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const ed = work.current.edits;
        undoStack.current.push(ed.getContext('2d').getImageData(0, 0, ed.width, ed.height));
        if (undoStack.current.length > UNDO_LIMIT)
            undoStack.current.shift();
        setUndoCount(undoStack.current.length);
        const p = toWork(e);
        drawing.current = p;
        stamp(p.x, p.y, (brush / 2) * p.ratio);
        render();
    };
    const onPointerMove = (e) => {
        const rect = viewRef.current?.getBoundingClientRect();
        if (rect)
            setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        if (!drawing.current)
            return;
        const p = toWork(e);
        const last = drawing.current;
        const radius = (brush / 2) * p.ratio;
        const dist = Math.hypot(p.x - last.x, p.y - last.y);
        const steps = Math.max(1, Math.ceil(dist / (radius * 0.3)));
        for (let i = 1; i <= steps; i++)
            stamp(last.x + ((p.x - last.x) * i) / steps, last.y + ((p.y - last.y) * i) / steps, radius);
        drawing.current = p;
        render();
    };
    const onPointerUp = () => {
        drawing.current = null;
    };
    const undo = () => {
        const snap = undoStack.current.pop();
        if (!snap)
            return;
        work.current.edits.getContext('2d').putImageData(snap, 0, 0);
        setUndoCount(undoStack.current.length);
        render();
    };
    const clearEdits = () => {
        const ed = work.current.edits;
        if (!ed)
            return;
        undoStack.current.push(ed.getContext('2d').getImageData(0, 0, ed.width, ed.height));
        ed.getContext('2d').clearRect(0, 0, ed.width, ed.height);
        setUndoCount(undoStack.current.length);
        render();
    };
    const save = async () => {
        setSaving(true);
        try {
            const w = work.current;
            const mask = combineMask(w.base, w.edits);
            const out = refineCutout(w.original, mask, params, 1);
            const blob = await trimTransparent(await canvasToBlob(out));
            const maskBlob = await canvasToBlob(mask);
            onSave({ src: URL.createObjectURL(blob), maskSrc: URL.createObjectURL(maskBlob), cutParams: params, cutout: true });
        }
        finally {
            setSaving(false);
        }
    };
    const checker = 'conic-gradient(#2a2622 25%, #1b1815 0 50%, #2a2622 0 75%, #1b1815 0) 0 0 / 22px 22px';
    const setP = (patch) => setParams((p) => ({ ...p, ...patch }));
    return (React.createElement("div", { className: "fixed inset-0 z-50 flex flex-col-reverse bg-black/85 backdrop-blur-sm lg:flex-row" },
        React.createElement("aside", { className: "scroll-thin flex h-[48%] w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-white/10 bg-ink-900 p-4 lg:h-auto lg:w-[330px] lg:border-l lg:border-t-0 lg:p-5" },
            React.createElement("div", null,
                React.createElement("h2", { className: "text-lg font-bold text-gold-300" }, "\u2702 \u0645\u062D\u0631\u0631 \u0627\u0644\u0642\u0635"),
                React.createElement("p", { className: "mt-1 text-[12px] leading-relaxed text-stone-400" }, "\u0627\u0645\u0633\u062D \u0645\u0627 \u062A\u0628\u0642\u0651\u0649 \u0645\u0646 \u0627\u0644\u062E\u0644\u0641\u064A\u0629 \u0628\u0627\u0644\u0645\u0645\u062D\u0627\u0629\u060C \u0648\u0627\u0633\u062A\u0631\u062C\u0639 \u0645\u0627 \u062D\u064F\u0630\u0641 \u062E\u0637\u0623\u064B \u0628\u0623\u062F\u0627\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629.")),
            React.createElement("div", { className: "grid grid-cols-2 gap-2" }, [['erase', '⌫ ممحاة'], ['restore', '🖌 استعادة']].map(([id, label]) => (React.createElement("button", { key: id, type: "button", onClick: () => setTool(id), className: `rounded-xl py-2.5 text-[13px] transition ${tool === id ? 'bg-gold-400 font-bold text-ink-950' : 'border border-white/10 bg-ink-800 text-stone-300'}` }, label)))),
            React.createElement(RangeField, { label: "\u062D\u062C\u0645 \u0627\u0644\u0641\u0631\u0634\u0627\u0629", min: 4, max: 300, value: brush, onChange: setBrush, format: (v) => `${v}px` }),
            React.createElement(RangeField, { label: "\u0646\u0639\u0648\u0645\u0629 \u0627\u0644\u0641\u0631\u0634\u0627\u0629", min: 0, max: 0.95, step: 0.01, value: softness, onChange: setSoftness, format: (v) => `${Math.round(v * 100)}%` }),
            React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                React.createElement("button", { type: "button", onClick: undo, disabled: !undoCount, className: "rounded-xl border border-white/10 bg-ink-800 py-2 text-[12px] text-stone-300 disabled:opacity-30" },
                    "\u21B6 \u062A\u0631\u0627\u062C\u0639 (",
                    undoCount,
                    ")"),
                React.createElement("button", { type: "button", onClick: clearEdits, className: "rounded-xl border border-white/10 bg-ink-800 py-2 text-[12px] text-stone-300" }, "\u0645\u0633\u062D \u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0627\u0644\u0641\u0631\u0634\u0627\u0629")),
            React.createElement("div", { className: "space-y-3 rounded-2xl border border-white/5 bg-ink-800/60 p-3" },
                React.createElement("div", { className: "text-[12px] font-bold text-stone-300" }, "\u062A\u062D\u0633\u064A\u0646 \u0627\u0644\u062D\u0648\u0627\u0641"),
                React.createElement(RangeField, { label: "\u062D\u062F\u0651\u0629 \u0627\u0644\u062D\u0648\u0627\u0641", min: 0, max: 1, step: 0.01, value: params.hardness, onChange: (hardness) => setP({ hardness }), format: (v) => `${Math.round(v * 100)}%` }),
                React.createElement(RangeField, { label: "\u062A\u0642\u0644\u064A\u0635 \u0627\u0644\u062D\u0648\u0627\u0641 (\u064A\u0632\u064A\u0644 \u0627\u0644\u0647\u0627\u0644\u0629)", min: 0, max: 8, step: 0.1, value: params.shrink, onChange: (shrink) => setP({ shrink }), format: (v) => `${v.toFixed(1)}px` }),
                React.createElement(RangeField, { label: "\u062A\u0646\u0639\u064A\u0645 \u0627\u0644\u062D\u0627\u0641\u0629", min: 0, max: 6, step: 0.1, value: params.feather, onChange: (feather) => setP({ feather }), format: (v) => `${v.toFixed(1)}px` }),
                React.createElement(Toggle, { checked: params.decontaminate, onChange: (decontaminate) => setP({ decontaminate }), label: "\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0647\u0627\u0644\u0629 \u0627\u0644\u0644\u0648\u0646\u064A\u0629 \u062D\u0648\u0644 \u0627\u0644\u0634\u0639\u0631 \u0648\u0627\u0644\u062D\u0648\u0627\u0641", small: true }),
                React.createElement("button", { type: "button", onClick: () => setParams({ ...DEFAULT_REFINE }), className: "text-[11px] text-stone-500 hover:text-stone-300" }, "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0642\u064A\u0645 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629")),
            React.createElement("div", { className: "space-y-2 rounded-2xl border border-white/5 bg-ink-800/60 p-3" },
                React.createElement("div", { className: "text-[12px] font-bold text-stone-300" }, "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0643\u0634\u0641 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A"),
                React.createElement("div", { className: "grid grid-cols-3 gap-1.5" }, QUALITY_MODES.map((q) => (React.createElement("button", { key: q.id, type: "button", disabled: status.loading, onClick: () => {
                        setCutQuality(q.id);
                        runAI(q.id);
                    }, className: "rounded-lg border border-white/10 bg-ink-900 py-2 text-[11.5px] text-stone-300 hover:border-gold-500/50 disabled:opacity-30" }, q.label)))),
                React.createElement("p", { className: "text-[10.5px] text-stone-500" }, "\u064A\u064F\u0644\u063A\u064A \u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0627\u0644\u0641\u0631\u0634\u0627\u0629 \u0648\u064A\u0639\u064A\u062F \u0627\u0644\u0643\u0634\u0641 \u0645\u0646 \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0623\u0635\u0644\u064A\u0629.")),
            React.createElement("div", { className: "space-y-2" },
                React.createElement("div", { className: "text-[12px] text-stone-400" }, "\u062E\u0644\u0641\u064A\u0629 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629"),
                React.createElement("div", { className: "flex flex-wrap gap-1.5" }, BACKDROPS.map((b) => (React.createElement("button", { key: b.id, type: "button", onClick: () => setBackdrop(b.id), className: `rounded-lg px-2.5 py-1 text-[11px] ${backdrop === b.id ? 'bg-gold-400 text-ink-950' : 'border border-white/10 text-stone-400'}` }, b.label)))),
                React.createElement(Toggle, { checked: showMask, onChange: setShowMask, label: "\u0639\u0631\u0636 \u0627\u0644\u0642\u0646\u0627\u0639 (\u0623\u0628\u064A\u0636 = \u064A\u0628\u0642\u0649)", small: true })),
            React.createElement("div", { className: "mt-auto grid grid-cols-2 gap-2 pt-2" },
                React.createElement("button", { type: "button", onClick: save, disabled: status.loading || saving || !!status.error, className: "rounded-xl bg-gold-400 py-3 text-[14px] font-bold text-ink-950 hover:bg-gold-300 disabled:opacity-40" }, saving ? 'جارٍ الحفظ…' : '✓ حفظ القص'),
                React.createElement("button", { type: "button", onClick: onClose, className: "rounded-xl border border-white/10 py-3 text-[14px] text-stone-300 hover:bg-white/5" }, "\u0625\u0644\u063A\u0627\u0621"))),
        React.createElement("main", { className: "relative grid min-h-0 min-w-0 flex-1 place-items-center p-3 lg:p-6" },
            status.loading && (React.createElement("div", { className: "w-80 rounded-2xl border border-white/10 bg-ink-900 p-5" },
                React.createElement(ProgressBar, { percent: status.percent, label: status.label }))),
            status.error && React.createElement("div", { className: "rounded-2xl border border-red-900/50 bg-red-950/40 p-5 text-red-200" }, status.error),
            React.createElement("div", { className: `relative max-h-full max-w-full ${status.loading || status.error ? 'hidden' : ''}`, style: { background: backdrop === 'checker' ? checker : backdrop, lineHeight: 0 } },
                React.createElement("canvas", { ref: viewRef, className: "block max-h-[calc(52dvh-24px)] max-w-full touch-none lg:max-h-[calc(100vh-48px)]", style: { cursor: 'none' }, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerLeave: () => {
                        onPointerUp();
                        setCursor(null);
                    } }),
                cursor && work.current.original && (React.createElement("div", { className: "pointer-events-none absolute rounded-full border-2", style: {
                        left: cursor.x,
                        top: cursor.y,
                        width: brush,
                        height: brush,
                        transform: 'translate(-50%, -50%)',
                        borderColor: tool === 'erase' ? '#ff4d6d' : '#4dffa6',
                        boxShadow: '0 0 0 1px rgba(0,0,0,.6)',
                    } }))))));
}
// ===== components/MockupStudio.jsx =====
function Chip({ active, onClick, children }) {
    return (React.createElement("button", { type: "button", onClick: onClick, className: `shrink-0 rounded-xl border px-3 py-2 text-[12px] ${active ? 'border-gold-400 bg-gold-400/15 font-bold text-gold-200' : 'border-white/10 bg-ink-900 text-stone-300'}` }, children));
}
/** شاشة المجسّمات: كتاب قائم، كتاب مسطّح، مجلة مفتوحة، دفتر — مع تحميل PNG */
function MockupStudio({ cover, title, onClose, onDone }) {
    const hostRef = useRef(null);
    const [kind, setKind] = useState('book3d');
    const [backdrop, setBackdrop] = useState('studio');
    const [angle, setAngle] = useState(28);
    const [spread, setSpread] = useState(false);
    const [band, setBand] = useState(true);
    const [busy, setBusy] = useState(false);
    const outRef = useRef(null);
    useEffect(() => {
        if (!cover)
            return;
        const id = requestAnimationFrame(() => {
            const c = renderMockup(cover, { kind, backdrop, angle, spread, band, title });
            outRef.current = c;
            const host = hostRef.current;
            if (!host)
                return;
            c.style.maxWidth = '100%';
            c.style.maxHeight = '100%';
            c.style.width = 'auto';
            c.style.height = 'auto';
            c.style.borderRadius = '12px';
            if (backdrop === 'transparent')
                c.style.background = 'repeating-conic-gradient(#3a3a3a 0 25%,#262626 0 50%) 0 0/24px 24px';
            host.replaceChildren(c);
        });
        return () => cancelAnimationFrame(id);
    }, [cover, kind, backdrop, angle, spread, band, title]);
    const download = async () => {
        if (!outRef.current || busy)
            return;
        setBusy(true);
        try {
            const blob = await new Promise((res, rej) => outRef.current.toBlob((b) => (b ? res(b) : rej(new Error('فشل إنشاء الصورة'))), 'image/png'));
            const name = `${(title || 'غلاف').replace(/[\\/:*?"<>|\n]+/g, ' ').trim().slice(0, 50)} - ${MOCKUP_KINDS.find((k) => k.id === kind)?.label}.png`;
            await downloadBlob(blob, name);
            onDone?.('تم تحميل المجسّم');
        }
        catch (e) {
            onDone?.('تعذّر تحميل المجسّم', 'error');
        }
        finally {
            setBusy(false);
        }
    };
    return (React.createElement("div", { className: "fixed inset-0 z-50 flex flex-col bg-ink-950" },
        React.createElement("div", { className: "flex shrink-0 items-center justify-between gap-2 border-b border-white/5 p-3" },
            React.createElement("button", { type: "button", onClick: onClose, className: "rounded-xl border border-white/15 px-4 py-2 text-[13px] text-stone-200" }, "\u2715 \u0631\u062C\u0648\u0639"),
            React.createElement("div", { className: "text-[14px] font-bold text-gold-200" }, "\u0645\u062C\u0633\u0651\u0645 \u0627\u0644\u062A\u0635\u0645\u064A\u0645"),
            React.createElement("button", { type: "button", onClick: download, disabled: busy, className: "rounded-xl bg-gold-400 px-4 py-2 text-[13px] font-bold text-ink-950 disabled:opacity-50" }, busy ? '…' : '⬇ تحميل')),
        React.createElement("div", { ref: hostRef, className: "grid min-h-0 flex-1 place-items-center p-3" }),
        React.createElement("div", { className: "scroll-thin max-h-[42%] shrink-0 space-y-3 overflow-y-auto border-t border-white/5 bg-ink-900/80 p-3" },
            React.createElement("div", { className: "scroll-thin flex gap-2 overflow-x-auto pb-1" }, MOCKUP_KINDS.map((k) => (React.createElement(Chip, { key: k.id, active: kind === k.id, onClick: () => setKind(k.id) },
                React.createElement("span", { className: "me-1" }, k.icon),
                k.label)))),
            React.createElement("div", { className: "scroll-thin flex gap-2 overflow-x-auto pb-1" }, MOCKUP_BACKDROPS.map((b) => (React.createElement("button", { key: b.id, type: "button", onClick: () => setBackdrop(b.id), className: `flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[12px] ${backdrop === b.id ? 'border-gold-400 text-gold-200' : 'border-white/10 text-stone-400'}` },
                React.createElement("span", { className: "h-5 w-5 rounded-md border border-white/20", style: { background: b.sw } }),
                b.label)))),
            kind === 'book3d' && React.createElement(RangeField, { label: "\u0632\u0627\u0648\u064A\u0629 \u0627\u0644\u0643\u062A\u0627\u0628", min: 8, max: 50, value: angle, onChange: setAngle, format: (v) => `${v}°`, defaultValue: 28 }),
            kind === 'magazine' && (React.createElement(Toggle, { checked: spread, onChange: setSpread, label: "\u0627\u0644\u062A\u0635\u0645\u064A\u0645 \u0645\u0645\u062A\u062F \u0639\u0644\u0649 \u0627\u0644\u0635\u0641\u062D\u062A\u064A\u0646 (\u0628\u062F\u0644 \u0635\u0641\u062D\u0629 \u0645\u0642\u0627\u0644)", small: true })),
            kind === 'notebook' && React.createElement(Toggle, { checked: band, onChange: setBand, label: "\u0634\u0631\u064A\u0637 \u0645\u0637\u0627\u0637\u064A", small: true }))));
}
// ===== components/App.jsx =====
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const DEFAULT_TEXTS = {
    title: {
        ...TEXT_EFFECT_DEFAULTS,
        text: 'ظلال المدينة الأخيرة',
        font: 'Aref Ruqaa',
        weight: 700,
        size: 128,
        lineHeight: 1.15,
        color: '#ecd9a6',
        width: 880,
        x: COVER_W / 2,
        y: 150,
        rotation: 0,
        shadow: true,
    },
    subtitle: {
        ...TEXT_EFFECT_DEFAULTS,
        text: 'رواية\nاسم المؤلف',
        font: 'Tajawal',
        weight: 500,
        size: 46,
        lineHeight: 1.6,
        color: '#cdbb95',
        width: 760,
        x: COVER_W / 2,
        y: 1250,
        rotation: 0,
        shadow: true,
    },
    tag: {
        ...TEXT_EFFECT_DEFAULTS,
        visible: false,
        text: 'رواية',
        font: 'Tajawal',
        weight: 700,
        size: 30,
        lineHeight: 1.2,
        color: '#1a1714',
        width: 220,
        x: COVER_W - 150,
        y: 62,
        rotation: 0,
        shadow: false,
        bg: 'box',
        bgColor: '#cfc6b6',
        bgOpacity: 1,
        bgPadding: 14,
        bgRadius: 2,
    },
    publisher: {
        ...TEXT_EFFECT_DEFAULTS,
        visible: false,
        text: 'اسم دار النشر',
        font: 'Amiri',
        weight: 400,
        size: 30,
        lineHeight: 1.4,
        color: '#bdb3a3',
        width: 420,
        x: COVER_W / 2,
        y: 1385,
        rotation: 0,
        shadow: true,
    },
    date: {
        ...TEXT_EFFECT_DEFAULTS,
        visible: false,
        text: hijriNow(),
        font: 'Tajawal',
        weight: 700,
        size: 40,
        lineHeight: 1.05,
        color: '#e8e1d4',
        width: 260,
        x: COVER_W - 160,
        y: 1350,
        rotation: 0,
        shadow: true,
    },
};
const createDefaultDoc = () => ({
    texts: DEFAULT_TEXTS,
    images: [],
    shapes: [],
    logo: null,
    paletteId: 'ink-night',
    customPalette: null,
    background: null,
    layers: createDefaultLayerState(),
    textAboveLayers: false,
    grade: { ...DEFAULT_GRADE },
    templateId: null,
});
const SLOT_LABELS = { title: 'العنوان', subtitle: 'النص الفرعي', tag: 'الوسم', publisher: 'دار النشر', date: 'التاريخ' };
const WIZARD_KEY = 'cover-studio-wizard-seen';
/** يعرض لوحة الرسم الجاهزة مباشرة داخل شاشة المشاهدة */
function PreviewHost({ canvas }) {
    const ref = useRef(null);
    useEffect(() => {
        const host = ref.current;
        if (!host || !canvas)
            return;
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = '100%';
        canvas.style.width = 'auto';
        canvas.style.height = 'auto';
        canvas.style.objectFit = 'contain';
        canvas.style.boxShadow = '0 30px 100px rgba(0,0,0,.9)';
        host.appendChild(canvas);
        return () => {
            if (canvas.parentNode === host)
                host.removeChild(canvas);
        };
    }, [canvas]);
    return React.createElement("div", { ref: ref, className: "grid h-full w-full place-items-center [&>canvas]:max-h-full [&>canvas]:max-w-full" });
}
function App() {
    const canvasRef = useRef(null);
    const openRef = useRef(null);
    const { fontsVersion, ensureFont } = useArabicFonts();
    const { present: doc, set: setDoc, undo, redo, canUndo, canRedo } = useHistory(createDefaultDoc);
    const [selection, setSelection] = useState([]);
    const selectedId = selection[selection.length - 1] || null;
    const [snapping, setSnapping] = useState(true);
    const [showWizard, setShowWizard] = useState(() => {
        try {
            return !localStorage.getItem(WIZARD_KEY);
        }
        catch {
            return true;
        }
    });
    const [panelOpen, setPanelOpen] = useState(false);
    const [panelTall, setPanelTall] = useState(false);
    const [multiSelect, setMultiSelect] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [mockupCover, setMockupCover] = useState(null);
    const [panelTab, setPanelTab] = useState('templates');
    const [openSlot, setOpenSlot] = useState('title');
    const [focusSignal, setFocusSignal] = useState(0);
    const [cutoutEditId, setCutoutEditId] = useState(null);
    const multiSelectRef = useRef(false);
    multiSelectRef.current = multiSelect;
    // تحميل أي خط مستخدم في النصوص (الخطوط غير الأساسية تُحمَّل عند الحاجة فقط)
    useEffect(() => {
        Object.values(doc.texts).forEach((t) => ensureFont(t.font));
    }, [doc.texts, ensureFont]);
    /** تحديد عنصر — additive يضيف/يزيل من التحديد المتعدد */
    const select = useCallback((id, additive = false) => {
        setSelection((prev) => {
            if (!id)
                return [];
            if (additive || multiSelectRef.current)
                return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
            if (prev.includes(id) && prev.length > 1)
                return prev;
            return [id];
        });
    }, []);
    const [exporting, setExporting] = useState(false);
    const [autoColors, setAutoColors] = useState(true);
    const [notice, setNotice] = useState(null);
    const flash = useCallback((text, tone = 'ok') => {
        setNotice({ text, tone, id: Date.now() });
    }, []);
    useEffect(() => {
        if (!notice)
            return;
        const t = setTimeout(() => setNotice(null), 3500);
        return () => clearTimeout(t);
    }, [notice]);
    const palette = getPalette(doc.paletteId, doc.customPalette);
    // ── النصوص ──
    const updateText = useCallback((key, patch) => setDoc((d) => ({ ...d, texts: { ...d.texts, [key]: { ...d.texts[key], ...patch } } }), {
        key: `text:${key}:${Object.keys(patch).join(',')}`,
    }), [setDoc]);
    // ── اقتراح الألوان من صورة ──
    const suggestColors = useCallback(async (src, { silent = false } = {}) => {
        try {
            const s = suggestDesign(await extractColors(src));
            if (!s)
                return;
            setDoc((d) => ({
                ...d,
                paletteId: 'custom',
                customPalette: s.palette,
                texts: {
                    ...d.texts,
                    title: { ...d.texts.title, color: s.title, color2: s.titleEnd, glowColor: s.glow },
                    subtitle: { ...d.texts.subtitle, color: s.subtitle },
                },
            }));
            if (!silent)
                flash('تم تطبيق ألوان مقترحة من الصورة');
        }
        catch (err) {
            console.error(err);
            if (!silent)
                flash('تعذّر تحليل ألوان الصورة', 'error');
        }
    }, [setDoc, flash]);
    // ── الصور ──
    const addImage = useCallback(async (src, meta = {}) => {
        const img = await loadImage(src);
        const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, COVER_W * 0.85, COVER_H * 0.6);
        const item = {
            id: uid('img'),
            src,
            name: meta.name || 'صورة',
            cutout: !!meta.cutout,
            originalSrc: meta.originalSrc,
            maskSrc: meta.maskSrc,
            credit: meta.credit,
            width,
            height,
            x: COVER_W / 2,
            y: COVER_H * 0.62,
            rotation: 0,
            scale: 1,
            opacity: 1,
            shadow: !!meta.cutout,
            shadowMode: meta.cutout ? 'ground' : 'none',
            glowColor: '#ffffff',
            glowSize: 60,
            fadeBottom: 0,
            fadeEdges: 0,
            backdrop: { ...DEFAULT_BACKDROP },
            fx: { ...DEFAULT_FX },
        };
        setDoc((d) => ({ ...d, images: [...d.images, item] }));
        setSelection([item.id]);
        if (autoColors && meta.suggestColors !== false)
            suggestColors(src, { silent: true });
        return item;
    }, [setDoc, autoColors, suggestColors]);
    /** تحديث موحّد لأي عنصر صوري (صورة أو شعار) — يعيد حساب الأبعاد عند تغيير المصدر */
    const changeNode = useCallback(async (id, patch) => {
        const key = `node:${id}:${Object.keys(patch).join(',')}`;
        let apply = (node) => ({ ...node, ...patch });
        if (patch.src) {
            const img = await loadImage(patch.src);
            apply = (node) => ({ ...node, ...patch, width: (img.naturalWidth / img.naturalHeight) * node.height });
        }
        if (id === 'logo')
            setDoc((d) => (d.logo ? { ...d, logo: apply(d.logo) } : d), { key });
        else if (id.startsWith('shp-'))
            setDoc((d) => ({ ...d, shapes: (d.shapes || []).map((n) => (n.id === id ? apply(n) : n)) }), { key });
        else
            setDoc((d) => ({ ...d, images: d.images.map((n) => (n.id === id ? apply(n) : n)) }), { key });
    }, [setDoc]);
    const removeImage = useCallback((id) => {
        setDoc((d) => ({ ...d, images: d.images.filter((n) => n.id !== id) }));
        setSelection((s) => s.filter((x) => x !== id));
    }, [setDoc]);
    const moveImage = useCallback((id, direction) => setDoc((d) => {
        const i = d.images.findIndex((n) => n.id === id);
        const j = i + direction;
        if (i < 0 || j < 0 || j >= d.images.length)
            return d;
        const images = [...d.images];
        [images[i], images[j]] = [images[j], images[i]];
        return { ...d, images };
    }), [setDoc]);
    // ── الزخارف ──
    const addShape = useCallback((kind) => {
        const item = createShape(kind, { x: COVER_W / 2, y: COVER_H / 2 });
        setDoc((d) => ({ ...d, shapes: [...(d.shapes || []), item] }));
        setSelection([item.id]);
    }, [setDoc]);
    const removeShape = useCallback((id) => {
        setDoc((d) => ({ ...d, shapes: (d.shapes || []).filter((n) => n.id !== id) }));
        setSelection((s) => s.filter((x) => x !== id));
    }, [setDoc]);
    // ── الشعار ──
    const setLogoFromSrc = useCallback(async (src) => {
        const img = await loadImage(src);
        const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, 180, 140);
        setDoc((d) => ({
            ...d,
            logo: { id: 'logo', src, width, height, x: COVER_W / 2, y: COVER_H - 90 - height / 2, rotation: 0, scale: 1, opacity: 0.95, shadow: false },
        }));
        setSelection(['logo']);
    }, [setDoc]);
    const removeLogo = useCallback(() => {
        setDoc((d) => ({ ...d, logo: null }));
        setSelection((s) => s.filter((x) => x !== 'logo'));
    }, [setDoc]);
    // ── الخلفية ──
    const setBackground = useCallback((src, meta = {}) => {
        setDoc((d) => ({
            ...d,
            background: {
                src,
                generated: !!meta.generated,
                scene: meta.scene || null,
                scale: 1,
                offsetX: 0,
                offsetY: 0,
                opacity: 1,
                dim: meta.scene ? 0.12 : 0.3,
                paletteMix: meta.scene ? 0 : 0.3,
                blend: 'soft-light',
            },
        }));
        if (autoColors && meta.suggest !== false && !meta.scene)
            suggestColors(src, { silent: true });
        if (!meta.quiet)
            flash(meta.generated ? 'تم توليد الخلفية' : meta.scene ? 'تم تطبيق الخلفية' : 'تمت إضافة صورة الخلفية');
    }, [setDoc, autoColors, suggestColors, flash]);
    const changeBackground = useCallback((patch) => setDoc((d) => (d.background ? { ...d, background: { ...d.background, ...patch } } : d), {
        key: `bg:${Object.keys(patch).join(',')}`,
    }), [setDoc]);
    // ── الطبقات والقوالب ──
    const changeLayer = useCallback((id, patch) => setDoc((d) => ({ ...d, layers: { ...d.layers, [id]: { ...d.layers[id], ...patch } } }), {
        key: `layer:${id}:${Object.keys(patch).join(',')}`,
    }), [setDoc]);
    const resetLayers = useCallback(() => setDoc((d) => ({ ...d, layers: Object.fromEntries(ALL_OVERLAYS.map((o) => [o.id, { ...d.layers[o.id], enabled: false }])) })), [setDoc]);
    const applyTemplate = useCallback((tpl, { quiet = false } = {}) => {
        setDoc((d) => ({ ...applyTemplateToDoc(d, tpl), templateId: tpl.id }));
        if (!quiet)
            flash(`تم تطبيق قالب «${tpl.name}»`);
    }, [setDoc, flash]);
    /** نقرتان على عنصر في الغلاف ← افتح خصائصه في لوحة التحكم مباشرة */
    const openProps = useCallback((id) => {
        if (!id)
            return;
        setSelection([id]);
        if (id.startsWith('text-')) {
            setPanelTab('typography');
            setOpenSlot(id.slice(5));
        }
        else if (id === 'logo') {
            setPanelTab('logo');
        }
        else if (id.startsWith('shp-')) {
            setPanelTab('shapes');
        }
        else {
            setPanelTab('compositing');
        }
        setPanelOpen(true);
        setFocusSignal((n) => n + 1);
    }, []);
    /** «تصميم آخر»: ينتقل للقالب التالي من نفس النوع */
    const shuffleDesign = () => {
        const current = TEMPLATES.find((t) => t.id === doc.templateId);
        const pool = current ? TEMPLATES.filter((t) => t.category === current.category) : TEMPLATES;
        const list = pool.length > 1 ? pool : TEMPLATES;
        const i = list.findIndex((t) => t.id === doc.templateId);
        applyTemplate(list[(i + 1) % list.length]);
    };
    // ── تحديثات جماعية (سحب/تحويل/محاذاة/تحريك بالأسهم) ──
    const applyPatches = useCallback((patches, key = null) => setDoc((d) => {
        let { texts, images, logo } = d;
        let shapes = d.shapes || [];
        for (const { id, patch } of patches) {
            if (id.startsWith('text-')) {
                const k = id.slice(5);
                if (texts[k])
                    texts = { ...texts, [k]: { ...texts[k], ...patch } };
            }
            else if (id === 'logo') {
                if (logo)
                    logo = { ...logo, ...patch };
            }
            else if (id.startsWith('shp-')) {
                shapes = shapes.map((n) => (n.id === id ? { ...n, ...patch } : n));
            }
            else {
                images = images.map((n) => (n.id === id ? { ...n, ...patch } : n));
            }
        }
        return { ...d, texts, images, logo, shapes };
    }, { key }), [setDoc]);
    const duplicateImages = useCallback((ids) => {
        const imgs = doc.images.filter((n) => ids.includes(n.id));
        const shps = (doc.shapes || []).filter((n) => ids.includes(n.id));
        if (!imgs.length && !shps.length)
            return;
        const copy = (n, prefix) => ({ ...JSON.parse(JSON.stringify(n)), id: uid(prefix), x: n.x + 30, y: n.y + 30, locked: false, fromTemplate: false });
        const imgCopies = imgs.map((n) => copy(n, 'img'));
        const shpCopies = shps.map((n) => copy(n, 'shp'));
        setDoc((d) => ({ ...d, images: [...d.images, ...imgCopies], shapes: [...(d.shapes || []), ...shpCopies] }));
        setSelection([...imgCopies, ...shpCopies].map((c) => c.id));
    }, [doc.images, doc.shapes, setDoc]);
    const deleteSelection = () => {
        if (!selection.length)
            return;
        setDoc((d) => {
            const texts = { ...d.texts };
            for (const id of selection)
                if (id.startsWith('text-'))
                    texts[id.slice(5)] = { ...texts[id.slice(5)], visible: false };
            return {
                ...d,
                texts,
                images: d.images.filter((n) => !selection.includes(n.id)),
                shapes: (d.shapes || []).filter((n) => !selection.includes(n.id)),
                logo: selection.includes('logo') ? null : d.logo,
            };
        });
        setSelection([]);
    };
    const lockSelection = () => {
        applyPatches(selection.map((id) => ({ id, patch: { locked: true } })));
        setSelection([]);
        flash('تم القفل — فكّه من تبويب «العناصر»');
    };
    const nudge = (dx, dy) => {
        const patches = selection
            .map((id) => {
            const node = id.startsWith('text-')
                ? doc.texts[id.slice(5)]
                : id === 'logo'
                    ? doc.logo
                    : id.startsWith('shp-')
                        ? (doc.shapes || []).find((n) => n.id === id)
                        : doc.images.find((n) => n.id === id);
            return node && !node.locked ? { id, patch: { x: node.x + dx, y: node.y + dy } } : null;
        })
            .filter(Boolean);
        if (patches.length)
            applyPatches(patches, 'nudge');
    };
    // ── المعالج السريع ──
    const closeWizard = () => {
        setShowWizard(false);
        try {
            localStorage.setItem(WIZARD_KEY, '1');
        }
        catch {
            /* التخزين غير متاح */
        }
    };
    const runWizard = async ({ title, author, category, file, removeBg, aiPrompt }, progress) => {
        const pool = TEMPLATES.filter((t) => t.category === category);
        const tpl = pool[Math.floor(Math.random() * pool.length)] || TEMPLATES[0];
        setDoc((d) => ({
            ...d,
            images: [],
            shapes: (d.shapes || []).filter((n) => !n.fromTemplate),
            background: null,
            texts: {
                ...d.texts,
                title: { ...d.texts.title, text: title || d.texts.title.text },
                subtitle: { ...d.texts.subtitle, text: author || d.texts.subtitle.text },
            },
        }));
        if (aiPrompt) {
            progress('توليد الخلفية بالذكاء الاصطناعي… (حتى دقيقة)', 20);
            try {
                setBackground(await generateAIBackground(aiPrompt), { generated: true, suggest: false, quiet: true });
            }
            catch (err) {
                flash('تعذّر توليد الخلفية: ' + err.message, 'error');
            }
        }
        if (file) {
            const original = URL.createObjectURL(file);
            let src = original;
            let maskSrc;
            if (removeBg) {
                progress('تفريغ خلفية الصورة داخل المتصفح…', 50);
                try {
                    const res = await removeImageBackgroundDetailed(file, (p) => progress(p.label, 40 + Math.round(p.percent * 0.5)));
                    src = URL.createObjectURL(res.blob);
                    maskSrc = res.maskUrl;
                }
                catch {
                    src = original;
                }
            }
            const item = await addImage(src, { name: file.name, cutout: removeBg && src !== original, originalSrc: original, maskSrc, suggestColors: false });
            // ثبّت الشخص أسفل الغلاف كما في الأغلفة الاحترافية
            applyPatches([{ id: item.id, patch: { y: COVER_H - item.height / 2 + 10 } }]);
        }
        progress('تطبيق التصميم…', 95);
        applyTemplate(tpl, { quiet: true });
        setSelection([]);
        flash(`تم التصميم بقالب «${tpl.name}» — جرّب «تصميم آخر» للتنويع`);
    };
    // ── حفظ / فتح المشروع ──
    const saveProject = async () => {
        try {
            const json = await serializeProject(doc);
            downloadBlob(new Blob([json], { type: 'application/json' }), projectFileName(doc.texts.title.text));
            flash('تم حفظ المشروع — يمكنك فتحه لاحقاً من زر «فتح»');
        }
        catch (err) {
            console.error(err);
            flash('تعذّر حفظ المشروع', 'error');
        }
    };
    const openProject = async (file) => {
        try {
            const loaded = await parseProject(file, createDefaultDoc());
            setDoc(loaded);
            setSelection([]);
            flash('تم فتح المشروع');
        }
        catch (err) {
            flash(err.message, 'error');
        }
    };
    // ── التصدير ──
    const handleExport = async () => {
        if (!canvasRef.current || exporting)
            return;
        setExporting(true);
        try {
            await document.fonts.ready;
            const blob = await canvasRef.current.exportPNG();
            downloadBlob(blob, coverFileName(doc.texts.title.text));
            flash('تم تحميل الغلاف');
        }
        catch (err) {
            console.error(err);
            flash('تعذّر تصدير الغلاف: ' + (err?.message || err), 'error');
        }
        finally {
            setExporting(false);
        }
    };
    // ── المشاهدة: عرض التصميم كاملاً بدون أدوات ──
    const openPreview = () => {
        try {
            // دقة تناسب الشاشة فقط — تظهر فوراً
            const ratio = Math.min(1.5, Math.max(0.5, (window.innerHeight * (window.devicePixelRatio || 1)) / COVER_H));
            setPreviewUrl(canvasRef.current.previewCanvas(ratio));
        }
        catch (err) {
            flash('تعذّر عرض التصميم', 'error');
        }
    };
    const closePreview = () => setPreviewUrl(null);
    // ── المجسّم: كتاب / مجلة / دفتر ──
    const openMockup = async () => {
        try {
            await document.fonts.ready;
            setPreviewUrl(null);
            setMockupCover(canvasRef.current.previewCanvas(1.6));
        }
        catch (err) {
            flash('تعذّر إنشاء المجسّم', 'error');
        }
    };
    const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
    const zoomStep = (dir) => {
        if (dir === 0)
            return setZoom(1);
        const next = dir > 0 ? ZOOMS.find((z) => z > zoom + 0.001) ?? ZOOMS[ZOOMS.length - 1] : [...ZOOMS].reverse().find((z) => z < zoom - 0.001) ?? ZOOMS[0];
        setZoom(next);
    };
    const onRailTab = (id) => {
        if (panelTab === id && panelOpen)
            setPanelOpen(false);
        else {
            setPanelTab(id);
            setPanelOpen(true);
        }
    };
    const selectionLabel = (() => {
        if (!selectedId)
            return '';
        if (selectedId.startsWith('text-'))
            return SLOT_LABELS[selectedId.slice(5)] || 'نص';
        if (selectedId === 'logo')
            return 'الشعار';
        if (selectedId.startsWith('shp-'))
            return 'زخرفة';
        return doc.images.find((n) => n.id === selectedId)?.name || 'صورة';
    })();
    const layersCount = Object.values(doc.layers).filter((l) => l.enabled).length;
    return (React.createElement("div", { className: "relative flex h-[100dvh] bg-ink-950 text-stone-200" },
        React.createElement(SideRail, { tab: panelTab, panelOpen: panelOpen, onTab: onRailTab, layersCount: layersCount, onWizard: () => setShowWizard(true), onShuffle: shuffleDesign, onUndo: undo, onRedo: redo, canUndo: canUndo, canRedo: canRedo, onPreview: openPreview, onMockup: openMockup, onOpen: () => openRef.current?.click(), onSave: saveProject, onExport: handleExport, exporting: exporting }),
        React.createElement("input", { ref: openRef, type: "file", accept: ".json,application/json", hidden: true, onChange: (e) => {
                const f = e.target.files?.[0];
                if (f)
                    openProject(f);
                e.target.value = '';
            } }),
        React.createElement("div", { className: "relative flex min-w-0 flex-1 flex-col-reverse lg:flex-row" },
            React.createElement(ControlPanel, { open: panelOpen, onClose: () => setPanelOpen(false), tall: panelTall, onToggleTall: () => setPanelTall((v) => !v), texts: doc.texts, onChangeText: updateText, images: doc.images, shapes: doc.shapes || [], frame: doc.frame, onChangeFrame: (frame) => setDoc((d) => ({ ...d, frame }), { key: `frame:${frame.style}` }), onAddShape: addShape, onRemoveShape: removeShape, selectedId: selectedId, selectedIds: selection, onSelect: select, onDuplicate: duplicateImages, activeTab: panelTab, openSlot: openSlot, onOpenSlot: setOpenSlot, focusSignal: focusSignal, onOpenCutout: setCutoutEditId, grade: doc.grade || DEFAULT_GRADE, onChangeGrade: (patch) => setDoc((d) => ({ ...d, grade: { ...(d.grade || DEFAULT_GRADE), ...patch } }), { key: `grade:${Object.keys(patch).join(',')}` }), onAddImage: addImage, onChangeNode: changeNode, onRemoveImage: removeImage, onMoveImage: moveImage, autoColors: autoColors, onToggleAutoColors: setAutoColors, onSuggestColors: suggestColors, paletteLight: palette.colors[1], logo: doc.logo, onSetLogo: setLogoFromSrc, onRemoveLogo: removeLogo, paletteId: doc.paletteId, customPalette: doc.customPalette, onChangePalette: (paletteId) => setDoc((d) => ({ ...d, paletteId })), background: doc.background, onSetBackground: setBackground, onChangeBackground: changeBackground, onRemoveBackground: () => setDoc((d) => ({ ...d, background: null })), layers: doc.layers, onChangeLayer: changeLayer, onResetLayers: resetLayers, textAboveLayers: doc.textAboveLayers, onToggleTextAbove: (textAboveLayers) => setDoc((d) => ({ ...d, textAboveLayers })), onApplyTemplate: applyTemplate, activeTemplateId: doc.templateId }),
            React.createElement("main", { className: "relative flex min-h-0 min-w-0 flex-1 flex-col" },
                React.createElement(TopBar, { count: selection.length, label: selectionLabel, onOpenProps: () => selectedId && openProps(selectedId), onAlign: (type) => canvasRef.current?.align(type), onNudge: nudge, onDuplicate: () => duplicateImages(selection), canDuplicate: selection.some((id) => id.startsWith('img-') || id.startsWith('shp-')), onDelete: deleteSelection, onLock: lockSelection, onDeselect: () => setSelection([]), snapping: snapping, onToggleSnapping: () => setSnapping((v) => !v), multiSelect: multiSelect, onToggleMulti: () => setMultiSelect((v) => !v), zoom: zoom, onZoom: zoomStep }),
                selection.length === 1 && (() => {
                    const id = selection[0];
                    if (id.startsWith('text-')) {
                        const key = id.slice(5);
                        return React.createElement(QuickBar, { kind: "text", value: doc.texts[key], onChange: (patch) => updateText(key, patch) });
                    }
                    const node = id === 'logo' ? doc.logo : id.startsWith('shp-') ? (doc.shapes || []).find((n) => n.id === id) : doc.images.find((n) => n.id === id);
                    if (!node || node.locked)
                        return null;
                    return React.createElement(QuickBar, { kind: id.startsWith('shp-') ? 'shape' : 'image', value: node, onChange: (patch) => changeNode(id, patch) });
                })(),
                React.createElement("div", { className: "stage-backdrop relative min-h-0 flex-1" },
                    React.createElement(CoverCanvas, { ref: canvasRef, texts: doc.texts, images: doc.images, shapes: doc.shapes || [], logo: doc.logo, palette: palette, background: doc.background, layers: doc.layers, textAboveLayers: doc.textAboveLayers, frame: doc.frame, grade: doc.grade || DEFAULT_GRADE, selectedIds: selection, onSelect: select, onCommit: (patches) => applyPatches(patches), onOpenProps: openProps, fontsVersion: fontsVersion, snapping: snapping, zoom: zoom })),
                notice && (React.createElement("div", { key: notice.id, className: `pointer-events-none absolute left-1/2 top-14 z-30 max-w-[92%] -translate-x-1/2 rounded-2xl border px-4 py-2 text-center text-[12px] shadow-xl backdrop-blur ${notice.tone === 'error' ? 'border-red-900/60 bg-red-950/90 text-red-200' : 'border-gold-500/30 bg-ink-800/95 text-gold-200'}` }, notice.text)))),
        previewUrl && (React.createElement("div", { className: "fixed inset-0 z-50 flex flex-col bg-black", onClick: closePreview },
            React.createElement("div", { className: "flex shrink-0 items-center justify-between gap-2 p-3", onClick: (e) => e.stopPropagation() },
                React.createElement("button", { type: "button", onClick: closePreview, className: "rounded-xl border border-white/15 px-4 py-2 text-[13px] text-stone-200" }, "\u2715 \u0631\u062C\u0648\u0639 \u0644\u0644\u062A\u062D\u0631\u064A\u0631"),
                React.createElement("div", { className: "flex gap-2" },
                    React.createElement("button", { type: "button", onClick: openMockup, className: "rounded-xl border border-gold-500/40 px-4 py-2 text-[13px] text-gold-200" }, "\uD83D\uDCD6 \u0645\u062C\u0633\u0651\u0645"),
                    React.createElement("button", { type: "button", onClick: handleExport, className: "rounded-xl bg-gold-400 px-4 py-2 text-[13px] font-bold text-ink-950" }, "\u2B07 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u063A\u0644\u0627\u0641"))),
            React.createElement("div", { className: "grid min-h-0 flex-1 place-items-center p-3" },
                React.createElement(PreviewHost, { canvas: previewUrl })))),
        mockupCover && (React.createElement(MockupStudio, { cover: mockupCover, title: doc.texts.title?.text?.split('\n')[0], onClose: () => setMockupCover(null), onDone: (text, tone) => flash(text, tone) })),
        showWizard && React.createElement(QuickWizard, { onRun: runWizard, onClose: closeWizard }),
        cutoutEditId && doc.images.find((n) => n.id === cutoutEditId) && (React.createElement(CutoutEditor, { item: doc.images.find((n) => n.id === cutoutEditId), onClose: () => setCutoutEditId(null), onSave: (patch) => {
                changeNode(cutoutEditId, patch);
                setCutoutEditId(null);
                flash('تم حفظ القص');
            } }))));
}
/** شاشة خطأ واضحة بدل الشاشة السوداء — تُظهر سبب المشكلة لإرساله للمطوّر */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        window.__APP_FAILED__ = true;
        console.error(error, info);
    }
    render() {
        if (!this.state.error)
            return this.props.children;
        const e = this.state.error;
        return (React.createElement("div", { style: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#070605', color: '#e6c98a', fontFamily: 'Tajawal, sans-serif', padding: 24, direction: 'rtl' } },
            React.createElement("div", { style: { maxWidth: 600, width: '100%' } },
                React.createElement("h2", { style: { fontSize: 20, marginBottom: 10 } }, "\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0627\u0633\u062A\u0648\u062F\u064A\u0648"),
                React.createElement("p", { style: { color: '#a8a29e', fontSize: 13, marginBottom: 12 } }, "\u0635\u0648\u0651\u0631 \u0647\u0630\u0647 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0648\u0623\u0631\u0633\u0644\u0647\u0627 \u0644\u0644\u0645\u0637\u0648\u0651\u0631:"),
                React.createElement("pre", { style: { whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', background: '#15120f', padding: 12, borderRadius: 12, fontSize: 11, color: '#fca5a5', maxHeight: '50vh', overflow: 'auto' } }, String((e && (e.stack || e.message)) || e)),
                React.createElement("button", { type: "button", onClick: () => location.reload(), style: { marginTop: 16, background: '#d4af6a', color: '#0d0b09', padding: '10px 22px', borderRadius: 12, fontWeight: 700 } }, "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629"))));
    }
}
window.__APP_STARTED__ = true;
createRoot(document.getElementById('root')).render(React.createElement(ErrorBoundary, null,
    React.createElement(App, null)));
// داخل تطبيق أندرويد: نؤكد أن هذا الإصدار يعمل (يحمي التحديث الصامت من الإصدارات المعطوبة)
setTimeout(() => {
    if (!window.__APP_FAILED__) {
        try {
            window.AndroidBridge?.appReady?.();
        }
        catch (e) {
            /* خارج التطبيق */
        }
    }
}, 4000);
