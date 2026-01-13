(() => {
  const filtersForm = document.querySelector('.filters');
  const sortSelect = document.querySelector('.select__control');
  const grid = document.querySelector('.grid');

  if (!filtersForm || !sortSelect || !grid) return;

  const getCards = () => Array.from(grid.querySelectorAll('.card'));

  const parseNumber = (value) => {
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const readFilters = () => {
    const fd = new FormData(filtersForm);

    const categories = new Set(
      fd.getAll('cat')
        .map((v) => String(v))
        .filter((v) => v.length > 0)
    );

    const min = parseNumber(fd.get('min'));
    const max = parseNumber(fd.get('max'));
    const onlyDiscount = fd.get('discount') === '1';

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
      card.hidden = !matchesFilters(card, filters);
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

  applyAll();
})();
