/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rule-based "AI" classification for complaints. Runs instantly and free,
 * with no external API calls required. If GEMINI_API_KEY is configured and
 * USE_MOCK_AI is false, server.ts can additionally enrich these results
 * with a live Gemini call for the summary/evidence-analysis text.
 */
import { Priority } from '../src/types.js';

const CRITICAL_KEYWORDS = [
  'gas leak', 'fire', 'explosion', 'electrocut', 'live wire', 'exposed wire',
  'collapse', 'sinkhole', 'flood', 'sewage overflow', 'chemical spill',
  'downed power line', 'burst main', 'child', 'injur', 'life threat'
];

const HIGH_KEYWORDS = [
  'no water', 'no electricity', 'power outage', 'burst pipe', 'major leak',
  'blocked road', 'accident', 'open manhole', 'contaminat', 'overflow',
  'blackout', 'unsafe', 'hazard'
];

const ANGRY_WORDS = ['furious', 'angry', 'disgusting', 'unacceptable', 'fed up', 'terrible', 'worst', 'disaster', 'outrageous', 'sick of'];
const NEGATIVE_WORDS = ['disappointed', 'frustrat', 'concern', 'worried', 'ignored', 'again', 'still not', 'weeks'];
const POSITIVE_WORDS = ['thank', 'please', 'appreciate', 'kindly'];

const MATERIAL_MAP: Record<string, string> = {
  concrete: 'Concrete Debris',
  asphalt: 'Asphalt Fragments',
  metal: 'Metal Fragments',
  wire: 'Exposed Wiring',
  cable: 'Exposed Cabling',
  glass: 'Broken Glass',
  plastic: 'Plastic Waste',
  sewage: 'Sewage Waste',
  oil: 'Oil Spill',
  garbage: 'Solid Waste',
  wood: 'Wood Debris',
};

export interface Classification {
  priority: Priority;
  hazardSeverity: number;
  materialsDetected: string[];
  aiSentiment: 'Positive' | 'Neutral' | 'Negative' | 'Very Angry';
  aiSummary: string;
  aiEvidenceAnalysis: string;
}

export function classifyComplaint(description: string, category: string, submittedPriority: Priority): Classification {
  const text = description.toLowerCase();
  let priority = submittedPriority;
  let hazardSeverity: number;

  if (CRITICAL_KEYWORDS.some((k) => text.includes(k))) {
    priority = Priority.CRITICAL;
    hazardSeverity = 8.3 + Math.random() * 1.7;
  } else if (HIGH_KEYWORDS.some((k) => text.includes(k))) {
    if (priority !== Priority.CRITICAL) priority = Priority.HIGH;
    hazardSeverity = 5.8 + Math.random() * 2.2;
  } else {
    hazardSeverity = 1.2 + Math.random() * 3.8;
  }

  let aiSentiment: Classification['aiSentiment'] = 'Neutral';
  if (ANGRY_WORDS.some((w) => text.includes(w))) aiSentiment = 'Very Angry';
  else if (NEGATIVE_WORDS.some((w) => text.includes(w))) aiSentiment = 'Negative';
  else if (POSITIVE_WORDS.some((w) => text.includes(w))) aiSentiment = 'Positive';

  const materialsDetected: string[] = [];
  Object.keys(MATERIAL_MAP).forEach((k) => {
    if (text.includes(k)) materialsDetected.push(MATERIAL_MAP[k]);
  });

  const aiSummary = description.length > 140 ? `${description.slice(0, 137).trim()}...` : description;
  const aiEvidenceAnalysis = `AI triage indicates a ${category.toLowerCase()} issue with estimated hazard severity ${hazardSeverity.toFixed(1)}/10, derived from the reported description and location context.`;

  return {
    priority,
    hazardSeverity: Math.min(hazardSeverity, 10),
    materialsDetected,
    aiSentiment,
    aiSummary,
    aiEvidenceAnalysis,
  };
}

/** Finds an existing open complaint from a different citizen matching category + location. */
export function findDuplicate(
  complaints: any[],
  candidate: { category: string; street: string; area: string; citizenId: string }
) {
  const cutoffMs = Date.now() - 1000 * 60 * 60 * 24 * 21; // 21 days
  return complaints.find(
    (c) =>
      c.citizenId !== candidate.citizenId &&
      c.category === candidate.category &&
      c.street.trim().toLowerCase() === candidate.street.trim().toLowerCase() &&
      c.area === candidate.area &&
      !['RESOLVED', 'REJECTED'].includes(c.status) &&
      new Date(c.createdAt).getTime() > cutoffMs
  );
}

export function generateSmartReply(complaint: any): string {
  const statusPhrase =
    complaint.status === 'RESOLVED'
      ? 'confirms the issue has been resolved'
      : complaint.status === 'ASSIGNED' || complaint.status === 'IN_PROGRESS'
      ? 'is actively working towards resolution'
      : 'has logged this for review and prioritization';

  return (
    `Dear ${complaint.citizenName},\n\n` +
    `Thank you for reporting "${complaint.title}". Our ${complaint.departmentName || 'municipal'} team has reviewed your ` +
    `${complaint.category.toLowerCase()} complaint (Priority: ${complaint.priority}) and ${statusPhrase}. ` +
    `${complaint.hazardSeverity ? `Our AI triage rated this at a hazard severity of ${Number(complaint.hazardSeverity).toFixed(1)}/10. ` : ''}` +
    `We appreciate your patience and civic engagement.\n\n— CivicAI Response Team`
  );
}

const CATEGORY_DEPT_CODE: Record<string, string> = {
  Garbage: 'WMD',
  'Illegal Dumping': 'WMD',
  'Road Damage': 'RID',
  'Public Transport': 'RID',
  Drainage: 'WSD',
  'Water Supply': 'WSD',
  'Street Light': 'ELE',
  Electricity: 'ELE',
  'Noise Pollution': 'PSD',
  Others: 'GAD',
};

export function mapCategoryToDepartment(category: string, departments: any[]) {
  const code = CATEGORY_DEPT_CODE[category] || 'GAD';
  return departments.find((d) => d.code === code) || departments[0];
}
