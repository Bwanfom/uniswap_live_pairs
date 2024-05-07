import { config as configureDotenv } from "dotenv";
import fetch from "node-fetch";
configureDotenv({ path: "./file.env" });

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

      if (responseData.status === "0") {
        console.error("Error fetching contract ABI:", responseData.message);
        return false; // Return false if there's an error
      }

      // Attempt to parse the ABI from the response
      let contractABI;
      try {
        // Remove outer quotes and unescape escaped characters
        contractABI = JSON.parse(
          responseData.result.replace(/^"|"$/g, "").replace(/\\"/g, '"')
        );
      } catch (parseError) {
        console.error("Error parsing ABI:", parseError);
        throw new Error("Failed to parse ABI from response");
      }

      // Check if the ABI is valid
      if (Array.isArray(contractABI) && contractABI.length > 0) {
        // console.log("Contract is verified.");
        return true; // Return true if the contract is verified
      } else {
        // console.log("Contract is not verified.");
        return false; // Return false if the contract is not verified
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

  console.error(
    `Max retries (${maxRetries}) reached. Unable to fetch contract ABI.`
  );
  return false; // Return false if max retries reached
}
