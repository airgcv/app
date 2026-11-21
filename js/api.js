const API_URL = "https://script.google.com/macros/s/AKfycbxnfUinjs-9Qu0_Gu0O5kUewQJJCFA6Wb4KKI-Zn7id69OquHSt0Flc4H3pDz2_wMS1GQ/exec";
const API_KEY = "40b17676db6758170fc434340f74d66ceba03bc1a62141543c879a8df1005c2d";

function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

async function callApi(payload) {
  payload.apiKey = API_KEY;
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (err) {
    return { status: "error" };
  }
}