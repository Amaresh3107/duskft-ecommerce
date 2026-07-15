/**
 * Database.gs
 * ------------------------------------------------------------------
 * A tiny generic ORM over Google Sheets. Every entity (Products,
 * Orders, Quotes...) reads/writes through DB.* so there's no repeated
 * boilerplate per module, and the row<->object mapping (incl. JSON
 * field parsing) is handled in exactly one place.
 *
 * Sheet layout assumption: row 1 = headers (from SCHEMAS in Setup.gs),
 * column A of every sheet is "id" (except Sessions, keyed by "token",
 * and Settings, keyed by "key").
 * ------------------------------------------------------------------
 */

const DB = {

  /** Return every row in a sheet as an array of plain objects. */
  getAll: function (sheetName) {
    const sheet = getSheet_(sheetName);
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return [];

    const headers = values[0];
    const rows = values.slice(1);
    return rows
      .filter(function (row) { return row.some(function (c) { return c !== '' && c !== null; }); })
      .map(function (row) { return rowToObject_(sheetName, headers, row); });
  },

  /** Find a single row by id (or by keyField if the sheet uses a different key). */
  getById: function (sheetName, id, keyField) {
    keyField = keyField || 'id';
    const all = this.getAll(sheetName);
    return all.find(function (r) { return String(r[keyField]) === String(id); }) || null;
  },

  /** Return rows matching a predicate function(row) => boolean. */
  query: function (sheetName, predicateFn) {
    return this.getAll(sheetName).filter(predicateFn);
  },

  /**
   * Insert a new record. Auto-generates a UUID id unless opts.noId
   * (used for keyed tables like Settings) or the record already has
   * an id/token supplied.
   */
  insert: function (sheetName, record, opts) {
    opts = opts || {};
    const sheet = getSheet_(sheetName);
    const headers = getHeaders_(sheet);

    if (!opts.noId && !record.id && headers.indexOf('id') !== -1) {
      record.id = Utilities.getUuid();
    }
    if (headers.indexOf('createdAt') !== -1 && !record.createdAt) {
      record.createdAt = new Date().toISOString();
    }

    const row = headers.map(function (h) {
      return encodeField_(sheetName, h, record[h]);
    });
    sheet.appendRow(row);
    return record;
  },

  /** Partially update a record identified by id (or keyField). */
  update: function (sheetName, id, updates, keyField) {
    keyField = keyField || 'id';
    const sheet = getSheet_(sheetName);
    const headers = getHeaders_(sheet);
    const keyCol = headers.indexOf(keyField);
    if (keyCol === -1) throw new Error('Key field "' + keyField + '" not found in ' + sheetName);

    const data = sheet.getDataRange().getValues();
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][keyCol]) === String(id)) {
        if (headers.indexOf('updatedAt') !== -1) {
          updates.updatedAt = new Date().toISOString();
        }
        headers.forEach(function (h, c) {
          if (Object.prototype.hasOwnProperty.call(updates, h)) {
            sheet.getRange(r + 1, c + 1).setValue(encodeField_(sheetName, h, updates[h]));
          }
        });
        const merged = rowToObject_(sheetName, headers, sheet.getRange(r + 1, 1, 1, headers.length).getValues()[0]);
        return merged;
      }
    }
    return null;
  },

  /** Delete a record by id (or keyField). Returns true if a row was removed. */
  remove: function (sheetName, id, keyField) {
    keyField = keyField || 'id';
    const sheet = getSheet_(sheetName);
    const headers = getHeaders_(sheet);
    const keyCol = headers.indexOf(keyField);

    const data = sheet.getDataRange().getValues();
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][keyCol]) === String(id)) {
        sheet.deleteRow(r + 1);
        return true;
      }
    }
    return false;
  }
};

// ---------- internal helpers ----------

function getSheet_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" does not exist. Run setupDatabase() first.');
  return sheet;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function rowToObject_(sheetName, headers, row) {
  const jsonFields = JSON_FIELDS[sheetName] || [];
  const obj = {};
  headers.forEach(function (h, i) {
    let val = row[i];
    if (jsonFields.indexOf(h) !== -1) {
      obj[h] = safeJsonParse_(val);
    } else if (val instanceof Date) {
      obj[h] = val.toISOString();
    } else {
      obj[h] = val;
    }
  });
  return obj;
}

function encodeField_(sheetName, field, value) {
  const jsonFields = JSON_FIELDS[sheetName] || [];
  if (jsonFields.indexOf(field) !== -1) {
    return value === undefined || value === null ? '' : JSON.stringify(value);
  }
  return value === undefined || value === null ? '' : value;
}

function safeJsonParse_(val) {
  if (val === '' || val === null || val === undefined) return null;
  try {
    return JSON.parse(val);
  } catch (e) {
    return val; // fall back to raw string if it's not valid JSON
  }
}

/** Convenience: read a single Settings value by key. */
function getSetting(key) {
  const row = DB.getById('Settings', key, 'key');
  return row ? row.value : null;
}

/** Convenience: write a single Settings value by key (insert or update). */
function setSetting(key, value) {
  const existing = DB.getById('Settings', key, 'key');
  if (existing) {
    DB.update('Settings', key, { value: value }, 'key');
  } else {
    DB.insert('Settings', { key: key, value: value }, { noId: true });
  }
}
