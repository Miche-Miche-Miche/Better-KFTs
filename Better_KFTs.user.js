// ==UserScript==
// @name         Better KFTs
// @namespace    local.servicenow.better-kfts
// @version      1.7.4
// @description  Read KFT descriptions more easily with wrapping, readable characters, clickable links and stable row shading.
// @icon         https://www.google.com/s2/favicons?sz=64&domain=service-now.com
// @match        https://*.service-now.com/now/nav/ui/*
// @match        https://*.service-now.com/kb_feedback_task_list.do*
// @match        https://*.service-now.com/kb_feedback_task.do*
// @updateURL    https://raw.githubusercontent.com/Miche-Miche-Miche/Better-KFTs/main/Better_KFTs.user.js
// @downloadURL  https://raw.githubusercontent.com/Miche-Miche-Miche/Better-KFTs/main/Better_KFTs.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
Better KFTs makes KFTs easier to read: descriptions wrap, encoded characters
become readable and web addresses become clickable. List rows keep their
white/grey shading on hover. On records, only Detailed Description is formatted;
double-click, press F2 or click its label to use the original editor.
Nothing is saved automatically: use ServiceNow's normal Save/Update action.

MAINTAINERS: Update this introduction and the changelog after every significant
change, so they describe what the current script actually does.
*/

/** Changelog
 * v1.7.4 - Repository-based updates
 * - Replaced the previous Git URLs with the new ones.
 *
 * v1.7.3 - Repository-based updates
 * - Makes the repository file the source for installation and updates.
 * - Keeps the hosted filename fixed as Better_KFTs.user.js.
 * - No changes to description rendering or record editing.
 *
 * v1.7.2 - Adds installation and automatic-update URLs.
 * 
 * v1.7.1 - Instance-neutral metadata and Gist preparation
 * - Removes company-specific references from the namespace, URLs and comments.
 * - Matches KFT routes and supported navigation views on ServiceNow subdomains.
 * - Adds inactive update/download templates and Gist publishing instructions.
 * - Changes the namespace; disable the old installation before enabling this one
 *   if the userscript manager treats it as a separate script.
 * - No changes to description rendering or normal record editing/saving.
 *
 * v1.7.0 - Rendering and refresh corrections
 * - Replaces the long feature list with a short introduction and maintenance reminder.
 * - Uses ASCII punctuation in comments to avoid garbled dashes and apostrophes
 *   when the script is opened with an incorrect legacy character encoding.
 * - Refreshes list descriptions after in-place text or loaded-tooltip changes,
 *   rather than permanently skipping cells after their first render.
 * - Preserves visible line breaks when reading list descriptions.
 * - Ignores nested-table rows and native inline editors when formatting lists.
 * - Avoids repeated DOM replacements when displayed content has not changed.
 * - Handles upper-case WWW. links and surrounding punctuation consistently.
 * - Keeps HTTP(S) URL percent escapes unchanged, including query values.
 * - Leaves encoded URL schemes as text instead of guessing how many URL
 *   encoding layers belong to the address. Ordinary encoded prose is decoded.
 * - Decodes named/numeric HTML entities and valid UTF-8 percent sequences,
 *   not a fixed character list; supports up to four nested decoding passes.
 * - Leaves malformed UTF-8, literal plus signs and non-layout control escapes
 *   unchanged. Tab and newline escapes can render as whitespace.
 * - Checks editability again when editing starts, respects changed read-only
 *   states and keeps the original field/value for ServiceNow saving.
 * - Observes text-node, tooltip and relevant field-state changes.
 * - Builds links and text with DOM nodes, never executing description markup.
 *
 * v1.6.4 - Changelog documentation
 * - Adds the in-script changelog; no functional changes in that release.
 *
 * v1.6.3 - Description documentation
 * - Condenses the feature list and aligns the in-script and canvas descriptions.
 *
 * v1.6.2 - Percent-encoded text
 * - Adds UTF-8 percent decoding outside recognised web addresses.
 * - Shortens the introduction and adds a reminder to keep it updated.
 *
 * v1.6.1 - Documented ServiceNow baseline
 * - Wraps Detailed Description cells and uses longer loaded tooltip text.
 * - Removes common description tooltips and keeps white/grey bands on hover.
 * - Makes HTTP(S)/www. addresses clickable in a separate tab.
 * - Decodes HTML entities as text, without interpreting embedded markup.
 * - Formats only the individual record's Detailed Description in place.
 * - Retains the original editor, normal saving and read-only restrictions.
 * - Supports double-click, F2 and label-click editing; leaving restores the view.
 *
 * Earlier releases are not reconstructed here: only the supplied baseline and
 * documented subsequent changes are listed.
 * MAINTAINERS: Keep this changelog and the introduction current.
 */

(() => {
  'use strict';

  // Limit changes to Knowledge Feedback Task list and record pages.
  function matchesTaskRoute(pattern) {
    const urls = [location.href];
    try {
      if (window.top && window.top !== window) urls.push(window.top.location.href);
    } catch (_) {
      // Ignore cross-origin access if the page is embedded elsewhere.
    }

    return urls.some((url) => {
      try {
        return pattern.test(decodeURIComponent(url));
      } catch (_) {
        return pattern.test(url);
      }
    });
  }

  function isTargetList() {
    return matchesTaskRoute(/kb_feedback_task_list\.do/i);
  }

  function isTargetRecord() {
    return matchesTaskRoute(/kb_feedback_task\.do/i) && !isTargetList();
  }

  function isTargetPage() {
    return isTargetList() || isTargetRecord();
  }

  if (!isTargetPage()) return;

  const style = document.createElement('style');
  style.textContent = `
    .kb-feedback-full-description {
      white-space: pre-wrap !important;
      overflow-wrap: anywhere !important;
      word-break: normal !important;
      text-overflow: clip !important;
      overflow: visible !important;
      max-height: none !important;
      height: auto !important;
      -webkit-line-clamp: unset !important;
      line-clamp: unset !important;
      vertical-align: top !important;
      min-width: 320px !important;
      max-width: 700px !important;
    }
    .kb-feedback-full-description * {
      white-space: inherit !important;
      overflow-wrap: inherit !important;
      text-overflow: clip !important;
      overflow: visible !important;
      max-height: none !important;
      -webkit-line-clamp: unset !important;
      line-clamp: unset !important;
    }
    /* Explicit bands, not sampled computed colours. Hover uses the same band. */
    tr.kb-feedback-row-white,
    tr.kb-feedback-row-white > td,
    tr.kb-feedback-row-white:hover > td {
      background-color: #ffffff !important;
    }
    tr.kb-feedback-row-grey,
    tr.kb-feedback-row-grey > td,
    tr.kb-feedback-row-grey:hover > td {
      background-color: #f0f2f5 !important;
    }
    tr.kb-feedback-row-white > td,
    tr.kb-feedback-row-grey > td {
      background-image: none !important;
      box-shadow: none !important;
    }
    .kb-feedback-native-hidden,
    .kb-feedback-record-rendered[hidden] {
      display: none !important;
    }
    .kb-feedback-record-rendered {
      display: block;
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      height: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: normal;
    }

  `;
  (document.head || document.documentElement).appendChild(style);

  const tooltipAttributes = [
    'title',
    'data-original-title',
    'data-tooltip',
    'data-tooltip-content',
    'data-content',
    'data-bs-title',
    'data-bs-original-title',
    'aria-label'
  ];

  const tooltipAttributesToRemove = [
    'title',
    'data-original-title',
    'data-tooltip',
    'data-tooltip-content',
    'data-content',
    'data-bs-title',
    'data-bs-original-title'
  ];

  function suppressDescriptionTooltips(cell) {
    for (const node of [cell, ...cell.querySelectorAll('*')]) {
      for (const attribute of tooltipAttributesToRemove) {
        node.removeAttribute(attribute);
      }
    }
  }

  function linkifyDescription(cell, text) {
    const fragment = document.createDocumentFragment();
    const urlPattern = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
    let cursor = 0;
    let match;

    while ((match = urlPattern.exec(text)) !== null) {
      let url = match[0];
      let trailing = '';

      let previous;
      do {
        previous = url;
        while (/[.,!?;:]$/.test(url)) {
          trailing = url.slice(-1) + trailing;
          url = url.slice(0, -1);
        }
        for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
          while (url.endsWith(close) &&
                 [...url].filter((character) => character === close).length >
                 [...url].filter((character) => character === open).length) {
            trailing = close + trailing;
            url = url.slice(0, -1);
          }
        }
      } while (url !== previous);

      if (!url) continue;
      fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));

      const anchor = document.createElement('a');
      anchor.href = /^www\./i.test(url) ? `https://${url}` : url;
      anchor.textContent = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.className = 'kb-feedback-url';
      fragment.appendChild(anchor);
      if (trailing) fragment.appendChild(document.createTextNode(trailing));
      cursor = match.index + match[0].length;
    }

    fragment.appendChild(document.createTextNode(text.slice(cursor)));
    cell.replaceChildren(fragment);
  }

  function longerTooltipText(cell) {
    const visibleText = (cell.innerText || cell.textContent || '').trim();
    const candidates = [];
    const nodes = [cell, ...cell.querySelectorAll('*')];

    for (const node of nodes) {
      for (const attribute of tooltipAttributes) {
        const value = node.getAttribute && node.getAttribute(attribute);
        if (!value) continue;
        const text = value.trim();
        // Avoid treating HTML fragments as literal text.
        if (text.length > visibleText.length + 8 && !/<\/?[a-z][\s\S]*>/i.test(text)) {
          candidates.push(text);
        }
      }
    }

    return candidates.sort((a, b) => b.length - a.length)[0] || '';
  }

  // Decode HTML character references as text, never as markup. Repeat to
  // handle values that have been encoded more than once (for example &amp;#64;).
  function decodeHtmlEntities(value) {
    let decoded = String(value || '');
    const entityPattern = /&(?:#(?:x[\da-f]+|\d+);?|[a-z][a-z0-9]+;)/gi;
    const template = document.createElement('template');

    for (let pass = 0; pass < 4; pass += 1) {
      let changed = false;
      const next = decoded.replace(entityPattern, (entity) => {
        template.innerHTML = entity;
        const character = template.content.textContent;
        if (character && character !== entity) {
          changed = true;
          return character;
        }
        return entity;
      });
      decoded = next;
      if (!changed) break;
    }

    return decoded;
  }

  // Decode any valid UTF-8 percent-encoded character, not a fixed lookup list.
  // Work one character at a time so malformed bytes do not block valid neighbours.
  // Leave malformed/incomplete sequences unchanged, and keep literal + signs:
  // + means a space only in form data, not in general description text.
  function decodePercentCharacters(value) {
    return value.replace(
      /%[0-7][\da-f]|%[cd][\da-f]%[89ab][\da-f]|%e[\da-f](?:%[89ab][\da-f]){2}|%f[0-4](?:%[89ab][\da-f]){3}/gi,
      (encoded) => {
        try {
          const character = decodeURIComponent(encoded);
          return /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(character)
            ? encoded : character;
        }
        catch (_) { return encoded; }
      }
    );
  }

  // Recognise literal AND percent-encoded schemes before decoding prose.
  // An encoded scheme is ambiguous: the rest may have a different encoding
  // depth. Leave it as text rather than silently changing the destination.
  function schemeCharacter(character) {
    const escaped = character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bytes = [...new Set([character.toLowerCase(), character.toUpperCase()])]
      .map((letter) => letter.charCodeAt(0).toString(16)).join('|');
    return `(?:escaped|%(?:25)0,3(?:{bytes}))`;
  }
  function encodedScheme(scheme) {
    return [...scheme].map(schemeCharacter).join('');
  }
  const protectedAddressPattern = new RegExp(
    `((?:${['http://', 'https://', 'www.'].map(encodedScheme).join('|')})[^\\s<>"']*)`,
    'gi'
  );

  function decodeDescriptionText(value) {
    let decoded = decodeHtmlEntities(value);
    for (let pass = 0; pass < 4; pass += 1) {
      const next = decoded.split(protectedAddressPattern)
        .map((part, index) => index % 2 ? part :
          decodeHtmlEntities(decodePercentCharacters(part)))
        .join('');
      if (next === decoded) break;
      decoded = next;
    }
    return decoded;
  }

  function isKftRow(row) {
    return [...row.querySelectorAll('a')].some((link) =>
      /^KFT\d+$/i.test((link.innerText || link.textContent || '').trim())
    ) || /\bKFT\d+\b/i.test(row.cells?.[0]?.innerText || '');
  }

  function isDetailedDescriptionField(element) {
    if (!element || element.nodeType !== 1) return false;
    if (!/^(TEXTAREA|INPUT)$/.test(element.tagName) &&
        !element.isContentEditable &&
        element.getAttribute('role') !== 'textbox') return false;

    // Match the actual ServiceNow field name, not any field whose name merely
    // contains "description" (for example short_description).
    const identifiers = [
      element.id,
      element.getAttribute('name'),
      element.getAttribute('data-field-name'),
      element.getAttribute('data-field')
    ].filter(Boolean);
    return identifiers.some((value) => /(?:^|\.)description$/i.test(value));
  }

  function findDetailedDescriptionField() {
    const exactId = document.getElementById('kb_feedback_task.description');
    if (isDetailedDescriptionField(exactId)) return exactId;
    const exactName = document.querySelector('[name="kb_feedback_task.description"]');
    if (isDetailedDescriptionField(exactName)) return exactName;

    const labels = [...document.querySelectorAll('label')];
    const detailedLabel = labels.find((label) =>
      (label.innerText || label.textContent || '')
        .replace(/\s+/g, ' ').trim().replace(/:$/, '').toLowerCase() === 'detailed description'
    );

    if (detailedLabel?.htmlFor) {
      const labelledField = document.getElementById(detailedLabel.htmlFor);
      if (isDetailedDescriptionField(labelledField)) return labelledField;
    }

    if (detailedLabel) {
      const group = detailedLabel.closest('tr, .form-group, .form-field, .field') || detailedLabel.parentElement;
      const field = group && [...group.querySelectorAll('textarea, input, [contenteditable="true"], [role="textbox"]')]
        .find(isDetailedDescriptionField);
      if (field) return field;
    }

    // If neither the exact ServiceNow field name nor its exact label is
    // present, leave the record page untouched rather than guessing a field.
    return null;
  }

  const recordViews = new WeakMap();

  function descriptionValue(field) {
    return 'value' in field ? field.value : (field.innerText || field.textContent || '');
  }

  function processRecord() {
    if (!isTargetRecord()) return;
    const field = findDetailedDescriptionField();
    if (!field) return;
    const existing = recordViews.get(field);
    if (existing) {
      existing.refresh();
      return;
    }

    // A native textarea cannot contain clickable links. Show a text-safe view
    // in its place, retaining the original control/value for ServiceNow saves.
    // Never select short_description, resolution notes or any other field.
    const view = document.createElement('div');
    view.className = 'kb-feedback-record-rendered';
    view.tabIndex = 0;
    view.setAttribute('role', 'group');
    view.setAttribute('aria-label', 'Detailed Description');
    const computed = getComputedStyle(field);
    for (const property of [
      'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
      'color', 'background-color', 'border-top', 'border-right', 'border-bottom',
      'border-left', 'border-radius', 'padding-top', 'padding-right',
      'padding-bottom', 'padding-left'
    ]) {
      view.style.setProperty(property, computed.getPropertyValue(property));
    }
    view.style.minHeight = `${Math.max(parseFloat(computed.height) || 0, 48)}px`;
    function isEditable() {
      return !field.disabled && !field.readOnly &&
        field.getAttribute('aria-readonly') !== 'true' &&
        (!field.hasAttribute('contenteditable') || field.isContentEditable);
    }
    if (isEditable()) {
      view.setAttribute('aria-description',
        'Double-click this field or press F2 to edit. Leave the field to restore the formatted view.');
    }

    let editing = false;
    let lastValue = null;
    function refresh() {
      if (editing) return;
      const value = descriptionValue(field);
      if (value === lastValue) return;
      linkifyDescription(view, decodeDescriptionText(value));
      lastValue = value;
    }
    function beginEditing() {
      if (!isEditable() || editing) return;
      editing = true;
      view.hidden = true;
      field.classList.remove('kb-feedback-native-hidden');
      field.focus();
    }
    function finishEditing() {
      if (!editing) return;
      editing = false;
      refresh();
      field.classList.add('kb-feedback-native-hidden');
      view.hidden = false;
    }

    view.addEventListener('dblclick', (event) => {
      if (!event.target.closest('a')) beginEditing();
    });
    view.addEventListener('keydown', (event) => {
      if (event.key === 'F2' && event.target === view) {
        event.preventDefault();
        beginEditing();
      }
    });
    field.addEventListener('focusout', (event) => {
      if (!field.contains(event.relatedTarget)) finishEditing();
    });
    field.addEventListener('input', refresh);
    field.addEventListener('change', refresh);
    if (field.form) {
      field.form.addEventListener('reset', () => window.setTimeout(() => {
        if (editing) finishEditing();
        else refresh();
      }, 0));
    }
    for (const label of document.querySelectorAll('label')) {
      if (field.id && label.htmlFor === field.id) {
        label.addEventListener('click', (event) => {
          event.preventDefault();
          if (isEditable()) beginEditing();
          else view.focus();
        });
      }
    }

    recordViews.set(field, { refresh });
    refresh();
    field.insertAdjacentElement('beforebegin', view);
    field.classList.add('kb-feedback-native-hidden');
  }

  const listViews = new WeakMap();

  function processList() {
    if (!isTargetList()) return;

    for (const table of document.querySelectorAll('table')) {
      const rows = [...table.querySelectorAll('tr')].filter((row) => row.closest('table') === table);
      const headerRows = rows.filter((row) => row.querySelector('th, [role="columnheader"]'));
      const headerRow = headerRows.find((row) =>
        [...row.cells].some((cell) => /detailed\s+description/i.test(cell.innerText || cell.textContent || ''))
      );
      if (!headerRow) continue;

      const headerCells = [...headerRow.cells];
      const columnIndex = headerCells.findIndex((cell) =>
        /detailed\s+description/i.test(cell.innerText || cell.textContent || '')
      );
      if (columnIndex < 0) continue;

      headerCells[columnIndex].classList.add('kb-feedback-full-description');

      let stripeIndex = 0;
      for (const row of rows) {
        if (row === headerRow || !isKftRow(row)) continue;

        const grey = stripeIndex++ % 2 === 1;
        row.classList.toggle('kb-feedback-row-white', !grey);
        row.classList.toggle('kb-feedback-row-grey', grey);
        // Explicit band colours also win over ServiceNow's important hover
        // rules. Never infer a colour from transparent/hovered cells.
        const bandColour = grey ? '#f0f2f5' : '#ffffff';
        for (const rowCell of row.cells) {
          if (rowCell.style.getPropertyValue('background-color') !== bandColour) {
            rowCell.style.setProperty('background-color', bandColour, 'important');
          }
        }

        const cell = row.cells && row.cells[columnIndex];
        if (!cell) continue;

        // Leave ServiceNow's active inline editor alone.
        if (cell.isContentEditable ||
            cell.querySelector('input, textarea, select, [contenteditable="true"], [role="textbox"]')) continue;
        cell.classList.add('kb-feedback-full-description');
        const previous = listViews.get(cell);
        const unchanged = previous && previous.html === cell.innerHTML;
        const fullText = longerTooltipText(cell);
        if (unchanged && !fullText) {
          suppressDescriptionTooltips(cell);
          continue;
        }

        const preview = cell.innerText || cell.textContent || '';
        const source = fullText || (unchanged ? previous.source : preview);
        const displayText = decodeDescriptionText(source);
        if (!unchanged || source !== previous.source) {
          linkifyDescription(cell, displayText);
        }
        suppressDescriptionTooltips(cell);
        listViews.set(cell, { source, html: cell.innerHTML });

      }
    }
  }

  let pending = false;
  function scheduleProcess() {
    if (pending) return;
    pending = true;
    window.setTimeout(() => {
      pending = false;
      processPage();
    }, 100);
  }

  function processPage() {
    processList();
    processRecord();
  }

  processPage();
  new MutationObserver(() => {
    scheduleProcess();
  }).observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'title', 'data-original-title', 'data-tooltip', 'data-tooltip-content',
      'data-content', 'data-bs-title', 'data-bs-original-title',
      'readonly', 'disabled', 'aria-readonly', 'contenteditable'
    ]
  });
})();
