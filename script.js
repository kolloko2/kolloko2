(() => {
  const filtersForm = document.querySelector('.filters');
  const sortSelect = document.querySelector('.select__control');
  const grid = document.querySelector('.grid');

  if (!filtersForm || !sortSelect || !grid) return;

  const getCards = () => Array.from(grid.querySelectorAll('.card'));

  const parseNumber = (value) => {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (s.length === 0) return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const readFilters = () => {
    const categories = new Set(
      Array.from(filtersForm.querySelectorAll('input[name="cat"]:checked'))
        .map((el) => String(el.value))
        .filter((v) => v.length > 0)
    );

    const minEl = filtersForm.querySelector('input[name="min"]');
    const maxEl = filtersForm.querySelector('input[name="max"]');
    const discountEl = filtersForm.querySelector('input[name="discount"]');

    const min = parseNumber(minEl ? minEl.value : null);
    const max = parseNumber(maxEl ? maxEl.value : null);
    const onlyDiscount = Boolean(discountEl && discountEl.checked);

    return { categories, min, max, onlyDiscount };
  };

  const cardValue = (card, key) => {
    const raw = card.dataset[key];
    const n = parseNumber(raw);
    return n === null ? 0 : n;
  };

  const isDiscounted = (card) => card.dataset.discount === '1';

  const matchesFilters = (card, filters) => {
    const category = String(card.dataset.category || '');
    if (filters.categories.size > 0 && !filters.categories.has(category)) return false;

    const price = cardValue(card, 'price');
    if (filters.min !== null && price < filters.min) return false;
    if (filters.max !== null && price > filters.max) return false;

    if (filters.onlyDiscount && !isDiscounted(card)) return false;

    return true;
  };

  const applyFilterVisibility = () => {
    const filters = readFilters();
    const cards = getCards();

    for (const card of cards) {
      const show = matchesFilters(card, filters);
      card.style.display = show ? '' : 'none';
    }
  };

  const sortCards = () => {
    const mode = String(sortSelect.value || 'rating-desc');
    const cards = getCards();

    const factor = mode.endsWith('-asc') ? 1 : -1;
    const key = mode.startsWith('price') ? 'price' : 'rating';

    cards.sort((a, b) => {
      const av = cardValue(a, key);
      const bv = cardValue(b, key);
      if (av === bv) return 0;
      return av > bv ? factor : -factor;
    });

    for (const card of cards) grid.appendChild(card);
  };

  const applyAll = () => {
    applyFilterVisibility();
    sortCards();
  };

  filtersForm.addEventListener('submit', (e) => {
    e.preventDefault();
    applyAll();
  });

  sortSelect.addEventListener('change', () => {
    sortCards();
  });

  sortCards();
})();
