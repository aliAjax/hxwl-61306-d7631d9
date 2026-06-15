import { uid as uidFn } from '../config/configManager';

export const PHRASE_LIBRARY_STORAGE = 'hxwl-61306-phrase-library';

export const PHRASE_LIBRARY_SEED = [
  {
    phrase: '镜下见肿瘤细胞呈巢状排列，核大深染，核分裂象易见，考虑为恶性肿瘤。',
    sampleType: '手术切除',
    useCount: 12,
    lastUsedAt: '2026-06-12T10:30:00.000Z',
    pinned: false,
    pinnedAt: ''
  },
  {
    phrase: '胃黏膜慢性炎，伴肠上皮化生，未见异型增生，建议定期复查。',
    sampleType: '胃镜',
    useCount: 25,
    lastUsedAt: '2026-06-13T14:20:00.000Z',
    pinned: true,
    pinnedAt: '2026-06-13T14:20:00.000Z'
  },
  {
    phrase: '结肠黏膜慢性炎，可见溃疡形成，伴炎性息肉，建议治疗后复查。',
    sampleType: '肠镜',
    useCount: 18,
    lastUsedAt: '2026-06-11T09:15:00.000Z',
    pinned: false,
    pinnedAt: ''
  },
  {
    phrase: '细针穿刺涂片见异型细胞，考虑为腺癌，建议进一步活检明确诊断。',
    sampleType: '穿刺',
    useCount: 8,
    lastUsedAt: '2026-06-10T16:45:00.000Z',
    pinned: false,
    pinnedAt: ''
  },
  {
    phrase: '细胞学检查见大量炎性细胞，未见明确癌细胞，建议结合临床。',
    sampleType: '细胞学',
    useCount: 15,
    lastUsedAt: '2026-06-09T11:00:00.000Z',
    pinned: false,
    pinnedAt: ''
  },
  {
    phrase: '切缘未见肿瘤细胞，肿瘤浸润至浆膜层，伴淋巴结转移（2/12）。',
    sampleType: '手术切除',
    useCount: 6,
    lastUsedAt: '2026-06-08T15:30:00.000Z',
    pinned: false,
    pinnedAt: ''
  },
  {
    phrase: '胃体溃疡型中分化腺癌，溃疡大小约2.5cm，侵及黏膜下层。',
    sampleType: '胃镜',
    useCount: 10,
    lastUsedAt: '2026-06-13T08:50:00.000Z',
    pinned: true,
    pinnedAt: '2026-06-12T08:00:00.000Z'
  },
  {
    phrase: '乳腺穿刺标本：浸润性导管癌，ER(+)，PR(+)，HER2(-)，Ki-67约30%。',
    sampleType: '穿刺',
    useCount: 4,
    lastUsedAt: '2026-06-07T13:20:00.000Z',
    pinned: false,
    pinnedAt: ''
  }
];

export const PHRASE_SAMPLE_TYPES = ['全部', '穿刺', '胃镜', '肠镜', '手术切除', '细胞学'];

function uid() {
  return uidFn();
}

export function withPhraseIds(items) {
  return items.map((item) => ({
    id: uid(),
    createdAt: item.createdAt || new Date().toISOString(),
    pinned: typeof item.pinned === 'boolean' ? item.pinned : false,
    pinnedAt: item.pinnedAt || '',
    ...item
  }));
}

export function loadPhrases() {
  const raw = localStorage.getItem(PHRASE_LIBRARY_STORAGE);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      return data.map((item) => ({
        ...item,
        id: item.id || uid(),
        pinned: typeof item.pinned === 'boolean' ? item.pinned : false,
        pinnedAt: item.pinnedAt || ''
      }));
    } catch {
      return withPhraseIds(PHRASE_LIBRARY_SEED);
    }
  }
  return withPhraseIds(PHRASE_LIBRARY_SEED);
}

export function persistPhrases(next) {
  localStorage.setItem(PHRASE_LIBRARY_STORAGE, JSON.stringify(next));
}

export function filterPhrases(phrases, filters) {
  return phrases
    .filter((item) => {
      if (filters.sampleType !== '全部' && item.sampleType !== filters.sampleType) {
        return false;
      }
      if (filters.query) {
        const q = filters.query.toLowerCase();
        return item.phrase.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.pinned && b.pinned) {
        const pinA = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
        const pinB = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
        return pinB - pinA;
      }
      if (a.lastUsedAt && b.lastUsedAt) {
        return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
      }
      if (a.lastUsedAt) return -1;
      if (b.lastUsedAt) return 1;
      return (b.useCount || 0) - (a.useCount || 0);
    });
}

export function calcPhraseStats(phrases) {
  let total = phrases.length;
  let totalUsed = phrases.filter((p) => (p.useCount || 0) > 0).length;
  let totalUseCount = phrases.reduce((sum, p) => sum + (p.useCount || 0), 0);
  return { total, totalUsed, totalUseCount };
}

export function submitPhrase(form, phrases, editingPhrase) {
  if (!form.phrase.trim()) return null;

  if (editingPhrase) {
    return phrases.map((item) =>
      item.id === editingPhrase.id
        ? {
            ...item,
            phrase: form.phrase.trim(),
            sampleType: form.sampleType,
            updatedAt: new Date().toISOString()
          }
        : item
    );
  } else {
    const newPhrase = {
      id: uid(),
      phrase: form.phrase.trim(),
      sampleType: form.sampleType,
      useCount: 0,
      lastUsedAt: '',
      pinned: false,
      pinnedAt: '',
      createdAt: new Date().toISOString()
    };
    return [newPhrase, ...phrases];
  }
}

export function recordPhraseUsage(id, phrases) {
  const now = new Date().toISOString();
  return phrases.map((item) =>
    item.id === id
      ? { ...item, useCount: (item.useCount || 0) + 1, lastUsedAt: now }
      : item
  );
}

export function togglePhrasePin(id, phrases) {
  const now = new Date().toISOString();
  return phrases.map((item) =>
    item.id === id
      ? { ...item, pinned: !item.pinned, pinnedAt: !item.pinned ? now : '' }
      : item
  );
}

export function removePhrase(id, phrases) {
  return phrases.filter((item) => item.id !== id);
}
