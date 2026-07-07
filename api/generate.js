export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { business_type, state, employee_count } = req.body;

  if (!business_type || !state || !employee_count) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const prompt = `You are a senior Indian data privacy lawyer specialising in the Digital Personal Data Protection Act, 2023 (DPDP Act) and its Draft Rules 2025.

Generate a compliance checklist for:
- Business type: ${business_type}
- State: ${state}
- Employee count: ${employee_count}

Return ONLY a valid JSON array with no markdown, no code fences, and no explanation.

Each item must have:
- "section"
- "title"
- "desc"
- "priority"

Include 20-24 items total. Tailor the checklist specifically to the business type and state. Return pure JSON only.`;

  try {
    console.log(
      "KEY PREFIX:",
      process.env.OPENROUTER_API_KEY?.substring(0, 15)
    );

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY?.trim()}`,
          'HTTP-Referer': req.headers.origin || '',
          'X-Title': 'DPDP Compliance Checker'
        },
        body: JSON.stringify({
          model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      }
    );

    const rawResponse = await response.text();

    console.log('STATUS:', response.status);
    console.log('RAW RESPONSE:', rawResponse);

    if (!response.ok) {
      return res.status(500).json({
        error: rawResponse
      });
    }

    const data = JSON.parse(rawResponse);

    if (
      !data.choices ||
      !data.choices[0] ||
      !data.choices[0].message
    ) {
      return res.status(500).json({
        error: 'Invalid response structure from OpenRouter',
        raw: data
      });
    }

    const content = data.choices[0].message.content;

    let cleaned = content
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    try {
      const items = JSON.parse(cleaned);

      return res.status(200).json({
        items
      });
    } catch (parseError) {
      console.log('JSON PARSE ERROR:', parseError);
      console.log('MODEL OUTPUT:', cleaned);

      return res.status(500).json({
        error: 'Model returned invalid JSON',
        output: cleaned
      });
    }
  } catch (e) {
    console.error(e);

    return res.status(500).json({
      error: e.message
    });
  }
}