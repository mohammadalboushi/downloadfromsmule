const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // إجبار النظام على حفظ المتصفح داخل مجلد المشروع
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
