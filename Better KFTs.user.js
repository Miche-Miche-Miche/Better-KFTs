// ==UserScript==
// @name         Better KFTs
// @namespace    local.booking.servicenow
// @version      1.6.3
// @description  Read KFT descriptions more easily with wrapping, readable characters, clickable links and stable row shading.
// @icon         https://www.google.com/s2/favicons?sz=64&domain=service-now.com
// @match        https://booking.service-now.com/now/nav/ui/*
// @match        https://booking.service-now.com/kb_feedback_task_list.do*
// @match        https://booking.service-now.com/kb_feedback_task.do*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
# Better KFTs — what the script does

## KFT list

* Wraps Detailed Description text, expanding rows and using longer tooltip text when available.
* Alternates white/grey rows, unchanged on hover, and removes description tooltips.

## Individual KFT

* Automatically formats only Detailed Description in its existing field area, without duplicate text or a preview button.
* Keeps the original editor and value. Double-click non-link text, press F2 while focused or click the label to edit; leaving restores the formatted view. Read-only fields stay read-only.
* Does not save edits: use ServiceNow’s Save/Update action.

## Text and links

* Displays HTML entities and valid UTF-8 percent-encoded characters readably, including repeated encoding, while preserving encoding inside web addresses.
* Preserves wording and line breaks. Makes HTTP, HTTPS and www. addresses clickable in a new tab, excluding surrounding punctuation where possible.
* Displays text safely, without executing embedded HTML or JavaScript or rewriting the saved value.

## Scope and limits

* Works on Booking.com’s KFT lists and records, including supported navigation/frame views, and checks newly loaded content without duplicating displays.
* Uses only text already loaded. Previously processed list cells are not refreshed after in-place text changes. Other link schemes are not automatically linked.
* No AI, external text processing or automatic ticket updates.

MAINTAINERS: Update this description whenever significant changes are made.
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

      if (!url) continue;
      fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));

      const anchor = document.createElement('a');
      anchor.href = url.startsWith('www.') ? `https://${url}` : url;
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
        try { return decodeURIComponent(encoded); }
        catch (_) { return encoded; }
      }
    );
  }

  function decodeDescriptionText(value) {
    let decoded = decodeHtmlEntities(value);
    for (let pass = 0; pass < 4; pass += 1) {
      // Protect complete web addresses BEFORE decoding. For example, changing
      // ?q=a%26b to ?q=a&b would change the destination's query parameters.
      // Re-split on each pass so an initially encoded URL is protected as soon
      // as its scheme becomes readable. Link labels keep their URL encoding too.
      const next = decoded.split(/((?:https?:\/\/|www\.)[^\s<>"']+)/gi)
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
    const editable = !field.disabled && !field.readOnly &&
      field.getAttribute('aria-readonly') !== 'true';
    if (editable) {
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
      if (!editable || editing) return;
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
      if (event.key === 'F2') {
        event.preventDefault();
        beginEditing();
      }
    });
    field.addEventListener('blur', finishEditing);
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
          if (editable) beginEditing();
          else view.focus();
        });
      }
    }

    recordViews.set(field, { refresh });
    refresh();
    field.insertAdjacentElement('beforebegin', view);
    field.classList.add('kb-feedback-native-hidden');
  }

  function processList() {
    if (!isTargetList()) return;

    for (const table of document.querySelectorAll('table')) {
      const headerRows = [...table.querySelectorAll('thead tr'), ...table.querySelectorAll('tr')];
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
      for (const row of table.querySelectorAll('tr')) {
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

        cell.classList.add('kb-feedback-full-description');
        if (cell.dataset.kbFeedbackProcessed === 'true') {
          suppressDescriptionTooltips(cell);
          continue;
        }

        const preview = cell.textContent || '';
        const fullText = longerTooltipText(cell);
        const displayText = decodeDescriptionText(fullText || preview);
        // Build links with DOM nodes rather than interpreting description text
        // as HTML. Only HTTP(S) and www URLs become clickable.
        linkifyDescription(cell, displayText);
        suppressDescriptionTooltips(cell);
        cell.dataset.kbFeedbackProcessed = 'true';
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
    subtree: true,
    attributes: true,
    attributeFilter: [
      'title', 'data-original-title', 'data-tooltip', 'data-tooltip-content',
      'data-content', 'data-bs-title', 'data-bs-original-title'
    ]
  });
})();
