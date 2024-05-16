import { ethers } from 'ethers';

export async function getTotalSupply(contractAddress) {
  try {
    const totalSupplyBigNumber = await contractAddress.totalSupply();
    const tokenSupply = ethers.formatUnits(totalSupplyBigNumber, 18);

    const strippedTokenSupply = parseInt(tokenSupply);
    return strippedTokenSupply;
  } catch (error) {
    console.error('Error fetching total supply:', error);
    return;
  }
}
