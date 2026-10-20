# UI Testing Standard

## Main Areas

Validate:

- Functionality
- Usability
- Accessibility
- Responsiveness
- Localization

---

# UI Assertions

Verify:

- Element visibility
- Element state
- Text values
- Error messages
- Navigation

---

# Forms

For each form verify:

Positive cases:
- Valid input

Negative cases:
- Empty values
- Invalid values
- Boundary values

---

# Tables

Verify:

- Sorting
- Filtering
- Pagination
- Data integrity

---

# Navigation

Verify:

- Menu links
- Redirects
- Deep links
- Browser navigation

---

# Localization (i18n)

Verify:

- All UI text translates correctly per locale
- No hardcoded strings — labels come from i18n bundles
- Date, time, and number formats match locale
- RTL layout support (if applicable)
- Minimum locales: EN, DE (production)

---

# Accessibility (WCAG 2.1 AA)

Perceivable:
- Visible labels for all form controls
- Contrast ratio: ≥ 4.5:1 for normal text, ≥ 3:1 for large text
- Meaningful alt text for images; ARIA labels on interactive elements

Operable:
- Full keyboard navigation (Tab, Enter, Escape, Arrow keys)
- Focus indicators visible and logical
- No keyboard traps

Understandable:
- Error messages descriptive, not generic
- Language attribute set correctly

---

# Browser & Device Coverage

**Desktop:** Chrome, Firefox, Edge, Safari
**Mobile:** Moon (Android / iOS), BrowserStack
**Tablet:** BrowserStack (Android / iOS) — if required by scope

---

# Evidence

Capture on failure:

- Screenshot of the page state
- Video recording (if configured)
- DOM snapshot at failure point