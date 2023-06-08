const puppeteer = require('puppeteer');
const csv = require('csv-parser');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

(async event => {
    const url = 'https://www.mastersindia.co/gst-number-search-and-gstin-verification/';
    const browser = await puppeteer.launch({ headless: false });
    const maxInFlight = 10;     // set this value to control how many pages run in parallel
    let inFlightCntr = 0;
    let paused = false;

    async function processDataAndFillCSV() {
    // Read the input CSV file
    const inputFilePath = 'example.csv'; // Replace with the path to your input CSV file
    const inputData = [];

    fs.createReadStream(inputFilePath)
        .pipe(csv())
        .on('data', (row) => {
        inputData.push(row);
        })
        .on('end', async () => {
        // Process the data and add output in another column
        const processedData = await Promise.all(
            inputData.map(async (row) => {
            const inputValue = row.GSTIN; // Replace 'InputColumn' with the name of your input column in the CSV
            const outputValue = await performTask(inputValue); // Perform your desired task using Puppeteer

            return { ...row, Address: outputValue }; // Replace 'OutputColumn' with the name of your output column in the CSV
            })
        );

        // Write the processed data to the output CSV file
        const outputFilePath = 'output.csv'; // Replace with the path to your output CSV file
        const csvWriter = createCsvWriter({
            path: outputFilePath,
            header: Object.keys(processedData[0]).map((columnName) => ({ id: columnName, title: columnName })),
        });

        await csvWriter.writeRecords(processedData);

        await browser.close();
        });
    }

    async function performTask(id) {
        try {
            ++inFlightCntr;
            const page = await browser.newPage();
            await page.waitForTimeout(3000);
            page.setViewport({ width: 1000, height: 1500, deviceScaleFactor: 1 });
            const response = await page.goto(url, { waitUntil: 'networkidle2' });
            await page.waitForTimeout(10000);

            await page.waitForSelector('.artibot-closer--J-1d0');
            const buttonIframe = await page.waitForSelector('.artibot-closer--J-1d0');
            buttonIframe.click();

            await page.waitForSelector('input[placeholder="Search by GST Number"]');
            await page.type('input[placeholder="Search by GST Number"]', id);
            await page.waitForFunction(
            (value) => document.querySelector('input[placeholder="Search by GST Number"]').value === value,
            {},
            id
            );
            await page.waitForTimeout(3000);

            const button = await page.waitForSelector('button span');
            button.click();
            await page.waitForTimeout(3000);

            await page.waitForSelector('table');

            // Get the inner text of the third row
            const innerText = await page.$eval('table tr:nth-child(3) td', (row) => row.innerText);
            
            await page.waitForTimeout(1000);
            await page.close();
            return innerText;
        } catch(e) {
            console.log(e);
            page.close();
        } finally {
            --inFlightCntr;
        }
    }

    processDataAndFillCSV();

})();