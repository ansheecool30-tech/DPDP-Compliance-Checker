export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { business_type, state, employee_count } = req.body;

  if (!business_type || !state || !employee_count) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const sectorHints = {
    'Fintech / BFSI': 'Consider RBI Master Directions on IT, SEBI cybersecurity circulars, and account aggregator framework obligations.',
    'Healthcare / MedTech': 'Consider NMC guidelines, ABDM health data privacy policies, and obligations around sensitive health and biometric data.',
    'EdTech': 'Pay special attention to Section 9 DPDP Act obligations around children\'s data and verifiable parental consent.',
    'Telecom': 'Consider TRAI regulations on customer data and the Telecommunications Act 2023.',
    'E-commerce / Retail': 'Consider Consumer Protection (E-Commerce) Rules 2020 alongside DPDP obligations.',
    'SaaS / IT Services': 'Consider cross-border data transfer obligations and data processor agreements with international clients.',
  };

  const sectorNote = sectorHints[business_type] || '';

  const prompt = `You are a senior Indian data privacy lawyer specialising in the Digital Personal Data Protection Act, 2023 (DPDP Act) and its Draft Rules 2025. You only reference obligations that actually exist in Indian law. You do not invent state-level obligations.

Generate a compliance checklist for:
- Business type: ${business_type}
- State: ${state}
- Employee count: ${employee_count}
${sectorNote ? `- Sector note: ${sectorNote}` : ''}

IMPORTANT RULES:
1. Do not reference "Sensitive Personal Data" — that concept does not exist in the DPDP Act. Use "personal data" or specific categories like health data, biometric data, financial data.
2. Only include state-specific items if there is a real, verifiable state IT policy or sector regulator for ${state}. If none exists, omit state-specific items.
3. Reference the exact DPDP Act section or Draft Rule number wherever possible.

The checklist MUST include at least one item from each of these categories:
- Notice and Consent (Section 5, 6)
- Data Principal Rights (Section 11-13)
- Security Safeguards (Section 8)
- Data Processor Management (Section 8(2))
- Data Breach Response (Section 8(6), Rule 7)
- Grievance Redressal (Section 13)
- Cross-Border Data Transfers (Section 16)
- Governance and Record Keeping

Return ONLY a valid JSON array. No markdown, no code fences, no explanation. Each item must have exactly these fields:
- "section": category name from the list above
- "title": action item in max 12 words
- "desc": 1-2 sentence practical explanation referencing the specific DPDP Act section or Draft Rule
- "priority": exactly one of "critical", "high", or "medium"
- "reference": the specific legal reference e.g. "Section 5, DPDP Act 2023" or "Rule 7, Draft DPDP Rules 2025"

Include 20-24 items total. Return pure JSON array only.`;

  async function callOpenRouter() {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY?.trim()}`,
        'HTTP-Referer': req.headers.origin || 'https://dpdp-checker.vercel.app',
        'X-Title': 'DPDP Compliance Checker'
      },
      body: JSON.stringify({
        model: 'google/gemma-4-26b-a4b-it:free',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const rawResponse = await response.text();

    if (response.status === 429) {
      return { rateLimited: true };
    }

    if (!response.ok) {
      throw new Error(rawResponse);
    }

    const data = JSON.parse(rawResponse);

    if (!data.choices?.[0]?.message) {
      throw new Error('Invalid response structure from OpenRouter');
    }

    return { content: data.choices[0].message.content };
  }

  try {
    // First attempt
    let result = await callOpenRouter();

    // Retry once after 5 seconds if rate limited
    if (result.rateLimited) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      result = await callOpenRouter();
      if (result.rateLimited) {
        return res.status(429).json({
          error: 'The AI model is currently busy. Please wait 30 seconds and try again.'
        });
      }
    }

    let cleaned = result.content
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    try {
      const items = JSON.parse(cleaned);
      return res.status(200).json({ items });
    } catch (parseError) {
      return res.status(500).json({
        error: 'Model returned invalid JSON. Please try again.',
        output: cleaned
      });
    }

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}