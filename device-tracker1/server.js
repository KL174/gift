const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// كلمة السر لصفحة المشاهدة (غيّرها، أو استخدم متغير البيئة ADMIN_PASSWORD عند النشر)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'my-secret-123';

const DATA_FILE = path.join(__dirname, 'visits.json');

// تحميل الزيارات السابقة
let visits = [];
try {
  if (fs.existsSync(DATA_FILE)) {
    visits = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
} catch (e) {
  visits = [];
}

function saveVisits() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(visits, null, 2));
  } catch (e) { /* تجاهل أخطاء الكتابة (مثل أنظمة الملفات للقراءة فقط) */ }
}

// تحليل نوع الجهاز من User-Agent
function detectDevice(ua) {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return { type: 'تابلت', icon: '📱' };
  }
  if (/Mobi|Android.*Mobile|iPhone|iPod|Windows Phone/i.test(ua)) {
    return { type: 'موبايل', icon: '📱' };
  }
  return { type: 'كمبيوتر', icon: '🖥️' };
}

function detectOS(ua) {
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows/.test(ua)) return 'Windows';
  const android = ua.match(/Android ([\d.]+)/);
  if (android) return 'Android ' + android[1];
  const ios = ua.match(/OS ([\d_]+)/);
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS ' + (ios ? ios[1].replace(/_/g, '.') : '');
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'غير معروف';
}

function detectBrowser(ua) {
  if (/Edg\//.test(ua)) return 'Microsoft Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/Chrome\//.test(ua)) return 'Google Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'غير معروف';
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// استقبال معلومات الزائر من الصفحة
app.post('/api/visit', async (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const device = detectDevice(ua);

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  const visit = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    time: new Date().toISOString(),
    deviceType: device.type,
    icon: device.icon,
    model: req.body.model || 'غير محدد',
    os: detectOS(ua),
    browser: detectBrowser(ua),
    language: req.body.language || 'غير معروفة',
    screen: req.body.screen || 'غير معروفة',
    viewport: req.body.viewport || 'غير معروفة',
    touch: req.body.touch ? 'نعم' : 'لا',
    referrer: req.body.referrer || 'مباشر',
    ip: ip,
    userAgent: ua,
    // معلومات قوية إضافية
    gpu: req.body.gpu || 'غير متاح',
    battery: req.body.battery || 'غير متاح',
    network: req.body.network || 'غير متاح',
    ram: req.body.ram || 'غير متاح',
    timezone: req.body.timezone || 'غير متاح',
    languages: req.body.languages || 'غير متاح',
    theme: req.body.theme || 'غير متاح',
    storage: req.body.storage || 'غير متاح',
    openedFrom: req.body.openedFrom || 'غير معروف',
    localTime: req.body.localTime || 'غير متاح',
    orientation: req.body.orientation || 'غير متاح',
    fingerprint: req.body.fingerprint || '',
    country: 'غير معروف',
    city: '',
    isp: '',
  };

  // معرفة الموقع من الـ IP (بلد، مدينة، شركة الاتصالات)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const geoRes = await fetch('https://ipwho.is/' + ip, { signal: controller.signal });
    clearTimeout(timer);
    const geo = await geoRes.json();
    if (geo && geo.success) {
      visit.country = geo.country || 'غير معروف';
      visit.city = geo.city || '';
      visit.isp = geo.connection && (geo.connection.isp || geo.connection.org || '');
    }
  } catch (e) { /* تجاهل فشل الخدمة */ }

  visits.push(visit);
  if (visits.length > 500) visits = visits.slice(-500); // آخر 500 زيارة فقط
  saveVisits();

  res.json({ ok: true, deviceType: device.type, icon: device.icon });
});

// جلب الزيارات (محمي بكلمة السر)
app.get('/api/visits', (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'كلمة السر غير صحيحة' });
  }
  res.json(visits);
});

app.listen(PORT, () => {
  console.log(`السيرفر شغال على http://localhost:${PORT}`);
});
