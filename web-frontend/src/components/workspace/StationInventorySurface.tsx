import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, LoaderCircle, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Lang } from '../../lib/i18n';

export interface InventoryColumn<Row> {
  key: string;
  label: { en: string; ar: string };
  width?: string;
  align?: 'start' | 'end';
  /** Omit to make the column unsortable. Return null for an unmeasured value. */
  sortValue?: (row: Row) => string | number | null;
  render: (row: Row, lang: Lang) => ReactNode;
}

export interface InventoryFilter<Row> {
  key: string;
  label: { en: string; ar: string };
  test: (row: Row) => boolean;
}

export interface InventoryEmptyLabels {
  notChecked: { en: string; ar: string };
  checking: { en: string; ar: string };
  noneFound: { en: string; ar: string };
  noMatch: { en: string; ar: string };
  noMatchHint: { en: string; ar: string };
}

interface StationInventorySurfaceProps<Row> {
  lang: Lang;
  /** null means nothing has been measured yet; [] means measured and genuinely empty. */
  rows: Row[] | null;
  loading?: boolean;
  rowKey: (row: Row) => string;
  columns: InventoryColumn<Row>[];
  filters?: InventoryFilter<Row>[];
  searchFields: (row: Row) => string[];
  searchPlaceholder: { en: string; ar: string };
  /**
   * Seeds the search box on mount. Because the surface unmounts when its tab
   * changes, re-entering the tab re-applies it — that is how another tab hands
   * a real term (a device class, a publisher) over to this inventory.
   */
  initialQuery?: string;
  empty: InventoryEmptyLabels;
  /** Contextual inspector rendered beside the list, never instead of it. */
  inspector?: (row: Row, close: () => void, lang: Lang) => ReactNode;
  sortInitial?: { key: string; direction: 'asc' | 'desc' };
  pageSize?: number;
  stickyHeader?: boolean;
}

const T = (copy: { en: string; ar: string }, lang: Lang) => (lang === 'ar' ? copy.ar : copy.en);

/**
 * One searchable, filterable, sortable inventory with a contextual inspector.
 *
 * Truthfulness contract:
 *   rows === null  -> "Not checked yet"      (never a fabricated empty list)
 *   loading        -> "Checking"             (never a fake zero)
 *   rows.length===0-> "No results"           (measured and genuinely empty)
 *   filtered === 0 -> "No results match"     (distinct from an empty source)
 */
export function StationInventorySurface<Row>({
  lang,
  rows,
  loading = false,
  rowKey,
  columns,
  filters = [],
  searchFields,
  searchPlaceholder,
  initialQuery = '',
  empty,
  inspector,
  sortInitial,
  pageSize = 200,
  stickyHeader = true,
}: StationInventorySurfaceProps<Row>) {
  const [query, setQuery] = useState(initialQuery);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    sortInitial ?? null,
  );
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const measured = rows !== null;
  const needle = query.trim().toLocaleLowerCase(lang === 'ar' ? 'ar' : 'en');

  const matched = useMemo(() => {
    if (!rows) return [];
    const locale = lang === 'ar' ? 'ar' : 'en';
    const active = activeFilters
      .map(key => filters.find(filter => filter.key === key))
      .filter((filter): filter is InventoryFilter<Row> => Boolean(filter));
    return rows.filter(row => {
      if (!active.every(filter => filter.test(row))) return false;
      if (needle === '') return true;
      return searchFields(row)
        .some(value => value.toLocaleLowerCase(locale).includes(needle));
    });
  }, [rows, activeFilters, filters, needle, searchFields, lang]);

  const sorted = useMemo(() => {
    if (!sort) return matched;
    const column = columns.find(c => c.key === sort.key);
    if (!column?.sortValue) return matched;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...matched].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [matched, sort, columns]);

  const selected = selectedKey && rows
    ? rows.find(row => rowKey(row) === selectedKey) ?? null
    : null;

  const toggleSort = (key: string) => {
    setVisibleCount(pageSize);
    setSort(current => {
      if (current?.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  const toggleFilter = (key: string) => {
    setVisibleCount(pageSize);
    setActiveFilters(current => (current.includes(key) ? current.filter(k => k !== key) : [...current, key]));
  };

  const clearAll = () => {
    setQuery('');
    setActiveFilters([]);
    setVisibleCount(pageSize);
  };

  const filtering = needle !== '' || activeFilters.length > 0;
  const shown = sorted.slice(0, visibleCount);
  const hasRows = (rows?.length ?? 0) > 0;

  let state: 'checking' | 'not-checked' | 'empty' | 'no-match' | 'ready' = 'ready';
  if (loading) state = 'checking';
  else if (!measured) state = 'not-checked';
  else if (!hasRows) state = 'empty';
  else if (sorted.length === 0) state = 'no-match';

  const templateColumns = columns
    .map(column => column.width ?? 'minmax(0, 1fr)')
    .join(' ');

  return (
    <div className="knoux-inventory" data-state={state} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="knoux-inventory__bar">
        <label className="knoux-inventory__search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={query}
            disabled={!measured}
            onChange={event => { setQuery(event.target.value); setVisibleCount(pageSize); }}
            placeholder={T(searchPlaceholder, lang)}
            aria-label={T(searchPlaceholder, lang)}
          />
          {query !== '' && (
            <button type="button" onClick={() => setQuery('')} aria-label={T({ en: 'Clear search', ar: 'مسح البحث' }, lang)}>
              <X size={13} />
            </button>
          )}
        </label>

        {filters.length > 0 && (
          <div className="knoux-inventory__filters" role="group" aria-label={T({ en: 'Filters', ar: 'المرشّحات' }, lang)}>
            <SlidersHorizontal size={13} aria-hidden="true" />
            {filters.map(filter => {
              const on = activeFilters.includes(filter.key);
              const count = (rows ?? []).filter(filter.test).length;
              return (
                <button
                  key={filter.key}
                  type="button"
                  data-on={on}
                  disabled={!measured}
                  aria-pressed={on}
                  onClick={() => toggleFilter(filter.key)}
                >
                  {T(filter.label, lang)}
                  <b>{measured ? count : '—'}</b>
                </button>
              );
            })}
          </div>
        )}

        <div className="knoux-inventory__readout" aria-live="polite">
          {measured ? T({ en: 'Showing', ar: 'المعروض' }, lang) : T(empty.notChecked, lang)}
          {measured && <b> {sorted.length}{hasRows ? ` / ${rows!.length}` : ''}</b>}
          {filtering && measured && (
            <button type="button" onClick={clearAll}>
              {T({ en: 'Clear', ar: 'مسح' }, lang)}
            </button>
          )}
        </div>
      </div>

      {state === 'checking' && (
        <p className="knoux-inventory__state" data-state="checking">
          <LoaderCircle size={15} className="animate-spin" />
          {T(empty.checking, lang)}
        </p>
      )}
      {state === 'not-checked' && (
        <p className="knoux-inventory__state" data-state="not-checked">
          {T(empty.notChecked, lang)}
        </p>
      )}
      {state === 'empty' && (
        <p className="knoux-inventory__state" data-state="empty">
          {T(empty.noneFound, lang)}
        </p>
      )}
      {state === 'no-match' && (
        <p className="knoux-inventory__state" data-state="no-match">
          <strong>{T(empty.noMatch, lang)}</strong>
          <span>{T(empty.noMatchHint, lang)}</span>
        </p>
      )}

      {state === 'ready' && (
        <div className="knoux-inventory__body" data-inspector={inspector ? 'open' : 'closed'}>
          <div className="knoux-inventory__list">
            <div
              className="knoux-inventory__head"
              data-sticky={stickyHeader}
              style={{ gridTemplateColumns: templateColumns }}
            >
              {columns.map(column => {
                const sortable = Boolean(column.sortValue);
                const active = sort?.key === column.key;
                return (
                  <button
                    key={column.key}
                    type="button"
                    data-align={column.align ?? 'start'}
                    disabled={!sortable}
                    onClick={() => sortable && toggleSort(column.key)}
                    aria-sort={active ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    {T(column.label, lang)}
                    {sortable && (active
                      ? (sort!.direction === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
                      : <span className="knoux-inventory__sorthint" aria-hidden="true" />)}
                  </button>
                );
              })}
            </div>

            <ul>
              {shown.map(row => {
                const key = rowKey(row);
                return (
                  <li key={key} data-selected={selectedKey === key}>
                    <button
                      type="button"
                      className="knoux-inventory__row"
                      style={{ gridTemplateColumns: templateColumns }}
                      onClick={() => setSelectedKey(selectedKey === key ? null : key)}
                      aria-pressed={selectedKey === key}
                    >
                      {columns.map(column => (
                        <span key={column.key} data-align={column.align ?? 'start'}>
                          {column.render(row, lang)}
                        </span>
                      ))}
                    </button>
                  </li>
                );
              })}
            </ul>

            {sorted.length > shown.length && (
              <button
                type="button"
                className="knoux-inventory__more"
                onClick={() => setVisibleCount(count => count + pageSize)}
              >
                {T({ en: `Show ${Math.min(pageSize, sorted.length - shown.length)} more`, ar: `عرض ${Math.min(pageSize, sorted.length - shown.length)} إضافي` }, lang)}
              </button>
            )}
          </div>

          {inspector && selected && (
            <aside className="knoux-inventory__inspector" aria-label={T({ en: 'Details', ar: 'التفاصيل' }, lang)}>
              {inspector(selected, () => setSelectedKey(null), lang)}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
