export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { business_type, state, employee_count } = req.body;

  if (!business_type || !state || !employee_count) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // sectorHints: sector-specific regulatory pointers
  // isIntermediary: whether this business type typically hosts, stores, or
  // transmits third-party / user-generated content, which is the trigger
  // for Intermediary Guidelines (IT Rules 2021) obligations. Kept
  // conservative on purpose — when in doubt, false, so the model doesn't
  // invent inapplicable duties.
  const sectorConfig = {
    'Fintech / BFSI': {
      note: 'Consider RBI Master Directions on IT, SEBI cybersecurity circulars, and account aggregator framework obligations.',
      isIntermediary: false,
    },
    'Healthcare / MedTech': {
      note: 'Consider NMC guidelines, ABDM health data privacy policies, and obligations relating to health and biometric data.',
      isIntermediary: false,
    },
    'EdTech': {
      note: 'Pay special attention to Section 9 DPDP Act obligations around children\'s data and verifiable parental consent.',
      isIntermediary: true,
    },
    'E-commerce / Retail': {
      note: 'Consider Consumer Protection (E-Commerce) Rules 2020 alongside DPDP obligations.',
      isIntermediary: true,
    },
    'SaaS / IT Services': {
      note: 'Consider cross-border data transfer obligations and data processor agreements with international clients.',
      isIntermediary: false, // set true only if the platform itself hosts user-generated/third-party content
    },
  };

  const sector = sectorConfig[business_type] || { note: '', isIntermediary: false };

  const prompt = `You are a senior Indian technology and data privacy lawyer specialising in:
- The Digital Personal Data Protection Act, 2023 (DPDP Act)
- The Digital Personal Data Protection Rules, 2025 (DPDP Rules 2025)
- The Information Technology Act, 2000 (IT Act)
- The Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 (IT Rules 2021)
- The Indian Computer Emergency Response Team (CERT-In) Directions of 2022 issued under Section 70B of the IT Act

You only reference obligations that actually exist in Indian law. You do not invent state-level obligations or obligations that do not apply to this business type.

Generate a compliance checklist for:
- Business type: ${business_type}
- State: ${state}
- Employee count: ${employee_count}
- Does this business type typically qualify as an "intermediary" under Section 2(1)(w) of the IT Act (i.e. it hosts, stores, transmits, publishes, or enables access to third-party information)?: ${sector.isIntermediary ? 'Yes' : 'No — default assumption for this sector; only include Intermediary Guidelines items if the specific business described clearly hosts, stores, transmits, publishes, or enables access to third-party information'}
${sector.note ? `- Sector note: ${sector.note}` : ''}

IMPORTANT RULES:
1. Do not reference "Sensitive Personal Data" — that concept does not exist in the DPDP Act. Use "personal data" or specific categories like health data, biometric data, financial data.
2. Only include state-specific items if there is a real, verifiable state IT policy or sector regulator for ${state}. If none exists, omit state-specific items.
3. Do not treat every business as an intermediary. Intermediary obligations apply only where the business hosts, stores, transmits, publishes, or enables access to third-party information. Only include items under "Intermediary Due Diligence (IT Rules 2021)" if the business genuinely meets this test. If it does not, omit this category entirely rather than forcing an item into it.
4. Reference the exact DPDP Act section, DPDP Rules 2025 rule number, IT Act section, IT Rules 2021 rule number, or CERT-In Direction wherever possible.
5. If a legal reference cannot be identified with confidence, omit the item rather than inventing a section, rule, regulator, obligation, or compliance requirement. 

The checklist MUST include at least one item from each of these categories (categories marked [conditional] should only appear if genuinely applicable per Rule 3 above; if omitted, redistribute items across the other categories so the total item count is still met):
- Notice and Consent (DPDP Act Section 5, 6)
- Data Principal Rights (DPDP Act Section 11-13)
- Security Safeguards (DPDP Act Section 8; DPDP Rules 2025 Rule 6)
- Data Processor Management (DPDP Act Section 8(2))
- Data Breach Response (DPDP Act Section 8(6); DPDP Rules 2025 Rule 7)
- Grievance Redressal (DPDP Act Section 13)
- Cross-Border Data Transfers (DPDP Act Section 16; DPDP Rules 2025 Rule 15)
- Governance and Record Keeping (DPDP Rules 2025 Rule 6, Schedule)
- IT Act Reasonable Security Practices (IT Act Section 43A, Section 72A and related obligations where applicable)
- CERT-In Cyber Incident Reporting (CERT-In Directions 2022 — 6-hour incident reporting, log retention for 180 days, time synchronisation with NTP servers)
- Intermediary Due Diligence [conditional] (IT Rules 2021 — grievance officer, due diligence, and takedown timelines, applicable only where the business hosts, stores, transmits, publishes, or enables access to third-party information)

Return ONLY a valid JSON array. No markdown, no code fences, no explanation. Each item must have exactly these fields:
- "section": category name from the list above
- "title": action item in max 12 words
- "desc": 1-2 sentence practical explanation referencing the specific legal reference
- "priority": exactly one of "critical", "high", or "medium"
- "reference": the specific legal reference e.g. "Section 5, DPDP Act 2023", "Rule 7, DPDP Rules 2025", "Section 43A, IT Act 2000", "CERT-In Directions 2022", or "Rule 3, IT Rules 2021"

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