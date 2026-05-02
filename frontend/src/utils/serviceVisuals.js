// Curated, license-safe Unsplash photos and category-aware fallback descriptions.
// Used purely as visual placeholders when an organiser hasn't uploaded their own image.

const IMAGES = [
  'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=900&q=80&auto=format&fit=crop', // dental clinic
  'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=900&q=80&auto=format&fit=crop',   // yoga
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=900&q=80&auto=format&fit=crop',// fitness
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=900&q=80&auto=format&fit=crop',// spa
  'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=900&q=80&auto=format&fit=crop',   // consult
  'https://images.unsplash.com/photo-1562280963-8a5475740a10?w=900&q=80&auto=format&fit=crop',   // beauty
  'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=900&q=80&auto=format&fit=crop',// auto / mechanic
  'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=900&q=80&auto=format&fit=crop',// tech / coding
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&q=80&auto=format&fit=crop',// coaching
  'https://images.unsplash.com/photo-1470114716159-e389f8712fda?w=900&q=80&auto=format&fit=crop',// event / studio
  'https://images.unsplash.com/photo-1514315384763-ba401779410f?w=900&q=80&auto=format&fit=crop',// salon
  'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=900&q=80&auto=format&fit=crop',   // medical
];

const CATEGORY_RULES = [
  { keys: ['dent','tooth','clinic','dental'],     image: 0,
    desc: 'Professional dental cleaning, check-ups, and consultations performed by certified specialists in a calm, modern environment.' },
  { keys: ['yoga','meditat','wellness','mindful'],image: 1,
    desc: 'Guided yoga and mindfulness sessions designed to improve flexibility, reduce stress, and bring balance to your day.' },
  { keys: ['gym','fitness','train','workout'],    image: 2,
    desc: 'Personal training tailored to your goals — strength, endurance, and form — with measurable progress at every session.' },
  { keys: ['spa','massage','therapy','relax'],    image: 3,
    desc: 'Relaxing wellness treatments to rejuvenate your mind and body, performed by experienced therapists.' },
  { keys: ['consult','advis','coach','strategy'], image: 4,
    desc: 'One-on-one consulting with deep, actionable insights tailored to your situation and goals.' },
  { keys: ['beauty','makeup','skincare','facial'],image: 5,
    desc: 'Premium beauty treatments using clean, dermatologist-approved products for a healthy, lasting glow.' },
  { keys: ['scoot','bike','car','auto','vehicle','servic'],
                                                  image: 6,
    desc: 'Comprehensive vehicle servicing with genuine parts, expert technicians, and transparent pricing — your ride in safe hands.' },
  { keys: ['code','dev','program','engineer','tech'], image: 7,
    desc: 'Hands-on technical sessions covering modern engineering practices, code reviews, and architecture deep dives.' },
  { keys: ['class','course','tutor','lesson','learn'], image: 8,
    desc: 'Structured learning sessions with personalised feedback and a clear roadmap to help you reach your goals faster.' },
  { keys: ['photo','studio','event','shoot'],     image: 9,
    desc: 'Studio sessions and event coverage with a professional setup, attentive direction, and beautifully edited deliverables.' },
  { keys: ['salon','hair','barber','cut','style'],image: 10,
    desc: 'Modern salon services from experienced stylists — precision cuts, colouring, and styling for every occasion.' },
  { keys: ['doctor','medical','health','check','clinic'], image: 11,
    desc: 'General health check-ups and consultations with experienced practitioners in a comfortable, hygienic clinic.' },
];

const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h);
};

export function imageFor(service) {
  if (!service) return IMAGES[0];
  const name = (service.name || '').toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keys.some((k) => name.includes(k))) return IMAGES[rule.image];
  }
  return IMAGES[hash(name || String(service.id || '0')) % IMAGES.length];
}

export function descriptionFor(service) {
  if (service && service.description && service.description.trim().length > 8) {
    return service.description;
  }
  const name = (service && service.name || '').toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keys.some((k) => name.includes(k))) return rule.desc;
  }
  return 'A trusted appointment experience — book a slot in seconds and we’ll take care of the rest.';
}
