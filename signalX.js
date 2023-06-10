const puppeteer = require('puppeteer');
const csv = require('csv-parser');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

(async event => {
    const url = 'https://app.signalx.ai/gstin-verification/';
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized'],
        timeout: 0, // Disable default launch timeout
        slowMo: 20, // Add some delay between actions for stability
        ignoreHTTPSErrors: true,
        defaultTimeout: 0, // Disable default timeout for page operations
        devtools: false,
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
                // const outputArr = outputValue ? outputValue.split(',') : [];
                // if (outputArr.length > 5) {
                //     return { ...row, Address: outputValue, City: outputArr[outputArr.length - 3], State: outputArr[outputArr.length - 2] };
                // }
                return { ...row, Address: outputValue }; // Replace 'OutputColumn' with the name of your output column in the CSV
            })
        );
        // Simulating an asynchronous task using setTimeout
        await new Promise((resolve) => setTimeout(resolve, 6000));

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
                await processArrayInBatches(inputData, 4)
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
            await page.waitForTimeout(1000);
            page.setViewport({ width: 1000, height: 1500, deviceScaleFactor: 1 });

            const response = await page.goto(`${url}${id}`, { waitUntil: 'networkidle2' });
            
            await page.waitForTimeout(5000);

            await page.waitForSelector('p.MuiTypography-root.MuiTypography-body1');

            const addressElement = await page.$('div.MuiGrid-item:nth-child(7) p.MuiTypography-body1');
            const address = await page.evaluate(element => element.textContent, addressElement);

            await page.close();
            return address;
        } catch (e) {
            console.log(e);
        }
    }

    processDataAndFillCSV();

})();