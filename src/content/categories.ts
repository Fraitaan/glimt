export const CATEGORY_IDS = [
  'psychology',
  'science',
  'history',
  'philosophy',
  'money',
  'health',
  'productivity',
  'ai',
  'business',
  'curiosities',
] as const

export type CategoryId = (typeof CATEGORY_IDS)[number]

export interface Category {
  id: CategoryId
  name: { en: string; sv: string }
  blurb: { en: string; sv: string }
  /** Muted accent used for emphasis, illustrations and the card glow. */
  accent: string
  /** Neighbouring topics used for the "related" slice of the feed. */
  related: CategoryId[]
}

export const CATEGORIES: Record<CategoryId, Category> = {
  psychology: {
    id: 'psychology',
    name: { en: 'Psychology', sv: 'Psykologi' },
    blurb: { en: 'Why we think and act the way we do', sv: 'Varför vi tänker och gör som vi gör' },
    accent: '#E89F92',
    related: ['productivity', 'health', 'philosophy', 'business'],
  },
  science: {
    id: 'science',
    name: { en: 'Science', sv: 'Vetenskap' },
    blurb: { en: 'How the universe actually works', sv: 'Hur universum faktiskt fungerar' },
    accent: '#8FB8DE',
    related: ['curiosities', 'health', 'ai'],
  },
  history: {
    id: 'history',
    name: { en: 'History', sv: 'Historia' },
    blurb: { en: 'Surprising moments that shaped today', sv: 'Oväntade ögonblick som format i dag' },
    accent: '#DDAA62',
    related: ['curiosities', 'business', 'philosophy'],
  },
  philosophy: {
    id: 'philosophy',
    name: { en: 'Philosophy', sv: 'Filosofi' },
    blurb: { en: 'Old ideas for modern problems', sv: 'Gamla idéer för moderna problem' },
    accent: '#B7A3DC',
    related: ['psychology', 'history', 'productivity'],
  },
  money: {
    id: 'money',
    name: { en: 'Money & Economics', sv: 'Pengar & ekonomi' },
    blurb: { en: 'How money, markets and choices work', sv: 'Hur pengar, marknader och val fungerar' },
    accent: '#9FCB9C',
    related: ['business', 'psychology', 'history'],
  },
  health: {
    id: 'health',
    name: { en: 'Health & Body', sv: 'Hälsa & kropp' },
    blurb: { en: 'Your body, sleep and wellbeing', sv: 'Kroppen, sömnen och välmåendet' },
    accent: '#7FCDB8',
    related: ['science', 'psychology', 'productivity'],
  },
  productivity: {
    id: 'productivity',
    name: { en: 'Learning & Focus', sv: 'Lärande & fokus' },
    blurb: { en: 'Evidence-based ways to learn and get things done', sv: 'Forskningsbaserade sätt att lära och komma igång' },
    accent: '#E7C96E',
    related: ['psychology', 'health', 'philosophy'],
  },
  ai: {
    id: 'ai',
    name: { en: 'Artificial Intelligence', sv: 'Artificiell intelligens' },
    blurb: { en: 'What AI really does under the hood', sv: 'Vad AI egentligen gör under huven' },
    accent: '#97A3F2',
    related: ['science', 'business', 'philosophy'],
  },
  business: {
    id: 'business',
    name: { en: 'Business & Thinking', sv: 'Affärer & tänkande' },
    blurb: { en: 'Mental models for decisions', sv: 'Tankemodeller för bättre beslut' },
    accent: '#E08B6A',
    related: ['money', 'psychology', 'history'],
  },
  curiosities: {
    id: 'curiosities',
    name: { en: 'Curiosities', sv: 'Kuriosa' },
    blurb: { en: 'Strange and wonderful facts', sv: 'Märkliga och underbara fakta' },
    accent: '#D9A0D2',
    related: ['science', 'history', 'health'],
  },
}

export const categoryList = CATEGORY_IDS.map((id) => CATEGORIES[id])
