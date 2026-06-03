// Google Sheets sync via Vercel serverless proxy
const SHEET_ID = import.meta.env.VITE_SHEET_ID;

export async function loadFromSheets() {
  try {
    const res = await fetch('/api/sheets?action=load');
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch(e) {
    return null;
  }
}

export async function saveToSheets(data) {
  try {
    await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch(e) {
    console.error('Sheets sync error:', e);
  }
}
