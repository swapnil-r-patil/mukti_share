export interface GovScheme {
  id: string;
  name: string;
  nameHi: string;
  description: string;
  descriptionHi: string;
  eligibility: {
    minScore?: number;
    maxIncome?: number;
    minJobs?: number;
    skills?: string[];
    verified?: boolean;
  };
  benefit: string;
  benefitHi: string;
  link: string;
  icon: string;
  category: 'loan' | 'insurance' | 'skill' | 'welfare' | 'pension';
}

export const GOV_SCHEMES: GovScheme[] = [
  {
    id: 'pm-svanidhi',
    name: 'PM SVANidhi',
    nameHi: 'पीएम स्वनिधि',
    description: 'Micro-credit facility up to ₹50,000 for street vendors and informal workers. No collateral required.',
    descriptionHi: 'रेहड़ी-पटरी वालों और अनौपचारिक श्रमिकों के लिए ₹50,000 तक की माइक्रो-क्रेडिट सुविधा।',
    eligibility: { minScore: 30, maxIncome: 25000 },
    benefit: 'Loan up to ₹50,000 at 7% interest',
    benefitHi: '7% ब्याज पर ₹50,000 तक का ऋण',
    link: 'https://pmsvanidhi.mohua.gov.in/',
    icon: '🏦',
    category: 'loan'
  },
  {
    id: 'mudra-shishu',
    name: 'MUDRA Loan (Shishu)',
    nameHi: 'मुद्रा लोन (शिशु)',
    description: 'Business loans up to ₹50,000 for micro-enterprises. Ideal for self-employed workers starting out.',
    descriptionHi: 'सूक्ष्म उद्यमों के लिए ₹50,000 तक का व्यवसाय ऋण।',
    eligibility: { minScore: 40, minJobs: 3 },
    benefit: 'Collateral-free loan up to ₹50,000',
    benefitHi: 'बिना गारंटी ₹50,000 तक का ऋण',
    link: 'https://www.mudra.org.in/',
    icon: '💰',
    category: 'loan'
  },
  {
    id: 'mudra-kishor',
    name: 'MUDRA Loan (Kishor)',
    nameHi: 'मुद्रा लोन (किशोर)',
    description: 'Business loans from ₹50,000 to ₹5,00,000 for growing micro-enterprises with work history.',
    descriptionHi: 'बढ़ते सूक्ष्म उद्यमों के लिए ₹50,000 से ₹5,00,000 तक का ऋण।',
    eligibility: { minScore: 60, minJobs: 10 },
    benefit: 'Loan ₹50,000 – ₹5,00,000',
    benefitHi: '₹50,000 – ₹5,00,000 तक का ऋण',
    link: 'https://www.mudra.org.in/',
    icon: '📈',
    category: 'loan'
  },
  {
    id: 'eshram',
    name: 'e-Shram Card',
    nameHi: 'ई-श्रम कार्ड',
    description: 'Universal registration for unorganized workers. Provides ₹2 lakh accidental insurance and access to welfare schemes.',
    descriptionHi: 'असंगठित श्रमिकों के लिए सार्वभौमिक पंजीकरण। ₹2 लाख का दुर्घटना बीमा।',
    eligibility: {},
    benefit: '₹2 lakh accidental insurance + scheme access',
    benefitHi: '₹2 लाख दुर्घटना बीमा + योजना पहुँच',
    link: 'https://eshram.gov.in/',
    icon: '🪪',
    category: 'welfare'
  },
  {
    id: 'pmjjby',
    name: 'PM Jeevan Jyoti Bima',
    nameHi: 'पीएम जीवन ज्योति बीमा',
    description: 'Life insurance cover of ₹2 lakh at just ₹436/year. Available for ages 18-50.',
    descriptionHi: 'मात्र ₹436/वर्ष पर ₹2 लाख का जीवन बीमा कवर।',
    eligibility: {},
    benefit: '₹2 lakh life cover @ ₹436/year',
    benefitHi: '₹436/वर्ष पर ₹2 लाख जीवन बीमा',
    link: 'https://jansuraksha.gov.in/',
    icon: '🛡️',
    category: 'insurance'
  },
  {
    id: 'pmsby',
    name: 'PM Suraksha Bima Yojana',
    nameHi: 'पीएम सुरक्षा बीमा योजना',
    description: 'Accidental death and disability insurance of ₹2 lakh at just ₹20/year.',
    descriptionHi: 'मात्र ₹20/वर्ष पर ₹2 लाख का दुर्घटना बीमा।',
    eligibility: {},
    benefit: '₹2 lakh accident cover @ ₹20/year',
    benefitHi: '₹20/वर्ष पर ₹2 लाख दुर्घटना बीमा',
    link: 'https://jansuraksha.gov.in/',
    icon: '🏥',
    category: 'insurance'
  },
  {
    id: 'pmkvy',
    name: 'PM Kaushal Vikas Yojana',
    nameHi: 'पीएम कौशल विकास योजना',
    description: 'Free skill development training and certification. Covers 300+ job roles across 40 sectors.',
    descriptionHi: 'मुफ्त कौशल विकास प्रशिक्षण और प्रमाणन। 40 क्षेत्रों में 300+ नौकरी भूमिकाएँ।',
    eligibility: {},
    benefit: 'Free certification + ₹8,000 reward',
    benefitHi: 'मुफ्त प्रमाणपत्र + ₹8,000 इनाम',
    link: 'https://pmkvyofficial.org/',
    icon: '🎓',
    category: 'skill'
  },
  {
    id: 'pm-shram-yogi',
    name: 'PM Shram Yogi Maandhan',
    nameHi: 'पीएम श्रम योगी मानधन',
    description: 'Pension scheme for unorganized workers. Get ₹3,000/month pension after age 60.',
    descriptionHi: 'असंगठित श्रमिकों के लिए पेंशन योजना। 60 वर्ष के बाद ₹3,000/माह पेंशन।',
    eligibility: { maxIncome: 15000 },
    benefit: '₹3,000/month pension after 60',
    benefitHi: '60 वर्ष के बाद ₹3,000/माह पेंशन',
    link: 'https://maandhan.in/',
    icon: '👴',
    category: 'pension'
  }
];

export const matchSchemes = (
  muktiScore: number,
  monthlyIncome: number,
  totalJobs: number,
  isVerified: boolean
): GovScheme[] => {
  return GOV_SCHEMES.filter(scheme => {
    const e = scheme.eligibility;
    if (e.minScore && muktiScore < e.minScore) return false;
    if (e.maxIncome && monthlyIncome > e.maxIncome) return false;
    if (e.minJobs && totalJobs < e.minJobs) return false;
    if (e.verified && !isVerified) return false;
    return true;
  });
};
