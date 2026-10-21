import type { ReactNode } from 'react';
import { StationInventorySurface } from '../workspace/StationInventorySurface';
import type { InventoryColumn, InventoryFilter, InventoryEmptyLabels } from '../workspace/StationInventorySurface';
import type { Lang } from '../../lib/i18n';

export interface EntityInventoryProps<Row> {
  lang: Lang;
  title: string;
  /** null means nothing has been measured yet; [] means measured and genuinely empty. */
  rows: Row[] | null;
  loading?: boolean;
  rowKey: (row: Row) => string;
  columns: InventoryColumn<Row>[];
  filters?: InventoryFilter<Row>[];
  searchFields: (row: Row) => string[];
  searchPlaceholder: { en: string; ar: string };
  initialQuery?: string;
  empty: InventoryEmptyLabels;
  inspector?: (row: Row, close: () => void, lang: Lang) => ReactNode;
  sortInitial?: { key: string; direction: 'asc' | 'desc' };
  pageSize?: number;
  /** Optional header content (counts, filters, actions). */
  header?: ReactNode;
}

/**
 * The product's one inventory surface.
 *
 * This is a composition of the canonical `StationInventorySurface`, not a
 * second implementation: the truthfulness contract (null = not checked,
 * [] = genuinely empty), the search/filter/sort behaviour and the
 * contextual inspector all come from the shared primitive.
 */
export default function EntityInventory<Row>({
  lang,
  title,
  rows,
  loading = false,
  rowKey,
  columns,
  filters = [],
  searchFields,
  searchPlaceholder,
  initialQuery,
  empty,
  inspector,
  sortInitial,
  pageSize,
  header,
}: EntityInventoryProps<Row>) {
  return (
    <section className="knoux-panel" data-role="entity-inventory">
      <header>
        <h3>{title}</h3>
        {header}
      </header>
      <StationInventorySurface
        lang={lang}
        rows={rows}
        loading={loading}
        rowKey={rowKey}
        columns={columns}
        filters={filters}
        searchFields={searchFields}
        searchPlaceholder={searchPlaceholder}
        initialQuery={initialQuery}
        empty={empty}
        inspector={inspector}
        sortInitial={sortInitial}
        pageSize={pageSize}
      />
    </section>
  );
}
