import '@testing-library/jest-dom';

globalThis.requestAnimationFrame = (cb) => {
  setTimeout(cb, 16);
  return 0;
};
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
