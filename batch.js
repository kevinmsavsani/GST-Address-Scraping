const puppeteer = require('puppeteer');
const csv = require('csv-parser');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

(async event => {
    const url = 'https://www.mastersindia.co/gst-number-search-and-gstin-verification/';
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized'],
        timeout: 0, // Disable default launch timeout
        slowMo: 20, // Add some delay between actions for stability
        ignoreHTTPSErrors: true,
        defaultTimeout: 0, // Disable default timeout for page operations
        protocolTimeout: 300000, // 5 minutes (in milliseconds) 
    });
    let data = [];
    // Function to perform a task on a batch of items and return the result
    async function performTaskOnBatch(batch) {
        // Process the data and add output in another column
        const processedData = await Promise.all(
            batch.map(async (row) => {
                const inputValue = row.GSTIN; // Replace 'InputColumn' with the name of your input column in the CSV
                const outputValue = await performTask(inputValue);
                const outputArr = outputValue ? outputValue.split(','): [];
                if(outputArr.length > 5) {
                    return { ...row, Address: outputValue, City: outputArr[4], State: outputArr[5] };
                }
                return { ...row, Address: outputValue, City: '', State: '' }; // Replace 'OutputColumn' with the name of your output column in the CSV
            })
        );
        // Simulating an asynchronous task using setTimeout
        await new Promise((resolve) => setTimeout(resolve, 4000));

        // Return the result of the task
        return processedData;
    }

    // Function to split an array into batches, perform a task on each batch, and collect the results
    async function processArrayInBatches(array, batchSize) {
        const output = [];

        for (let i = 0; i < array.length; i += batchSize) {
            const batch = array.slice(i, i + batchSize);
            const result = await performTaskOnBatch(batch);
            output.push(...result);
        }

        return output;
    }


    async function processDataAndFillCSV() {
        // Read the input CSV file
        const fname = 'example.csv'; // Replace with the path to your input CSV file
        const inputData = [];

        const csvPipe = fs.createReadStream(fname).pipe(csv());

        csvPipe.on('data', (row) => {
            inputData.push(row);
        })
            .on('end', async () => {
                await processArrayInBatches(inputData, 1)
                    .then((outputArray) => {
                        data = [...data, ...outputArray];
                        console.log('Processing completed');
                    })
                    .catch((error) => {
                        console.error('Error occurred during processing:', error);
                    });

                // Write the processed data to the output CSV file
                const outputFilePath = 'output.csv'; // Replace with the path to your output CSV file
                const csvWriter = createCsvWriter({
                    path: outputFilePath,
                    header: Object.keys(data[0]).map((columnName) => ({ id: columnName, title: columnName })),
                });

                await csvWriter.writeRecords(data);

                await browser.close();
            });
    }

    async function performTask(id) {
        try {
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
                    // console.log('Clicked on the chat element.');
                } else {
                    console.log('The chat element is not clickable.');
                }
            } else {
                console.log('The chat element was not found.');
            }

            await page.waitForSelector('input[placeholder="Search by GST Number"]');
            await page.type('input[placeholder="Search by GST Number"]', id);
            await page.waitForFunction(
                (value) => document.querySelector('input[placeholder="Search by GST Number"]').value === value,
                {},
                id
            );
            await page.waitForTimeout(5000);

            await page.waitForSelector('button span');
            await page.click('button span');

            await page.waitForTimeout(5000);

            await page.waitForSelector('table');

            // Get the inner text of the third row
            const innerText = await page.$eval('table tr:nth-child(3) td', (row) => row.innerText);

            await page.close();
            return innerText;
        } catch (e) {
            console.log(e);
        }
    }

    processDataAndFillCSV();

})();