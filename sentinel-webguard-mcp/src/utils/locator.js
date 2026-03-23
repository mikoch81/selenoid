import pkg from 'selenium-webdriver';
const { By } = pkg;

const STRATEGIES = {
  id: (value) => By.id(value),
  css: (value) => By.css(value),
  xpath: (value) => By.xpath(value),
  name: (value) => By.name(value),
  tag: (value) => By.tagName(value),
  class: (value) => By.className(value),
};

/**
 * Resolve a locator strategy + value into a Selenium By object.
 * @param {string} by - Strategy name
 * @param {string} value - Locator value
 * @returns {By}
 */
export function resolveLocator(by, value) {
  const strategy = STRATEGIES[by?.toLowerCase()];
  if (!strategy) {
    throw new Error(`Unsupported locator strategy: ${by}. Supported: ${Object.keys(STRATEGIES).join(', ')}`);
  }
  return strategy(value);
}

export const LOCATOR_STRATEGIES = Object.keys(STRATEGIES);
