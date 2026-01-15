(() => {
  const API_BASE = 'https://edu.std-900.ist.mospolytech.ru/exam-2024-1/api';
  const API_KEY_STORAGE = 'api_key';
  const CART_STORAGE = 'cart_goods';
  const NO_API_KEY = 'NO_API_KEY';

  const alerts = document.querySelector('.alerts');

  const showAlert = (type, text) => {
    if (!alerts) return;
    const el = document.createElement('div');
    el.className = 'alert';
    if (type === 'error') el.classList.add('alert--error');
    if (type === 'info') el.classList.add('alert--info');

    const msg = document.createElement('div');
    msg.textContent = String(text);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'alert__close';
    close.textContent = '×';
    close.addEventListener('click', () => el.remove());

    el.appendChild(msg);
    el.appendChild(close);
    alerts.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, 5000);
  };

  const getApiKey = () => {
    const key = localStorage.getItem(API_KEY_STORAGE);
    return key && String(key).trim().length > 0 ? String(key).trim() : null;
  };

  let apiKeyRequested = false;
  const ensureApiKey = () => {
    const existing = getApiKey();
    if (existing) return existing;

    if (!apiKeyRequested) {
      apiKeyRequested = true;
      showAlert('info', 'Введите API Key: кликните по странице, чтобы продолжить');
      document.addEventListener(
        'click',
        () => {
          const key = prompt('Введите API Key');
          if (!key || String(key).trim().length === 0) return;
          localStorage.setItem(API_KEY_STORAGE, String(key).trim());
          location.reload();
        },
        { once: true }
      );
    }

    return null;
  };

  const apiFetch = async (path, options = {}) => {
    const apiKey = ensureApiKey();
    if (!apiKey) throw new Error(NO_API_KEY);

    const params = new URLSearchParams();
    const rawParams = options.params || {};
    for (const k of Object.keys(rawParams)) {
      const v = rawParams[k];
      if (v === undefined || v === null) continue;
      const s = String(v);
      if (s.length === 0) continue;
      params.set(k, s);
    }
    params.set('api_key', apiKey);
    const url = `${API_BASE}${path}?${params.toString()}`;

    const init = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    if (options.json !== undefined) {
      init.headers = { ...init.headers, 'Content-Type': 'application/json' };
      init.body = JSON.stringify(options.json);
    }

    const res = await fetch(url, init);
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (!res.ok) {
      const msg = data && data.error ? data.error : `HTTP ${res.status}`;
      throw new Error(msg);
    }

    if (data && data.error) throw new Error(data.error);
    return data;
  };

  const normalizeGoodPayload = (data) => {
    if (!data) return null;
    if (data.good && typeof data.good === 'object') return data.good;
    return data;
  };

  const parseNumber = (value) => {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (s.length === 0) return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const formatMoney = (n) => `${Math.round(n)} ₽`;

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
  };

  const dateInputToDdMmYyyy = (value) => {
    const s = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  };

  const orderDateToInput = (value) => {
    const s = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2]}-${m[1]}`;
  };

  const calcDeliveryCost = (dateValue, intervalValue) => {
    let cost = 200;
    const d = new Date(String(dateValue || ''));
    const day = Number.isFinite(d.getTime()) ? d.getDay() : null;
    const interval = String(intervalValue || '');

    if (day === 0 || day === 6) cost += 300;
    else if (interval.startsWith('18:00')) cost += 200;

    return cost;
  };

  const getCartIds = () => {
    try {
      const raw = localStorage.getItem(CART_STORAGE);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : [];
    } catch (_) {
      showAlert('error', 'Не удалось прочитать корзину (localStorage недоступен)');
      return [];
    }
  };

  const setCartIds = (ids) => {
    try {
      localStorage.setItem(CART_STORAGE, JSON.stringify(ids));
      return true;
    } catch (_) {
      showAlert('error', 'Не удалось сохранить корзину (localStorage недоступен)');
      return false;
    }
  };

  const addToCart = (id) => {
    const ids = getCartIds();
    if (!ids.includes(id)) ids.push(id);
    return setCartIds(ids);
  };

  const removeFromCart = (id) => {
    const ids = getCartIds().filter((x) => x !== id);
    return setCartIds(ids);
  };

  const goodsPrice = (g) => {
    const a = Number(g.actual_price);
    const d = Number(g.discount_price);
    if (Number.isFinite(d) && Number.isFinite(a) && d > 0 && d < a) return d;
    if (Number.isFinite(a)) return a;
    return 0;
  };

  const hasDiscount = (g) => {
    const a = Number(g.actual_price);
    const d = Number(g.discount_price);
    return Number.isFinite(d) && Number.isFinite(a) && d > 0 && d < a;
  };

  const renderStars = (rating) => {
    const r = Number(rating);
    const on = Number.isFinite(r) ? Math.round(r) : 0;
    const wrap = document.createElement('span');
    wrap.className = 'stars';
    wrap.setAttribute('aria-hidden', 'true');
    for (let i = 1; i <= 5; i += 1) {
      const star = document.createElement('span');
      star.className = i <= on ? 'star star--on' : 'star';
      wrap.appendChild(star);
    }
    return wrap;
  };

  const createGoodsCard = (g, mode) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = String(g.id);
    card.dataset.price = String(goodsPrice(g));
    card.dataset.rating = String(g.rating);
    card.dataset.discount = hasDiscount(g) ? '1' : '0';

    const img = document.createElement('div');
    img.className = 'card__img';
    img.setAttribute('role', 'img');
    img.setAttribute('aria-label', 'Изображение товара');
    if (g.image_url) img.style.backgroundImage = `url(${g.image_url})`;
    img.style.backgroundSize = 'cover';
    img.style.backgroundPosition = 'center';

    const name = document.createElement('h3');
    name.className = 'card__name';
    name.textContent = String(g.name || '');
    if (String(g.name || '').length > 80) name.title = String(g.name);

    const meta = document.createElement('div');
    meta.className = 'card__meta';
    const rating = document.createElement('span');
    rating.className = 'rating';
    const rv = document.createElement('span');
    rv.className = 'rating__value';
    rv.textContent = Number(g.rating).toFixed(1).replace('.', ',');
    rating.appendChild(rv);
    rating.appendChild(renderStars(g.rating));
    meta.appendChild(rating);

    const priceLine = document.createElement('div');
    priceLine.className = 'price-line';

    const now = document.createElement('span');
    now.className = 'price-line__now';
    now.textContent = formatMoney(goodsPrice(g));
    priceLine.appendChild(now);

    if (hasDiscount(g)) {
      const old = document.createElement('span');
      old.className = 'price-line__old';
      old.textContent = formatMoney(g.actual_price);
      priceLine.appendChild(old);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = mode === 'cart' ? 'btn btn--block btn--secondary' : 'btn btn--block';
    btn.textContent = mode === 'cart' ? 'Удалить' : 'Добавить';

    card.appendChild(img);
    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(priceLine);
    card.appendChild(btn);

    return { card, btn };
  };

  const initCatalog = () => {
    const grid = document.querySelector('.content .grid');
    const loadMoreBtn = document.querySelector('.btn--load');
    const sortSelect = document.querySelector('.select__control');
    const searchForm = document.querySelector('.search');
    const filtersForm = document.querySelector('.filters');

    if (!grid || !loadMoreBtn || !sortSelect) return;

    grid.addEventListener('click', (e) => {
      const target = e.target;
      const btn = target && target.closest ? target.closest('button') : null;
      if (!btn) return;
      if (!btn.classList.contains('btn')) return;
      if (String(btn.textContent || '').trim() !== 'Добавить') return;

      const card = btn.closest ? btn.closest('.card') : null;
      const rawId = card && card.dataset ? card.dataset.id : null;
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) {
        showAlert('error', 'Не удалось определить товар для добавления в корзину');
        return;
      }

      addToCart(id);
      showAlert('info', 'Товар добавлен в корзину');
    });

    let page = 1;
    const perPage = 10;
    let totalCount = null;
    let query = '';
    let sortOrder = 'rating_desc';

    const readSortOrder = () => {
      const v = String(sortSelect.value || 'rating-desc');
      if (v === 'rating-asc') return 'rating_asc';
      if (v === 'price-desc') return 'price_desc';
      if (v === 'price-asc') return 'price_asc';
      return 'rating_desc';
    };

    const readFilters = () => {
      if (!filtersForm) return { min: null, max: null, onlyDiscount: false };
      const minEl = filtersForm.querySelector('input[name="min"]');
      const maxEl = filtersForm.querySelector('input[name="max"]');
      const discountEl = filtersForm.querySelector('input[name="discount"]');
      return {
        min: parseNumber(minEl ? minEl.value : null),
        max: parseNumber(maxEl ? maxEl.value : null),
        onlyDiscount: Boolean(discountEl && discountEl.checked),
      };
    };

    const applyClientFilters = () => {
      const f = readFilters();
      const cards = Array.from(grid.querySelectorAll('.card'));
      for (const c of cards) {
        const price = parseNumber(c.dataset.price);
        const disc = c.dataset.discount === '1';
        if (f.min !== null && price !== null && price < f.min) c.style.display = 'none';
        else if (f.max !== null && price !== null && price > f.max) c.style.display = 'none';
        else if (f.onlyDiscount && !disc) c.style.display = 'none';
        else c.style.display = '';
      }
    };

    const updateLoadMoreVisibility = () => {
      if (totalCount === null) {
        loadMoreBtn.style.display = '';
        return;
      }
      const loaded = grid.querySelectorAll('.card').length;
      loadMoreBtn.style.display = loaded >= totalCount ? 'none' : '';
    };

    const loadPage = async (targetPage, append) => {
      sortOrder = readSortOrder();
      loadMoreBtn.disabled = true;
      try {
        const data = await apiFetch('/goods', {
          params: {
            page: String(targetPage),
            per_page: String(perPage),
            sort_order: sortOrder,
            query: query || undefined,
          },
        });

        const goods = Array.isArray(data.goods) ? data.goods : Array.isArray(data) ? data : [];
        if (data._pagination && Number.isFinite(Number(data._pagination.total_count))) {
          totalCount = Number(data._pagination.total_count);
        }

        if (!append) grid.innerHTML = '';

        for (const g of goods) {
          const { card } = createGoodsCard(g, 'catalog');
          grid.appendChild(card);
        }

        applyClientFilters();
        updateLoadMoreVisibility();
      } catch (e) {
        if (e && e.message === NO_API_KEY) return;
        showAlert('error', e.message);
      } finally {
        loadMoreBtn.disabled = false;
      }
    };

    loadMoreBtn.addEventListener('click', () => {
      page += 1;
      loadPage(page, true);
    });

    sortSelect.addEventListener('change', () => {
      page = 1;
      totalCount = null;
      loadPage(page, false);
    });

    if (filtersForm) {
      filtersForm.addEventListener('submit', (e) => {
        e.preventDefault();
        applyClientFilters();
      });
    }

    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = searchForm.querySelector('input[name="q"]');
        query = input ? String(input.value || '').trim() : '';
        page = 1;
        totalCount = null;
        loadPage(page, false);
      });
    }

    page = 1;
    totalCount = null;
    loadPage(page, false);
  };

  const initCart = () => {
    const grid = document.querySelector('.cart .grid');
    const empty = document.querySelector('.cart-empty');
    const form = document.querySelector('.checkout__form');
    const totalEl = document.querySelector('[data-total]');
    const deliveryEl = document.querySelector('[data-delivery]');

    if (!grid || !empty || !form) return;

    const dateEl = form.querySelector('input[name="date"]');
    const intervalEl = form.querySelector('select[name="time"]');
    const subscribeEl = form.querySelector('input[name="newsletter"]');

    let goods = [];

    const goodsSum = () => goods.reduce((acc, g) => acc + goodsPrice(g), 0);

    const updateTotals = () => {
      const delivery = calcDeliveryCost(dateEl ? dateEl.value : '', intervalEl ? intervalEl.value : '');
      const sum = goodsSum();
      const total = sum + delivery;
      if (deliveryEl) deliveryEl.textContent = `стоимость доставки ${formatMoney(delivery)}`;
      if (totalEl) totalEl.textContent = formatMoney(total);
    };

    const render = () => {
      grid.innerHTML = '';
      const ids = getCartIds();
      if (ids.length === 0) {
        grid.style.display = 'none';
        empty.style.display = '';
      } else {
        grid.style.display = '';
        empty.style.display = 'none';
      }

      for (const g of goods) {
        const { card, btn } = createGoodsCard(g, 'cart');
        btn.addEventListener('click', () => {
          removeFromCart(Number(g.id));
          goods = goods.filter((x) => Number(x.id) !== Number(g.id));
          render();
          updateTotals();
          showAlert('info', 'Товар удалён из корзины');
        });
        grid.appendChild(card);
      }
    };

    const load = async () => {
      const ids = getCartIds();
      if (ids.length === 0) {
        goods = [];
        render();
        updateTotals();
        return;
      }

      try {
        const list = await Promise.all(ids.map((id) => apiFetch(`/goods/${id}`)));
        goods = list.map(normalizeGoodPayload).filter(Boolean);
        render();
        updateTotals();
      } catch (e) {
        if (e && e.message === NO_API_KEY) return;
        showAlert('error', e.message);
      }
    };

    const submitOrder = async () => {
      const ids = getCartIds();
      if (ids.length === 0) {
        showAlert('error', 'Корзина пуста');
        return;
      }

      const name = form.querySelector('input[name="name"]');
      const email = form.querySelector('input[name="email"]');
      const phone = form.querySelector('input[name="phone"]');
      const address = form.querySelector('input[name="address"]');

      const payload = {
        full_name: name ? String(name.value || '').trim() : '',
        email: email ? String(email.value || '').trim() : '',
        phone: phone ? String(phone.value || '').trim() : '',
        delivery_address: address ? String(address.value || '').trim() : '',
        delivery_date: dateInputToDdMmYyyy(dateEl ? dateEl.value : ''),
        delivery_interval: intervalEl ? String(intervalEl.value || '') : '',
        comment: (() => {
          const c = form.querySelector('textarea[name="comment"]');
          const v = c ? String(c.value || '').trim() : '';
          return v.length > 0 ? v : undefined;
        })(),
        subscribe: Boolean(subscribeEl && subscribeEl.checked),
        good_ids: ids,
      };

      if (!payload.full_name || !payload.email || !payload.phone || !payload.delivery_address || !payload.delivery_date || !payload.delivery_interval) {
        showAlert('error', 'Заполните обязательные поля');
        return;
      }

      try {
        await apiFetch('/orders', { method: 'POST', json: payload });
        showAlert('success', 'Заказ оформлен');
        setCartIds([]);
        setTimeout(() => {
          location.href = 'index.html';
        }, 600);
      } catch (e) {
        if (e && e.message === NO_API_KEY) return;
        showAlert('error', e.message);
      }
    };

    if (dateEl) dateEl.addEventListener('change', updateTotals);
    if (intervalEl) intervalEl.addEventListener('change', updateTotals);
    form.addEventListener('reset', () => setTimeout(updateTotals, 0));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitOrder();
    });

    load();
  };

  const initOrders = () => {
    const table = document.querySelector('.orders .table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const modals = Array.from(document.querySelectorAll('.modal'));
    const modalView = modals.find((m) => String(m.getAttribute('aria-label')) === 'Просмотр заказа');
    const modalEdit = modals.find((m) => String(m.getAttribute('aria-label')) === 'Редактирование заказа');
    const modalDelete = modals.find((m) => String(m.getAttribute('aria-label')) === 'Удаление заказа');

    const openModal = (m) => {
      if (!m) return;
      m.style.display = 'grid';
    };

    const closeModal = (m) => {
      if (!m) return;
      m.style.display = 'none';
    };

    for (const m of modals) {
      const closeBtn = m.querySelector('.modal__close');
      if (closeBtn) closeBtn.addEventListener('click', () => closeModal(m));
      m.addEventListener('click', (e) => {
        if (e.target === m) closeModal(m);
      });
    }

    let orders = [];
    let goodsById = new Map();
    let currentId = null;

    const getGoodsName = (id) => {
      const g = goodsById.get(Number(id));
      return g ? String(g.name || '') : `#${id}`;
    };

    const ensureGoodsLoaded = async (ids) => {
      const need = Array.from(new Set(ids.map((x) => Number(x)).filter((x) => Number.isFinite(x))))
        .filter((id) => !goodsById.has(id));
      if (need.length === 0) return;
      const list = await Promise.all(need.map((id) => apiFetch(`/goods/${id}`)));
      for (const raw of list) {
        const g = normalizeGoodPayload(raw);
        if (g && Number.isFinite(Number(g.id))) goodsById.set(Number(g.id), g);
      }
    };

    const orderTotal = (o) => {
      const ids = Array.isArray(o.good_ids) ? o.good_ids : [];
      const sum = ids.reduce((acc, id) => {
        const g = goodsById.get(Number(id));
        return acc + (g ? goodsPrice(g) : 0);
      }, 0);
      const delivery = calcDeliveryCost(orderDateToInput(o.delivery_date), o.delivery_interval);
      return sum + delivery;
    };

    const renderTable = () => {
      tbody.innerHTML = '';
      orders.forEach((o, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.id = String(o.id);

        const tdN = document.createElement('td');
        tdN.textContent = `${idx + 1}.`;

        const tdCreated = document.createElement('td');
        tdCreated.textContent = formatDateTime(o.created_at);

        const tdGoods = document.createElement('td');
        const names = (Array.isArray(o.good_ids) ? o.good_ids : []).map(getGoodsName);
        const joined = names.join(', ');
        tdGoods.textContent = joined.length > 80 ? `${joined.slice(0, 77)}...` : joined;
        if (joined.length > 80) tdGoods.title = joined;

        const tdCost = document.createElement('td');
        tdCost.textContent = formatMoney(orderTotal(o));

        const tdDel = document.createElement('td');
        tdDel.textContent = `${o.delivery_date} ${o.delivery_interval}`;

        const tdAct = document.createElement('td');
        const actions = document.createElement('div');
        actions.className = 'table-actions';
        actions.setAttribute('role', 'group');
        actions.setAttribute('aria-label', 'Действия');

        const mkBtn = (label) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'icon-action';
          b.setAttribute('aria-label', label);
          b.dataset.action = label;
          b.dataset.id = String(o.id);
          return b;
        };

        const bView = mkBtn('Просмотр');
        bView.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5.5Z" /></svg>';

        const bEdit = mkBtn('Редактирование');
        bEdit.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25Zm18-11.5a1 1 0 0 0 0-1.41l-1.34-1.34a1 1 0 0 0-1.41 0l-1.13 1.13 3.75 3.75L21 5.75Z" /></svg>';

        const bDel = mkBtn('Удаление');
        bDel.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l-1 14H7L6 7Zm3-3h6l1 2H8l1-2Z" /></svg>';

        actions.appendChild(bView);
        actions.appendChild(bEdit);
        actions.appendChild(bDel);
        tdAct.appendChild(actions);

        tr.appendChild(tdN);
        tr.appendChild(tdCreated);
        tr.appendChild(tdGoods);
        tr.appendChild(tdCost);
        tr.appendChild(tdDel);
        tr.appendChild(tdAct);
        tbody.appendChild(tr);
      });
    };

    const fillViewModal = (o) => {
      if (!modalView) return;
      const dl = modalView.querySelector('.details');
      if (!dl) return;
      const goodsText = (Array.isArray(o.good_ids) ? o.good_ids : []).map(getGoodsName).join(', ');
      const total = orderTotal(o);

      const setRow = (i, v) => {
        const row = dl.querySelectorAll('.details__row')[i];
        if (!row) return;
        const dd = row.querySelector('dd');
        if (dd) dd.textContent = String(v);
      };

      setRow(0, formatDateTime(o.created_at));
      setRow(1, o.full_name);
      setRow(2, o.phone);
      setRow(3, o.email);
      setRow(4, o.delivery_address);
      setRow(5, o.delivery_date);
      setRow(6, o.delivery_interval);
      setRow(7, goodsText);
      setRow(8, formatMoney(total));
      setRow(9, o.comment || '');
    };

    const fillEditModal = (o) => {
      if (!modalEdit) return;
      const form = modalEdit.querySelector('form');
      if (!form) return;
      const setVal = (name, val) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (!el) return;
        el.value = val;
      };
      setVal('created_at', formatDateTime(o.created_at));
      setVal('full_name', o.full_name || '');
      setVal('phone', o.phone || '');
      setVal('email', o.email || '');
      setVal('delivery_address', o.delivery_address || '');
      setVal('delivery_date', orderDateToInput(o.delivery_date));
      setVal('delivery_interval', o.delivery_interval || '');
      setVal('goods', (Array.isArray(o.good_ids) ? o.good_ids : []).map(getGoodsName).join(', '));
      setVal('total', formatMoney(orderTotal(o)));
      setVal('comment', o.comment || '');
    };

    const doUpdateOrder = async () => {
      if (!modalEdit || currentId === null) return;
      const form = modalEdit.querySelector('form');
      if (!form) return;

      const getVal = (selector) => {
        const el = form.querySelector(selector);
        return el ? el.value : '';
      };

      const payload = {
        full_name: String(getVal('[name="full_name"]') || '').trim(),
        email: String(getVal('[name="email"]') || '').trim(),
        phone: String(getVal('[name="phone"]') || '').trim(),
        delivery_address: String(getVal('[name="delivery_address"]') || '').trim(),
        delivery_date: dateInputToDdMmYyyy(String(getVal('[name="delivery_date"]') || '')),
        delivery_interval: String(getVal('[name="delivery_interval"]') || '').trim(),
        comment: String(getVal('[name="comment"]') || '').trim(),
      };

      if (!payload.full_name || !payload.email || !payload.phone || !payload.delivery_address || !payload.delivery_date || !payload.delivery_interval) {
        showAlert('error', 'Заполните обязательные поля');
        return;
      }

      if (payload.comment.length === 0) delete payload.comment;

      try {
        const updated = await apiFetch(`/orders/${currentId}`, { method: 'PUT', json: payload });
        const idx = orders.findIndex((x) => Number(x.id) === Number(currentId));
        if (idx !== -1) orders[idx] = { ...orders[idx], ...updated };
        renderTable();
        closeModal(modalEdit);
        showAlert('success', 'Заказ обновлён');
      } catch (e) {
        if (e && e.message === NO_API_KEY) return;
        showAlert('error', e.message);
      }
    };

    const doDeleteOrder = async () => {
      if (currentId === null) return;
      try {
        await apiFetch(`/orders/${currentId}`, { method: 'DELETE' });
        orders = orders.filter((x) => Number(x.id) !== Number(currentId));
        renderTable();
        closeModal(modalDelete);
        showAlert('success', 'Заказ удалён');
      } catch (e) {
        if (e && e.message === NO_API_KEY) return;
        showAlert('error', e.message);
      }
    };

    tbody.addEventListener('click', async (e) => {
      const btn = e.target.closest('.icon-action');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (!Number.isFinite(id)) return;
      const action = String(btn.dataset.action || '');
      currentId = id;
      const o = orders.find((x) => Number(x.id) === id);
      if (!o) return;
      await ensureGoodsLoaded(Array.isArray(o.good_ids) ? o.good_ids : []);

      if (action === 'Просмотр') {
        fillViewModal(o);
        openModal(modalView);
      }
      if (action === 'Редактирование') {
        fillEditModal(o);
        openModal(modalEdit);
      }
      if (action === 'Удаление') {
        openModal(modalDelete);
      }
    });

    if (modalView) {
      const ok = modalView.querySelector('.btn');
      if (ok) ok.addEventListener('click', () => closeModal(modalView));
    }

    if (modalEdit) {
      const form = modalEdit.querySelector('form');
      const cancel = modalEdit.querySelector('.btn--secondary[type="button"]');
      if (cancel) cancel.addEventListener('click', () => closeModal(modalEdit));
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          doUpdateOrder();
        });
      }
    }

    if (modalDelete) {
      const btns = modalDelete.querySelectorAll('.modal__actions .btn');
      const no = btns[0];
      const yes = btns[1];
      if (no) no.addEventListener('click', () => closeModal(modalDelete));
      if (yes) yes.addEventListener('click', () => doDeleteOrder());
    }

    const loadOrders = async () => {
      try {
        const data = await apiFetch('/orders');
        orders = Array.isArray(data) ? data : [];
        const allIds = orders.flatMap((o) => (Array.isArray(o.good_ids) ? o.good_ids : []));
        await ensureGoodsLoaded(allIds);
        renderTable();
      } catch (e) {
        if (e && e.message === NO_API_KEY) return;
        showAlert('error', e.message);
      }
    };

    loadOrders();
  };

  initCatalog();
  initCart();
  initOrders();
})();
