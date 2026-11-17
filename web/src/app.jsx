import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import Konva from 'konva';
import { createRoot } from 'react-dom/client';
import { Stage, Layer, Rect, Text, Transformer, Group, Shape, Ellipse, Circle, Line, Image as KonvaImage } from 'react-konva';

// مكتبة إزالة الخلفية: النسخة المدمجة أولاً ثم CDN احتياطاً
const IMGLY_URL = './imgly.js';
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
// 17 نمطاً لونياً داكناً وترابياً.
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
];

const getPalette = (id, custom) =>
  id === 'custom' && custom ? { id: 'custom', ...custom } : PALETTES.find((p) => p.id === id) || PALETTES[0];

// CSS مطابق لتدرّج الكانفاس — لعرض المعاينات الصغيرة في لوحة التحكم
function paletteToCss(p) {
  const [a, b, c] = p.colors;
  return p.type === 'radial'
    ? `radial-gradient(circle at 50% 40%, ${b} 0%, ${a} 55%, ${c} 100%)`
    : `linear-gradient(165deg, ${b} 0%, ${a} 50%, ${c} 100%)`;
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
    if (existing) return resolve();
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
  if (cache.has(family)) return cache.get(family);
  const font = getFontMeta(family);
  if (!font) return Promise.resolve(false);

  // في تطبيق أندرويد الخطوط مدمجة محلياً (window.__LOCAL_FONTS__) فلا حاجة لـ Google Fonts
  const local = typeof window !== 'undefined' && window.__LOCAL_FONTS__;
  const promise = (local ? Promise.resolve() : injectStylesheet(buildGoogleFontsUrl(font), family))
    .then(() =>
      Promise.all(font.weights.map((w) => document.fonts.load(`${w} 64px "${family}"`, SAMPLE_TEXT)))
    )
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
  if (!font) return weight;
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
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return blob; // الصورة شفافة بالكامل

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  if (w === width && h === height) return blob;

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
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function hslToHex(h, s, l) {
  s = clamp(s, 0, 1); l = clamp(l, 0, 1);
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
    if (data[i + 3] < 200) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const bk = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    bk.r += data[i]; bk.g += data[i + 1]; bk.b += data[i + 2]; bk.n++;
    buckets.set(key, bk);
  }
  const list = [...buckets.values()]
    .map((bk) => ({ r: bk.r / bk.n, g: bk.g / bk.n, b: bk.b / bk.n, n: bk.n }))
    .sort((a, b) => b.n - a.n);

  const picked = [];
  for (const c of list) {
    if (picked.every((p) => dist(p, c) > 48)) picked.push(c);
    if (picked.length >= max) break;
  }
  const total = picked.reduce((s, c) => s + c.n, 0) || 1;
  return picked.map((c) => ({ ...c, ...rgbToHsl(c), hex: rgbToHex(c), share: c.n / total }));
}

/** يبني نمطاً لونياً داكناً من ألوان الصورة + ألوان متناسقة للنصوص */
function suggestDesign(colors) {
  if (!colors.length) return null;
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
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
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
      } else {
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
  } catch {
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
  if (edits) ctx.drawImage(edits, 0, 0, c.width, c.height);
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
  if (shrink > 0.05) m = blurred(m, shrink);

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
  for (let i = 0; i < 256; i++) lut[i] = Math.max(0, Math.min(1, (i / 255 - lo) / Math.max(0.001, hi - lo))) * 255;
  for (let i = 0; i < md.length; i += 4) md[i] = md[i + 1] = md[i + 2] = lut[md[i]];
  mctx.putImageData(mImg, 0, 0);

  // 3) تنعيم الحافة
  const feather = (params.feather || 0) * scale;
  if (feather > 0.05) m = blurred(m, feather);
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
        cd[i] = od[i]; cd[i + 1] = od[i + 1]; cd[i + 2] = od[i + 2]; cd[i + 3] = 255;
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
  } catch {
    return fallback;
  }
}

function setCutQuality(q) {
  try {
    localStorage.setItem(QUALITY_KEY, q);
  } catch {
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
  if (typeof lib.preload === 'function') await lib.preload(BG_REMOVAL_CONFIG);
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
  if (typeof input === 'string') return (await fetch(input)).blob();
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
  if (localPath) attempts.push({ lib: 0, publicPath: localPath, name: 'المحرك المدمج' });
  attempts.push({ lib: 0, publicPath: null, name: 'النموذج من الإنترنت' });
  attempts.push({ lib: 1, publicPath: null, name: 'المكتبة الاحتياطية' });
  if (workingAttempt) attempts.sort((a, b) => (a.name === workingAttempt ? -1 : b.name === workingAttempt ? 1 : 0));

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
    } catch (e) {
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
    } catch (err) {
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
  for (let i = 0; i < b64.length; i += CHUNK) bridge.appendChunk(id, b64.slice(i, i + CHUNK));
  bridge.finishFile(id);
}

function isAndroidApp() {
  return typeof window !== 'undefined' && !!window.AndroidBridge;
}

function downloadBlob(blob, filename = 'book-cover.png') {
  if (isAndroidApp()) return saveViaAndroid(blob, filename);
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
  for (let i = 0; i < 120; i++) softDot(ctx, r() * w, r() * h, 1 + r() * 3, 'rgba(255,255,255,0.5)');
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
  for (let i = 0; i < 160; i++) softDot(ctx, r() * w, r() * h, 2 + r() * 10, 'rgba(70,42,18,0.45)');
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
  for (let i = 0; i < 700; i++) softDot(ctx, r() * w, r() * h, 0.8 + r() * 2.5, 'rgba(40,40,40,0.8)');
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
  for (let y = -span / 2; y < span / 2; y += 66) ctx.fillRect(-span / 2, y, span, 32); // شرائح الستارة
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
  for (let x = 0; x <= w; x += minor) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y <= h; y += minor) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(190,215,195,0.3)';
  ctx.beginPath();
  for (let x = 0; x <= w; x += major) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y <= h; y += major) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(190,215,195,0.6)';
  ctx.font = '13px ui-monospace, monospace';
  if ('direction' in ctx) ctx.direction = 'ltr';
  for (let i = 0, x = 0; x < w; x += major, i++) ctx.fillText(String.fromCharCode(65 + i), x + 6, 18);
  for (let i = 1, y = major; y < h; y += major, i++) ctx.fillText(String(i).padStart(2, '0'), 6, y - 6);
  // شبكة تصويب
  const cx = w * 0.66, cy = h * 0.4;
  ctx.strokeStyle = 'rgba(210,235,215,0.45)';
  ctx.lineWidth = 1.2;
  [36, 70].forEach((rad) => { ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke(); });
  ctx.beginPath();
  ctx.moveTo(cx - 100, cy); ctx.lineTo(cx - 20, cy); ctx.moveTo(cx + 20, cy); ctx.lineTo(cx + 100, cy);
  ctx.moveTo(cx, cy - 100); ctx.lineTo(cx, cy - 20); ctx.moveTo(cx, cy + 20); ctx.lineTo(cx, cy + 100);
  ctx.stroke();
  ctx.fillText('N 33°30′ / E 36°18′', cx + 78, cy - 78);
}

function drawScanlines(ctx, w, h, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.6);
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
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const v = field(i * step, j * step);
    vals[j * cols + i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const levels = 30;
  for (let L = 0; L < levels; L++) {
    const t = min + ((max - min) * (L + 0.5)) / levels;
    const index = L % 5 === 0;
    ctx.strokeStyle = index ? 'rgba(215,192,150,0.48)' : 'rgba(215,192,150,0.22)';
    ctx.lineWidth = index ? 1.6 : 0.8;
    ctx.beginPath();
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = vals[j * cols + i], b = vals[j * cols + i + 1];
      const c = vals[(j + 1) * cols + i + 1], d = vals[(j + 1) * cols + i];
      const code = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
      const segs = MS_SEGMENTS[code];
      if (!segs) continue;
      const x0 = i * step, y0 = j * step;
      const pt = (e) =>
        e === 0 ? [x0 + ((t - a) / (b - a)) * step, y0]
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
    ctx.moveTo(d, 0); ctx.lineTo(d + h, h);
    ctx.moveTo(d + h, 0); ctx.lineTo(d, h);
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
    ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y);
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
  ctx.moveTo(w / 2 - 140, 80); ctx.lineTo(w / 2 + 140, 80);
  ctx.moveTo(w / 2 - 140, h - 80); ctx.lineTo(w / 2 + 140, h - 80);
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
  for (let x = 0; x <= w; x += step) pts.push([x, jag()]);
  for (let y = 0; y <= h; y += step) pts.push([w - jag(), y]);
  for (let x = w; x >= 0; x -= step) pts.push([x, h - jag()]);
  for (let y = h; y >= 0; y -= step) pts.push([jag(), y]);
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
    ctx.moveTo(x - L, y); ctx.lineTo(x + L, y);
    ctx.moveTo(x, y - L); ctx.lineTo(x, y + L);
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
  for (let i = 0; i < 70; i++) softDot(ctx, r() * w, r() * h, 60 + r() * 220, `rgba(150,110,60,${0.05 + r() * 0.1})`);
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
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '255,0,90' : '0,240,255'},${0.3 + r() * 0.4})`;
    ctx.fillRect(r() * w, r() * h, 4 + r() * 40, 2 + r() * 6);
  }
}

function drawSunburst(ctx, w, h) {
  const cx = w / 2, cy = h * 0.42, R = Math.hypot(w, h);
  const n = 36;
  for (let i = 0; i < n; i++) {
    if (i % 2) continue;
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
  for (let i = 0; i < 500; i++) softDot(ctx, r() * w, r() * h, 1 + r() * 2.5, 'rgba(255,235,190,0.8)');
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
  if (canvasCache.has(id)) return canvasCache.get(id);
  const def = ALL_OVERLAYS.find((o) => o.id === id);
  if (!def) return null;
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
  for (const o of ALL_OVERLAYS) state[o.id] = { enabled: false, opacity: o.opacity };
  state.vignette.enabled = true;
  state.grain.enabled = true;
  return state;
}

// ===== lib/textEffects.js =====
// ─────────────────────────────────────────────────────────────
// تأثيرات النص: ذهبي معدني، محفور، توهّج، حدّ خارجي، تدرّج لوني
// ─────────────────────────────────────────────────────────────
// buildTextLayers تُرجع خصائص Konva للنص الأساسي + نُسخاً سفلية (underlays)
// تُرسم خلفه لصنع تأثيرات تحتاج أكثر من ظل واحد (مثل الحفر والتوهّج القوي).

const TEXT_EFFECTS = [
  { id: 'none', label: 'بدون' },
  { id: 'gold', label: 'ذهبي معدني' },
  { id: 'engraved', label: 'محفور' },
  { id: 'glow', label: 'توهّج' },
  { id: 'outline', label: 'حدّ خارجي' },
  { id: 'gradient', label: 'تدرّج لوني' },
  { id: 'silver', label: 'فضي معدني' },
  { id: 'extrude', label: 'ثلاثي الأبعاد' },
  { id: 'neon', label: 'نيون' },
  { id: 'double', label: 'حدّ مزدوج' },
];

const TEXT_BACKGROUNDS = [
  { id: 'none', label: 'بدون' },
  { id: 'bars', label: 'شريط لكل سطر' },
  { id: 'box', label: 'صندوق' },
  { id: 'pill', label: 'إطار بيضاوي' },
  { id: 'plaque', label: 'لوحة زخرفية' },
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
};

const SILVER_STOPS = [0, '#ffffff', 0.3, '#cdd2da', 0.48, '#6b717b', 0.6, '#eef1f5', 0.84, '#9aa1ab', 1, '#4d525a'];
const GOLD_STOPS = [0, '#fff4c8', 0.28, '#e6c46a', 0.48, '#9c7426', 0.6, '#f2d47c', 0.82, '#b8892f', 1, '#76531a'];

function estimateHeight(t) {
  const lines = Math.max(1, String(t.text || '').split('\n').length);
  return lines * t.size * t.lineHeight;
}

function buildTextLayers(t) {
  const h = estimateHeight(t);
  const shadow = t.shadow
    ? { shadowEnabled: true, shadowColor: '#000', shadowBlur: 30, shadowOpacity: 0.9, shadowOffsetX: 0, shadowOffsetY: 6 }
    : { shadowEnabled: false };
  const gradient = (stops) => ({
    fillPriority: 'linear-gradient',
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint: { x: 0, y: h },
    fillLinearGradientColorStops: stops,
  });

  switch (t.effect) {
    case 'gold':
      return {
        main: { ...gradient(GOLD_STOPS), stroke: '#4a330c', strokeWidth: Math.max(1, t.size * 0.012), fillAfterStrokeEnabled: true, ...shadow },
        under: [],
      };
    case 'silver':
      return {
        main: { ...gradient(SILVER_STOPS), stroke: '#2b2e33', strokeWidth: Math.max(1, t.size * 0.012), fillAfterStrokeEnabled: true, ...shadow },
        under: [],
      };
    case 'extrude': {
      // نص بارز ثلاثي الأبعاد: نُسخ متتالية مزاحة بلون العمق
      const depth = Math.max(4, t.size * 0.09);
      const steps = 10;
      const under = [];
      for (let i = steps; i >= 1; i--) {
        under.push({
          fill: t.color2,
          dx: (depth * i * 0.55) / steps,
          dy: (depth * i) / steps,
          ...(i === steps ? { shadowEnabled: true, shadowColor: '#000', shadowBlur: depth * 2, shadowOpacity: 0.8, shadowOffsetY: depth * 0.6 } : {}),
        });
      }
      return { main: { fill: t.color, stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 }, under };
    }
    case 'neon':
      return {
        main: {
          fill: t.color,
          stroke: t.glowColor,
          strokeWidth: Math.max(1, t.size * 0.025),
          fillAfterStrokeEnabled: true,
          shadowEnabled: true,
          shadowColor: t.glowColor,
          shadowBlur: t.size * 0.3,
          shadowOpacity: 1,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
        },
        under: [
          {
            fill: 'rgba(0,0,0,0)',
            stroke: t.glowColor,
            strokeWidth: Math.max(2, t.size * 0.07),
            shadowEnabled: true,
            shadowColor: t.glowColor,
            shadowBlur: t.size * 0.9,
            shadowOpacity: 1,
            opacity: 0.85,
          },
        ],
      };
    case 'double':
      return {
        main: { fill: t.color, stroke: t.strokeColor, strokeWidth: t.strokeWidth, fillAfterStrokeEnabled: true, lineJoin: 'round' },
        under: [{ fill: t.color2, stroke: t.color2, strokeWidth: t.strokeWidth * 3.4, lineJoin: 'round', ...shadow }],
      };
    case 'gradient':
      return { main: { ...gradient([0, t.color, 1, t.color2]), ...shadow }, under: [] };
    case 'glow': {
      const glow = { shadowEnabled: true, shadowColor: t.glowColor, shadowOffsetX: 0, shadowOffsetY: 0, shadowOpacity: 1 };
      return {
        main: { fill: t.color, ...glow, shadowBlur: t.size * 0.25 },
        under: [{ fill: t.color, ...glow, shadowBlur: t.size * 0.75, opacity: 0.9 }],
      };
    }
    case 'outline':
      return {
        main: {
          fill: t.outlineOnly ? 'rgba(0,0,0,0)' : t.color,
          stroke: t.strokeColor,
          strokeWidth: t.strokeWidth,
          fillAfterStrokeEnabled: !t.outlineOnly,
          lineJoin: 'round',
          ...shadow,
        },
        under: [],
      };
    case 'engraved': {
      const d = Math.max(1.5, t.size * 0.02);
      return {
        main: { fill: t.color, shadowEnabled: true, shadowColor: '#000', shadowBlur: d, shadowOpacity: 0.85, shadowOffsetX: 0, shadowOffsetY: -d },
        under: [{ fill: 'rgba(255,255,255,0.28)', dy: d }],
      };
    }
    default:
      return { main: { fill: t.color, ...shadow }, under: [] };
  }
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
  if (!fx) return { filters: [], attrs: {} };
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
      if (!tint) { tint = 0.18; tintColor = '#ff9a3c'; }
      break;
    case 'cold':
      if (!tint) { tint = 0.18; tintColor = '#3c8cff'; }
      break;
    default:
  }

  if (brightness) { filters.push(Konva.Filters.Brighten); attrs.brightness = brightness; }
  if (contrast) { filters.push(Konva.Filters.Contrast); attrs.contrast = contrast; }
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
];

const STYLE_RESET = { effect: 'none', bg: 'none', secondColor: '', rotation: 0, letterSpacing: 0 };

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
    customPalette: tpl.customPalette || doc.customPalette,
    texts: Object.fromEntries(
      Object.entries(doc.texts).map(([k, t]) => {
        const style = tpl[k];
        if (!style) return [k, k === 'title' || k === 'subtitle' ? { ...t, ...STYLE_RESET } : t];
        const { text, ...rest } = style;
        const base = k === 'title' || k === 'subtitle' ? { ...t, ...STYLE_RESET, x: t.x } : t;
        return [k, { ...base, ...rest, ...(text && k !== 'title' ? { text } : {}) }];
      })
    ),
    shapes: [
      ...(doc.shapes || []).filter((sh) => !sh.fromTemplate),
      ...(tpl.shapes || []).map((sp) => createShape(sp.kind, { ...sp, fromTemplate: true })),
    ],
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

const AI_STYLE_SUFFIX =
  'cinematic dark moody book cover background art, dramatic lighting, atmospheric, film grain, highly detailed, vertical composition, empty space at top for title, no text, no letters, no watermark';

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
  if (!text) throw new Error('اكتب وصفاً للخلفية أولاً');
  const full = enhanceStyle ? `${text}, ${AI_STYLE_SUFFIX}` : text;
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}` +
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
      if (!res.ok) throw new Error(res.status === 429 ? 'الخدمة مشغولة — انتظر 15 ثانية وأعد المحاولة' : `فشل التوليد (رمز ${res.status})`);
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('الخدمة لم تُرجع صورة، أعد المحاولة');
      return URL.createObjectURL(blob);
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('انتهت مهلة التوليد، أعد المحاولة');
      throw err;
    } finally {
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
  if (!res.ok) throw new Error('تعذّر البحث في الأيقونات');
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
  } finally {
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
  if (!res.ok) throw new Error('تعذّر البحث في ويكيميديا');
  const json = await res.json();
  return Object.values(json.query?.pages || {})
    .map((p) => {
      const ii = p.imageinfo?.[0];
      if (!ii || ii.mime !== 'image/png') return null;
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
            if (x > 3 && x < S - 4 && y > 3 && y < S - 4) continue; // الأطراف فقط
            edge++;
            if (d[(y * S + x) * 4 + 3] < 40) clear++;
          }
        }
        resolve(clear / edge > 0.35);
      } catch {
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
  await Promise.all(
    all.map(async (it) => {
      if (await hasTransparency(it.thumb)) out.push(it);
      onProgress?.(++done, all.length);
    })
  );
  return out;
}

/** ينزّل نسخة مناسبة الحجم من الصورة كرابط blob: محلي */
async function fetchCommonsImage(item) {
  const candidates = [];
  if (item.width > 1280 && item.thumb) candidates.push(item.thumb.replace(/\/\d+px-/, '/1280px-'));
  candidates.push(item.full);
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return URL.createObjectURL(await res.blob());
    } catch {
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
  if (!src || src.startsWith('data:')) return src;
  return blobToDataURL(await (await fetch(src)).blob());
}

async function toObjectURL(src) {
  if (!src || !src.startsWith('data:')) return src;
  return URL.createObjectURL(await (await fetch(src)).blob());
}

async function mapSources(doc, fn) {
  const out = JSON.parse(JSON.stringify(doc));
  for (const img of out.images) {
    img.src = await fn(img.src);
    if (img.originalSrc) img.originalSrc = img.originalSrc === doc.images.find((i) => i.id === img.id)?.src ? img.src : await fn(img.originalSrc);
  }
  for (const img of out.images) if (img.maskSrc) img.maskSrc = await fn(img.maskSrc);
  if (out.logo) out.logo.src = await fn(out.logo.src);
  if (out.background) out.background.src = await fn(out.background.src);
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
  } catch {
    throw new Error('الملف ليس مشروع غلاف صالحاً');
  }
  if (json.app !== APP_ID || !json.doc) throw new Error('هذا الملف ليس من استوديو الأغلفة');
  const d = json.doc;
  const merged = {
    ...defaults,
    ...d,
    texts: Object.fromEntries(
      Object.keys(defaults.texts).map((k) => [k, { ...defaults.texts[k], ...(d.texts?.[k] || {}) }])
    ),
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
      ctx.moveTo(-w / 2, -h * 0.3); ctx.lineTo(w / 2, -h * 0.3);
      ctx.moveTo(-w / 2, h * 0.3); ctx.lineTo(w / 2, h * 0.3);
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
      ctx.moveTo(-w / 2, 0); ctx.lineTo(-d * 2.2, 0);
      ctx.moveTo(d * 2.2, 0); ctx.lineTo(w / 2, 0);
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
      ctx.moveTo(-w / 2, 0); ctx.lineTo(-R * 1.4, 0);
      ctx.moveTo(R * 1.4, 0); ctx.lineTo(w / 2, 0);
      ctx.moveTo(-w / 2 + 20, -6); ctx.lineTo(-R * 2, -6);
      ctx.moveTo(R * 2, 6); ctx.lineTo(w / 2 - 20, 6);
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
      ctx.moveTo(-hw + c, -hh); ctx.lineTo(hw - c, -hh);
      ctx.moveTo(hw, -hh + c); ctx.lineTo(hw, hh - c);
      ctx.moveTo(hw - c, hh); ctx.lineTo(-hw + c, hh);
      ctx.moveTo(-hw, hh - c); ctx.lineTo(-hw, -hh + c);
      for (const [x, y] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) dPoly(ctx, [[x, y - c], [x + c, y], [x, y + c], [x - c, y]]);
      for (const [x, y] of [[0, -hh], [0, hh], [-hw, 0], [hw, 0]]) dPoly(ctx, [[x, y - c * 0.6], [x + c * 0.6, y], [x, y + c * 0.6], [x - c * 0.6, y]]);
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
      ctx.moveTo(x0, y0 + h); ctx.lineTo(x0, y0); ctx.lineTo(x0 + w, y0);
      ctx.moveTo(x0 + w * 0.18, y0 + h * 0.75); ctx.lineTo(x0 + w * 0.18, y0 + h * 0.18); ctx.lineTo(x0 + w * 0.75, y0 + h * 0.18);
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
      for (let x = -w / 2; x < w / 2; x += seg + gap) ctx.rect(x, -h / 2, Math.min(seg, w / 2 - x), h);
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
      ctx.moveTo(-w / 2 + a, 0); ctx.lineTo(w / 2 - a, 0);
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
      ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0);
      for (const k of [-3, -2, -1, 0, 1, 2, 3]) {
        const x = k * r * 3.2, rr = k === 0 ? r : r * (0.75 - Math.abs(k) * 0.12);
        if (k === 0) dPoly(ctx, [[x, -rr], [x + rr, 0], [x, rr], [x - rr, 0]]);
        else dEllipse(ctx, rr, rr, x, 0);
      }
      ctx.fillStrokeShape(s);
    },
  },
  {
    id: 'triDots', label: 'ثلاث نقاط', cat: 'lines', w: 120, h: 40, fill: D_GOLD, stroke: D_NONE, strokeWidth: 0,
    draw(ctx, w, h, s) {
      const r = Math.min(h / 2, w / 7);
      ctx.beginPath();
      dEllipse(ctx, r, r, -w / 3, 0); dEllipse(ctx, r, r, 0, 0); dEllipse(ctx, r, r, w / 3, 0);
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
        ctx.moveTo(sx * hw, sy * hh + -sy * L); ctx.lineTo(sx * hw, sy * hh); ctx.lineTo(sx * hw - sx * L, sy * hh);
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
      edge(-hw, -hh, hw, -hh); edge(hw, -hh, hw, hh); edge(hw, hh, -hw, hh); edge(-hw, hh, -hw, -hh);
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
    if (fill && fill !== D_NONE) ctx.fill();
    if (stroke && stroke !== D_NONE && def.strokeWidth > 0) ctx.stroke();
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
        if (!alive) return;
        setVersion((v) => v + 1);
        setLoadedCount((c) => c + 1);
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  const ensureFont = useCallback((family) => {
    if (!family || isFontLoaded(family)) return;
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
      if (next === s.present) return s;
      if (merge) return { ...s, present: next, future: [] };
      return { past: [...s.past, s.present].slice(-LIMIT), present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    last.current = { key: null, t: 0 };
    setState((s) =>
      s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s
    );
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
  return (
    <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4 space-y-4">
      {(title || action) && (
        <header className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-bold tracking-wide text-gold-300">{title}</h3>
            {hint && <p className="mt-0.5 text-[11px] text-stone-500">{hint}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function FieldLabel({ children, value }) {
  return (
    <div className="mb-1.5 flex items-center justify-between text-[12px] text-stone-400">
      <span>{children}</span>
      {value !== undefined && <span className="tabular-nums text-stone-500" dir="ltr">{value}</span>}
    </div>
  );
}

function RangeField({ label, value, min, max, step = 1, onChange, format, disabled }) {
  return (
    <label className="block">
      <FieldLabel value={format ? format(value) : value}>{label}</FieldLabel>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, styleFor }) {
  return (
    <label className="block">
      {label && <FieldLabel>{label}</FieldLabel>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-stone-200 outline-none transition focus:border-gold-500/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={styleFor?.(o)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({ label, value, onChange, rows = 2, style, inputRef }) {
  return (
    <label className="block">
      {label && <FieldLabel>{label}</FieldLabel>}
      <textarea
        ref={inputRef}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={style}
        className="w-full resize-none rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-base leading-relaxed text-stone-100 outline-none transition focus:border-gold-500/60"
      />
    </label>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-stone-400">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-[11px] uppercase text-stone-500" dir="ltr">{value}</span>
        <input type="color" className="swatch" value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  );
}

function Toggle({ checked, onChange, label, small }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-right"
    >
      <span
        className={`relative inline-flex shrink-0 rounded-full transition ${small ? 'h-5 w-9' : 'h-6 w-11'} ${
          checked ? 'bg-gold-500' : 'bg-ink-600'
        }`}
      >
        <span
          className={`absolute top-0.5 rounded-full bg-ink-950 shadow transition-all ${small ? 'h-4 w-4' : 'h-5 w-5'} ${
            checked ? (small ? 'right-[18px]' : 'right-[22px]') : 'right-0.5'
          }`}
        />
      </span>
      {label && <span className="text-[13px] text-stone-300">{label}</span>}
    </button>
  );
}

function Button({ children, onClick, variant = 'ghost', disabled, className = '', title }) {
  const styles = {
    primary: 'bg-gold-400 text-ink-950 hover:bg-gold-300 font-bold',
    ghost: 'border border-white/10 bg-ink-900 text-stone-300 hover:border-gold-500/50 hover:text-gold-200',
    danger: 'border border-red-900/50 bg-red-950/30 text-red-300 hover:bg-red-950/60',
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-3 py-2 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function UploadDrop({ accept = 'image/*', onFile, disabled, title, subtitle }) {
  const inputRef = useRef(null);
  const handle = (files) => {
    const file = files?.[0];
    if (file && file.type.startsWith('image/')) onFile(file);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!disabled) handle(e.dataTransfer.files);
      }}
      className={`group grid place-items-center rounded-2xl border border-dashed px-4 py-6 text-center transition ${
        disabled
          ? 'cursor-wait border-white/10 opacity-50'
          : 'cursor-pointer border-gold-600/40 hover:border-gold-400 hover:bg-gold-400/5'
      }`}
    >
      <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-gold-400/10 text-xl text-gold-300">＋</div>
      <div className="text-sm font-bold text-stone-200">{title}</div>
      {subtitle && <div className="mt-1 text-[11px] text-stone-500">{subtitle}</div>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function ProgressBar({ percent, label }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[12px] text-stone-400">
        <span>{label}</span>
        <span dir="ltr">{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-600">
        <div className="h-full rounded-full bg-gradient-to-l from-gold-300 to-gold-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// ===== components/TransformableImage.jsx =====









/** شكل ملوّن خلف الصورة (محراب، قوس، دائرة، توهّج…) يتحرك معها */
function Backdrop({ item }) {
  const bd = item.backdrop;
  if (!bd || bd.shape === 'none') return null;
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
  } else if (bd.fade > 0) {
    fill = {
      fillLinearGradientStartPoint: { x: 0, y: -h / 2 },
      fillLinearGradientEndPoint: { x: 0, y: h / 2 },
      fillLinearGradientColorStops: [0, rgba(bd.color, 1), Math.max(0, 1 - bd.fade), rgba(bd.color, 1), 1, rgba(bd.color, 0)],
    };
  } else {
    fill = { fill: bd.color };
  }

  return (
    <>
      <Shape
        y={y}
        sceneFunc={scene}
        {...fill}
        opacity={bd.opacity}
        stroke={bd.stroke ? bd.strokeColor : undefined}
        strokeWidth={bd.stroke ? 4 : 0}
        strokeEnabled={!!bd.stroke}
      />
      {bd.pattern > 0 && bd.shape !== 'glow' && (
        <Shape
          y={y}
          sceneFunc={scene}
          fillPatternImage={getOverlayCanvas('islamic')}
          fillPatternRepeat="repeat"
          fillPatternScale={{ x: 0.55 / OVERLAY_SCALE, y: 0.55 / OVERLAY_SCALE }}
          opacity={bd.pattern}
          listening={false}
        />
      )}
    </>
  );
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
  const source = useMemo(
    () => (image && (fadeBottom > 0 || fadeEdges > 0) ? makeFadedImage(image, fadeBottom, fadeEdges) : image),
    [image, fadeBottom, fadeEdges]
  );
  const { filters, attrs } = useMemo(() => buildImageFilters(item.fx), [item.fx]);

  const mode = item.shadowMode || (item.shadow ? 'ground' : 'none');
  const shadow =
    mode === 'ground'
      ? { shadowEnabled: true, shadowColor: '#000', shadowBlur: 45, shadowOpacity: 0.75, shadowOffsetX: 0, shadowOffsetY: 18 }
      : mode === 'glow'
      ? { shadowEnabled: true, shadowColor: item.glowColor || '#ffffff', shadowBlur: item.glowSize ?? 60, shadowOpacity: 1, shadowOffsetX: 0, shadowOffsetY: 0 }
      : { shadowEnabled: false };

  // المرشحات تعمل على نسخة مخزّنة (cache) — نعيد بناءها عند أي تغيير
  useEffect(() => {
    const node = imgRef.current;
    if (!node) return;
    if (filters.length) node.cache({ pixelRatio: 2 });
    else node.clearCache();
    node.getLayer()?.batchDraw();
  }, [source, filters, attrs, item.width, item.height, mode, item.glowColor, item.glowSize]);

  if (!source) return null;

  return (
    <Group
      id={item.id}
      name="element"
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      scaleX={item.scale}
      scaleY={item.scale}
      opacity={item.opacity}
      visible={item.visible !== false}
      listening={!item.locked}
      draggable={!item.locked}
      onMouseDown={(e) => onSelect(item.id, e.evt?.shiftKey)}
      onTap={() => onSelect(item.id)}
      onDblClick={() => onOpenProps?.(item.id)}
      onDblTap={() => onOpenProps?.(item.id)}
      onDragEnd={onDragEnd}
    >
      <Backdrop item={item} />
      <KonvaImage
        ref={imgRef}
        image={source}
        width={item.width}
        height={item.height}
        offsetX={item.width / 2}
        offsetY={item.height / 2}
        filters={filters}
        {...attrs}
        {...shadow}
      />
    </Group>
  );
}

// ===== components/TransformableShape.jsx =====




/** عنصر زخرفي قابل للتلوين والسحب والتمديد والتدوير */
function TransformableShape({ item, onSelect, onDragEnd, onOpenProps }) {
  const def = getShapeDef(item.kind);
  const w = item.width, h = item.height;
  const hasStroke = item.strokeWidth > 0 && item.stroke && item.stroke !== 'rgba(0,0,0,0)';
  return (
    <Group
      id={item.id}
      name="element"
      shapeW={w}
      shapeH={h}
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      opacity={item.opacity}
      visible={item.visible !== false}
      listening={!item.locked}
      draggable={!item.locked}
      onMouseDown={(e) => onSelect(item.id, e.evt?.shiftKey)}
      onTap={() => onSelect(item.id)}
      onDblClick={() => onOpenProps?.(item.id)}
      onDblTap={() => onOpenProps?.(item.id)}
      onDragEnd={onDragEnd}
    >
      {/* منطقة لمس شفافة حتى يسهل اختيار الخطوط الرفيعة */}
      <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="rgba(0,0,0,0.01)" />
      <Shape
        sceneFunc={(ctx, shape) => def.draw(ctx, w, h, shape)}
        fill={item.fill}
        stroke={hasStroke ? item.stroke : undefined}
        strokeWidth={hasStroke ? item.strokeWidth : 0}
        strokeEnabled={hasStroke}
        lineJoin="round"
        lineCap="round"
        shadowEnabled={!!item.shadow}
        shadowColor="#000"
        shadowBlur={item.shadow ? 20 : 0}
        shadowOpacity={item.shadow ? 0.7 : 0}
        shadowOffsetY={item.shadow ? 6 : 0}
        listening={false}
      />
    </Group>
  );
}

// ===== components/FontPicker.jsx =====




/** منتقي خطوط مرئي: كل خط يُعرض بشكله الحقيقي، مقسّماً حسب النوع */
function FontPicker({ value, onChange, sample = 'أبجد هوز' }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(() => getFontMeta(value)?.category || 'calligraphy');
  const [, setTick] = useState(0);

  // تحميل خطوط النوع المعروض فقط عند فتح المنتقي
  useEffect(() => {
    if (!open) return;
    let alive = true;
    ARABIC_FONTS.filter((f) => f.category === cat).forEach((f) =>
      loadGoogleFont(f.family).then(() => alive && setTick((t) => t + 1))
    );
    return () => {
      alive = false;
    };
  }, [open, cat]);

  const current = getFontMeta(value);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-right transition ${
          open ? 'border-gold-500/60 bg-ink-900' : 'border-white/10 bg-ink-900 hover:border-gold-500/40'
        }`}
      >
        <span className="min-w-0">
          <span className="block text-[11px] text-stone-500">الخط</span>
          <span className="block truncate text-[19px] leading-tight text-stone-100" style={{ fontFamily: `"${value}"` }}>
            {current?.label || value}
          </span>
        </span>
        <span className={`text-[10px] text-stone-500 transition ${open ? 'rotate-90' : ''}`}>◀</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-ink-900 p-2">
          <div className="scroll-thin flex gap-1 overflow-x-auto pb-1">
            {FONT_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] transition ${
                  cat === c.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-800 text-stone-400'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ARABIC_FONTS.filter((f) => f.category === cat).map((f) => (
              <button
                key={f.family}
                type="button"
                onClick={() => {
                  onChange(f.family);
                  setOpen(false);
                }}
                className={`rounded-lg border px-2 py-2 text-center transition ${
                  value === f.family ? 'border-gold-400 bg-gold-400/10' : 'border-white/5 bg-ink-800 hover:border-white/20'
                }`}
              >
                <span className="block truncate text-[20px] leading-snug text-stone-100" style={{ fontFamily: `"${f.family}"` }}>
                  {sample}
                </span>
                <span className="block truncate text-[10.5px] text-stone-500">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== components/CoverCanvas.jsx =====














function paletteFill(palette) {
  const [base, light, edge] = palette.colors;
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
function BackgroundImage({ bg, palette }) {
  const img = useHTMLImage(bg.src);
  if (!img) return null;
  const base = Math.max(COVER_W / img.naturalWidth, COVER_H / img.naturalHeight) * bg.scale;
  const w = img.naturalWidth * base;
  const h = img.naturalHeight * base;
  const x = (COVER_W - w) / 2 + (bg.offsetX * (w - COVER_W)) / 2;
  const y = (COVER_H - h) / 2 + (bg.offsetY * (h - COVER_H)) / 2;
  return (
    <>
      <KonvaImage name="background" image={img} x={x} y={y} width={w} height={h} opacity={bg.opacity} />
      {bg.paletteMix > 0 && (
        <Rect
          name="background"
          width={COVER_W}
          height={COVER_H}
          {...paletteFill(palette)}
          opacity={bg.paletteMix}
          globalCompositeOperation={bg.blend || 'soft-light'}
        />
      )}
      {bg.dim > 0 && <Rect name="background" width={COVER_W} height={COVER_H} fill="#000" opacity={bg.dim} />}
    </>
  );
}

/** شكل خلف النص: شريط لكل سطر، صندوق، إطار بيضاوي، لوحة زخرفية، هالة، خط سفلي */
function TextBackground({ t, lines, lh }) {
  const type = t.bg || 'none';
  if (type === 'none') return null;
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
      return lines.map((l, i) => (
        <Rect
          key={i}
          x={-l.width / 2 - pad}
          y={i * lh + (lh - glyphH) / 2 - pad * 0.35}
          width={l.width + pad * 2}
          height={glyphH + pad * 0.7}
          fill={color}
          opacity={op}
          cornerRadius={t.bgRadius || 0}
        />
      ));
    case 'box':
      return <Rect x={-blockW / 2 - pad} y={top} width={blockW + pad * 2} height={boxH} fill={color} opacity={op} cornerRadius={t.bgRadius || 0} />;
    case 'pill':
      return (
        <Rect
          x={-blockW / 2 - pad * 1.6}
          y={top}
          width={blockW + pad * 3.2}
          height={boxH}
          cornerRadius={boxH / 2}
          stroke={t.bgStroke || color}
          strokeWidth={Math.max(1.5, t.size * 0.025)}
          fill={rgba(color, 0.18 * op)}
          opacity={op}
        />
      );
    case 'plaque': {
      const w = blockW + pad * 2 + boxH * 0.3;
      const cy = top + boxH / 2;
      const dotX = w / 2 + boxH * 0.18 + boxH * 0.22;
      return (
        <>
          <Shape
            y={cy}
            sceneFunc={(ctx, shape) => {
              tracePlaque(ctx, w, boxH);
              ctx.fillStrokeShape(shape);
            }}
            fillLinearGradientStartPoint={{ x: 0, y: -boxH / 2 }}
            fillLinearGradientEndPoint={{ x: 0, y: boxH / 2 }}
            fillLinearGradientColorStops={[0, rgba(color, 1), 1, rgba(color, 0.82)]}
            stroke={t.bgStroke}
            strokeWidth={Math.max(2, t.size * 0.03)}
            opacity={op}
          />
          <Circle x={-dotX} y={cy} radius={boxH * 0.07} fill={t.bgStroke || color} opacity={op} />
          <Circle x={dotX} y={cy} radius={boxH * 0.07} fill={t.bgStroke || color} opacity={op} />
        </>
      );
    }
    case 'halo':
      return (
        <Ellipse
          x={0}
          y={blockH / 2}
          radiusX={blockW * 0.62 + pad * 2}
          radiusY={blockH * 0.85 + pad * 2}
          fillRadialGradientStartPoint={{ x: 0, y: 0 }}
          fillRadialGradientEndPoint={{ x: 0, y: 0 }}
          fillRadialGradientStartRadius={0}
          fillRadialGradientEndRadius={blockW * 0.62 + pad * 2}
          fillRadialGradientColorStops={[0, rgba(color, op), 0.55, rgba(color, op * 0.45), 1, rgba(color, 0)]}
          listening={false}
        />
      );
    case 'underline': {
      const y = blockH - (lh - glyphH) / 2 + pad * 0.4;
      return <Rect x={-blockW / 2} y={y} width={blockW} height={Math.max(3, t.size * 0.05)} fill={color} opacity={op} cornerRadius={2} />;
    }
    default:
      return null;
  }
}

/** مجموعة نص كاملة: الخلفية + الطبقات السفلية للتأثير + النص (أو كل سطر بلونه) */
function TextGroup({ id, t, fontsVersion, onSelect, onDragEnd, onOpenProps }) {
  const lines = useMemo(
    () => measureLines(t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t.text, t.font, t.weight, t.size, t.width, t.letterSpacing, fontsVersion]
  );
  const lh = t.size * t.lineHeight;
  const perLine = !!t.secondColor && lines.length > 1;
  const pieces = perLine
    ? lines.map((l, i) => ({ text: l.text, y: i * lh, color: i === 0 ? t.color : t.secondColor }))
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

  return (
    <Group
      id={`text-${id}`}
      x={t.x}
      y={t.y}
      rotation={t.rotation || 0}
      opacity={t.opacity ?? 1}
      name="element"
      visible={t.visible !== false}
      listening={!t.locked}
      draggable={!t.locked}
      onMouseDown={(e) => onSelect(`text-${id}`, e.evt?.shiftKey)}
      onTap={() => onSelect(`text-${id}`)}
      onDblClick={() => onOpenProps?.(`text-${id}`)}
      onDblTap={() => onOpenProps?.(`text-${id}`)}
      onDragEnd={onDragEnd}
    >
      <TextBackground t={t} lines={lines} lh={lh} />
      {pieces.map((p, pi) => {
        const { main, under } = buildTextLayers({ ...t, text: p.text, color: p.color });
        return [
          ...under.map(({ dy = 0, dx = 0, ...u }, i) => (
            <Text key={`${k}-${pi}-u${i}`} {...common} text={p.text} x={dx} y={p.y + dy} {...u} listening={false} />
          )),
          <Text key={`${k}-${pi}`} {...common} text={p.text} y={p.y} {...main} />,
        ];
      })}
    </Group>
  );
}

const SAFE_MARGIN = 60;
const SNAP = 8;

const CoverCanvas = forwardRef(function CoverCanvas(
  { texts, images, shapes = [], logo, palette, background, layers, grade, textAboveLayers, selectedIds, onSelect, onCommit, onOpenProps, fontsVersion, snapping = true, zoom = 1, onZoomChange },
  ref
) {
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
    if (!el) return;
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
    if (!tr) return;
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
    if (!id.startsWith('text-')) patch.scale = Math.max(0.05, node.scaleX());
    return { id, patch };
  };

  const handleDragEnd = (e) => {
    setGuides([]);
    snapTargets.current = null;
    const node = e.target;
    const nodes = new Set([node]);
    if (selectedIds.includes(node.id())) selectedNodes().forEach((n) => nodes.add(n));
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
    if (!snapping || selectedIds.length > 1 || !e.target.id()) return;
    const layer = layerRef.current;
    const vs = [0, SAFE_MARGIN, COVER_W / 2, COVER_W - SAFE_MARGIN, COVER_W];
    const hs = [0, SAFE_MARGIN, COVER_H / 2, COVER_H - SAFE_MARGIN, COVER_H];
    for (const id of elementIds) {
      if (id === e.target.id()) continue;
      const n = findNode(id);
      if (!n || !n.visible()) continue;
      const r = n.getClientRect({ relativeTo: layer, skipShadow: true });
      vs.push(r.x, r.x + r.width / 2, r.x + r.width);
      hs.push(r.y, r.y + r.height / 2, r.y + r.height);
    }
    snapTargets.current = { vs, hs };
  };

  const handleDragMove = (e) => {
    const t = snapTargets.current;
    const node = e.target;
    if (!t || !node.id()) return;
    const r = node.getClientRect({ relativeTo: layerRef.current, skipShadow: true });
    const best = (edges, targets) => {
      let res = null;
      for (const ed of edges) for (const tg of targets) {
        const d = tg - ed;
        if (Math.abs(d) <= SNAP && (!res || Math.abs(d) < Math.abs(res.d))) res = { d, pos: tg };
      }
      return res;
    };
    const bx = best([r.x, r.x + r.width / 2, r.x + r.width], t.vs);
    const by = best([r.y, r.y + r.height / 2, r.y + r.height], t.hs);
    const g = [];
    if (bx) { node.x(node.x() + bx.d); g.push({ v: true, pos: bx.pos }); }
    if (by) { node.y(node.y() + by.d); g.push({ v: false, pos: by.pos }); }
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
      } finally {
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
      } finally {
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
        if (type === 'centerH') dx = COVER_W / 2 - (r.x + r.width / 2);
        if (type === 'centerV') dy = COVER_H / 2 - (r.y + r.height / 2);
        if (type === 'left') dx = SAFE_MARGIN - r.x;
        if (type === 'right') dx = COVER_W - SAFE_MARGIN - (r.x + r.width);
        if (type === 'top') dy = SAFE_MARGIN - r.y;
        if (type === 'bottom') dy = COVER_H - SAFE_MARGIN - (r.y + r.height);
        return { id: n.id(), patch: { x: n.x() + dx, y: n.y() + dy } };
      });
      if (patches.length) onCommit(patches);
    },
  }));

  const overlays = useMemo(
    () =>
      ALL_OVERLAYS.filter((o) => layers[o.id]?.enabled).map((o) => ({
        id: o.id,
        blend: o.blend,
        opacity: layers[o.id].opacity,
        canvas: getOverlayCanvas(o.id),
      })),
    [layers]
  );
  const grading = gradeLayers(grade, COVER_W, COVER_H);

  const selectedTexts = selectedIds.some((id) => id.startsWith('text-'));
  const onlyShapes = selectedIds.length > 0 && selectedIds.every((id) => id.startsWith('shp-'));
  const shapeNodes = (behind) =>
    shapes
      .filter((sh) => !!sh.behind === behind)
      .map((sh) => <TransformableShape key={sh.id} item={sh} onSelect={onSelect} onDragEnd={handleDragEnd} onOpenProps={onOpenProps} />);

  const textNodes = Object.entries(texts).map(([key, t]) => (
    <TextGroup key={key} id={key} t={t} fontsVersion={fontsVersion} onSelect={onSelect} onDragEnd={handleDragEnd} onOpenProps={onOpenProps} />
  ));

  const handleStageDown = (e) => {
    const target = e.target;
    if (target === target.getStage() || target.name() === 'background') onSelect(null);
  };

  return (
    <>
      <div ref={wrapRef} className="scroll-thin absolute inset-0 overflow-auto">
        <div className="flex min-h-full min-w-full items-center justify-center p-3 lg:p-8" style={{ width: 'max-content', height: 'max-content' }}>
          <div className="shrink-0 shadow-cover" style={{ width: COVER_W * scale, height: COVER_H * scale }}>
            <Stage
              ref={stageRef}
              width={COVER_W * scale}
              height={COVER_H * scale}
              scaleX={scale}
              scaleY={scale}
              onMouseDown={handleStageDown}
              onTouchStart={handleStageDown}
            >
              {/* طبقة واحدة حتى تعمل أوضاع الدمج على كامل التصميم */}
              <Layer ref={layerRef} onDragStart={handleDragStart} onDragMove={handleDragMove}>
                <Rect name="background" x={0} y={0} width={COVER_W} height={COVER_H} {...paletteFill(palette)} />
                {background && <BackgroundImage bg={background} palette={palette} />}

                {shapeNodes(true)}
                {images.map((img) => (
                  <TransformableImage key={img.id} item={img} onSelect={onSelect} onDragEnd={handleDragEnd} onOpenProps={onOpenProps} />
                ))}
                {logo && <TransformableImage item={logo} onSelect={onSelect} onDragEnd={handleDragEnd} onOpenProps={onOpenProps} />}

                {shapeNodes(false)}
                {!textAboveLayers && textNodes}

                {overlays.map((o) => (
                  <KonvaImage
                    key={o.id}
                    image={o.canvas}
                    x={0}
                    y={0}
                    width={COVER_W}
                    height={COVER_H}
                    opacity={o.opacity}
                    globalCompositeOperation={o.blend}
                    listening={false}
                  />
                ))}

                {grading.map(({ blend, ...g }, i) => (
                  <Rect key={`grade-${i}`} x={0} y={0} width={COVER_W} height={COVER_H} {...g} globalCompositeOperation={blend} listening={false} />
                ))}

                {textAboveLayers && textNodes}

                <Transformer
                  ref={trRef}
                  rotateEnabled
                  keepRatio={!onlyShapes}
                  enabledAnchors={
                    selectedTexts
                      ? []
                      : onlyShapes
                      ? ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
                      : ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                  }
                  anchorFill="#d4af6a"
                  anchorStroke="#0d0b09"
                  anchorSize={12}
                  anchorCornerRadius={6}
                  borderStroke="#d4af6a"
                  borderDash={[6, 4]}
                  rotateAnchorOffset={36}
                  rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                  rotationSnapTolerance={4}
                  onTransformEnd={() => onCommit(selectedNodes().map(readPatch))}
                  boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 4 ? oldBox : newBox)}
                />
              </Layer>

              {/* خطوط المحاذاة الذكية — لا تدخل في التصدير */}
              <Layer listening={false}>
                {guides.map((g, i) => (
                  <Line
                    key={i}
                    points={g.v ? [g.pos, 0, g.pos, COVER_H] : [0, g.pos, COVER_W, g.pos]}
                    stroke="#ff3d7f"
                    strokeWidth={1.2 / scale}
                    dash={[6 / scale, 4 / scale]}
                  />
                ))}
              </Layer>
            </Stage>
          </div>
        </div>
      </div>

    </>
  );
});


// ===== components/tabs/TemplatesTab.jsx =====







const GOLD_CSS = 'linear-gradient(180deg,#fff4c8 0%,#e6c46a 30%,#9c7426 50%,#f2d47c 62%,#b8892f 85%,#76531a 100%)';

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

  return (
    <Section title="القوالب الجاهزة" hint="نقرة واحدة تضبط الخطوط والألوان والطبقات — نصوصك وصورك تبقى كما هي، ويمكنك التراجع بزر ↶">
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={`rounded-full px-3 py-1 text-[12px] transition ${
              cat === c.id ? 'bg-gold-400 font-bold text-ink-950' : 'border border-white/10 bg-ink-900 text-stone-400 hover:text-stone-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {list.map((tpl) => {
          const palette = tpl.customPalette ? tpl.customPalette : getPalette(tpl.paletteId);
          const category = TEMPLATE_CATEGORIES.find((c) => c.id === tpl.category)?.label;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onApplyTemplate(tpl)}
              className={`group overflow-hidden rounded-xl border text-right transition ${
                activeTemplateId === tpl.id ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-white/10 hover:border-gold-500/50'
              }`}
            >
              <div
                className="relative flex aspect-[2/3] flex-col items-center justify-between overflow-hidden px-2 py-4 text-center"
                style={{ background: paletteToCss(palette), boxShadow: 'inset 0 0 50px rgba(0,0,0,.6)' }}
              >
                {tpl.layers?.frame && <div className="pointer-events-none absolute inset-2 rounded-sm border border-gold-400/60" />}
                {tpl.layers?.thinframe && <div className="pointer-events-none absolute inset-2 border border-white/50" />}
                {tpl.layers?.torn && <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 0 5px #0a0908, inset 0 0 18px 8px rgba(0,0,0,.9)' }} />}
                {tpl.imageStyle?.backdrop?.shape === 'mihrab' && (
                  <div className="pointer-events-none absolute bottom-0 left-1/2 h-[55%] w-[55%] -translate-x-1/2 rounded-t-[50%] opacity-80" style={{ background: `linear-gradient(${tpl.imageStyle.backdrop.color}, transparent)` }} />
                )}
                {tpl.tag?.visible && (
                  <div className="absolute right-2 top-2 bg-stone-300 px-1.5 text-[8px] font-bold text-stone-900">{tpl.tag.text || 'مقال'}</div>
                )}
                <div className="relative z-10 whitespace-pre-line text-[20px]">
                  <span style={{ ...titleStyle({ color: '#fff', color2: '#fff', glowColor: '#fff', strokeColor: '#000', strokeWidth: 5, ...tpl.title }), ...bgStyle(tpl.title) }}>
                    {tpl.title.secondColor ? (
                      <>
                        {tpl.sample.split('\n')[0]}
                        {'\n'}
                        <span style={{ color: tpl.title.secondColor }}>{tpl.sample.split('\n')[1]}</span>
                      </>
                    ) : (
                      tpl.sample
                    )}
                  </span>
                </div>
                <div className="relative z-10 text-[9px] opacity-80" style={{ fontFamily: `"${tpl.subtitle.font}"`, color: tpl.subtitle.color }}>
                  اسم المؤلف
                </div>
              </div>
              <div className="flex items-center justify-between bg-ink-900 px-2.5 py-2">
                <span className="text-[12px] text-stone-200">{tpl.name}</span>
                <span className="text-[10px] text-stone-500">{category}</span>
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
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
  return (
    <div className={`grid gap-1.5 ${cols === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={`rounded-lg px-1.5 py-2 text-[11.5px] transition ${
            value === it.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-800 text-stone-400 hover:text-stone-200'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
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
    if (!focusSignal || !open) return;
    boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const t = setTimeout(() => {
      textRef.current?.focus();
      textRef.current?.select();
    }, 250);
    return () => clearTimeout(t);
  }, [focusSignal, open]);

  return (
    <section ref={boxRef} className={`scroll-mt-4 rounded-2xl border bg-ink-800/70 ${open ? 'border-gold-500/30' : 'border-white/5'}`}>
      <header className="flex items-center justify-between gap-2 p-3">
        <button type="button" onClick={onToggleOpen} className="flex min-w-0 flex-1 items-center gap-2 text-right">
          <span className={`text-[10px] text-stone-500 transition ${open ? 'rotate-90' : ''}`}>◀</span>
          <span className="min-w-0">
            <span className={`block text-[13px] font-bold ${visible ? 'text-gold-300' : 'text-stone-500'}`}>{slot.label}</span>
            <span className="block truncate text-[11px] text-stone-500">{value.text.replace(/\n/g, ' · ') || '—'}</span>
          </span>
        </button>
        <Toggle checked={visible} onChange={(v) => set({ visible: v })} small />
      </header>

      {open && (
        <div className="space-y-4 border-t border-white/5 p-4">
          <p className="text-[11px] text-stone-500">{slot.hint}</p>
          <TextAreaField
            inputRef={textRef}
            value={value.text}
            rows={id === 'title' || id === 'subtitle' ? 2 : 2}
            onChange={(text) => set({ text })}
            style={{ fontFamily: `"${value.font}"`, fontWeight: value.weight }}
          />
          {id === 'date' && (
            <Button onClick={() => set({ text: hijriNow() })} className="w-full text-[12px]">
              إدراج الشهر والسنة الهجرية الحالية
            </Button>
          )}

          <FontPicker
            value={value.font}
            sample={(value.text || 'أبجد').split('\n')[0].slice(0, 12) || 'أبجد'}
            onChange={(fontName) => set({ font: fontName, weight: closestWeight(fontName, value.weight) })}
          />
          <SelectField label="الوزن" value={String(value.weight)} options={weightOptions} onChange={(w) => set({ weight: Number(w) })} />

          <RangeField label="الحجم" min={12} max={260} value={value.size} onChange={(size) => set({ size })} format={(v) => `${v}px`} />
          <RangeField label="تباعد الأسطر" min={0.8} max={2.2} step={0.05} value={value.lineHeight} onChange={(lineHeight) => set({ lineHeight })} format={(v) => v.toFixed(2)} />
          <RangeField label="عرض صندوق النص" min={120} max={COVER_W} step={10} value={value.width} onChange={(width) => set({ width })} />
          <RangeField label="الموضع الأفقي" min={0} max={COVER_W} value={Math.round(value.x)} onChange={(x) => set({ x })} />
          <RangeField label="الموضع العمودي" min={0} max={COVER_H - 20} value={Math.round(value.y)} onChange={(y) => set({ y })} />
          <RangeField label="التدوير" min={-30} max={30} value={Math.round(value.rotation || 0)} onChange={(rotation) => set({ rotation })} format={(v) => `${v}°`} />
          <RangeField
            label="تباعد الأحرف (للنص اللاتيني فقط)"
            min={0}
            max={40}
            value={value.letterSpacing || 0}
            onChange={(letterSpacing) => set({ letterSpacing })}
          />

          <ColorField label={value.effect === 'gradient' ? 'لون البداية' : 'اللون'} value={value.color} onChange={(color) => set({ color })} />
          <div className="flex items-center justify-between gap-3">
            <Toggle
              checked={!!value.secondColor}
              onChange={(on) => set({ secondColor: on ? '#5fb39a' : '' })}
              label="لون مختلف للسطر الثاني"
              small
            />
            {value.secondColor && (
              <input type="color" className="swatch" value={value.secondColor} onChange={(e) => set({ secondColor: e.target.value })} />
            )}
          </div>

          {/* خلفية النص */}
          <div className="space-y-3 rounded-xl border border-white/5 bg-ink-900/60 p-3">
            <FieldLabel>شكل خلف النص</FieldLabel>
            <ChipGroup items={TEXT_BACKGROUNDS} value={value.bg || 'none'} onChange={(bg) => set({ bg })} cols={4} />
            {value.bg && value.bg !== 'none' && (
              <>
                <ColorField label="لون الشكل" value={value.bgColor} onChange={(bgColor) => set({ bgColor })} />
                {(value.bg === 'pill' || value.bg === 'plaque') && (
                  <ColorField label="لون الإطار" value={value.bgStroke} onChange={(bgStroke) => set({ bgStroke })} />
                )}
                <RangeField label="الشفافية" min={0.05} max={1} step={0.01} value={value.bgOpacity} onChange={(bgOpacity) => set({ bgOpacity })} format={(v) => `${Math.round(v * 100)}%`} />
                <RangeField label="الهامش" min={0} max={60} value={value.bgPadding} onChange={(bgPadding) => set({ bgPadding })} />
                {(value.bg === 'bars' || value.bg === 'box') && (
                  <RangeField label="استدارة الزوايا" min={0} max={40} value={value.bgRadius || 0} onChange={(bgRadius) => set({ bgRadius })} />
                )}
              </>
            )}
          </div>

          {/* تأثير النص */}
          <div className="space-y-3 rounded-xl border border-white/5 bg-ink-900/60 p-3">
            <FieldLabel>تأثير النص</FieldLabel>
            <ChipGroup items={TEXT_EFFECTS} value={value.effect} onChange={(effect) => set({ effect })} />
            {value.effect === 'gradient' && <ColorField label="لون النهاية" value={value.color2} onChange={(color2) => set({ color2 })} />}
            {(value.effect === 'glow' || value.effect === 'neon') && (
              <ColorField label="لون التوهّج" value={value.glowColor} onChange={(glowColor) => set({ glowColor })} />
            )}
            {value.effect === 'extrude' && <ColorField label="لون العمق" value={value.color2} onChange={(color2) => set({ color2 })} />}
            {value.effect === 'double' && (
              <>
                <ColorField label="لون الحدّ الداخلي" value={value.strokeColor} onChange={(strokeColor) => set({ strokeColor })} />
                <ColorField label="لون الحدّ الخارجي" value={value.color2} onChange={(color2) => set({ color2 })} />
                <RangeField label="السماكة" min={1} max={16} value={value.strokeWidth} onChange={(strokeWidth) => set({ strokeWidth })} />
              </>
            )}
            {value.effect === 'outline' && (
              <>
                <ColorField label="لون الحدّ" value={value.strokeColor} onChange={(strokeColor) => set({ strokeColor })} />
                <RangeField label="سماكة الحدّ" min={1} max={24} value={value.strokeWidth} onChange={(strokeWidth) => set({ strokeWidth })} />
                <Toggle checked={!!value.outlineOnly} onChange={(outlineOnly) => set({ outlineOnly })} label="حدّ فقط (نص مفرغ)" small />
              </>
            )}
            {value.effect === 'engraved' && <p className="text-[11px] text-stone-500">يبدو أفضل بلون نص أغمق قليلاً من الخلفية.</p>}
          </div>

          <div className="flex items-center justify-between">
            <Toggle checked={!!value.shadow} onChange={(shadow) => set({ shadow })} label="ظل سينمائي" small />
            <div className="flex gap-2">
              <Button onClick={() => set({ x: COVER_W / 2, rotation: 0 })} className="!px-2.5 text-[11px]">توسيط</Button>
              <Button onClick={() => onSelect(`text-${id}`)} className="!px-2.5 text-[11px]">تحديد</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TypographyTab({ texts, onChangeText, onSelect, openSlot, onOpenSlot, focusSignal }) {
  const [localOpen, setLocalOpen] = useState('title');
  const open = openSlot !== undefined ? openSlot : localOpen;
  const setOpen = onOpenSlot || setLocalOpen;
  return (
    <>
      {TEXT_SLOTS.filter((s) => texts[s.id]).map((slot) => (
        <TextBlockEditor
          key={slot.id}
          slot={slot}
          value={texts[slot.id]}
          onChange={onChangeText}
          onSelect={onSelect}
          open={open === slot.id}
          onToggleOpen={() => setOpen(open === slot.id ? null : slot.id)}
          focusSignal={open === slot.id ? focusSignal : 0}
        />
      ))}
      <Section>
        <p className="text-[11px] leading-relaxed text-stone-500">
          اسحب أي نص مباشرة على الغلاف. المفتاح بجانب كل نص يُظهره أو يخفيه. تباعد الأحرف يفكّك الحروف العربية، فاستخدمه للنص اللاتيني فقط.
        </p>
      </Section>
    </>
  );
}

// ===== components/tabs/CompositingTab.jsx =====







function FiltersEditor({ item, paletteLight, onChange }) {
  const fx = { ...DEFAULT_FX, ...(item.fx || {}) };
  const set = (patch) => onChange(item.id, { fx: { ...fx, ...patch } });
  return (
    <div className="space-y-3 rounded-xl border border-white/5 bg-ink-900/60 p-3">
      <FieldLabel>المرشحات</FieldLabel>
      <div className="grid grid-cols-3 gap-1.5">
        {FILTER_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => set({ preset: p.id })}
            className={`rounded-lg px-2 py-2 text-[12px] transition ${
              fx.preset === p.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <RangeField label="السطوع" min={-0.5} max={0.5} step={0.01} value={fx.brightness} onChange={(brightness) => set({ brightness })} format={(v) => Math.round(v * 100)} />
      <RangeField label="التباين" min={-50} max={60} value={fx.contrast} onChange={(contrast) => set({ contrast })} />
      <RangeField label="التشبّع" min={-2} max={1} step={0.05} value={fx.saturation} onChange={(saturation) => set({ saturation })} format={(v) => v.toFixed(2)} />
      <RangeField label="دمج اللون" min={0} max={0.7} step={0.01} value={fx.tint} onChange={(tint) => set({ tint })} format={(v) => `${Math.round(v * 100)}%`} />
      <ColorField label="لون الدمج" value={fx.tintColor} onChange={(tintColor) => set({ tintColor })} />
      <RangeField label="فسيفساء (بكسلة)" min={0} max={40} value={fx.pixelSize || 0} onChange={(pixelSize) => set({ pixelSize })} />
      <RangeField label="ضبابية" min={0} max={30} value={fx.blur || 0} onChange={(blur) => set({ blur })} />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => set({ tintColor: paletteLight, tint: Math.max(fx.tint, 0.25) })} className="text-[12px]">
          ✦ دمج مع لون الخلفية
        </Button>
        <Button onClick={() => onChange(item.id, { fx: { ...DEFAULT_FX } })} className="text-[12px]">
          إعادة الضبط
        </Button>
      </div>
    </div>
  );
}

function Chips({ items, value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={`rounded-lg px-1 py-2 text-[11.5px] transition ${
            value === it.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-800 text-stone-400 hover:text-stone-200'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
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

  return (
    <>
      <div className="space-y-3 rounded-xl border border-white/5 bg-ink-900/60 p-3">
        <FieldLabel>الظل والتوهّج</FieldLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {SHADOW_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(item.id, { shadowMode: m.id, shadow: m.id === 'ground' })}
              className={`rounded-lg px-1 py-2 text-[12px] transition ${
                mode === m.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode === 'glow' && (
          <>
            <ColorField label="لون التوهّج" value={item.glowColor || '#ffffff'} onChange={(glowColor) => onChange(item.id, { glowColor })} />
            <RangeField label="قوة التوهّج" min={10} max={150} value={item.glowSize ?? 60} onChange={(glowSize) => onChange(item.id, { glowSize })} />
          </>
        )}
        <RangeField label="تلاشي الأسفل (دمج مع الخلفية)" min={0} max={0.8} step={0.01} value={item.fadeBottom || 0} onChange={(fadeBottom) => onChange(item.id, { fadeBottom })} format={(v) => `${Math.round(v * 100)}%`} />
        <RangeField label="تلاشي الأطراف" min={0} max={0.9} step={0.01} value={item.fadeEdges || 0} onChange={(fadeEdges) => onChange(item.id, { fadeEdges })} format={(v) => `${Math.round(v * 100)}%`} />
      </div>

      <div className="space-y-3 rounded-xl border border-white/5 bg-ink-900/60 p-3">
        <FieldLabel>شكل ملوّن خلف العنصر</FieldLabel>
        <Chips items={BACKDROP_SHAPES} value={bd.shape} onChange={pickShape} />
        {bd.shape !== 'none' && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ColorField label="اللون" value={bd.color} onChange={(color) => setBd({ color })} />
              </div>
              <Button onClick={() => setBd({ color: paletteLight })} className="!px-2 text-[11px]">لون الخلفية</Button>
            </div>
            <RangeField label="الشفافية" min={0.05} max={1} step={0.01} value={bd.opacity} onChange={(opacity) => setBd({ opacity })} format={(v) => `${Math.round(v * 100)}%`} />
            <RangeField label="العرض" min={0.3} max={2.5} step={0.01} value={bd.width} onChange={(width) => setBd({ width })} format={(v) => `${Math.round(v * 100)}%`} />
            <RangeField label="الارتفاع" min={0.3} max={2.5} step={0.01} value={bd.height} onChange={(height) => setBd({ height })} format={(v) => `${Math.round(v * 100)}%`} />
            <RangeField label="إزاحة عمودية" min={-0.8} max={0.8} step={0.01} value={bd.offsetY} onChange={(offsetY) => setBd({ offsetY })} format={(v) => Math.round(v * 100)} />
            {bd.shape !== 'glow' && (
              <>
                <RangeField label="تلاشي الشكل من الأسفل" min={0} max={0.9} step={0.01} value={bd.fade} onChange={(fade) => setBd({ fade })} format={(v) => `${Math.round(v * 100)}%`} />
                <RangeField label="زخرفة داخل الشكل" min={0} max={1} step={0.01} value={bd.pattern} onChange={(pattern) => setBd({ pattern })} format={(v) => `${Math.round(v * 100)}%`} />
                <Toggle checked={!!bd.stroke} onChange={(stroke) => setBd({ stroke })} label="إطار ذهبي حول الشكل" small />
                {bd.stroke && <ColorField label="لون الإطار" value={bd.strokeColor} onChange={(strokeColor) => setBd({ strokeColor })} />}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function CompositingTab({
  images, selectedId, onSelect, onAddImage, onChangeNode, onRemoveImage, onMoveImage,
  autoColors, onToggleAutoColors, onSuggestColors, paletteLight, onOpenCutout, focusSignal,
}) {
  const [autoRemove, setAutoRemove] = useState(true);
  const [quality, setQuality] = useState(getCutQuality);
  const editorRef = useRef(null);
  const [job, setJob] = useState({ status: 'idle', label: '', percent: 0, error: null });
  const busy = job.status === 'working';
  const selected = images.find((i) => i.id === selectedId);

  // النقر المزدوج على صورة في الغلاف ← انتقل مباشرة إلى خصائصها
  useEffect(() => {
    if (focusSignal && editorRef.current) editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusSignal, selectedId]);

  const runRemoval = async (input) => {
    setJob({ status: 'working', label: 'تحميل محرك التفريغ…', percent: 0, error: null });
    try {
      const { blob, maskUrl } = await removeImageBackgroundDetailed(input, (p) => setJob((j) => ({ ...j, label: p.label, percent: p.percent })));
      setJob({ status: 'done', label: '', percent: 100, error: null });
      return { src: URL.createObjectURL(blob), maskSrc: maskUrl };
    } catch (err) {
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
    if (!selected) return;
    const res = await runRemoval(selected.originalSrc || selected.src);
    if (res) onChangeNode(selected.id, { src: res.src, maskSrc: res.maskSrc, cutout: true, originalSrc: selected.originalSrc || selected.src });
  };

  return (
    <>
      <Section title="رفع صورة" hint="شخص، عنصر، مبنى… تُفرَّغ داخل متصفحك دون رفعها لأي خادم">
        <UploadDrop
          onFile={handleFile}
          disabled={busy}
          title={busy ? 'جارٍ المعالجة…' : 'اسحب الصورة هنا أو اضغط للاختيار'}
          subtitle="PNG · JPG · WEBP"
        />
        <Toggle checked={autoRemove} onChange={setAutoRemove} label="إزالة الخلفية تلقائياً (AI داخل المتصفح)" small />
        {autoRemove && (
          <div>
            <FieldLabel>جودة القص</FieldLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {QUALITY_MODES.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setQuality(q.id);
                    setCutQuality(q.id);
                  }}
                  className={`rounded-lg py-2 text-[12px] transition ${quality === q.id ? 'bg-gold-400 font-bold text-ink-950' : 'bg-ink-800 text-stone-400 hover:text-stone-200'}`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <Toggle checked={autoColors} onChange={onToggleAutoColors} label="اقتراح الألوان تلقائياً من الصورة" small />
        {busy && <ProgressBar percent={job.percent} label={job.label} />}
        {job.status === 'error' && (
          <p className="rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-[12px] text-red-300">
            تعذّر التفريغ: {job.error}. تأكد من الاتصال عند أول استخدام لتنزيل النموذج.
          </p>
        )}
        <p className="text-[11px] leading-relaxed text-stone-500">
          أول تفريغ يستغرق وقتاً أطول لتنزيل النموذج مرة واحدة، ثم يُخزَّن في المتصفح.
        </p>
      </Section>

      {images.length > 0 && (
        <Section title="العناصر على الغلاف" hint="اضغط عنصراً لتحديده، أو حدّده مباشرة على الكانفاس">
          <div className="grid grid-cols-4 gap-2">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                title={img.credit || img.name}
                onClick={() => onSelect(img.id)}
                className={`relative aspect-square overflow-hidden rounded-xl border bg-[conic-gradient(#1f1b16_25%,#15120f_0_50%,#1f1b16_0_75%,#15120f_0)] bg-[length:12px_12px] transition ${
                  img.id === selectedId ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-white/10 hover:border-white/30'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.name} className="h-full w-full object-contain p-1" />
                {img.cutout && (
                  <span className="absolute bottom-1 right-1 rounded bg-gold-500 px-1 text-[9px] font-bold text-ink-950">شفافة</span>
                )}
              </button>
            ))}
          </div>
        </Section>
      )}

      {selected && (
        <div ref={editorRef} className="scroll-mt-4">
        <Section title="تحرير العنصر المحدد" hint="نقرتان على أي صورة في الغلاف تفتح خصائصها هنا مباشرة">
          <Button variant="primary" onClick={() => onOpenCutout(selected.id)} className="w-full">
            ✂ تحسين القص يدوياً (ممحاة / استعادة / الحواف)
          </Button>
          <RangeField label="الحجم" min={0.1} max={3} step={0.01} value={selected.scale} onChange={(scale) => onChangeNode(selected.id, { scale })} format={(v) => `${Math.round(v * 100)}%`} />
          <RangeField label="التدوير" min={-180} max={180} value={Math.round(selected.rotation)} onChange={(rotation) => onChangeNode(selected.id, { rotation })} format={(v) => `${v}°`} />
          <RangeField label="الشفافية" min={0} max={1} step={0.01} value={selected.opacity} onChange={(opacity) => onChangeNode(selected.id, { opacity })} format={(v) => `${Math.round(v * 100)}%`} />
          <AppearanceEditor item={selected} onChange={onChangeNode} paletteLight={paletteLight} />

          <FiltersEditor item={selected} paletteLight={paletteLight} onChange={onChangeNode} />

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onMoveImage(selected.id, 1)}>⬆ إلى الأمام</Button>
            <Button onClick={() => onMoveImage(selected.id, -1)}>⬇ إلى الخلف</Button>
            <Button onClick={() => onSuggestColors(selected.src)} className="col-span-2">
              🎨 اقتراح ألوان الغلاف من هذه الصورة
            </Button>
            {!selected.cutout && (
              <Button variant="primary" onClick={removeFromSelected} disabled={busy} className="col-span-2">
                ✦ إزالة خلفية هذه الصورة
              </Button>
            )}
            {selected.cutout && selected.originalSrc && selected.originalSrc !== selected.src && (
              <Button onClick={() => onChangeNode(selected.id, { src: selected.originalSrc, cutout: false })} className="col-span-2">
                استعادة الصورة الأصلية
              </Button>
            )}
            <Button variant="danger" onClick={() => onRemoveImage(selected.id)} className="col-span-2">
              حذف العنصر
            </Button>
          </div>
          {selected.credit && <p className="text-[11px] leading-relaxed text-stone-500">المصدر: {selected.credit}</p>}
        </Section>
        </div>
      )}
    </>
  );
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
    if (!term) return;
    setStatus({ loading: true, error: null, adding: null });
    try {
      const list =
        mode === 'icons'
          ? await searchIcons(term)
          : await searchTransparentPNG(term, (done, total) => setStatus((st) => ({ ...st, progress: `فحص الشفافية ${done}/${total}` })));
      setResults(list);
      setStatus({
        loading: false,
        adding: null,
        error: list.length ? null : mode === 'icons' ? 'لا توجد نتائج — جرّب كلمة إنجليزية (مثل: sword, lion, moon)' : 'لا توجد صور PNG شفافة لهذه الكلمة — جرّب كلمة إنجليزية أخرى',
      });
    } catch (err) {
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
    } catch {
      setStatus((s) => ({ ...s, error: 'تعذّر إضافة الأيقونة' }));
    } finally {
      setStatus((s) => ({ ...s, adding: null }));
    }
  };

  const addPng = async (item) => {
    setStatus((s) => ({ ...s, adding: item.id }));
    try {
      const src = await fetchCommonsImage(item);
      const credit = `${item.title} — ${item.artist || 'ويكيميديا كومنز'} (${item.license})`;
      await onAddImage(src, { name: item.title, cutout: true, credit });
    } catch (err) {
      setStatus((s) => ({ ...s, error: err.message }));
    } finally {
      setStatus((s) => ({ ...s, adding: null }));
    }
  };

  return (
    <>
      <Section title="مكتبة العناصر المجانية" hint="أيقونات وصور PNG شفافة فقط من مصادر مفتوحة">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-900 p-1">
          {[['icons', 'أيقونات'], ['png', 'صور PNG']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-lg py-2 text-[13px] transition ${mode === id ? 'bg-gold-400 font-bold text-ink-950' : 'text-stone-400'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'icons' ? 'ابحث: sword, crown, moon…' : 'ابحث: lion, castle, rose…'}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-stone-100 outline-none placeholder:text-stone-600 focus:border-gold-500/60"
          />
          <button type="submit" className="rounded-xl bg-gold-400 px-4 text-sm font-bold text-ink-950 hover:bg-gold-300">
            بحث
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {suggestions.map(([ar, en]) => (
            <button
              key={en}
              type="button"
              onClick={() => {
                setQuery(ar);
                search(en);
              }}
              className="rounded-full border border-white/10 bg-ink-900 px-2.5 py-1 text-[11px] text-stone-400 transition hover:border-gold-500/50 hover:text-gold-200"
            >
              {ar}
            </button>
          ))}
        </div>

        {mode === 'icons' && <ColorField label="لون الأيقونة" value={color} onChange={setColor} />}
        {status.loading && <p className="text-[12px] text-stone-400">{status.progress || 'جارٍ البحث…'}</p>}
        {status.error && <p className="text-[12px] text-red-300">{status.error}</p>}
      </Section>

      {results.length > 0 && (
        <Section title={`النتائج (${results.length})`} hint={mode === 'icons' ? 'اضغط على أي عنصر لإضافته إلى الغلاف' : 'صور PNG شفافة فقط (فُحصت تلقائياً) — اضغط لإضافتها'}>
          {mode === 'icons' ? (
            <div className="grid grid-cols-6 gap-1.5">
              {results.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  disabled={!!status.adding}
                  onClick={() => addIcon(name)}
                  className={`grid aspect-square place-items-center rounded-lg border bg-ink-900 p-1.5 transition hover:border-gold-400 ${
                    status.adding === name ? 'animate-pulse border-gold-400' : 'border-white/5'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={iconSvgUrl(name, color)} alt={name} loading="lazy" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={`${item.title}\n${item.artist}\n${item.license}`}
                  disabled={!!status.adding}
                  onClick={() => addPng(item)}
                  className={`overflow-hidden rounded-lg border bg-[conic-gradient(#1f1b16_25%,#15120f_0_50%,#1f1b16_0_75%,#15120f_0)] bg-[length:12px_12px] text-right transition hover:border-gold-400 ${
                    status.adding === item.id ? 'animate-pulse border-gold-400' : 'border-white/5'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumb} alt={item.title} loading="lazy" className="aspect-square w-full object-contain p-1" />
                  <div className="truncate bg-ink-900 px-1.5 py-1 text-[9px] text-stone-500" dir="ltr">{item.license}</div>
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-stone-500">
            {mode === 'icons'
              ? 'الأيقونات من مجموعات مفتوحة المصدر عبر Iconify، وتُضاف كـ PNG شفاف بدقة 1024px.'
              : 'الصور من ويكيميديا كومنز بتراخيص حرة. بعضها يشترط ذكر اسم المؤلف — يظهر المصدر عند تحديد العنصر.'}
          </p>
        </Section>
      )}
    </>
  );
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
  return (
    <>
      <Section title="شعار دار النشر" hint="يُفضَّل PNG بخلفية شفافة">
        <UploadDrop
          accept="image/png,image/svg+xml,image/webp"
          onFile={(file) => onSetLogo(URL.createObjectURL(file))}
          title={logo ? 'استبدال الشعار' : 'رفع الشعار'}
          subtitle="PNG شفاف · SVG · WEBP"
        />
      </Section>

      {logo && (
        <Section
          title="الموقع والحجم"
          action={
            <Button onClick={() => onSelect('logo')} className="!px-2.5 !py-1 text-[11px]">
              تحديد على الغلاف
            </Button>
          }
        >
          <div>
            <div className="mb-2 text-[12px] text-stone-400">موضع سريع</div>
            <div className="mx-auto grid w-40 grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-ink-900 p-2" style={{ aspectRatio: '2 / 3' }}>
              {POSITIONS.map(([v, hz]) => (
                <button
                  key={`${v}-${hz}`}
                  type="button"
                  title={`${v} ${hz}`}
                  onClick={() => onChangeNode('logo', positionFor(logo, v, hz))}
                  className="grid place-items-center rounded-md bg-white/5 transition hover:bg-gold-400/30"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
                </button>
              ))}
            </div>
          </div>

          <RangeField label="الحجم" min={0.1} max={3} step={0.01} value={logo.scale} onChange={(scale) => onChangeNode('logo', { scale })} format={(v) => `${Math.round(v * 100)}%`} />
          <RangeField label="التدوير" min={-180} max={180} value={Math.round(logo.rotation)} onChange={(rotation) => onChangeNode('logo', { rotation })} format={(v) => `${v}°`} />
          <RangeField label="الشفافية" min={0} max={1} step={0.01} value={logo.opacity} onChange={(opacity) => onChangeNode('logo', { opacity })} format={(v) => `${Math.round(v * 100)}%`} />
          <AppearanceEditor item={logo} onChange={onChangeNode} paletteLight="#d4af6a" />
          <Button variant="danger" onClick={onRemoveLogo} className="w-full">
            إزالة الشعار
          </Button>
        </Section>
      )}
    </>
  );
}

// ===== components/tabs/PalettesTab.jsx =====






const BLEND_OPTIONS = [
  { value: 'soft-light', label: 'ضوء ناعم' },
  { value: 'overlay', label: 'تراكب' },
  { value: 'multiply', label: 'تعتيم (ضرب)' },
  { value: 'color', label: 'تلوين' },
  { value: 'source-over', label: 'عادي' },
];

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
    } catch (err) {
      setState({ busy: false, error: err.message, started: 0 });
    }
  };

  return (
    <Section title="✦ توليد خلفية بالذكاء الاصطناعي" hint="اكتب وصف المشهد، أو اختر فكرة جاهزة">
      <textarea
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="مثال: ruined city at night under heavy rain — أو بالعربية: مدينة مدمّرة تحت المطر ليلاً"
        className="w-full resize-none rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm leading-relaxed text-stone-100 outline-none placeholder:text-stone-600 focus:border-gold-500/60"
      />
      <div className="flex flex-wrap gap-1.5">
        {AI_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={state.busy}
            onClick={() => {
              setPrompt(p.prompt);
              run(p.prompt);
            }}
            className="rounded-full border border-white/10 bg-ink-900 px-2.5 py-1 text-[11px] text-stone-400 transition hover:border-gold-500/50 hover:text-gold-200 disabled:opacity-40"
          >
            {p.label}
          </button>
        ))}
      </div>
      <Toggle checked={enhance} onChange={setEnhance} label="إضافة طابع سينمائي داكن للوصف تلقائياً" small />
      <Button variant="primary" onClick={() => run(prompt)} disabled={state.busy || !prompt.trim()} className="w-full">
        {state.busy ? 'جارٍ التوليد… (قد يستغرق 15–60 ثانية)' : 'توليد الخلفية'}
      </Button>
      {state.busy && (
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-600">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-gold-400" />
        </div>
      )}
      {state.error && <p className="rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-[12px] text-red-300">{state.error}</p>}
      <p className="text-[11px] leading-relaxed text-stone-500">
        يتم التوليد عبر خدمة Pollinations المجانية (تحتاج إنترنت). الوصف بالإنجليزية يعطي نتائج أدق. كل ضغطة تعطي صورة مختلفة.
      </p>
    </Section>
  );
}

function PalettesTab({
  paletteId, customPalette, onChangePalette, background, onSetBackground, onChangeBackground, onRemoveBackground, onSuggestColors,
}) {
  const options = [
    ...(customPalette ? [{ value: 'custom', label: `★ ${customPalette.name || 'نمط مخصص'}` }] : []),
    ...PALETTES.map((p, i) => ({ value: p.id, label: `${i + 1}. ${p.name}` })),
  ];

  return (
    <>
      <AIGenerator onResult={(src) => onSetBackground(src, { generated: true })} />

      <Section title="صورة خلفية كاملة" hint="ارفع صورة لتملأ الغلاف بدل التدرّج اللوني">
        <UploadDrop onFile={(file) => onSetBackground(URL.createObjectURL(file))} title={background ? 'استبدال صورة الخلفية' : 'رفع صورة خلفية'} subtitle="JPG · PNG · WEBP" />
        {background && (
          <>
            <RangeField label="التكبير" min={1} max={3} step={0.01} value={background.scale} onChange={(scale) => onChangeBackground({ scale })} format={(v) => `${Math.round(v * 100)}%`} />
            <RangeField label="إزاحة أفقية" min={-1} max={1} step={0.01} value={background.offsetX} onChange={(offsetX) => onChangeBackground({ offsetX })} format={(v) => Math.round(v * 100)} />
            <RangeField label="إزاحة عمودية" min={-1} max={1} step={0.01} value={background.offsetY} onChange={(offsetY) => onChangeBackground({ offsetY })} format={(v) => Math.round(v * 100)} />
            <RangeField label="تعتيم الصورة" min={0} max={0.9} step={0.01} value={background.dim} onChange={(dim) => onChangeBackground({ dim })} format={(v) => `${Math.round(v * 100)}%`} />
            <RangeField label="مزج النمط اللوني فوقها" min={0} max={1} step={0.01} value={background.paletteMix} onChange={(paletteMix) => onChangeBackground({ paletteMix })} format={(v) => `${Math.round(v * 100)}%`} />
            <SelectField label="طريقة المزج" value={background.blend} options={BLEND_OPTIONS} onChange={(blend) => onChangeBackground({ blend })} />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => onSuggestColors(background.src)} className="text-[12px]">🎨 ألوان من الخلفية</Button>
              <Button variant="danger" onClick={onRemoveBackground} className="text-[12px]">إزالة الخلفية</Button>
            </div>
          </>
        )}
      </Section>

      <Section title="النمط اللوني" hint="17 نمطاً داكناً وترابياً + النمط المقترح من صورك">
        <SelectField value={paletteId} onChange={onChangePalette} options={options} />
        <div className="grid grid-cols-3 gap-2.5">
          {customPalette && (
            <PaletteCard palette={{ id: 'custom', ...customPalette }} active={paletteId === 'custom'} onClick={() => onChangePalette('custom')} star />
          )}
          {PALETTES.map((p) => (
            <PaletteCard key={p.id} palette={p} active={p.id === paletteId} onClick={() => onChangePalette(p.id)} />
          ))}
        </div>
      </Section>
    </>
  );
}

function PaletteCard({ palette, active, onClick, star }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`overflow-hidden rounded-xl border text-right transition ${
        active ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-white/10 hover:border-white/30'
      }`}
    >
      <div className="aspect-[2/3]" style={{ background: paletteToCss(palette) }} />
      <div className="truncate bg-ink-900 px-2 py-1.5 text-[11px] text-stone-300">
        {star && '★ '}
        {palette.name}
      </div>
    </button>
  );
}

// ===== components/tabs/LayersTab.jsx =====





function LayersTab({ layers, onChangeLayer, onResetLayers, textAboveLayers, onToggleTextAbove, grade, onChangeGrade }) {
  return (
    <>
      <Section title="التدرّج اللوني السينمائي" hint="يلوّن الغلاف كاملاً كما في أفلام السينما">
        <div className="grid grid-cols-3 gap-2">
          {GRADES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onChangeGrade({ preset: g.id })}
              className={`overflow-hidden rounded-xl border text-center transition ${
                grade.preset === g.id ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div className="h-8" style={{ background: `linear-gradient(135deg, ${g.swatch[0]}, ${g.swatch[1]})` }} />
              <div className="bg-ink-900 py-1 text-[11px] text-stone-300">{g.label}</div>
            </button>
          ))}
        </div>
        {grade.preset !== 'none' && (
          <RangeField label="قوة التدرّج" min={0.05} max={1} step={0.01} value={grade.amount} onChange={(amount) => onChangeGrade({ amount })} format={(v) => `${Math.round(v * 100)}%`} />
        )}
      </Section>

      <Section
        title="الطبقات والمؤثرات"
        hint="تُطبَّق فوق التصميم بالكامل بأوضاع دمج سينمائية"
        action={
          <Button onClick={onResetLayers} className="!px-2.5 !py-1 text-[11px]">
            إيقاف الكل
          </Button>
        }
      >
        <Toggle checked={textAboveLayers} onChange={onToggleTextAbove} label="إبقاء النصوص فوق المؤثرات (وضوح أعلى)" small />
      </Section>

      {OVERLAY_GROUPS.map((group) => (
        <Section key={group.id} title={group.label}>
          <div className="space-y-3">
            {group.items.map((item) => {
              const state = layers[item.id];
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 transition ${
                    state.enabled ? 'border-gold-500/30 bg-gold-400/5' : 'border-white/5 bg-ink-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Toggle checked={state.enabled} onChange={(enabled) => onChangeLayer(item.id, { enabled })} label={item.label} small />
                    <span className="text-[11px] tabular-nums text-stone-500" dir="ltr">
                      {Math.round(state.opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    className="slider mt-3"
                    min={0}
                    max={1}
                    step={0.01}
                    value={state.opacity}
                    disabled={!state.enabled}
                    onChange={(e) => onChangeLayer(item.id, { opacity: parseFloat(e.target.value) })}
                  />
                </div>
              );
            })}
          </div>
        </Section>
      ))}
    </>
  );
}

// ===== components/tabs/ElementsTab.jsx =====





function IconBtn({ children, onClick, active, title, disabled }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px] transition disabled:opacity-25 ${
        active ? 'text-gold-300' : 'text-stone-500 hover:bg-white/5 hover:text-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

function Row({ selected, onClick, thumb, label, sub, visible, locked, onToggleVisible, onToggleLock, extra }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 transition ${
        selected ? 'border-gold-400/60 bg-gold-400/10' : 'border-transparent hover:bg-white/5'
      } ${visible ? '' : 'opacity-50'}`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-[conic-gradient(#1f1b16_25%,#15120f_0_50%,#1f1b16_0_75%,#15120f_0)] bg-[length:10px_10px] text-[13px] text-gold-300">
        {thumb}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] text-stone-200">{label}</div>
        {sub && <div className="truncate text-[10.5px] text-stone-500">{sub}</div>}
      </div>
      {extra}
      <IconBtn onClick={onToggleLock} active={locked} title={locked ? 'فك القفل' : 'قفل (يمنع التحريك)'}>{locked ? '🔒' : '🔓'}</IconBtn>
      <IconBtn onClick={onToggleVisible} active={visible} title={visible ? 'إخفاء' : 'إظهار'}>{visible ? '👁' : '◌'}</IconBtn>
    </div>
  );
}

function ElementsTab({ texts, images, shapes = [], logo, selectedIds, onSelect, onChangeText, onChangeNode, onMoveImage, onRemoveImage, onDuplicate }) {
  const isSel = (id) => selectedIds.includes(id);
  const pick = (id, e) => onSelect(id, e?.shiftKey);
  const ordered = [...images].reverse(); // الأعلى أولاً

  return (
    <>
      <Section title="العناصر" hint="اضغط للتحديد · القفل يمنع التحريك بالخطأ · العين تُخفي العنصر">
        <div className="space-y-1">
          <div className="px-1 pb-1 text-[11px] font-bold text-stone-500">النصوص</div>
          {TEXT_SLOTS.filter((s) => texts[s.id]).map((slot) => {
            const t = texts[slot.id];
            const id = `text-${slot.id}`;
            return (
              <Row
                key={slot.id}
                selected={isSel(id)}
                onClick={(e) => t.visible !== false && pick(id, e)}
                thumb={<span style={{ fontFamily: `"${t.font}"`, color: t.color }}>أ</span>}
                label={slot.label}
                sub={t.text.replace(/\n/g, ' · ')}
                visible={t.visible !== false}
                locked={!!t.locked}
                onToggleVisible={() => onChangeText(slot.id, { visible: t.visible === false })}
                onToggleLock={() => onChangeText(slot.id, { locked: !t.locked })}
              />
            );
          })}

          {logo && (
            <>
              <div className="px-1 pb-1 pt-3 text-[11px] font-bold text-stone-500">الشعار</div>
              <Row
                selected={isSel('logo')}
                onClick={(e) => pick('logo', e)}
                // eslint-disable-next-line @next/next/no-img-element
                thumb={<img src={logo.src} alt="" className="h-full w-full object-contain p-0.5" />}
                label="الشعار"
                visible={logo.visible !== false}
                locked={!!logo.locked}
                onToggleVisible={() => onChangeNode('logo', { visible: logo.visible === false })}
                onToggleLock={() => onChangeNode('logo', { locked: !logo.locked })}
              />
            </>
          )}

          {shapes.length > 0 && (
            <>
              <div className="px-1 pb-1 pt-3 text-[11px] font-bold text-stone-500">الزخارف ({shapes.length})</div>
              {[...shapes].reverse().map((sh) => (
                <Row
                  key={sh.id}
                  selected={isSel(sh.id)}
                  onClick={(e) => pick(sh.id, e)}
                  thumb={<span style={{ color: sh.fill && sh.fill !== 'rgba(0,0,0,0)' ? sh.fill : sh.stroke }}>✤</span>}
                  label={getShapeDef(sh.kind).label}
                  sub={sh.behind ? 'خلف الصور' : 'أمام الصور'}
                  visible={sh.visible !== false}
                  locked={!!sh.locked}
                  onToggleVisible={() => onChangeNode(sh.id, { visible: sh.visible === false })}
                  onToggleLock={() => onChangeNode(sh.id, { locked: !sh.locked })}
                  extra={<IconBtn onClick={() => onDuplicate([sh.id])} title="تكرار">⧉</IconBtn>}
                />
              ))}
            </>
          )}

          <div className="px-1 pb-1 pt-3 text-[11px] font-bold text-stone-500">الصور والعناصر ({images.length})</div>
          {ordered.length === 0 && <p className="px-1 text-[11px] text-stone-600">لا توجد صور بعد — أضفها من تبويب «الصور» أو «المكتبة».</p>}
          {ordered.map((img, i) => (
            <Row
              key={img.id}
              selected={isSel(img.id)}
              onClick={(e) => pick(img.id, e)}
              // eslint-disable-next-line @next/next/no-img-element
              thumb={<img src={img.src} alt="" className="h-full w-full object-contain p-0.5" />}
              label={img.name}
              sub={img.backdrop?.shape && img.backdrop.shape !== 'none' ? 'مع شكل خلفي' : img.cutout ? 'شفافة' : 'صورة'}
              visible={img.visible !== false}
              locked={!!img.locked}
              onToggleVisible={() => onChangeNode(img.id, { visible: img.visible === false })}
              onToggleLock={() => onChangeNode(img.id, { locked: !img.locked })}
              extra={
                <>
                  <IconBtn onClick={() => onMoveImage(img.id, 1)} disabled={i === 0} title="للأمام">▲</IconBtn>
                  <IconBtn onClick={() => onMoveImage(img.id, -1)} disabled={i === ordered.length - 1} title="للخلف">▼</IconBtn>
                  <IconBtn onClick={() => onDuplicate([img.id])} title="تكرار">⧉</IconBtn>
                  <IconBtn onClick={() => onRemoveImage(img.id)} title="حذف">✕</IconBtn>
                </>
              }
            />
          ))}
        </div>
      </Section>

    </>
  );
}

// ===== components/tabs/ShapesTab.jsx =====





function Preview({ kind, fill, stroke }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) drawShapePreview(ref.current, kind, { fill, stroke });
  }, [kind, fill, stroke]);
  return <canvas ref={ref} width={120} height={72} className="h-[54px] w-full" />;
}

const SWATCHES = ['#d4af6a', '#f0ede8', '#000000', '#b3121f', '#8a1c1c', '#2c7a5e', '#1e4f7a', '#5a34c4', '#c8102e', '#ffb347'];

function Swatches({ onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SWATCHES.map((c) => (
        <button key={c} type="button" onClick={() => onPick(c)} className="h-6 w-6 rounded-full border border-white/20" style={{ background: c }} />
      ))}
    </div>
  );
}

/** تبويب الزخارف: إضافة عناصر قابلة للتلوين + تحرير العنصر المحدد */
function ShapesTab({ shapes, selectedId, onAddShape, onChangeShape, onRemoveShape, onDuplicate, focusSignal }) {
  const [cat, setCat] = useState('lines');
  const selected = shapes.find((s) => s.id === selectedId);
  const editorRef = useRef(null);

  useEffect(() => {
    if (focusSignal && selected && editorRef.current) editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal, selectedId]);

  const set = (patch) => selected && onChangeShape(selected.id, patch);
  const noFill = selected && (!selected.fill || selected.fill === TRANSPARENT);

  return (
    <>
      {selected && (
        <div ref={editorRef} className="scroll-mt-4">
          <Section title="تحرير الزخرفة المحددة" hint="نقرتان على أي زخرفة في الغلاف تفتح خصائصها هنا">
            <div className="rounded-xl border border-white/5 bg-ink-900 p-2">
              <Preview kind={selected.kind} fill={selected.fill} stroke={selected.stroke} />
            </div>

            <div className="space-y-2 rounded-xl border border-white/5 bg-ink-900/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-stone-400">لون التعبئة</span>
                <Toggle checked={!noFill} onChange={(on) => set({ fill: on ? '#d4af6a' : TRANSPARENT })} label={noFill ? 'بدون' : ''} small />
              </div>
              {!noFill && (
                <>
                  <ColorField label="اللون" value={selected.fill} onChange={(fill) => set({ fill })} />
                  <Swatches onPick={(fill) => set({ fill })} />
                </>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-white/5 bg-ink-900/60 p-3">
              <RangeField label="سماكة الحدّ" min={0} max={30} step={0.5} value={selected.strokeWidth} onChange={(strokeWidth) => set({ strokeWidth, stroke: selected.stroke === TRANSPARENT ? '#d4af6a' : selected.stroke })} />
              {selected.strokeWidth > 0 && (
                <>
                  <ColorField label="لون الحدّ" value={selected.stroke === TRANSPARENT ? '#d4af6a' : selected.stroke} onChange={(stroke) => set({ stroke })} />
                  <Swatches onPick={(stroke) => set({ stroke })} />
                </>
              )}
            </div>

            <RangeField label="العرض" min={10} max={1200} value={Math.round(selected.width)} onChange={(width) => set({ width })} />
            <RangeField label="الارتفاع" min={4} max={1600} value={Math.round(selected.height)} onChange={(height) => set({ height })} />
            <RangeField label="التدوير" min={-180} max={180} value={Math.round(selected.rotation)} onChange={(rotation) => set({ rotation })} format={(v) => `${v}°`} />
            <RangeField label="الشفافية" min={0.05} max={1} step={0.01} value={selected.opacity} onChange={(opacity) => set({ opacity })} format={(v) => `${Math.round(v * 100)}%`} />
            <Toggle checked={!!selected.shadow} onChange={(shadow) => set({ shadow })} label="ظل" small />
            <Toggle checked={!!selected.behind} onChange={(behind) => set({ behind })} label="خلف الصور" small />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => set({ x: 500 })}>توسيط أفقي</Button>
              <Button onClick={() => onDuplicate([selected.id])}>⧉ تكرار</Button>
              <Button variant="danger" onClick={() => onRemoveShape(selected.id)} className="col-span-2">حذف الزخرفة</Button>
            </div>
          </Section>
        </div>
      )}

      <Section title="إضافة زخرفة" hint="خطوط وفواصل وإطارات وزوايا وأشكال ورموز — كلها قابلة للتلوين والتمديد">
        <div className="scroll-thin flex gap-1 overflow-x-auto pb-1">
          {SHAPE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[12px] transition ${
                cat === c.id ? 'bg-gold-400 font-bold text-ink-950' : 'border border-white/10 bg-ink-900 text-stone-400'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SHAPE_LIBRARY.filter((s) => s.cat === cat).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onAddShape(s.id)}
              className="rounded-xl border border-white/10 bg-ink-900 p-1.5 transition hover:border-gold-500/50"
            >
              <Preview kind={s.id} />
              <div className="mt-1 truncate text-[11px] text-stone-400">{s.label}</div>
            </button>
          ))}
        </div>
      </Section>
    </>
  );
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
  return (
    <aside
      className={`w-full shrink-0 flex-col border-t border-white/10 bg-ink-900 transition-[height] duration-200 lg:flex lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0 lg:border-white/5 ${
        props.open ? 'flex' : 'hidden'
      } ${props.tall ? 'h-[68%]' : 'h-[44%]'}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-3 py-2 lg:px-4 lg:py-3">
        <div className="flex items-center gap-2 text-[14px] font-bold text-gold-300 lg:text-[15px]">
          <span>{current?.icon}</span>
          {current?.label}
        </div>
        <div className="flex items-center gap-1 lg:hidden">
          <button
            type="button"
            onClick={props.onToggleTall}
            className="rounded-lg px-2.5 py-1 text-[12px] text-stone-400 hover:bg-white/5"
            title="تكبير/تصغير اللوحة"
          >
            {props.tall ? '⬇ تصغير' : '⬆ تكبير'}
          </button>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg px-2.5 py-1 text-[12px] text-stone-400 hover:bg-white/5"
            title="إغلاق اللوحة"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-3 lg:p-4">
        {tab === 'elements' && (
          <ElementsTab
            texts={props.texts}
            images={props.images}
            shapes={props.shapes}
            logo={props.logo}
            selectedIds={props.selectedIds}
            onSelect={props.onSelect}
            onChangeText={props.onChangeText}
            onChangeNode={props.onChangeNode}
            onMoveImage={props.onMoveImage}
            onRemoveImage={props.onRemoveImage}
            onDuplicate={props.onDuplicate}
          />
        )}
        {tab === 'shapes' && (
          <ShapesTab
            shapes={props.shapes}
            selectedId={props.selectedId}
            onAddShape={props.onAddShape}
            onChangeShape={props.onChangeNode}
            onRemoveShape={props.onRemoveShape}
            onDuplicate={props.onDuplicate}
            focusSignal={props.focusSignal}
          />
        )}
        {tab === 'templates' && <TemplatesTab onApplyTemplate={props.onApplyTemplate} activeTemplateId={props.activeTemplateId} />}
        {tab === 'typography' && (
          <TypographyTab
            texts={props.texts}
            onChangeText={props.onChangeText}
            onSelect={props.onSelect}
            openSlot={props.openSlot}
            onOpenSlot={props.onOpenSlot}
            focusSignal={props.focusSignal}
          />
        )}
        {tab === 'compositing' && (
          <CompositingTab
            images={props.images}
            selectedId={props.selectedId}
            onSelect={props.onSelect}
            onAddImage={props.onAddImage}
            onChangeNode={props.onChangeNode}
            onRemoveImage={props.onRemoveImage}
            onMoveImage={props.onMoveImage}
            autoColors={props.autoColors}
            onToggleAutoColors={props.onToggleAutoColors}
            onSuggestColors={props.onSuggestColors}
            paletteLight={props.paletteLight}
            onOpenCutout={props.onOpenCutout}
            focusSignal={props.focusSignal}
          />
        )}
        {tab === 'library' && <LibraryTab onAddImage={props.onAddImage} />}
        {tab === 'palettes' && (
          <PalettesTab
            paletteId={props.paletteId}
            customPalette={props.customPalette}
            onChangePalette={props.onChangePalette}
            background={props.background}
            onSetBackground={props.onSetBackground}
            onChangeBackground={props.onChangeBackground}
            onRemoveBackground={props.onRemoveBackground}
            onSuggestColors={props.onSuggestColors}
          />
        )}
        {tab === 'layers' && (
          <LayersTab
            layers={props.layers}
            onChangeLayer={props.onChangeLayer}
            onResetLayers={props.onResetLayers}
            textAboveLayers={props.textAboveLayers}
            onToggleTextAbove={props.onToggleTextAbove}
            grade={props.grade}
            onChangeGrade={props.onChangeGrade}
          />
        )}
        {tab === 'logo' && (
          <LogoTab logo={props.logo} onSetLogo={props.onSetLogo} onChangeNode={props.onChangeNode} onRemoveLogo={props.onRemoveLogo} onSelect={props.onSelect} />
        )}
      </div>
    </aside>
  );
}

// ===== components/SideRail.jsx =====



function RailButton({ icon, label, onClick, active, disabled, gold, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`relative flex w-full shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] leading-tight transition disabled:opacity-25 ${
        gold
          ? 'bg-gold-400 font-bold text-ink-950 hover:bg-gold-300'
          : active
          ? 'bg-gold-400/15 text-gold-300'
          : 'text-stone-400 hover:bg-white/5 hover:text-stone-200'
      }`}
    >
      <span className="text-[17px] leading-none">{icon}</span>
      <span className="w-full truncate px-0.5 text-center">{label}</span>
      {badge > 0 && (
        <span className="absolute left-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold-500 px-1 text-[9px] font-bold text-ink-950">{badge}</span>
      )}
    </button>
  );
}

/** العمود الجانبي الأيمن: تبويبات القوائم + الأوامر — بالطول لترك أكبر مساحة للتصميم */
function SideRail({
  tab, panelOpen, onTab, layersCount,
  onWizard, onShuffle, onUndo, onRedo, canUndo, canRedo, onPreview, onOpen, onSave, onExport, exporting,
}) {
  return (
    <nav className="scroll-thin z-40 flex h-full w-16 shrink-0 flex-col items-center gap-1 overflow-y-auto border-l border-white/5 bg-ink-900 px-1.5 py-2">
      <div className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 text-lg font-bold text-ink-950" title="استوديو الأغلفة — تطوير أبو عبدالله الشامي">
        غ
      </div>

      {PANEL_TABS.map((t) => (
        <RailButton
          key={t.id}
          icon={t.icon}
          label={t.label}
          active={tab === t.id && panelOpen}
          badge={t.id === 'layers' ? layersCount : 0}
          onClick={() => onTab(t.id)}
        />
      ))}

      <div className="my-1 h-px w-8 shrink-0 bg-white/10" />

      <RailButton icon="✦" label="المعالج" onClick={onWizard} />
      <RailButton icon="🎲" label="تصميم آخر" onClick={onShuffle} />
      <RailButton icon="↶" label="تراجع" onClick={onUndo} disabled={!canUndo} />
      <RailButton icon="↷" label="إعادة" onClick={onRedo} disabled={!canRedo} />
      <RailButton icon="👁" label="مشاهدة" onClick={onPreview} />
      <RailButton icon="📂" label="فتح" onClick={onOpen} />
      <RailButton icon="💾" label="حفظ" onClick={onSave} />
      <RailButton icon="⬇" label={exporting ? '…' : 'تحميل'} onClick={onExport} gold disabled={exporting} />
    </nav>
  );
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
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-1.5 text-[15px] transition ${
        danger ? 'text-red-300 hover:bg-red-950/60' : active ? 'bg-gold-400/20 text-gold-300' : 'text-stone-300 hover:bg-white/10 hover:text-gold-200'
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-white/10" />;

/**
 * شريط رفيع أعلى مساحة التصميم (لا يغطي التصميم):
 * أدوات العنصر المحدد (محاذاة، أسهم تحريك، مغناطيس، تكرار، قفل، حذف) + التكبير.
 */
function TopBar({
  count, label, onAlign, onNudge, onDuplicate, canDuplicate, onDelete, onLock, onDeselect, onOpenProps,
  snapping, onToggleSnapping, multiSelect, onToggleMulti, zoom, onZoom,
}) {
  return (
    <div className="scroll-thin flex h-12 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-white/5 bg-ink-900/90 px-2">
      {count > 0 ? (
        <>
          <button type="button" onClick={onOpenProps} className="shrink-0 whitespace-nowrap rounded-lg bg-gold-400/10 px-2.5 py-1.5 text-[12px] text-gold-300" title="فتح الخصائص">
            ✎ {count > 1 ? `${count} عناصر` : label}
          </button>
          <Sep />
          {ALIGN.map((a) => (
            <Btn key={a.id} title={a.title} onClick={() => onAlign(a.id)}>{a.icon}</Btn>
          ))}
          <Sep />
          <Btn title="تحريك للأعلى" onClick={() => onNudge(0, -4)}>↑</Btn>
          <Btn title="تحريك للأسفل" onClick={() => onNudge(0, 4)}>↓</Btn>
          <Btn title="تحريك لليمين" onClick={() => onNudge(4, 0)}>→</Btn>
          <Btn title="تحريك لليسار" onClick={() => onNudge(-4, 0)}>←</Btn>
          <Sep />
          <Btn title={snapping ? 'المحاذاة الذكية مفعّلة' : 'المحاذاة الذكية معطّلة'} onClick={onToggleSnapping} active={snapping}>🧲</Btn>
          {canDuplicate && <Btn title="تكرار" onClick={onDuplicate}>⧉</Btn>}
          <Btn title="قفل" onClick={onLock}>🔒</Btn>
          <Btn title="حذف / إخفاء" onClick={onDelete} danger>🗑</Btn>
          <Btn title="إلغاء التحديد" onClick={onDeselect}>✕</Btn>
        </>
      ) : (
        <>
          <span className="shrink-0 whitespace-nowrap px-1 text-[11.5px] text-stone-500">اضغط عنصراً لتحديده · نقرتان لخصائصه</span>
          <Btn title={snapping ? 'المحاذاة الذكية مفعّلة' : 'المحاذاة الذكية معطّلة'} onClick={onToggleSnapping} active={snapping}>🧲</Btn>
        </>
      )}
      <Btn title="تحديد متعدد باللمس" onClick={onToggleMulti} active={multiSelect}>⧈</Btn>

      <div className="mr-auto flex shrink-0 items-center gap-0.5 pr-2">
        <Btn title="تصغير" onClick={() => onZoom(-1)}>−</Btn>
        <button type="button" onClick={() => onZoom(0)} className="w-12 shrink-0 text-center text-[12px] tabular-nums text-stone-300" dir="ltr" title="ملاءمة">
          {Math.round(zoom * 100)}%
        </button>
        <Btn title="تكبير" onClick={() => onZoom(1)}>+</Btn>
      </div>
    </div>
  );
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
      await onRun(
        { title: title.trim(), author: author.trim(), category, file, removeBg, aiPrompt: useAI ? aiPrompt : '' },
        (label, percent) => setProgress({ label, percent: percent ?? 50 })
      );
      onClose();
    } catch (err) {
      setProgress(null);
      alert(err?.message || 'حدث خطأ');
    }
  };

  const input = 'w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-[15px] text-stone-100 outline-none placeholder:text-stone-600 focus:border-gold-500/60';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="scroll-thin max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-gold-500/20 bg-ink-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gold-300">✦ المعالج السريع</h2>
            <p className="mt-1 text-[13px] text-stone-400">اكتب بيانات كتابك واختر نوعه، وسنصمّم الغلاف لك — ثم عدّل ما تشاء.</p>
          </div>
          {!busy && (
            <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-stone-500 hover:bg-white/5 hover:text-stone-200">✕</button>
          )}
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-stone-400">عنوان الكتاب</span>
            <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: ظلال المدينة الأخيرة" autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-stone-400">اسم المؤلف أو العنوان الفرعي</span>
            <input className={input} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="مثال: رواية — أحمد محمد" />
          </label>

          <div>
            <span className="mb-1.5 block text-[12px] text-stone-400">نوع الكتاب</span>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATE_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`rounded-xl py-2.5 text-[13px] transition ${
                    category === c.id ? 'bg-gold-400 font-bold text-ink-950' : 'border border-white/10 bg-ink-800 text-stone-300 hover:border-gold-500/40'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-ink-800/60 p-4">
            <span className="mb-2 block text-[12px] text-stone-400">صورة رئيسية (اختياري) — شخص أو عنصر</span>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gold-600/40 px-4 py-3 hover:border-gold-400">
              <span className="text-lg text-gold-300">＋</span>
              <span className="truncate text-[13px] text-stone-300">{file ? file.name : 'اختر صورة'}</span>
              <input type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            {file && (
              <div className="mt-3">
                <Toggle checked={removeBg} onChange={setRemoveBg} label="إزالة خلفية الصورة تلقائياً" small />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/5 bg-ink-800/60 p-4">
            <Toggle checked={useAI} onChange={setUseAI} label="توليد خلفية بالذكاء الاصطناعي (اختياري)" small />
            {useAI && (
              <div className="mt-3 space-y-2">
                <select
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-stone-200 outline-none"
                >
                  {AI_PRESETS.map((p) => (
                    <option key={p.label} value={p.prompt}>{p.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500">يستغرق 15–60 ثانية ويحتاج إنترنت.</p>
              </div>
            )}
          </div>

          {busy ? (
            <ProgressBar percent={progress.percent} label={progress.label} />
          ) : (
            <button
              type="button"
              onClick={run}
              className="w-full rounded-2xl bg-gradient-to-l from-gold-300 to-gold-500 py-3.5 text-[15px] font-bold text-ink-950 shadow-[0_10px_40px_rgba(212,175,106,.3)] transition hover:brightness-110"
            >
              صمّم الغلاف
            </button>
          )}
          {!busy && (
            <button type="button" onClick={onClose} className="w-full text-[12px] text-stone-500 hover:text-stone-300">
              تخطَّ وابدأ بغلاف فارغ
            </button>
          )}
        </div>
      </div>
    </div>
  );
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
      if (!w.original || !view) return;
      const pw = w.prevOriginal.width, ph = w.prevOriginal.height;
      if (view.width !== pw) view.width = pw;
      if (view.height !== ph) view.height = ph;
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
    } catch (err) {
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
          if (!alive) return;
          setupFrom(original, base);
          setStatus({ loading: false, label: '', percent: 100, error: null });
          render();
        } else if (item.cutout && !item.originalSrc) {
          // لدينا الصورة المفرّغة فقط (من المكتبة مثلاً) — نستخدم شفافيتها كقناع
          const img = await loadImage(item.src);
          const original = toWorkCanvas(img);
          if (!alive) return;
          setupFrom(original, alphaToMask(original, original.width, original.height));
          setStatus({ loading: false, label: '', percent: 100, error: null });
          render();
        } else {
          await runAI(getCutQuality());
        }
      } catch (err) {
        if (alive) setStatus({ loading: false, label: '', percent: 0, error: err?.message || 'تعذّر تحميل الصورة' });
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
    if (status.loading || !work.current.edits) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ed = work.current.edits;
    undoStack.current.push(ed.getContext('2d').getImageData(0, 0, ed.width, ed.height));
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
    setUndoCount(undoStack.current.length);
    const p = toWork(e);
    drawing.current = p;
    stamp(p.x, p.y, (brush / 2) * p.ratio);
    render();
  };

  const onPointerMove = (e) => {
    const rect = viewRef.current?.getBoundingClientRect();
    if (rect) setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (!drawing.current) return;
    const p = toWork(e);
    const last = drawing.current;
    const radius = (brush / 2) * p.ratio;
    const dist = Math.hypot(p.x - last.x, p.y - last.y);
    const steps = Math.max(1, Math.ceil(dist / (radius * 0.3)));
    for (let i = 1; i <= steps; i++) stamp(last.x + ((p.x - last.x) * i) / steps, last.y + ((p.y - last.y) * i) / steps, radius);
    drawing.current = p;
    render();
  };

  const onPointerUp = () => {
    drawing.current = null;
  };

  const undo = () => {
    const snap = undoStack.current.pop();
    if (!snap) return;
    work.current.edits.getContext('2d').putImageData(snap, 0, 0);
    setUndoCount(undoStack.current.length);
    render();
  };

  const clearEdits = () => {
    const ed = work.current.edits;
    if (!ed) return;
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
    } finally {
      setSaving(false);
    }
  };

  const checker = 'conic-gradient(#2a2622 25%, #1b1815 0 50%, #2a2622 0 75%, #1b1815 0) 0 0 / 22px 22px';
  const setP = (patch) => setParams((p) => ({ ...p, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex flex-col-reverse bg-black/85 backdrop-blur-sm lg:flex-row">
      {/* لوحة الأدوات */}
      <aside className="scroll-thin flex h-[48%] w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-white/10 bg-ink-900 p-4 lg:h-auto lg:w-[330px] lg:border-l lg:border-t-0 lg:p-5">
        <div>
          <h2 className="text-lg font-bold text-gold-300">✂ محرر القص</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-stone-400">
            امسح ما تبقّى من الخلفية بالممحاة، واسترجع ما حُذف خطأً بأداة الاستعادة.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[['erase', '⌫ ممحاة'], ['restore', '🖌 استعادة']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTool(id)}
              className={`rounded-xl py-2.5 text-[13px] transition ${tool === id ? 'bg-gold-400 font-bold text-ink-950' : 'border border-white/10 bg-ink-800 text-stone-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <RangeField label="حجم الفرشاة" min={4} max={300} value={brush} onChange={setBrush} format={(v) => `${v}px`} />
        <RangeField label="نعومة الفرشاة" min={0} max={0.95} step={0.01} value={softness} onChange={setSoftness} format={(v) => `${Math.round(v * 100)}%`} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={undo} disabled={!undoCount} className="rounded-xl border border-white/10 bg-ink-800 py-2 text-[12px] text-stone-300 disabled:opacity-30">
            ↶ تراجع ({undoCount})
          </button>
          <button type="button" onClick={clearEdits} className="rounded-xl border border-white/10 bg-ink-800 py-2 text-[12px] text-stone-300">
            مسح تعديلات الفرشاة
          </button>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/5 bg-ink-800/60 p-3">
          <div className="text-[12px] font-bold text-stone-300">تحسين الحواف</div>
          <RangeField label="حدّة الحواف" min={0} max={1} step={0.01} value={params.hardness} onChange={(hardness) => setP({ hardness })} format={(v) => `${Math.round(v * 100)}%`} />
          <RangeField label="تقليص الحواف (يزيل الهالة)" min={0} max={8} step={0.1} value={params.shrink} onChange={(shrink) => setP({ shrink })} format={(v) => `${v.toFixed(1)}px`} />
          <RangeField label="تنعيم الحافة" min={0} max={6} step={0.1} value={params.feather} onChange={(feather) => setP({ feather })} format={(v) => `${v.toFixed(1)}px`} />
          <Toggle checked={params.decontaminate} onChange={(decontaminate) => setP({ decontaminate })} label="إزالة الهالة اللونية حول الشعر والحواف" small />
          <button type="button" onClick={() => setParams({ ...DEFAULT_REFINE })} className="text-[11px] text-stone-500 hover:text-stone-300">
            إعادة القيم الافتراضية
          </button>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/5 bg-ink-800/60 p-3">
          <div className="text-[12px] font-bold text-stone-300">إعادة الكشف بالذكاء الاصطناعي</div>
          <div className="grid grid-cols-3 gap-1.5">
            {QUALITY_MODES.map((q) => (
              <button
                key={q.id}
                type="button"
                disabled={status.loading}
                onClick={() => {
                  setCutQuality(q.id);
                  runAI(q.id);
                }}
                className="rounded-lg border border-white/10 bg-ink-900 py-2 text-[11.5px] text-stone-300 hover:border-gold-500/50 disabled:opacity-30"
              >
                {q.label}
              </button>
            ))}
          </div>
          <p className="text-[10.5px] text-stone-500">يُلغي تعديلات الفرشاة ويعيد الكشف من الصورة الأصلية.</p>
        </div>

        <div className="space-y-2">
          <div className="text-[12px] text-stone-400">خلفية المعاينة</div>
          <div className="flex flex-wrap gap-1.5">
            {BACKDROPS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBackdrop(b.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] ${backdrop === b.id ? 'bg-gold-400 text-ink-950' : 'border border-white/10 text-stone-400'}`}
              >
                {b.label}
              </button>
            ))}
          </div>
          <Toggle checked={showMask} onChange={setShowMask} label="عرض القناع (أبيض = يبقى)" small />
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={status.loading || saving || !!status.error}
            className="rounded-xl bg-gold-400 py-3 text-[14px] font-bold text-ink-950 hover:bg-gold-300 disabled:opacity-40"
          >
            {saving ? 'جارٍ الحفظ…' : '✓ حفظ القص'}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 py-3 text-[14px] text-stone-300 hover:bg-white/5">
            إلغاء
          </button>
        </div>
      </aside>

      {/* منطقة الرسم */}
      <main className="relative grid min-h-0 min-w-0 flex-1 place-items-center p-3 lg:p-6">
        {status.loading && (
          <div className="w-80 rounded-2xl border border-white/10 bg-ink-900 p-5">
            <ProgressBar percent={status.percent} label={status.label} />
          </div>
        )}
        {status.error && <div className="rounded-2xl border border-red-900/50 bg-red-950/40 p-5 text-red-200">{status.error}</div>}
        <div
          className={`relative max-h-full max-w-full ${status.loading || status.error ? 'hidden' : ''}`}
          style={{ background: backdrop === 'checker' ? checker : backdrop, lineHeight: 0 }}
        >
          <canvas
            ref={viewRef}
            className="block max-h-[calc(52dvh-24px)] max-w-full touch-none lg:max-h-[calc(100vh-48px)]"
            style={{ cursor: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => {
              onPointerUp();
              setCursor(null);
            }}
          />
          {cursor && work.current.original && (
            <div
              className="pointer-events-none absolute rounded-full border-2"
              style={{
                left: cursor.x,
                top: cursor.y,
                width: brush,
                height: brush,
                transform: 'translate(-50%, -50%)',
                borderColor: tool === 'erase' ? '#ff4d6d' : '#4dffa6',
                boxShadow: '0 0 0 1px rgba(0,0,0,.6)',
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
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
    if (!host || !canvas) return;
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.width = 'auto';
    canvas.style.height = 'auto';
    canvas.style.objectFit = 'contain';
    canvas.style.boxShadow = '0 30px 100px rgba(0,0,0,.9)';
    host.appendChild(canvas);
    return () => {
      if (canvas.parentNode === host) host.removeChild(canvas);
    };
  }, [canvas]);
  return <div ref={ref} className="grid h-full w-full place-items-center [&>canvas]:max-h-full [&>canvas]:max-w-full" />;
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
    } catch {
      return true;
    }
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTall, setPanelTall] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [previewUrl, setPreviewUrl] = useState(null);
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
      if (!id) return [];
      if (additive || multiSelectRef.current) return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (prev.includes(id) && prev.length > 1) return prev;
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
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const palette = getPalette(doc.paletteId, doc.customPalette);

  // ── النصوص ──
  const updateText = useCallback(
    (key, patch) =>
      setDoc((d) => ({ ...d, texts: { ...d.texts, [key]: { ...d.texts[key], ...patch } } }), {
        key: `text:${key}:${Object.keys(patch).join(',')}`,
      }),
    [setDoc]
  );

  // ── اقتراح الألوان من صورة ──
  const suggestColors = useCallback(
    async (src, { silent = false } = {}) => {
      try {
        const s = suggestDesign(await extractColors(src));
        if (!s) return;
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
        if (!silent) flash('تم تطبيق ألوان مقترحة من الصورة');
      } catch (err) {
        console.error(err);
        if (!silent) flash('تعذّر تحليل ألوان الصورة', 'error');
      }
    },
    [setDoc, flash]
  );

  // ── الصور ──
  const addImage = useCallback(
    async (src, meta = {}) => {
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
      if (autoColors && meta.suggestColors !== false) suggestColors(src, { silent: true });
      return item;
    },
    [setDoc, autoColors, suggestColors]
  );

  /** تحديث موحّد لأي عنصر صوري (صورة أو شعار) — يعيد حساب الأبعاد عند تغيير المصدر */
  const changeNode = useCallback(
    async (id, patch) => {
      const key = `node:${id}:${Object.keys(patch).join(',')}`;
      let apply = (node) => ({ ...node, ...patch });
      if (patch.src) {
        const img = await loadImage(patch.src);
        apply = (node) => ({ ...node, ...patch, width: (img.naturalWidth / img.naturalHeight) * node.height });
      }
      if (id === 'logo') setDoc((d) => (d.logo ? { ...d, logo: apply(d.logo) } : d), { key });
      else if (id.startsWith('shp-')) setDoc((d) => ({ ...d, shapes: (d.shapes || []).map((n) => (n.id === id ? apply(n) : n)) }), { key });
      else setDoc((d) => ({ ...d, images: d.images.map((n) => (n.id === id ? apply(n) : n)) }), { key });
    },
    [setDoc]
  );

  const removeImage = useCallback(
    (id) => {
      setDoc((d) => ({ ...d, images: d.images.filter((n) => n.id !== id) }));
      setSelection((s) => s.filter((x) => x !== id));
    },
    [setDoc]
  );

  const moveImage = useCallback(
    (id, direction) =>
      setDoc((d) => {
        const i = d.images.findIndex((n) => n.id === id);
        const j = i + direction;
        if (i < 0 || j < 0 || j >= d.images.length) return d;
        const images = [...d.images];
        [images[i], images[j]] = [images[j], images[i]];
        return { ...d, images };
      }),
    [setDoc]
  );

  // ── الزخارف ──
  const addShape = useCallback(
    (kind) => {
      const item = createShape(kind, { x: COVER_W / 2, y: COVER_H / 2 });
      setDoc((d) => ({ ...d, shapes: [...(d.shapes || []), item] }));
      setSelection([item.id]);
    },
    [setDoc]
  );

  const removeShape = useCallback(
    (id) => {
      setDoc((d) => ({ ...d, shapes: (d.shapes || []).filter((n) => n.id !== id) }));
      setSelection((s) => s.filter((x) => x !== id));
    },
    [setDoc]
  );

  // ── الشعار ──
  const setLogoFromSrc = useCallback(
    async (src) => {
      const img = await loadImage(src);
      const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, 180, 140);
      setDoc((d) => ({
        ...d,
        logo: { id: 'logo', src, width, height, x: COVER_W / 2, y: COVER_H - 90 - height / 2, rotation: 0, scale: 1, opacity: 0.95, shadow: false },
      }));
      setSelection(['logo']);
    },
    [setDoc]
  );

  const removeLogo = useCallback(() => {
    setDoc((d) => ({ ...d, logo: null }));
    setSelection((s) => s.filter((x) => x !== 'logo'));
  }, [setDoc]);

  // ── الخلفية ──
  const setBackground = useCallback(
    (src, meta = {}) => {
      setDoc((d) => ({
        ...d,
        background: {
          src,
          generated: !!meta.generated,
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          opacity: 1,
          dim: 0.3,
          paletteMix: 0.3,
          blend: 'soft-light',
        },
      }));
      if (autoColors && meta.suggest !== false) suggestColors(src, { silent: true });
      if (!meta.quiet) flash(meta.generated ? 'تم توليد الخلفية' : 'تمت إضافة صورة الخلفية');
    },
    [setDoc, autoColors, suggestColors, flash]
  );

  const changeBackground = useCallback(
    (patch) =>
      setDoc((d) => (d.background ? { ...d, background: { ...d.background, ...patch } } : d), {
        key: `bg:${Object.keys(patch).join(',')}`,
      }),
    [setDoc]
  );

  // ── الطبقات والقوالب ──
  const changeLayer = useCallback(
    (id, patch) =>
      setDoc((d) => ({ ...d, layers: { ...d.layers, [id]: { ...d.layers[id], ...patch } } }), {
        key: `layer:${id}:${Object.keys(patch).join(',')}`,
      }),
    [setDoc]
  );

  const resetLayers = useCallback(
    () => setDoc((d) => ({ ...d, layers: Object.fromEntries(ALL_OVERLAYS.map((o) => [o.id, { ...d.layers[o.id], enabled: false }])) })),
    [setDoc]
  );

  const applyTemplate = useCallback(
    (tpl, { quiet = false } = {}) => {
      setDoc((d) => ({ ...applyTemplateToDoc(d, tpl), templateId: tpl.id }));
      if (!quiet) flash(`تم تطبيق قالب «${tpl.name}»`);
    },
    [setDoc, flash]
  );

  /** نقرتان على عنصر في الغلاف ← افتح خصائصه في لوحة التحكم مباشرة */
  const openProps = useCallback((id) => {
    if (!id) return;
    setSelection([id]);
    if (id.startsWith('text-')) {
      setPanelTab('typography');
      setOpenSlot(id.slice(5));
    } else if (id === 'logo') {
      setPanelTab('logo');
    } else if (id.startsWith('shp-')) {
      setPanelTab('shapes');
    } else {
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
  const applyPatches = useCallback(
    (patches, key = null) =>
      setDoc(
        (d) => {
          let { texts, images, logo } = d;
          let shapes = d.shapes || [];
          for (const { id, patch } of patches) {
            if (id.startsWith('text-')) {
              const k = id.slice(5);
              if (texts[k]) texts = { ...texts, [k]: { ...texts[k], ...patch } };
            } else if (id === 'logo') {
              if (logo) logo = { ...logo, ...patch };
            } else if (id.startsWith('shp-')) {
              shapes = shapes.map((n) => (n.id === id ? { ...n, ...patch } : n));
            } else {
              images = images.map((n) => (n.id === id ? { ...n, ...patch } : n));
            }
          }
          return { ...d, texts, images, logo, shapes };
        },
        { key }
      ),
    [setDoc]
  );

  const duplicateImages = useCallback(
    (ids) => {
      const imgs = doc.images.filter((n) => ids.includes(n.id));
      const shps = (doc.shapes || []).filter((n) => ids.includes(n.id));
      if (!imgs.length && !shps.length) return;
      const copy = (n, prefix) => ({ ...JSON.parse(JSON.stringify(n)), id: uid(prefix), x: n.x + 30, y: n.y + 30, locked: false, fromTemplate: false });
      const imgCopies = imgs.map((n) => copy(n, 'img'));
      const shpCopies = shps.map((n) => copy(n, 'shp'));
      setDoc((d) => ({ ...d, images: [...d.images, ...imgCopies], shapes: [...(d.shapes || []), ...shpCopies] }));
      setSelection([...imgCopies, ...shpCopies].map((c) => c.id));
    },
    [doc.images, doc.shapes, setDoc]
  );

  const deleteSelection = () => {
    if (!selection.length) return;
    setDoc((d) => {
      const texts = { ...d.texts };
      for (const id of selection) if (id.startsWith('text-')) texts[id.slice(5)] = { ...texts[id.slice(5)], visible: false };
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
    if (patches.length) applyPatches(patches, 'nudge');
  };

  // ── المعالج السريع ──
  const closeWizard = () => {
    setShowWizard(false);
    try {
      localStorage.setItem(WIZARD_KEY, '1');
    } catch {
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
      } catch (err) {
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
        } catch {
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
    } catch (err) {
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
    } catch (err) {
      flash(err.message, 'error');
    }
  };

  // ── التصدير ──
  const handleExport = async () => {
    if (!canvasRef.current || exporting) return;
    setExporting(true);
    try {
      await document.fonts.ready;
      const blob = await canvasRef.current.exportPNG();
      downloadBlob(blob, coverFileName(doc.texts.title.text));
      flash('تم تحميل الغلاف');
    } catch (err) {
      console.error(err);
      flash('تعذّر تصدير الغلاف: ' + (err?.message || err), 'error');
    } finally {
      setExporting(false);
    }
  };

  // ── المشاهدة: عرض التصميم كاملاً بدون أدوات ──
  const openPreview = () => {
    try {
      // دقة تناسب الشاشة فقط — تظهر فوراً
      const ratio = Math.min(1.5, Math.max(0.5, (window.innerHeight * (window.devicePixelRatio || 1)) / COVER_H));
      setPreviewUrl(canvasRef.current.previewCanvas(ratio));
    } catch (err) {
      flash('تعذّر عرض التصميم', 'error');
    }
  };
  const closePreview = () => setPreviewUrl(null);

  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  const zoomStep = (dir) => {
    if (dir === 0) return setZoom(1);
    const next = dir > 0 ? ZOOMS.find((z) => z > zoom + 0.001) ?? ZOOMS[ZOOMS.length - 1] : [...ZOOMS].reverse().find((z) => z < zoom - 0.001) ?? ZOOMS[0];
    setZoom(next);
  };

  const onRailTab = (id) => {
    if (panelTab === id && panelOpen) setPanelOpen(false);
    else {
      setPanelTab(id);
      setPanelOpen(true);
    }
  };

  const selectionLabel = (() => {
    if (!selectedId) return '';
    if (selectedId.startsWith('text-')) return SLOT_LABELS[selectedId.slice(5)] || 'نص';
    if (selectedId === 'logo') return 'الشعار';
    if (selectedId.startsWith('shp-')) return 'زخرفة';
    return doc.images.find((n) => n.id === selectedId)?.name || 'صورة';
  })();

  const layersCount = Object.values(doc.layers).filter((l) => l.enabled).length;

  return (
    <div className="relative flex h-[100dvh] bg-ink-950 text-stone-200">
      {/* RTL: أول عنصر يظهر يميناً ← العمود الجانبي ثم لوحة القوائم ثم مساحة التصميم */}
      <SideRail
        tab={panelTab}
        panelOpen={panelOpen}
        onTab={onRailTab}
        layersCount={layersCount}
        onWizard={() => setShowWizard(true)}
        onShuffle={shuffleDesign}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onPreview={openPreview}
        onOpen={() => openRef.current?.click()}
        onSave={saveProject}
        onExport={handleExport}
        exporting={exporting}
      />
      <input
        ref={openRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) openProject(f);
          e.target.value = '';
        }}
      />

      {/* الهاتف: التصميم في الأعلى ولوحة التعديل أسفله — الحاسوب: اللوحة بجانب التصميم */}
      <div className="relative flex min-w-0 flex-1 flex-col-reverse lg:flex-row">
        <ControlPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          tall={panelTall}
          onToggleTall={() => setPanelTall((v) => !v)}
          texts={doc.texts}
          onChangeText={updateText}
          images={doc.images}
          shapes={doc.shapes || []}
          onAddShape={addShape}
          onRemoveShape={removeShape}
          selectedId={selectedId}
          selectedIds={selection}
          onSelect={select}
          onDuplicate={duplicateImages}
          activeTab={panelTab}
          openSlot={openSlot}
          onOpenSlot={setOpenSlot}
          focusSignal={focusSignal}
          onOpenCutout={setCutoutEditId}
          grade={doc.grade || DEFAULT_GRADE}
          onChangeGrade={(patch) => setDoc((d) => ({ ...d, grade: { ...(d.grade || DEFAULT_GRADE), ...patch } }), { key: `grade:${Object.keys(patch).join(',')}` })}
          onAddImage={addImage}
          onChangeNode={changeNode}
          onRemoveImage={removeImage}
          onMoveImage={moveImage}
          autoColors={autoColors}
          onToggleAutoColors={setAutoColors}
          onSuggestColors={suggestColors}
          paletteLight={palette.colors[1]}
          logo={doc.logo}
          onSetLogo={setLogoFromSrc}
          onRemoveLogo={removeLogo}
          paletteId={doc.paletteId}
          customPalette={doc.customPalette}
          onChangePalette={(paletteId) => setDoc((d) => ({ ...d, paletteId }))}
          background={doc.background}
          onSetBackground={setBackground}
          onChangeBackground={changeBackground}
          onRemoveBackground={() => setDoc((d) => ({ ...d, background: null }))}
          layers={doc.layers}
          onChangeLayer={changeLayer}
          onResetLayers={resetLayers}
          textAboveLayers={doc.textAboveLayers}
          onToggleTextAbove={(textAboveLayers) => setDoc((d) => ({ ...d, textAboveLayers }))}
          onApplyTemplate={applyTemplate}
          activeTemplateId={doc.templateId}
        />

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <TopBar
            count={selection.length}
            label={selectionLabel}
            onOpenProps={() => selectedId && openProps(selectedId)}
            onAlign={(type) => canvasRef.current?.align(type)}
            onNudge={nudge}
            onDuplicate={() => duplicateImages(selection)}
            canDuplicate={selection.some((id) => id.startsWith('img-') || id.startsWith('shp-'))}
            onDelete={deleteSelection}
            onLock={lockSelection}
            onDeselect={() => setSelection([])}
            snapping={snapping}
            onToggleSnapping={() => setSnapping((v) => !v)}
            multiSelect={multiSelect}
            onToggleMulti={() => setMultiSelect((v) => !v)}
            zoom={zoom}
            onZoom={zoomStep}
          />
          <div className="stage-backdrop relative min-h-0 flex-1">
            <CoverCanvas
              ref={canvasRef}
              texts={doc.texts}
              images={doc.images}
              shapes={doc.shapes || []}
              logo={doc.logo}
              palette={palette}
              background={doc.background}
              layers={doc.layers}
              textAboveLayers={doc.textAboveLayers}
              grade={doc.grade || DEFAULT_GRADE}
              selectedIds={selection}
              onSelect={select}
              onCommit={(patches) => applyPatches(patches)}
              onOpenProps={openProps}
              fontsVersion={fontsVersion}
              snapping={snapping}
              zoom={zoom}
            />
          </div>

          {notice && (
            <div
              key={notice.id}
              className={`pointer-events-none absolute left-1/2 top-14 z-30 max-w-[92%] -translate-x-1/2 rounded-2xl border px-4 py-2 text-center text-[12px] shadow-xl backdrop-blur ${
                notice.tone === 'error' ? 'border-red-900/60 bg-red-950/90 text-red-200' : 'border-gold-500/30 bg-ink-800/95 text-gold-200'
              }`}
            >
              {notice.text}
            </div>
          )}
        </main>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black" onClick={closePreview}>
          <div className="flex shrink-0 items-center justify-between gap-2 p-3" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={closePreview} className="rounded-xl border border-white/15 px-4 py-2 text-[13px] text-stone-200">
              ✕ رجوع للتحرير
            </button>
            <button type="button" onClick={handleExport} className="rounded-xl bg-gold-400 px-4 py-2 text-[13px] font-bold text-ink-950">
              ⬇ تحميل الغلاف
            </button>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center p-3">
            <PreviewHost canvas={previewUrl} />
          </div>
        </div>
      )}

      {showWizard && <QuickWizard onRun={runWizard} onClose={closeWizard} />}
      {cutoutEditId && doc.images.find((n) => n.id === cutoutEditId) && (
        <CutoutEditor
          item={doc.images.find((n) => n.id === cutoutEditId)}
          onClose={() => setCutoutEditId(null)}
          onSave={(patch) => {
            changeNode(cutoutEditId, patch);
            setCutoutEditId(null);
            flash('تم حفظ القص');
          }}
        />
      )}
    </div>
  );
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
    if (!this.state.error) return this.props.children;
    const e = this.state.error;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#070605', color: '#e6c98a', fontFamily: 'Tajawal, sans-serif', padding: 24, direction: 'rtl' }}>
        <div style={{ maxWidth: 600, width: '100%' }}>
          <h2 style={{ fontSize: 20, marginBottom: 10 }}>حدث خطأ في الاستوديو</h2>
          <p style={{ color: '#a8a29e', fontSize: 13, marginBottom: 12 }}>صوّر هذه الرسالة وأرسلها للمطوّر:</p>
          <pre style={{ whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', background: '#15120f', padding: 12, borderRadius: 12, fontSize: 11, color: '#fca5a5', maxHeight: '50vh', overflow: 'auto' }}>
            {String((e && (e.stack || e.message)) || e)}
          </pre>
          <button type="button" onClick={() => location.reload()} style={{ marginTop: 16, background: '#d4af6a', color: '#0d0b09', padding: '10px 22px', borderRadius: 12, fontWeight: 700 }}>
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }
}

window.__APP_STARTED__ = true;
createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);

// داخل تطبيق أندرويد: نؤكد أن هذا الإصدار يعمل (يحمي التحديث الصامت من الإصدارات المعطوبة)
setTimeout(() => {
  if (!window.__APP_FAILED__) {
    try {
      window.AndroidBridge?.appReady?.();
    } catch (e) {
      /* خارج التطبيق */
    }
  }
}, 4000);
