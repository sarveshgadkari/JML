// Mock data for the application

export interface Lawyer {
  id: string;
  name: string;
  rank: number;
  specialization: string[];
  totalCases: number;
  winRate: number;
  lossRate: number;
  settlementRate: number;
  avgCaseDuration: number; // in days
  avgHearings: number;
  courts: string[];
  contactEmail?: string;
  contactPhone?: string;
  experience: number; // years
  barRegistration: string;
}

export interface Judge {
  id: string;
  name: string;
  rank: number;
  court: string;
  totalCases: number;
  casesForComplainant: number;
  casesForRespondent: number;
  settlementRate: number;
  dismissRate: number;
  avgHearings: number;
  avgCaseDuration: number; // in days
  yearsOfService: number;
  specialization: string[];
  appealRate: number; // percentage of cases appealed
  reversalRate: number; // percentage of appealed cases reversed
  avgDecisionTime: number; // days from last hearing to judgment
}

export interface Court {
  id: string;
  name: string;
  rank: number;
  location: string;
  type: string; // District, High, Supreme
  totalCases: number;
  casesForComplainant: number;
  casesForRespondent: number;
  settlementRate: number;
  dismissRate: number;
  avgHearings: number;
  avgCaseDuration: number; // in days
  judges: number;
  clearanceRate: number; // (disposed/filed) * 100
  pendingCases: number;
  casesFiled: number; // cases filed this year
  casesDisposed: number; // cases disposed this year
}

export interface CaseHistory {
  id: string;
  caseNumber: string;
  title: string;
  type: 'Civil' | 'Criminal' | 'Family' | 'Corporate' | 'Property';
  court: string;
  filingDate: string;
  closingDate: string;
  judgmentDate?: string; // Date of final judgment
  outcome: 'Won' | 'Lost' | 'Settled' | 'Pending' | 'Dismissed';
  hearings: number;
  duration: number; // in days
  opposingLawyer?: string; // For opposition analysis
  wasAppealed?: boolean; // For appeal tracking
  appealOutcome?: 'Upheld' | 'Reversed' | 'Pending'; // For reversal rate
}

export const mockLawyers: Lawyer[] = [
  {
    id: '1',
    name: 'Adv. Rajesh Kumar',
    rank: 1,
    specialization: ['Criminal Law', 'Corporate Law'],
    totalCases: 487,
    winRate: 78.2,
    lossRate: 15.4,
    settlementRate: 6.4,
    avgCaseDuration: 245,
    avgHearings: 8.3,
    courts: ['Delhi High Court', 'Supreme Court'],
    contactEmail: 'rajesh.kumar@lawfirm.com',
    contactPhone: '+91 98765 43210',
    experience: 18,
    barRegistration: 'D/1234/2005'
  },
  {
    id: '2',
    name: 'Adv. Priya Sharma',
    rank: 2,
    specialization: ['Civil Law', 'Family Law'],
    totalCases: 392,
    winRate: 76.8,
    lossRate: 17.1,
    settlementRate: 6.1,
    avgCaseDuration: 198,
    avgHearings: 7.1,
    courts: ['Mumbai High Court', 'Family Court Mumbai'],
    contactEmail: 'priya.sharma@legal.com',
    contactPhone: '+91 98123 45678',
    experience: 15,
    barRegistration: 'M/5678/2008'
  },
  {
    id: '3',
    name: 'Adv. Vikram Singh',
    rank: 3,
    specialization: ['Property Law', 'Civil Law'],
    totalCases: 356,
    winRate: 74.5,
    lossRate: 18.3,
    settlementRate: 7.2,
    avgCaseDuration: 312,
    avgHearings: 9.8,
    courts: ['Bangalore High Court', 'Civil Court Bangalore'],
    experience: 12,
    barRegistration: 'K/9012/2011'
  },
  {
    id: '4',
    name: 'Adv. Meera Patel',
    rank: 4,
    specialization: ['Corporate Law', 'Tax Law'],
    totalCases: 289,
    winRate: 72.3,
    lossRate: 19.7,
    settlementRate: 8.0,
    avgCaseDuration: 276,
    avgHearings: 6.4,
    courts: ['Gujarat High Court', 'Supreme Court'],
    contactEmail: 'meera.patel@corporate.law',
    experience: 14,
    barRegistration: 'G/3456/2009'
  },
  {
    id: '5',
    name: 'Adv. Anil Verma',
    rank: 5,
    specialization: ['Criminal Law', 'Civil Law'],
    totalCases: 412,
    winRate: 71.8,
    lossRate: 20.1,
    settlementRate: 8.1,
    avgCaseDuration: 223,
    avgHearings: 7.9,
    courts: ['Kolkata High Court', 'Sessions Court Kolkata'],
    experience: 16,
    barRegistration: 'WB/7890/2007'
  }
];

export const mockJudges: Judge[] = [
  {
    id: '1',
    name: 'Hon. Justice M. K. Sharma',
    rank: 1,
    court: 'Delhi High Court',
    totalCases: 1245,
    casesForComplainant: 542,
    casesForRespondent: 498,
    settlementRate: 16.5,
    dismissRate: 8.2,
    avgHearings: 6.8,
    avgCaseDuration: 187,
    yearsOfService: 22,
    specialization: ['Criminal Law', 'Constitutional Law'],
    appealRate: 5.0,
    reversalRate: 2.5,
    avgDecisionTime: 30
  },
  {
    id: '2',
    name: 'Hon. Justice S. Reddy',
    rank: 2,
    court: 'Supreme Court',
    totalCases: 892,
    casesForComplainant: 398,
    casesForRespondent: 387,
    settlementRate: 12.0,
    dismissRate: 7.5,
    avgHearings: 5.2,
    avgCaseDuration: 156,
    yearsOfService: 25,
    specialization: ['Civil Law', 'Corporate Law'],
    appealRate: 4.0,
    reversalRate: 2.0,
    avgDecisionTime: 25
  },
  {
    id: '3',
    name: 'Hon. Justice P. Iyer',
    rank: 3,
    court: 'Mumbai High Court',
    totalCases: 1089,
    casesForComplainant: 487,
    casesForRespondent: 456,
    settlementRate: 13.4,
    dismissRate: 9.1,
    avgHearings: 7.1,
    avgCaseDuration: 198,
    yearsOfService: 19,
    specialization: ['Family Law', 'Property Law'],
    appealRate: 6.0,
    reversalRate: 3.0,
    avgDecisionTime: 35
  },
  {
    id: '4',
    name: 'Hon. Justice R. Patel',
    rank: 4,
    court: 'Gujarat High Court',
    totalCases: 967,
    casesForComplainant: 423,
    casesForRespondent: 412,
    settlementRate: 13.7,
    dismissRate: 8.8,
    avgHearings: 6.5,
    avgCaseDuration: 203,
    yearsOfService: 17,
    specialization: ['Tax Law', 'Corporate Law'],
    appealRate: 5.5,
    reversalRate: 2.8,
    avgDecisionTime: 32
  },
  {
    id: '5',
    name: 'Hon. Justice A. Khan',
    rank: 5,
    court: 'Bangalore High Court',
    totalCases: 1134,
    casesForComplainant: 512,
    casesForRespondent: 467,
    settlementRate: 13.6,
    dismissRate: 9.3,
    avgHearings: 7.3,
    avgCaseDuration: 215,
    yearsOfService: 20,
    specialization: ['Criminal Law', 'Civil Law'],
    appealRate: 4.5,
    reversalRate: 2.3,
    avgDecisionTime: 28
  }
];

export const mockCourts: Court[] = [
  {
    id: '1',
    name: 'Supreme Court of India',
    rank: 1,
    location: 'New Delhi',
    type: 'Supreme Court',
    totalCases: 12456,
    casesForComplainant: 5432,
    casesForRespondent: 5234,
    settlementRate: 14.2,
    dismissRate: 5.8,
    avgHearings: 5.8,
    avgCaseDuration: 178,
    judges: 34,
    clearanceRate: 85.2,
    pendingCases: 1800,
    casesFiled: 2500,
    casesDisposed: 2100
  },
  {
    id: '2',
    name: 'Delhi High Court',
    rank: 2,
    location: 'New Delhi',
    type: 'High Court',
    totalCases: 8934,
    casesForComplainant: 3987,
    casesForRespondent: 3678,
    settlementRate: 14.8,
    dismissRate: 7.2,
    avgHearings: 7.2,
    avgCaseDuration: 203,
    judges: 45,
    clearanceRate: 82.5,
    pendingCases: 1500,
    casesFiled: 2000,
    casesDisposed: 1650
  },
  {
    id: '3',
    name: 'Mumbai High Court',
    rank: 3,
    location: 'Mumbai',
    type: 'High Court',
    totalCases: 9823,
    casesForComplainant: 4312,
    casesForRespondent: 4089,
    settlementRate: 15.6,
    dismissRate: 7.8,
    avgHearings: 7.8,
    avgCaseDuration: 218,
    judges: 52,
    clearanceRate: 84.0,
    pendingCases: 1600,
    casesFiled: 2200,
    casesDisposed: 1840
  },
  {
    id: '4',
    name: 'Bangalore High Court',
    rank: 4,
    location: 'Bangalore',
    type: 'High Court',
    totalCases: 7654,
    casesForComplainant: 3421,
    casesForRespondent: 3187,
    settlementRate: 13.4,
    dismissRate: 8.1,
    avgHearings: 8.1,
    avgCaseDuration: 234,
    judges: 38,
    clearanceRate: 83.5,
    pendingCases: 1400,
    casesFiled: 1900,
    casesDisposed: 1600
  },
  {
    id: '5',
    name: 'Gujarat High Court',
    rank: 5,
    location: 'Ahmedabad',
    type: 'High Court',
    totalCases: 6789,
    casesForComplainant: 2987,
    casesForRespondent: 2876,
    settlementRate: 13.7,
    dismissRate: 7.4,
    avgHearings: 7.4,
    avgCaseDuration: 212,
    judges: 36,
    clearanceRate: 84.5,
    pendingCases: 1300,
    casesFiled: 1800,
    casesDisposed: 1530
  }
];

export const generateCaseHistory = (entityType: 'lawyer' | 'judge' | 'court', entityId: string): CaseHistory[] => {
  const caseTypes: Array<'Civil' | 'Criminal' | 'Family' | 'Corporate' | 'Property'> = ['Civil', 'Criminal', 'Family', 'Corporate', 'Property'];
  const outcomes: Array<'Won' | 'Lost' | 'Settled' | 'Pending' | 'Dismissed'> = ['Won', 'Lost', 'Settled', 'Pending', 'Dismissed'];
  const opposingLawyers = ['Adv. Rajesh Kumar', 'Adv. Priya Sharma', 'Adv. Vikram Singh', 'Adv. Meera Patel', 'Adv. Anil Verma'];
  
  const cases: CaseHistory[] = [];
  const numCases = 50; // Increased for better data visualization

  for (let i = 0; i < numCases; i++) {
    const filingDate = new Date(2020 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    const duration = Math.floor(Math.random() * 400) + 30;
    const hearings = Math.floor(Math.random() * 15) + 3;
    const closingDate = new Date(filingDate);
    closingDate.setDate(closingDate.getDate() + duration);
    
    const judgmentDate = new Date(closingDate);
    judgmentDate.setDate(judgmentDate.getDate() - Math.floor(Math.random() * 30)); // Judgment before closing
    
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    const wasAppealed = Math.random() < 0.15; // 15% appeal rate
    const appealOutcome = wasAppealed ? (Math.random() < 0.25 ? 'Reversed' : 'Upheld') : undefined;

    cases.push({
      id: `case-${entityType}-${entityId}-${i + 1}`,
      caseNumber: `${caseTypes[i % caseTypes.length].substring(0, 3).toUpperCase()}/${2020 + Math.floor(i / 10)}/${1000 + i}`,
      title: `${['State', 'Corporation', 'Individual', 'Company', 'Trust', 'Partnership'][i % 6]} vs ${['Defendant', 'Respondent', 'Party', 'Entity', 'Accused', 'Opposition'][i % 6]}`,
      type: caseTypes[Math.floor(Math.random() * caseTypes.length)],
      court: ['Supreme Court', 'Delhi High Court', 'Mumbai High Court', 'Bangalore High Court', 'Gujarat High Court'][Math.floor(Math.random() * 5)],
      filingDate: filingDate.toISOString().split('T')[0],
      closingDate: closingDate.toISOString().split('T')[0],
      judgmentDate: judgmentDate.toISOString().split('T')[0],
      outcome: outcome,
      hearings: hearings,
      duration: duration,
      opposingLawyer: opposingLawyers[Math.floor(Math.random() * opposingLawyers.length)],
      wasAppealed: wasAppealed,
      appealOutcome: appealOutcome
    });
  }

  return cases.sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime());
};

// Generate backlog trend data for courts
export const generateBacklogTrend = (): Array<{ year: number; month: string; filed: number; disposed: number; pending: number }> => {
  const data = [];
  let cumPending = 1200;
  
  for (let year = 2022; year <= 2025; year++) {
    for (let month = 0; month < 12; month++) {
      if (year === 2025 && month > 0) break; // Only up to Jan 2026
      
      const filed = 150 + Math.floor(Math.random() * 100);
      const disposed = 130 + Math.floor(Math.random() * 110);
      cumPending = cumPending + filed - disposed;
      
      data.push({
        year,
        month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month],
        filed,
        disposed,
        pending: cumPending
      });
    }
  }
  
  return data;
};

// Generate judge performance data for a court
export const generateJudgePerformanceData = (courtId: string) => {
  const judgeNames = [
    'Justice A. Kumar',
    'Justice B. Sharma', 
    'Justice C. Patel',
    'Justice D. Singh',
    'Justice E. Reddy'
  ];
  
  return judgeNames.map((name, idx) => ({
    name,
    cases: 180 + Math.floor(Math.random() * 100),
    avgDuration: 180 + Math.floor(Math.random() * 60),
    settlementRate: 12 + Math.floor(Math.random() * 8),
    disposalRate: 85 + Math.floor(Math.random() * 15)
  }));
};