/**
 * MK Paper Mill — High-Performance Multi-Type Table Sorting Utility
 * Intelligently compares numbers, floats, dates, strings, and categorical values.
 */

export function compareValues(a, b, isAsc = true, customType = null) {
  if (a === b) return 0;
  if (a === null || a === undefined || a === '') return 1; // Nulls last
  if (b === null || b === undefined || b === '') return -1;

  let result = 0;

  if (customType === 'number' || (typeof a === 'number' && typeof b === 'number')) {
    const numA = Number(a);
    const numB = Number(b);
    result = isNaN(numA) || isNaN(numB) ? 0 : numA - numB;
  } else if (customType === 'date' || (a instanceof Date && b instanceof Date)) {
    const timeA = new Date(a).getTime();
    const timeB = new Date(b).getTime();
    result = timeA - timeB;
  } else if (customType === 'criticality') {
    const critOrder = { A: 1, B: 2, C: 3 };
    const valA = critOrder[String(a).toUpperCase()] || 99;
    const valB = critOrder[String(b).toUpperCase()] || 99;
    result = valA - valB;
  } else if (typeof a === 'boolean' || typeof b === 'boolean') {
    result = (a === b) ? 0 : a ? -1 : 1;
  } else {
    // Check if both strings are parseable clean numbers (e.g. "120.50", "45")
    const strA = String(a).trim();
    const strB = String(b).trim();
    const cleanA = strA.replace(/^[₹$€,\s]+/, '').replace(/,/g, '');
    const cleanB = strB.replace(/^[₹$€,\s]+/, '').replace(/,/g, '');

    const parsedA = parseFloat(cleanA);
    const parsedB = parseFloat(cleanB);

    if (!isNaN(parsedA) && !isNaN(parsedB) && String(parsedA) === cleanA && String(parsedB) === cleanB) {
      result = parsedA - parsedB;
    } else {
      result = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
    }
  }

  return isAsc ? result : -result;
}

export function sortTableData(items, sortKey, sortOrder = 'asc', customExtractors = {}) {
  if (!items || !items.length || !sortKey) return items;
  const isAsc = String(sortOrder).toLowerCase() === 'asc';

  return [...items].sort((rowA, rowB) => {
    let valA = rowA[sortKey];
    let valB = rowB[sortKey];

    let customType = null;
    if (customExtractors[sortKey]) {
      if (typeof customExtractors[sortKey] === 'function') {
        valA = customExtractors[sortKey](rowA);
        valB = customExtractors[sortKey](rowB);
      } else if (typeof customExtractors[sortKey] === 'string') {
        customType = customExtractors[sortKey];
      }
    }

    return compareValues(valA, valB, isAsc, customType);
  });
}
