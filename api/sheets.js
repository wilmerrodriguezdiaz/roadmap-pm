const { google } = require('googleapis');

const SHEET_ID = process.env.VITE_SHEET_ID;
const CLIENT_EMAIL = process.env.VITE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.VITE_PRIVATE_KEY?.replace(/\\n/g, '\n');

async function getSheets() {
  const auth = new google.auth.JWT(
    CLIENT_EMAIL,
    null,
    PRIVATE_KEY,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheets = await getSheets();

    if (req.method === 'GET') {
      // Load data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Data!A1',
      });
      const rows = response.data.values;
      if (!rows || rows.length === 0) return res.status(200).json(null);
      const data = JSON.parse(rows[0][0]);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      // Save data
      const data = JSON.stringify(req.body);
      // Ensure sheet "Data" exists
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: 'Data!A1',
          valueInputOption: 'RAW',
          requestBody: { values: [[data]] },
        });
      } catch(e) {
        // Sheet tab may not exist, try creating it
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            requests: [{ addSheet: { properties: { title: 'Data' } } }]
          }
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: 'Data!A1',
          valueInputOption: 'RAW',
          requestBody: { values: [[data]] },
        });
      }
      return res.status(200).json({ ok: true });
    }
  } catch(err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
