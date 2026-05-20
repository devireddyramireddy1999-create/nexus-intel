import { cryptoRadar } from "../data/mockData.js";
import { getCrypto } from "./marketProvider.js";

export async function getCryptoData() {
  const crypto = await getCrypto();

  return {
    ...crypto,
    radar: cryptoRadar,
  };
}
