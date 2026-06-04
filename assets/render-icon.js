const { chromium } = require('playwright')
const path = require('path')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1024, height: 1024 })

  const fs = require('fs')
  const svgContent = fs.readFileSync(path.resolve(__dirname, 'icon.svg'), 'utf8')
  const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0}body{background:transparent;width:1024px;height:1024px;overflow:hidden}</style></head><body>${svgContent}</body></html>`
  await page.setContent(html)

  await page.screenshot({
    path: path.resolve(__dirname, 'icon.png'),
    clip: { x: 0, y: 0, width: 1024, height: 1024 },
    omitBackground: true,
  })

  await browser.close()
  console.log('icon.png written')
})()
