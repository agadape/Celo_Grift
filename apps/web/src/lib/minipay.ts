import {connectWallet} from "./wallet";

export async function connectMiniPay() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet found. Open this app inside MiniPay.");
  }

  if (!window.ethereum.isMiniPay) {
    throw new Error("MiniPay was not detected. Open this page in MiniPay.");
  }

  const {address} = await connectWallet();
  return address;
}
