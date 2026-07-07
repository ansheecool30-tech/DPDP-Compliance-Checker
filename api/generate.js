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

Return ONLY a valid JSON array with no markdown, no code fences, no explanation. Each item must have exactly these fields:
- "section": one of ["Data Principal Rights", "Consent Management", "Data Fiduciary Obligations", "Data Localisation & Cross-Border Transfers", "Security Safeguards", "Grievance Redressal", "State-Specific Requirements", "Significant Data Fiduciary Obligations"]
- "title": short action item (max 12 words)
- "desc": 1-2 sentence practical explanation referencing specific DPDP Act sections or rules where relevant
- "priority": exactly one of "critical", "high", or "medium"

Include 20-24 items total. Tailor items specifically to the business type and state. For ${state}, include relevant state government IT policies, sector regulators, or data sharing obligations. Mark Significant Data Fiduciary obligations only if scale and business type warrants it. Return pure JSON array only — no other text.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Claude API error' });
    }

    let raw = data.content[0].text.trim().replace(/```json|```/g, '').trim();
    const items = JSON.parse(raw);
    return res.status(200).json({ items });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
