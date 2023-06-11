const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Function to make API call and get response data
async function makeApiCall(id) {
  const url = `https://app.signalx.ai/apps/gst-verification/gstin-overview/${id}`;
  try {
    const response = await axios.get(url);
    return response.data; // Return the response data
  } catch (error) {
    console.error(`Error making API call for ID: ${id}`, error);
    return null; // Return null if there's an error
  }
}

async function performTaskOnBatch(batch) {
    // Process the data and add output in another column
    const processedData = await Promise.all(
        batch.map(async (row) => {
            const apiData = await makeApiCall(row.GSTIN);
            let outputValue = apiData.principal_place_of_business;
            const pincodeRegex = /\b\d{6}\b/;
            const match = outputValue.match(pincodeRegex);
            if (match) {
                const pincodeIndex = match.index;
                outputValue = outputValue.substring(0, pincodeIndex+6).trim();
            }
            const outputArr = outputValue ? outputValue.split(',') : [];
            if (outputArr.length > 5) {
                return { ...row, Address: outputValue, City: outputArr[outputArr.length - 4], State: outputArr[outputArr.length - 3] };
            }
            return { ...row, Address: outputValue, City: '', State: '' };
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
    console.log("started");
    for (let i = 0; i < array.length; i += batchSize) {
        const batch = array.slice(i, i + batchSize);
        const result = await performTaskOnBatch(batch);
        output.push(...result);
    }
    console.log("ended");

    return output;
}

// Read data from CSV file
function readDataFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    const data = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        data.push(row);
      })
      .on('end', () => {
        resolve(data);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

(async () => {
  const csvFilePath = 'example.csv'; // Path to your CSV file
  const batchSize = 2; // Set the desired batch size

  try {
    // Read data from CSV file
    const inputData = await readDataFromCSV(csvFilePath);

    // Process data in batches
    const results = await processArrayInBatches(inputData, batchSize);

    const outputFilePath = 'output.csv'; // Replace with the path to your output CSV file
    const csvWriter = createCsvWriter({
        path: outputFilePath,
        header: Object.keys(results[0]).map((columnName) => ({ id: columnName, title: columnName })),
    });

    await csvWriter.writeRecords(results);

  } catch (error) {
    console.error('Error reading data from CSV:', error);
  }
})();
