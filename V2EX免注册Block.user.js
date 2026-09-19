// ==UserScript==
// @name         V2EX免注册Block
// @namespace    FreezeNowV2EXBlock
// @version      1.1
// @description  无需注册便能和你讨厌的人说拜拜，适合和我一样不想注册 账号的拧巴人
// @author       FreezeNow
// @match        *://v2ex.com/*
// @icon         https://www.v2ex.com/static/icon-196.png
// @require      https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js
// @grant        none
// @license MIT
// ==/UserScript==

(function () {
  'use strict';
  localforage.config({ 
    name: 'v2ex-block',
  });
  const blockList = localforage?.getItem('block-list') ?? [];
  

  if (!location.href.includes('https://www.v2ex.com/member')) {
    return;
  }
  const userbox = document.querySelector('#Main>.box td[width="auto"][valign="top"][align="left"]');
  if (!userbox) {
    return;
  }

  const div = document.createAttribute('div');
  div.className = 'fr';
  const input = document.createAttribute('input');
  input.className = 'super normal button';

  const username = userbox.querySelector('h1')?.innerText;
  const canBlock = !blockList.includes(username);

  input.value = canBlock ? 'Block' : 'Unblock';
  input.addEventListener('click', () => {
    if (canBlock) {
      blockList.push(username);
      input.value = 'Unblock';
    } else {
      const index = blockList.findIndex((item) => item === username);
      blockList.splice(index, 1);
      input.value = 'Block';
    }
    localforage.setItem('block-list', blockList);
  });
  div.appendChild(input);
  userbox.appendChild(div);
})();
