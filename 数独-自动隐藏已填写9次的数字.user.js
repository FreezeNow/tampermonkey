// ==UserScript==
// @name         数独-自动隐藏已填写9次的数字
// @namespace    FreezeNowSudokuHideNumberButton
// @version      1.0
// @description  可以用来隐藏已在九宫格中存在九个的数字按钮，目前只支持 sudoku.com
// @author       FreezeNow
// @match        *://sudoku.com/*
// @icon         https://sudoku.com/favicon-32x32.png
// @grant        none
// @license MIT
// ==/UserScript==

(function () {
  'use strict';
  const numpadItems = document.querySelectorAll('.numpad-item');
  if (!numpadItems) {
    return;
  }
  document.addEventListener('keydown', async () => {
    // 如果在备注模式，则退出
    const pencilOn = document.querySelector('.pencil-mode');
    if (pencilOn) {
      return;
    }
    // 不延时的话，会导致拿到的是上一步的数据
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, 100);
    });
    const mode = window.mode;
    let info;
    switch (mode) {
      case 'daily': {
        const newDate = new Date();
        const dcDate =
          sessionStorage.getItem('dc-date') ?? `${newDate.getFullYear()}_${newDate.getMonth()}_${newDate.getDate()}`;
        const dailyInfoString = localStorage.getItem('dailyInfo');
        if (!dailyInfoString) {
          return;
        }
        const dailyInfo = JSON.parse(dailyInfoString);
        info = dailyInfo[dcDate];
        break;
      }
      case 'classic': {
        const main_gameString = localStorage.getItem('main_game');
        if (!main_gameString) {
          return;
        }
        info = JSON.parse(main_gameString);
        break;
      }
    }
    if (!info) {
      return;
    }
    const infoValues = info.values;
    const numberMap = {};
    for (let i = 0; i < infoValues.length; i++) {
      const element = infoValues[i];
      const val = element.val;
      if (val) {
        if (!numberMap[val]) {
          numberMap[val] = 0;
        }
        numberMap[val]++;
      }
    }
    for (const number in numberMap) {
      if (Object.hasOwnProperty.call(numberMap, number)) {
        const count = numberMap[number];
        const numpadItem = numpadItems[number - 1];
        if (count === 9) {
          numpadItem.style.opacity = 0.1;
        } else {
          numpadItem.style.opacity = 1;
        }
      }
    }
  });
})();

