const fs = require('fs').promises;
const path = require('path');

const folderPath = path.join(__dirname, "server/services");
const filePath = path.join(folderPath, 'chat_log.json');

// Queue to prevent concurrent write issues
let writeQueue = Promise.resolve();

/**
 * Save Q&A to JSON file
 */
async function saveQA(question, answer) {
  writeQueue = writeQueue.then(async () => {
    try {
      // Ensure folder exists
      await fs.mkdir(folderPath, { recursive: true });

      let data = [];

      // Read existing file
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        if (fileContent) {
          data = JSON.parse(fileContent);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }

      // Append new entry
      data.push({
        question,
        answer,
        timestamp: new Date().toISOString()
      });

      // Write back to file
      await fs.writeFile(
        filePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );

      console.log('Q&A saved');
    } catch (err) {
      console.error('Error saving Q&A:', err);
    }
  });

  return writeQueue;
}

/**
 * Fetch all Q&A from file
 */
async function getAllQA() {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

module.exports = {
  saveQA,
  getAllQA
};