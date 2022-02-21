/**
 * Mutilated copy of Hyde's moveRowsFromSpreadsheetToSpreadsheet_ script v2.9.1
 *    https://support.google.com/docs/thread/39992635?hl=en&msgid=40432488
 *
 * Apps Script references:
 *    https://support.google.com/docs/thread/151016160?hl=en&msgid=151026074
 */

/**
 * Global variables.
 */
try {
  var sheetsToWatch = [
    "Movies to Watch",
    "Watched Movies",
    "Activities to Do",
    "Activities Done",
  ];
  var columnsToWatch = ["Watched?", "Watched?", "Done?", "Done?"];
  var valuesToWatch = [
    /^(watched)$/i,
    /^(unwatched)$/i,
    /^(done)$/i,
    /^(notdone)$/i,
  ];
  var targetSheets = [
    "Watched Movies",
    "Movies to Watch",
    "Activities Done",
    "Activities to Do",
  ];
} catch (error) {
  showAndThrow_(error);
}

/**
 * Moves rows from sheet to sheet, and sorts the source and target sheets after the move.
 *
 * @param {Object} e The onEdit event object.
 */
function moveRowsAndSortSheet_(e) {
  // version 1.1, written by --Hyde, 27 June 2020
  //  - use LockService
  //  - sort all targetSheets instead of sorting just one targetSheet
  // version 1.0, written by --Hyde, 9 January 2020
  //  - initial version
  try {
    var lock = LockService.getDocumentLock();
    lock.waitLock(30 * 1000);
    var modifiedSheets = moveRowsFromSpreadsheetToSpreadsheet_(e);
  } catch (error) {
    showAndThrow_(error);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Moves a row from a spreadsheet to another spreadsheet file when a magic value is entered in a column.
 *
 * The name of the sheet to move the row to is derived from the position of the magic value on the valuesToWatch list.
 * The targetSpreadheets list uses spreadsheet IDs that can be obtained from the address bar of the browser.
 * Use a spreadsheet ID of '' to indicate that the row is to be moved to another tab in the same spreadsheet file.
 *
 * Globals: see the Global variables section.
 * Displays pop-up messages through Spreadsheet.toast().
 * Throws errors.
 *
 * @param {Object} e The 'on edit', 'on form submit' or 'on change' event object.
 * @return {Object} An object that lists the sheets that were modified with this structure, or a falsy value if no rows were moved:
 *                  {Sheet} sourceSheet The sheet from where a row was moved.
 *                  {Sheet[]} targetSheets The sheets to where rows were moved.
 *                  {Number} numRowsMoved The number of rows that were moved to another sheet.
 */
function moveRowsFromSpreadsheetToSpreadsheet_(e) {
  if (e.value === "") {
    // optimization for single-cell edits
    return;
  }
  if (e.value !== undefined) {
    // optimization for single-cell edits
    var valuesToWatchIndex = -1;
    for (var i = 0, numRegexes = valuesToWatch.length; i < numRegexes; i++) {
      if (e.value.match(valuesToWatch[i])) {
        valuesToWatchIndex = i;
        break;
      }
    }
    if (valuesToWatchIndex === -1) {
      return null;
    }
  }
  var event = getEventObject_(e);
  if (!event || sheetsToWatch.indexOf(event.sheetName) === -1) {
    return;
  }
  var numRowsMoved = 0;
  var messageOnDisplay = false;
  var sourceSheetNames = [];
  var targetSheetNames = [];
  var targets = [];
  for (var row = event.numRows - 1; row >= 0; row--) {
    for (var column = 0; column < event.numColumns; column++) {
      if (
        event.rowStart + row <= event.columnLabelRow ||
        columnsToWatch.indexOf(
          event.columnLabels[event.columnStart - 1 + column]
        ) === -1
      ) {
        continue;
      }
      valuesToWatchIndex = -1;
      for (var i = 0, numRegexes = valuesToWatch.length; i < numRegexes; i++) {
        if (event.displayValues[row][column].match(valuesToWatch[i])) {
          valuesToWatchIndex = i;
          break;
        }
      }
      if (valuesToWatchIndex === -1) {
        continue;
      }
      var targetIndex = valuesToWatchIndex;
      if (targetIndex === -1) {
        continue;
      }
      if (!messageOnDisplay) {
        showMessage_("Moving rows...", 30);
        messageOnDisplay = true;
      }
      var targetSheet = getTargetSheet_(event, targetIndex);
      if (!targetSheet) {
        continue; // skip moving the row if it would end up on the same sheet
      }
      var sourceRange = event.sheet.getRange(
        event.rowStart + row,
        1,
        1,
        event.numSheetColumns
      );
      var firstFreeTargetRow = targetSheet.getLastRow() + 1;
      if (firstFreeTargetRow > targetSheet.getMaxRows()) {
        targetSheet.insertRowAfter(targetSheet.getLastRow());
      }
      var targetRange = targetSheet.getRange(firstFreeTargetRow, 1);
      sourceRange.copyTo(
        targetRange,
        SpreadsheetApp.CopyPasteType["PASTE_NORMAL"],
        false
      );
      // clear cells in targetRange where column label row contains an array formula
      var numColumns = sourceRange.getWidth();
      var formulas = targetSheet
        .getRange(targetSheet.getFrozenRows() || 1, 1, 1, numColumns)
        .getFormulas()[0];
      formulas.forEach(function (formula, index) {
        if (formula.match(/^=.*arrayformula/i)) {
          targetRange.offset(0, index, 1, 1).clearContent();
        }
      });
      numRowsMoved += 1;
      if (event.sheet.getMaxRows() <= event.columnLabelRow + 1) {
        // avoid deleting the last unfrozen row
        event.sheet.appendRow([null]);
      }
      event.sheet.deleteRow(event.rowStart + row);
      sourceSheetNames = sourceSheetNames
        .concat(event.sheetName)
        .filter(filterUniques_);
      targetSheetNames = targetSheetNames
        .concat(targetSheet.getName())
        .filter(filterUniques_);
      targets = targets.concat(targetSheet).filter(filterUniques_);
    } // column
  } // row
  if (messageOnDisplay) {
    var message =
      "Moved " +
      numRowsMoved +
      (numRowsMoved === 1 ? " row " : " rows ") +
      "from '" +
      sourceSheetNames.join(", ") +
      "' to '" +
      targetSheetNames.join(", ") +
      "'.";
    showMessage_("Moving rows... done. " + message);
  }
  return numRowsMoved
    ? {
        sourceSheet: event.sheet,
        targetSheets: targets,
        numRowsMoved: numRowsMoved,
      }
    : null;
}

/**
 * Determines the type of a spreadsheet event and populates an event object.
 *
 * @param {Object} e The original event object.
 * @return {Object} An event object with the following fields, or null if the event type is unknown.
 *                  {Spreadsheet} spreadsheet The spreadsheet that was edited.
 *                  {Sheet} sheet The sheet that was edited in spreadsheet.
 *                  {Range} range The cell or range that was edited in sheet.
 *                  {String} sheetName The name of the sheet that was edited.
 *                  {Number} rowStart The ordinal number of the first row in range.
 *                  {Number} rowEnd The ordinal number of the last row in range.
 *                  {Number} columnStart The ordinal number of the first column in range.
 *                  {Number} columnEnd The ordinal number of the last column in range.
 *                  {Number} numRows The number of rows in range.
 *                  {Number} numColumns The number of columns in range.
 *                  {Number} numSheetColumns The number of columns in sheet.
 *                  {Number} columnLabelRow The 1-based row number where column labels are found.
 *                  {String[]} columnLabels The values in row event.columnLabelRow as shown in the spreadsheet as text strings.
 *                  {String[][]} displayValues The values in the edited range as shown in the spreadsheet as text strings.
 *                  {String} eventType One of ON_EDIT, ON_CHANGE or ON_FORM_SUBMIT.
 *                  {String} changeType Always EDIT, and never INSERT_ROW, INSERT_COLUMN, REMOVE_ROW, REMOVE_COLUMN, INSERT_GRID, REMOVE_GRID, FORMAT, or OTHER.
 *                  {String} authMode One of ScriptApp.AuthMode.NONE, .LIMITED, .FULL or .CUSTOM_FUNCTION.
 */
function getEventObject_(e) {
  // version 1.4, written by --Hyde, 20 January 2021
  //  - replace |event.range.getLastRow()| with |event.range.getLastColumn()| in event.columnEnd
  //  - re-add event.numSheetColumns, event.columnLabelRow, event.columnLabels, event.displayValues
  // version 1.3, written by --Hyde, 9 July 2020
  //  - add JSDoc for eventType
  // version 1.2, written by --Hyde, 9 July 2020
  //  - remove moveRowsFromSpreadsheetToSpreadsheet_ optimizations
  //  - replace |e.range.getLastRow()| with |event.range.getLastRow()|, ditto for getLastColumn
  // version 1.1, written by --Hyde, 29 June 2020
  //  - use Number()
  // version 1.0, written by --Hyde, 27 June 2020
  //  - initial version
  if (!e) {
    return null;
  }
  var event = {};
  if (e.range && JSON.stringify(e.range) !== "{}") {
    // triggered by ScriptApp.EventType.ON_EDIT or .ON_FORM_SUBMIT
    event.range = e.range;
    event.rowStart = Number(e.range.rowStart);
    event.rowEnd = Number(e.range.rowEnd);
    event.columnStart = Number(e.range.columnStart);
    event.columnEnd = Number(e.range.columnEnd);
    event.changeType = "EDIT";
    event.eventType = e.namedValues ? "ON_FORM_SUBMIT" : "ON_EDIT";
  } else if (e.changeType === "EDIT") {
    // triggered by ScriptApp.EventType.ON_CHANGE
    // @see https://developers.google.com/apps-script/guides/triggers/events#change
    // @see https://community.glideapps.com/t/new-row-in-spreadsheet-for-every-user/6475/55
    var ss = SpreadsheetApp.getActive();
    event.range = ss.getActiveRange();
    event.rowStart = event.range.getRow();
    event.rowEnd = event.range.getLastRow();
    event.columnStart = event.range.getColumn();
    event.columnEnd = event.range.getLastColumn();
    event.changeType = e.changeType;
    event.eventType = "ON_CHANGE";
  } else {
    // triggered by some other change type
    return null;
  }
  event.authMode = e.authMode; // @see https://developers.google.com/apps-script/reference/script/auth-mode
  event.sheet = event.range.getSheet();
  event.sheetName = event.sheet.getName();
  event.spreadsheet = event.sheet.getParent();
  event.numRows = event.rowEnd - event.rowStart + 1;
  event.numColumns = event.columnEnd - event.columnStart + 1;
  event.columnLabelRow = event.sheet.getFrozenRows() || 1;
  event.numSheetColumns = event.sheet.getLastColumn();
  event.columnLabels = event.sheet
    .getRange(event.columnLabelRow, 1, 1, event.numSheetColumns)
    .getDisplayValues()[0];
  event.displayValues = event.range.getDisplayValues();
  return event;
}

/**
 * Callback function to Array.filter() to return an array where there is just one copy of each individual value.
 *
 * Usage:
 *   var array = [3, 1, 1, 1, '1', 2, '1', 'test', 'test2', 'test'];
 *   var unique = array.filter(filterUniques_); // returns [3, 1, "1", 2, "test", "test2"]
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
 * @see https://stackoverflow.com/questions/9229645/remove-duplicate-values-from-js-array
 *
 * @param {Object} element The current element being processed in the array.
 * @param {Number} index The index of the current element being processed in the array.
 * @param {Object[]} array The array filter was called upon.
 * @return {Boolean} True if element is unique in array, false if there is another identical value in array.
 */
function filterUniques_(element, index, array) {
  // version 1.0, written by --Hyde, 30 May 2019
  //  - initial version
  return array.indexOf(element) === index;
}

/**
 * Gets the target sheet where to move a row.
 *
 * Globals: targetSheets, targetSpreadheets.
 * Throws errors.
 *
 * @param {Object} event The event object from getEventObject_().
 * @param {Number} targetIndex The index to use when getting the pertinent value from targetSheets and targetSpreadheets.
 * @return {Sheet} The target sheet, or null if the target sheet is the same as the source sheet.
 */
function getTargetSheet_(event, targetIndex) {
  // version 1.0, written by --Hyde, 27 June 2020
  //  - initial version, based on inline code in moveRowsFromSpreadsheetToSpreadsheet_
  var targetSheetName = targetSheets[targetIndex];
  var targetSpreadsheet = event.spreadsheet;
  if (targetSheetName === event.sheetName) {
    return null; // skip moving the row if it would end up in the same sheet
  }
  var targetSheet = targetSpreadsheet.getSheetByName(targetSheetName);
  if (!targetSheet) {
    throw new Error(
      "Could not find the target sheet '" +
        targetSheetName +
        "'" +
        targetSpreadsheet ===
      event.spreadsheet
        ? "."
        : ' in spreadsheet "' + targetSpreadsheet.getName() + '".'
    );
  }
  return targetSheet;
}

/**
 * Installs a trigger that runs each time the user hand edits the spreadsheet.
 * Deletes any previous instances of ON_EDIT and ON_CHANGE triggers.
 *
 * To permanently install the trigger, choose Run > Run function > installOnEditTrigger.
 * You only need to install the trigger once per spreadsheet.
 * To review the installed triggers, choose Edit > Current project's triggers.
 */
function installOnEditTrigger() {
  // version 1.0, written by --Hyde, 7 May 2020
  //  - initial version
  deleteTriggers_(ScriptApp.EventType.ON_EDIT);
  deleteTriggers_(ScriptApp.EventType.ON_CHANGE);
  ScriptApp.newTrigger("moveRowsAndSortSheet_")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}

/**
 * Deletes all installable triggers of the type triggerType associated with the current
 * script project that are owned by the current user in the current spreadsheet.
 *
 * @param {EventType} triggerType One of ScriptApp.EventType.ON_EDIT, .ON_FORM_SUBMIT, .ON_OPEN, .ON_CHANGE, .CLOCK (time-driven triggers) or .ON_EVENT_UPDATED (Calendar events).
 */
function deleteTriggers_(triggerType) {
  // version 1.1, written by --Hyde, 27 June 2020
  //  - use getUserTriggers(ss) instead of getProjectTriggers()
  // version 1.0, written by --Hyde, 7 May 2020
  //  - initial version
  var triggers = ScriptApp.getUserTriggers(SpreadsheetApp.getActive());
  for (var i = 0, numTriggers = triggers.length; i < numTriggers; i++) {
    if (triggers[i].getEventType() === triggerType) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * Shows error.message in a pop-up and throws the error.
 *
 * @param {Error} error The error to show and throw.
 */
function showAndThrow_(error) {
  // version 1.0, written by --Hyde, 16 April 2020
  //  - initial version
  var stackCodeLines = String(error.stack).match(/\d+:/);
  if (stackCodeLines) {
    var codeLine = stackCodeLines.join(", ").slice(0, -1);
  } else {
    codeLine = error.stack;
  }
  showMessage_(error.message + " Code line: " + codeLine, 30);
  throw error;
}

/**
 * Shows a message in a pop-up.
 *
 * @param {String} message The message to show.
 * @param {Number} timeoutSeconds Optional. The number of seconds before the message goes away. Defaults to 5.
 */
function showMessage_(message, timeoutSeconds) {
  // version 1.0, written by --Hyde, 16 April 2020
  //  - initial version
  SpreadsheetApp.getActive().toast(
    message,
    "Auto Move Rows",
    timeoutSeconds || 5
  );
}
