const ASSEMBLY_KEY = process.env.ASSEMBLYAI_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { audioUrl, audioBase64, mimeType } = req.body;

  try {
    let uploadUrl = audioUrl;

    // If base64 audio, upload to AssemblyAI first
    if (audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'authorization': ASSEMBLY_KEY,
          'Content-Type': mimeType || 'audio/webm',
        },
        body: audioBuffer,
      });
      const uploadData = await uploadRes.json();
      uploadUrl = uploadData.upload_url;
    }

    // Submit transcription with speaker diarization
    const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLY_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: uploadUrl,
        language_code: 'es',
        speaker_labels: true,
        speakers_expected: 4,
      }),
    });
    const transcriptData = await transcriptRes.json();
    const transcriptId = transcriptData.id;

    // Poll for completion (max 60s)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 'authorization': ASSEMBLY_KEY },
      });
      const pollData = await pollRes.json();

      if (pollData.status === 'completed') {
        // Format with speaker labels
        const utterances = pollData.utterances || [];
        const formatted = utterances.map(u => `[${u.speaker}]: ${u.text}`).join('\n');
        return res.status(200).json({
          text: formatted || pollData.text,
          utterances,
          speakers: [...new Set(utterances.map(u => u.speaker))],
        });
      }

      if (pollData.status === 'error') {
        throw new Error(pollData.error);
      }
    }

    return res.status(408).json({ error: 'Transcription timeout' });
  } catch (err) {
    console.error('Transcribe error:', err);
    return res.status(500).json({ error: err.message });
  }
};
