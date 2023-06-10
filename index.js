const puppeteer = require('puppeteer');
const fs = require("fs");
const csv = require('csv-parser');

(async event => {
    const url = 'https://www.mastersindia.co/gst-number-search-and-gstin-verification/';
    const browser = await puppeteer.launch({ headless: false });
    const maxInFlight = 10;     // set this value to control how many pages run in parallel
    let inFlightCntr = 0;
    let paused = false;

    async function getFile(id) {
        try {
            ++inFlightCntr;
            const page = await browser.newPage();
            await page.waitForTimeout(3000);
            page.setViewport({ width: 1000, height: 1500, deviceScaleFactor: 1 });
            const response = await page.goto(url, { waitUntil: 'networkidle2' });
            await page.waitForTimeout(10000);

            const chatElement = await page.$('.artibot-closer--J-1d0');
            if (chatElement) {
                const isClickable = await page.evaluate((element) => {
                  const style = window.getComputedStyle(element);
                  const isHidden = style.display === 'none' || style.visibility !== 'visible';
                  const isDisabled = element.disabled || element.getAttribute('aria-disabled') === 'true';
                  const isClickable = !isHidden && !isDisabled;
                  return isClickable;
                }, chatElement);
              
                if (isClickable) {
                  await chatElement.click();
                  console.log('Clicked on the chat element.');
                } else {
                  console.log('The chat element is not clickable.');
                }
              } else {
                console.log('The chat element was not found.');
              }
            await page.waitForTimeout(3000);

            await page.waitForSelector('input[placeholder="Search by GST Number"]');
            await page.type('input[placeholder="Search by GST Number"]', id);
            await page.waitForFunction(
                (value) => document.querySelector('input[placeholder="Search by GST Number"]').value === value,
                {},
                id
            );
            await page.waitForTimeout(5000);

            const button = await page.waitForSelector('button span');
            button.click();
            await page.waitForTimeout(5000);

            await page.waitForSelector('table');

            // Get the inner text of the third row
            const innerText = await page.$eval('table tr:nth-child(3) td', (row) => row.innerText);

            await page.waitForTimeout(1000);
            console.log(innerText);
            await page.close();
        } catch (e) {
            console.log(e);
        } finally {
            --inFlightCntr;
        }
    }

    let fname = 'example.csv'
    const csvPipe = fs.createReadStream(fname).pipe(csv());

    csvPipe.on('data', async (row) => {
        let id = row.GSTIN;

        getFile(id).finally(() => {
            if (paused && inFlightCntr < maxInFlight) {
                csvPipe.resume();
                paused = false;
            }
        });

        if (!paused && inFlightCntr >= maxInFlight) {
            csvPipe.pause();
            paused = true;
        }
    }).on('end', () => {
        console.log('CSV file successfully processed');
    });
})();