module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { text, clientName, companyName } = req.body;
  if (!text?.trim()) return res.status(200).json({ todos: [] });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `Eres un experto Project Manager. Analiza notas o transcripción de reunión con el cliente "${clientName}" de la empresa "${companyName}".
Extrae TODAS las acciones, tareas, compromisos y pendientes mencionados, explícitos o implícitos.
Responde ÚNICAMENTE con JSON válido sin backticks:
{"todos":[{"text":"tarea específica y accionable","owner":"Wilmer"}]}
- Sé específico: "Enviar propuesta técnica antes del viernes" no solo "Enviar propuesta"
- Máximo 15 tareas. Sin tareas: {"todos":[]}`
          },
          {
            role: 'user',
            content: `Cliente: ${clientName}\nEmpresa: ${companyName}\n\nNotas/Transcripción:\n${text}`
          }
        ],
      }),
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '{"todos":[]}';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    // Find JSON object in response even if there's surrounding text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ todos: [] });
    const parsed = JSON.parse(match[0]);
    return res.status(200).json({ todos: parsed.todos || [] });
  } catch (err) {
    console.error('Extract error:', err);
    return res.status(500).json({ todos: [], error: err.message });
  }
};
