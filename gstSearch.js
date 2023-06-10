const puppeteer = require('puppeteer');
const csv = require('csv-parser');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

(async event => {
    const url = 'https://www.gstsearch.in/process.php';
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
                const outputArr = outputValue ? outputValue.split(',') : [];
                if (outputArr.length > 5) {
                    return { ...row, Address: outputValue, City: outputArr[outputArr.length - 3], State: outputArr[outputArr.length - 2] };
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
                await processArrayInBatches(inputData, 25)
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
            const response = await page.goto(url, { waitUntil: 'networkidle2' });
            await page.waitForTimeout(1000);

            await page.waitForSelector('input[placeholder="Enter GST Number"]');
            await page.type('input[placeholder="Enter GST Number"]', id);
            await page.waitForFunction(
                (value) => document.querySelector('input[placeholder="Enter GST Number"]').value === value,
                {},
                id
            );
            await page.waitForTimeout(5000);

            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button.btn.btn-primary'));
                const searchButton = buttons.find(button => button.innerText.includes('Search Now') && button.type === 'submit');
                searchButton.click();
            });
            await page.waitForTimeout(5000);

            await page.waitForSelector('table.table.table-striped.table-hover');

            const address = await page.$eval('table.table.table-striped.table-hover tr:nth-child(13) td:nth-child(2)', element => {
                const strongElements = element.querySelectorAll('strong');
                Array.from(strongElements).forEach(strongElement => {
                  strongElement.remove();
                });
    
                const str = element.innerHTML.replace(/<br\s*[\/]?>/gi, ', ');
                return str.slice(0,-2);
              });
            console.log(address);

            await page.close();
            return address;
        } catch (e) {
            console.log(e);
        }
    }

    processDataAndFillCSV();

})();