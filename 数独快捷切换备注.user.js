// ==UserScript==
// @name         数独快捷切换备注
// @namespace    FreezeNowSudoku
// @version      1.0
// @description  可以用来快捷切换备注开关，快捷键为小键盘的"."，目前只支持 sudoku.com
// @author       FreezeNow
// @match        *://sudoku.com/*
// @icon         https://sudoku.com/favicon-32x32.png
// @grant        none
// @license MIT
// ==/UserScript==

(function () {
  'use strict';
  const notes = document.querySelector('.game-controls-item[data-action="pencil"]');
  if (notes) {
    document.addEventListener('keydown', (event) => {
      const code = event.code;
      if (code === 'NumpadDecimal') {
        const mousedownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        notes.dispatchEvent(mousedownEvent);
      }
    });
  }
})();
