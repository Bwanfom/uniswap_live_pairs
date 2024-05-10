import { config as configureDotenv } from 'dotenv';
import fetch from 'node-fetch';
configureDotenv({ path: './file.env' });

export async function isContractVerified(contractAddress, maxRetries = 3) {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const apiKey = process.env.API_KEY;
      const response = await fetch(
        `https://api.basescan.org/api?module=contract&action=getabi&address=${contractAddress}&apikey=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error status: ${response.status}`);
      }

      // Parse the JSON response
      const responseData = await response.json();

      if (responseData.status === '0') {
        return false;
      }

      // Attempt to parse the ABI from the response
      let contractABI;
      try {
        contractABI = JSON.parse(
          responseData.result.replace(/^"|"$/g, '').replace(/\\"/g, '"')
        );
      } catch (parseError) {
        throw new Error('Failed to parse ABI from response');
      }

      // Check if the ABI is valid
      if (Array.isArray(contractABI) && contractABI.length > 0) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(
        `Error fetching contract ABI (Retry ${retries + 1} of ${maxRetries}):`,
        error
      );

      // Increment retry count and wait before retrying
      retries++;
      await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Wait for 1 second before retrying
    }
  }
  return false;
}
