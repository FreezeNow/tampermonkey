// ==UserScript==
// @name         B站黑流量与水军检测
// @namespace    FreezeNowBilibiliBlackTrafficDetector
// @version      1.1.0
// @description  精准识别B站评论区中的反华/逆民/阴阳怪气、反米哈游极端黑粉、手机圈商战互黑等黑流量与水军模板，支持全站UP主置信度与通稿矩阵排查、设备交叉比对与自定义规则
// @author       FreezeNow
// @match        *://www.bilibili.com/video/*
// @match        *://www.bilibili.com/list/*
// @match        *://www.bilibili.com/bangumi/play/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @license      MIT
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ==========================================
  // 1. 默认配置与多维度特征词库
  // ==========================================

  const DEFAULT_CONFIG = {
    enabled: true,
    foldSuspects: false, // 是否自动折叠高危评论
    foldThreshold: 60,   // 折叠阈值分 (0-100)
    modules: {
      anti_china: true,         // 反华/逆民/阴阳怪气
      anti_mihoyo: true,        // 二次元/反米哈游黑流量
      smartphone_rivalry: true, // 手机数码圈商战黑公关
      text_clustering: true     // 跨账号模板文案聚类
    },
    // 用户自定义扩展规则（关键词与正则）
    customRules: [],
    // 白名单（UID或关键词，命中则完全不标记）
    whitelist: []
  };

  // 模块一：反华 / 反中 / 逆民与阴阳怪气特征库
  const DICT_ANTI_CHINA = {
    category: 'anti_china',
    label: '🌐 恶意阴阳/逆民',
    color: '#E53935',
    keywords: [
      // 殖人/逆民典型词汇
      '殖人', '润人', '大东亚', '下辈子美利坚', '劣根性', '人种不行', '支黑',
      '反思怪', '人矿', '韭菜论', '下辈子',
      // 阴阳怪气定式反讽
      '偷着乐', '定体问', '这国怎', '厉害了我的', '小粉红', '红小兵',
      '大国自信', '战狼出征', '战狼ptsd', '又赢了', '双赢就是赢两次',
      '责任全在美方', '笑嘻了', '典中典之', '奉旨爱国', '虚假繁荣',
      // 国产突破/自研抹黑
      '自研套壳', '套壳开源', '骗补', '自研大炼钢铁', '瓦房店', '赢麻了',
      '不买不是中国人', '芯片大跃进', '航天作秀', '基建狂魔翻车'
    ],
    regexPatterns: [
      /这(个)?国(家)?(怎么|怎地|怎么了)/,
      /定(是|期)?体制的?问题/,
      /偷着乐吧?/,
      /不买.*不是中国?人/,
      /厉害了(我的)?\w{1,5}/,
      /赢麻了/,
      /战狼(又|开始)?出征/
    ],
    weight: 35
  };

  // 模块二：二次元 / 反米哈游黑流量特征库
  const DICT_ANTI_MIHOYO = {
    category: 'anti_mihoyo',
    label: '🎮 涉米极端引战',
    color: '#8E24AA',
    keywords: [
      // 黑称与群体攻击标签
      '原批', 'op', '米学长', '米孝子', '米解', '米线', '米黑', '结晶粉',
      '仙家军', '米忽悠', '黑暗降临', '买量大户', '米式营销', '买热搜买水军',
      // 典型黑公关话术
      '抄袭萨尔达', '抄袭荒野', '抄袭缝合', '退款维权', '虚空立靶',
      '米哈游法务部', '水军又洗地', '谁玩原神谁', '玩原神玩的', '原神怎么你了',
      '冥潮暴打', '原神暴死', '流水腰斩', '崩铁暴死', '绝区零暴死',
      '开盒恐吓', '挂人开盒', '米门信徒'
    ],
    regexPatterns: [
      /(纯纯的)?结晶粉?/,
      /玩(原神|崩铁|绝区零)玩的/,
      /(原神|崩铁|绝区零)怎么你了/,
      /(米哈游|原神|崩铁).*(暴死|凉透|腰斩)/,
      /抄袭(塞达尔|萨尔达|荒野之息)/,
      /黑(暗)?降临/
    ],
    weight: 35
  };

  // 模块三：手机数码圈商战互黑特征库
  const DICT_SMARTPHONE = {
    category: 'smartphone_rivalry',
    label: '📱 手机圈黑公关',
    color: '#FB8C00',
    keywords: [
      // 小米攻击黑称
      '粗粮', '杂粮', '猴米', '雷猴', '耍猴', '饥饿营销', '买办组装',
      '打胶', '高炉', '屌丝机', '绿化严重', '卡成ppt', '自研打胶', '组装厂',
      // 华为攻击黑称
      '海军', '军训', '沸腾', '沸腾厂', '爱国绑架', '绑架爱国', '爱国营销',
      '智商税', '电子垃圾', '套壳自研', '忽悠营销', '不买就是不爱国', '遥遥领先(讽刺)',
      // 苹果/其他阵营攻击
      '果蛆', '果批', '果粉孝子', '五福一安', '智商税苹果', '厂妹机', '高价低配',
      // 商战控评通用话术
      '公关费拉满', '评测被充值', '收钱办事的', '友商又急了', '某厂水军',
      '虚假宣传', '电子废铁', '买这手机脑子有病'
    ],
    regexPatterns: [
      /爱国(绑架|营销|标签)/,
      /(绑架|强行)爱国/,
      /(耍猴|雷猴|粗粮|杂粮)/,
      /(电子|工业)垃圾/,
      /公关费(真|又)?足/,
      /(某厂|友商)水军(又|开始)?/
    ],
    weight: 35
  };

  // ==========================================
  // 2. 本地配置持久化管理器
  // ==========================================

  class ConfigManager {
    constructor() {
      this.config = this.load();
    }

    load() {
      try {
        let stored = null;
        if (typeof GM_getValue === 'function') {
          stored = GM_getValue('bili_detector_config', null);
        } else {
          stored = localStorage.getItem('bili_detector_config');
        }
        if (stored) {
          const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
          return { ...DEFAULT_CONFIG, ...parsed };
        }
      } catch (e) {
        console.warn('[黑流量检测] 读取配置失败，恢复默认', e);
      }
      return { ...DEFAULT_CONFIG };
    }

    save() {
      try {
        const json = JSON.stringify(this.config);
        if (typeof GM_setValue === 'function') {
          GM_setValue('bili_detector_config', this.config);
        }
        localStorage.setItem('bili_detector_config', json);
      } catch (e) {
        console.error('[黑流量检测] 保存配置失败', e);
      }
    }

    get() {
      return this.config;
    }

    update(partial) {
      this.config = { ...this.config, ...partial };
      this.save();
    }
  }

  const configMgr = new ConfigManager();

  // ==========================================
  // 3. 评论数据缓存池与文本指纹聚类算法
  // ==========================================

  class ReplyStore {
    constructor() {
      this.replies = new Map(); // rpid -> replyData
      this.clusters = [];       // [{ rootRpid, rpids: [], textSample }]
      this.shinglesMap = new Map(); // rpid -> Set of 2-grams
    }

    addReply(reply) {
      if (!reply || !reply.rpid || this.replies.has(String(reply.rpid))) return;
      const rpid = String(reply.rpid);
      this.replies.set(rpid, reply);

      // 计算文本 Shingles (2-gram)
      const msg = reply.message || '';
      if (msg.length >= 6) {
        const shingles = this.createShingles(msg);
        this.shinglesMap.set(rpid, shingles);
        this.checkCluster(rpid, shingles, msg);
      }
    }

    createShingles(text) {
      const clean = text.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
      const set = new Set();
      for (let i = 0; i < clean.length - 1; i++) {
        set.add(clean.slice(i, i + 2));
      }
      return set;
    }

    calcJaccard(setA, setB) {
      if (!setA.size || !setB.size) return 0;
      let intersection = 0;
      for (const item of setA) {
        if (setB.has(item)) intersection++;
      }
      const union = setA.size + setB.size - intersection;
      return union === 0 ? 0 : intersection / union;
    }

    checkCluster(rpid, shingles, text) {
      if (!configMgr.get().modules.text_clustering) return;
      let matchedCluster = null;

      for (const cluster of this.clusters) {
        const rootShingles = this.shinglesMap.get(cluster.rootRpid);
        if (rootShingles) {
          const sim = this.calcJaccard(shingles, rootShingles);
          if (sim >= 0.58) {
            matchedCluster = cluster;
            break;
          }
        }
      }

      if (matchedCluster) {
        matchedCluster.rpids.push(rpid);
      } else {
        this.clusters.push({
          rootRpid: rpid,
          rpids: [rpid],
          textSample: text.slice(0, 30)
        });
      }
    }

    getClusterInfo(rpid) {
      const targetRpid = String(rpid);
      for (const c of this.clusters) {
        if (c.rpids.includes(targetRpid)) {
          return {
            isCluster: c.rpids.length >= 3,
            size: c.rpids.length,
            sample: c.textSample
          };
        }
      }
      return { isCluster: false, size: 0, sample: '' };
    }
  }

  const replyStore = new ReplyStore();

  // ==========================================
  // 4. 多维度黑流量与水军特征检测引擎
  // ==========================================

  class DetectionEngine {
    constructor() {
      this.dictModules = [DICT_ANTI_CHINA, DICT_ANTI_MIHOYO, DICT_SMARTPHONE];
    }

    analyze(reply) {
      const cfg = configMgr.get();
      if (!cfg.enabled) return { isSuspect: false, score: 0, reasons: [] };

      const msg = (reply.message || '').trim();
      const uname = reply.uname || '';
      const mid = String(reply.mid || '');
      const device = reply.device || '';

      // 1. 白名单检查
      if (cfg.whitelist.some(w => w && (mid === w || uname.includes(w) || msg.includes(w)))) {
        return { isSuspect: false, score: 0, reasons: ['白名单用户/内容'] };
      }

      let score = 0;
      const reasons = [];
      const matchedCategories = new Set();

      // 2. 垂直黑流量词库匹配
      for (const dict of this.dictModules) {
        if (!cfg.modules[dict.category]) continue;

        let categoryHits = [];
        for (const kw of dict.keywords) {
          if (msg.toLowerCase().includes(kw.toLowerCase())) {
            categoryHits.push(kw);
          }
        }
        for (const reg of dict.regexPatterns) {
          if (reg.test(msg)) {
            categoryHits.push('特征:' + reg.source.slice(0, 15));
          }
        }

        if (categoryHits.length > 0) {
          matchedCategories.add(dict.category);
          const uniqueHits = Array.from(new Set(categoryHits));
          const hitScore = Math.min(dict.weight + (uniqueHits.length - 1) * 15, 60);
          score += hitScore;
          reasons.push(`${dict.label} (命中: ${uniqueHits.slice(0, 4).join(', ')})`);
        }
      }

      // 3. 用户自定义规则检查
      if (cfg.customRules && cfg.customRules.length > 0) {
        for (const rule of cfg.customRules) {
          if (!rule || !rule.pattern) continue;
          let matched = false;
          if (rule.isRegex) {
            try {
              const reg = new RegExp(rule.pattern, 'i');
              if (reg.test(msg)) matched = true;
            } catch (e) {}
          } else {
            if (msg.toLowerCase().includes(rule.pattern.toLowerCase())) matched = true;
          }

          if (matched) {
            const ruleScore = rule.score || 40;
            score += ruleScore;
            reasons.push(`自定义规则 [${rule.name || rule.pattern}] (+${ruleScore})`);
          }
        }
      }

      // 4. 手机圈机型与言论冲突交叉校验 (Device Cross-check)
      if (cfg.modules.smartphone_rivalry && device) {
        const isXiaomiDevice = /xiaomi|redmi|k\d0/i.test(device);
        const isHuaweiDevice = /huawei|honor|mate|p\d0|nova/i.test(device);
        const isAppleDevice = /iphone|ipad/i.test(device);

        if (isAppleDevice && (msg.includes('粗粮') || msg.includes('猴米') || msg.includes('屌丝机') || msg.includes('自研打胶'))) {
          score += 20;
          reasons.push(`设备交叉异常: 持苹果设备发表极端黑米言论 (+20)`);
        } else if (isXiaomiDevice && (msg.includes('军训') || msg.includes('沸腾厂') || msg.includes('套壳自研') || msg.includes('买办'))) {
          score += 20;
          reasons.push(`设备交叉异常: 持小米设备发表极端黑华言论 (+20)`);
        } else if (isHuaweiDevice && (msg.includes('粗粮') || msg.includes('耍猴') || msg.includes('打胶') || msg.includes('电子废铁'))) {
          score += 20;
          reasons.push(`设备交叉异常: 持华为设备发表极端黑米言论 (+20)`);
        }
      }

      // 5. 跨账号文本模板聚类 (Shingle Clustering)
      if (cfg.modules.text_clustering) {
        const clusterInfo = replyStore.getClusterInfo(reply.rpid);
        if (clusterInfo.isCluster) {
          score += 35;
          reasons.push(`🤖 模板文案聚类 (发现 ${clusterInfo.size} 人发布极高雷同通稿)`);
        }
      }

      // 6. 账号资产维度微调
      const level = reply.level ?? 0;
      const fansDetail = reply.fans_detail;
      const isDefaultAvatar = !reply.avatar || reply.avatar.includes('noface');

      if (level <= 2 && score >= 30) {
        score += 15;
        reasons.push(`账号等级极低 (Lv${level}, +15)`);
      } else if (level >= 4 && !fansDetail && !reply.sign && score >= 30) {
        score += 10;
        reasons.push(`养号高危特征 (Lv${level}但零粉丝牌零签名, +10)`);
      }

      if (isDefaultAvatar && score >= 20) {
        score += 10;
        reasons.push('默认无头像 (+10)');
      }

      // 7. 白名单扣分/路人保护
      if (reply.is_up_liked) {
        score -= 40;
        reasons.push('UP主点赞认可 (-40)');
      }
      if (fansDetail && fansDetail.level >= 5) {
        score -= 20;
        reasons.push(`佩戴粉丝勋章 Lv${fansDetail.level} (-20)`);
      }

      score = Math.max(0, Math.min(100, score));

      return {
        isSuspect: score >= 45,
        score,
        categories: Array.from(matchedCategories),
        reasons
      };
    }
  }

  const detector = new DetectionEngine();

  // ==========================================
  // 5. 原生请求沙箱穿透与数据拦截机制
  // ==========================================

  function parseReplyItem(item) {
    if (!item) return null;
    return {
      rpid: String(item.rpid || item.id_str || ''),
      mid: item.mid,
      uname: item.member?.uname || '',
      avatar: item.member?.avatar || '',
      level: item.member?.level_info?.current_level ?? 0,
      sign: item.member?.sign || '',
      fans_detail: item.member?.fans_detail,
      message: item.content?.message || '',
      device: item.content?.device || '',
      location: item.reply_control?.location || '',
      like: item.like || 0,
      rcount: item.count || 0,
      ctime: item.ctime || 0,
      is_up_liked: !!item.reply_control?.is_up_liked
    };
  }

  function handleReplyData(json) {
    if (!json || json.code !== 0 || !json.data) return;
    const data = json.data;
    const items = [];

    if (Array.isArray(data.replies)) {
      data.replies.forEach(r => items.push(r));
    }
    if (Array.isArray(data.top_replies)) {
      data.top_replies.forEach(r => items.push(r));
    }
    if (Array.isArray(data.hots)) {
      data.hots.forEach(r => items.push(r));
    }

    items.forEach(raw => {
      const parsed = parseReplyItem(raw);
      if (parsed) {
        replyStore.addReply(parsed);
      }
      if (Array.isArray(raw.replies)) {
        raw.replies.forEach(subRaw => {
          const subParsed = parseReplyItem(subRaw);
          if (subParsed) {
            replyStore.addReply(subParsed);
          }
        });
      }
    });

    updateDashboard();
    scheduleDOMScan();
  }

  // 穿透油猴沙箱：向页面主世界注入劫持脚本 + 监听通信事件
  function injectMainWorldHook() {
    const script = document.createElement('script');
    script.textContent = `(${function () {
      const dispatchData = (json) => {
        if (!json || json.code !== 0 || !json.data) return;
        window.dispatchEvent(new CustomEvent('__BILI_REPLY_INTERCEPT__', {
          detail: JSON.stringify(json)
        }));
      };

      // 1. Hook 主世界 fetch
      const rawFetch = window.fetch;
      window.fetch = async function (...args) {
        const res = await rawFetch.apply(this, args);
        try {
          const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
          if (url && (url.includes('/x/v2/reply') || url.includes('/x/v2/reply/wbi/main'))) {
            res.clone().json().then(dispatchData).catch(() => {});
          }
        } catch (e) {}
        return res;
      };

      // 2. Hook 主世界 XHR
      const rawOpen = XMLHttpRequest.prototype.open;
      const rawSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, u, ...rest) {
        this._bili_url = u;
        return rawOpen.call(this, m, u, ...rest);
      };
      XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener('load', function () {
          try {
            if (this._bili_url && (this._bili_url.includes('/x/v2/reply') || this._bili_url.includes('/x/v2/reply/wbi/main'))) {
              dispatchData(JSON.parse(this.responseText));
            }
          } catch (e) {}
        });
        return rawSend.apply(this, args);
      };
    }.toString()})();`;

    (document.head || document.documentElement).appendChild(script);
    script.remove();

    // 监听来自主世界的通信事件
    window.addEventListener('__BILI_REPLY_INTERCEPT__', (e) => {
      try {
        const json = JSON.parse(e.detail);
        handleReplyData(json);
      } catch (err) {}
    });

    // 同时在 unsafeWindow（如果存在）挂载劫持作为双重保护
    const targetWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (targetWin && targetWin !== window) {
      try {
        const origFetch = targetWin.fetch;
        targetWin.fetch = async function (...args) {
          const res = await origFetch.apply(this, args);
          try {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
            if (url && (url.includes('/x/v2/reply') || url.includes('/x/v2/reply/wbi/main'))) {
              res.clone().json().then(handleReplyData).catch(() => {});
            }
          } catch (e) {}
          return res;
        };
      } catch (e) {}
    }
  }

  injectMainWorldHook();

  // ==========================================
  // 6. 轻量级 MD5 与 WBI 签名算法模块
  // ==========================================

  const MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
  ];

  function calcMD5(string) {
    function rotateLeft(lValue, iShiftBits) {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
      const lX8 = (lX & 0x80000000), lY8 = (lY & 0x80000000);
      const lX4 = (lX & 0x40000000), lY4 = (lY & 0x40000000);
      const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
      if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
      if (lX4 | lY4) {
        if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
        else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
      } else return (lResult ^ lX8 ^ lY8);
    }
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }
    function FF(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function GG(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function HH(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function II(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    string = unescape(encodeURIComponent(string));
    const lMessageLength = string.length;
    const lNumberOfWords = (((lMessageLength + 8) - ((lMessageLength + 8) % 64)) / 64 + 1) * 16;
    const x = Array(lNumberOfWords - 1);
    let lBytePosition = 0, lByteCount = 0;
    while (lByteCount < lMessageLength) {
      const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      x[lWordCount] = (x[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    x[lWordCount] = (x[lWordCount] | (0x80 << lBytePosition));
    x[lNumberOfWords - 2] = lMessageLength << 3;
    x[lNumberOfWords - 1] = lMessageLength >>> 29;

    let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
    for (let k = 0; k < x.length; k += 16) {
      const AA = a, BB = b, CC = c, DD = d;
      a = FF(a, b, c, d, x[k + 0], 7, 0xD76AA478); d = FF(d, a, b, c, x[k + 1], 12, 0xE8C7B756);
      c = FF(c, d, a, b, x[k + 2], 17, 0x242070DB); b = FF(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
      a = FF(a, b, c, d, x[k + 4], 7, 0xF57C0FAF); d = FF(d, a, b, c, x[k + 5], 12, 0x4787C62A);
      c = FF(c, d, a, b, x[k + 6], 17, 0xA8304613); b = FF(b, c, d, a, x[k + 7], 22, 0xFD469501);
      a = FF(a, b, c, d, x[k + 8], 7, 0x698098D8); d = FF(d, a, b, c, x[k + 9], 12, 0x8B44F7AF);
      c = FF(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1); b = FF(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
      a = FF(a, b, c, d, x[k + 12], 7, 0x6B901122); d = FF(d, a, b, c, x[k + 13], 12, 0xFD987193);
      c = FF(c, d, a, b, x[k + 14], 17, 0xA679438E); b = FF(b, c, d, a, x[k + 15], 22, 0x49B40821);

      a = GG(a, b, c, d, x[k + 1], 5, 0xF61E2562); d = GG(d, a, b, c, x[k + 6], 9, 0xC040B340);
      c = GG(c, d, a, b, x[k + 11], 14, 0x265E5A51); b = GG(b, c, d, a, x[k + 0], 20, 0xE9B6C7AA);
      a = GG(a, b, c, d, x[k + 5], 5, 0xD62F105D); d = GG(d, a, b, c, x[k + 10], 9, 0x2441453);
      c = GG(c, d, a, b, x[k + 15], 14, 0xD8A1E681); b = GG(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
      a = GG(a, b, c, d, x[k + 9], 5, 0x21E1CDE6); d = GG(d, a, b, c, x[k + 14], 9, 0xC33707D6);
      c = GG(c, d, a, b, x[k + 3], 14, 0xF4D50D87); b = GG(b, c, d, a, x[k + 8], 20, 0x455A14ED);
      a = GG(a, b, c, d, x[k + 13], 5, 0xA9E3E905); d = GG(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8);
      c = GG(c, d, a, b, x[k + 7], 14, 0x676F02D9); b = GG(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);

      a = HH(a, b, c, d, x[k + 5], 4, 0xFFFA3942); d = HH(d, a, b, c, x[k + 8], 11, 0x8771F681);
      c = HH(c, d, a, b, x[k + 11], 16, 0x6D9D6122); b = HH(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
      a = HH(a, b, c, d, x[k + 1], 4, 0xA4BEEA44); d = HH(d, a, b, c, x[k + 4], 11, 0x4BDECFA9);
      c = HH(c, d, a, b, x[k + 7], 16, 0xF6BB4B60); b = HH(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
      a = HH(a, b, c, d, x[k + 13], 4, 0x289B7EC6); d = HH(d, a, b, c, x[k + 0], 11, 0xEAA127FA);
      c = HH(c, d, a, b, x[k + 3], 16, 0xD4EF3085); b = HH(b, c, d, a, x[k + 6], 23, 0x4881D05);
      a = HH(a, b, c, d, x[k + 9], 4, 0xD9D4D039); d = HH(d, a, b, c, x[k + 12], 11, 0xE6DB99E5);
      c = HH(c, d, a, b, x[k + 15], 16, 0x1FA27CF8); b = HH(b, c, d, a, x[k + 2], 23, 0xC4AC5665);

      a = II(a, b, c, d, x[k + 0], 6, 0xF4292244); d = II(d, a, b, c, x[k + 7], 10, 0x432AFF97);
      c = II(c, d, a, b, x[k + 14], 15, 0xAB9423A7); b = II(b, c, d, a, x[k + 5], 21, 0xFC93A039);
      a = II(a, b, c, d, x[k + 12], 6, 0x655B59C3); d = II(d, a, b, c, x[k + 3], 10, 0x8F0CCC92);
      c = II(c, d, a, b, x[k + 10], 15, 0xFFEFF47D); b = II(b, c, d, a, x[k + 1], 21, 0x85845DD1);
      a = II(a, b, c, d, x[k + 8], 6, 0x6FA87E4F); d = II(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0);
      c = II(c, d, a, b, x[k + 6], 15, 0xA3014314); b = II(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
      a = II(a, b, c, d, x[k + 4], 6, 0xF7537E82); d = II(d, a, b, c, x[k + 11], 10, 0xBD3AF235);
      c = II(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB); b = II(b, c, d, a, x[k + 9], 21, 0xEB86D391);

      a = addUnsigned(a, AA); b = addUnsigned(b, BB);
      c = addUnsigned(c, CC); d = addUnsigned(d, DD);
    }
    const toHex = (val) => {
      let str = "";
      for (let i = 0; i <= 3; i++) {
        const byte = (val >>> (i * 8)) & 255;
        str += ("0" + byte.toString(16)).slice(-2);
      }
      return str;
    };
    return (toHex(a) + toHex(b) + toHex(c) + toHex(d)).toLowerCase();
  }

  // 获取 Wbi 签名密钥
  async function getWbiKeys() {
    try {
      const res = await fetch('https://api.bilibili.com/x/web-interface/nav', { credentials: 'include' });
      const json = await res.json();
      if (json.code === 0 && json.data?.wbi_img) {
        const img = json.data.wbi_img.img_url.split('/').pop().split('.')[0];
        const sub = json.data.wbi_img.sub_url.split('/').pop().split('.')[0];
        return { img, sub };
      }
    } catch (e) {}
    // 降级兜底备用 key
    return { img: '67546de4eed44a2cad6625287a5454cc', sub: '8484e16101f341a8832d1ee1081f04f5' };
  }

  // 计算 Wbi 请求参数
  async function signWbiQuery(params) {
    const { img, sub } = await getWbiKeys();
    const rawKey = img + sub;
    let mixinKey = '';
    MIXIN_KEY_ENC_TAB.forEach(n => {
      if (n < rawKey.length) mixinKey += rawKey[n];
    });
    mixinKey = mixinKey.slice(0, 32);

    const wts = Math.round(Date.now() / 1000);
    const newParams = { ...params, wts };

    // 排序
    const sortedKeys = Object.keys(newParams).sort();
    let queryStr = '';
    for (const k of sortedKeys) {
      const val = String(newParams[k]).replace(/[!'()*]/g, '');
      queryStr += `${encodeURIComponent(k)}=${encodeURIComponent(val)}&`;
    }
    queryStr = queryStr.slice(0, -1);

    const w_rid = calcMD5(queryStr + mixinKey);
    return `${queryStr}&w_rid=${w_rid}`;
  }

  // ==========================================
  // 7. UP主置信度与通稿矩阵排查引擎
  // ==========================================

  async function checkUpAndMatrixCredibility() {
    // 1. 获取当前视频标题与 UP 信息
    const titleEl = document.querySelector('h1.video-title') || document.querySelector('.video-title');
    let title = (titleEl ? titleEl.innerText : document.title) || '';
    title = title.replace(/_哔哩哔哩_bilibili.*/, '').trim();

    const upEl = document.querySelector('.up-name') || document.querySelector('.up-detail .name') || document.querySelector('.username');
    const currentUp = (upEl ? upEl.innerText.trim() : '') || '当前UP主';
    const currentBvid = (location.pathname.match(/(BV\w+)/i) || [])[1] || '';

    // 提取清洗核心检索词（去除括号、井号与标签）
    const cleanKeyword = title
      .replace(/【.*?】|\[.*?\]|#.*?#|（.*?）|\(.*?\)/g, ' ')
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join(' ') || title.slice(0, 15);

    openMatrixReportModal({
      state: 'loading',
      title,
      cleanKeyword,
      currentUp,
      currentBvid
    });

    try {
      // 2. 发起签名搜索接口请求
      const signedQuery = await signWbiQuery({
        keyword: cleanKeyword,
        search_type: 'video',
        order: 'totalrank',
        page: 1,
        page_size: 30
      });

      const resp = await fetch(`https://api.bilibili.com/x/web-interface/wbi/search/type?${signedQuery}`, {
        credentials: 'include'
      });
      const data = await resp.json();

      if (data.code !== 0 || !data.data?.result) {
        throw new Error(data.message || '获取搜索数据失败');
      }

      const results = data.data.result;
      const similarVideos = [];

      // 3. 计算标题重合度与矩阵特征
      const currentShingles = replyStore.createShingles(title);

      for (const item of results) {
        // 排除自身
        if (item.bvid === currentBvid) continue;
        const itemTitle = (item.title || '').replace(/<[^>]+>/g, '').trim();
        const itemShingles = replyStore.createShingles(itemTitle);
        const similarity = replyStore.calcJaccard(currentShingles, itemShingles);

        // 如果标题相似度高于 0.45 或包含完全相同的核心通稿句式
        if (similarity >= 0.45 || (cleanKeyword.length >= 6 && itemTitle.includes(cleanKeyword))) {
          similarVideos.push({
            title: itemTitle,
            author: item.author,
            bvid: item.bvid,
            pubdate: item.pubdate ? new Date(item.pubdate * 1000).toLocaleDateString() : '未知',
            play: item.play || 0,
            similarity: Math.round(similarity * 100)
          });
        }
      }

      // 按相似度降序排序
      similarVideos.sort((a, b) => b.similarity - a.similarity);

      // 4. 判定置信度等级
      let level = 'safe';
      let verdictTitle = '🟢 置信度高 (独立原创UP主)';
      let verdictDesc = '全站未检索到高度雷同标题通稿，内容具有较高的独立性与独创性。';

      if (similarVideos.length >= 3) {
        level = 'danger';
        verdictTitle = '🔴 高危通稿矩阵 (疑似公关买量/矩阵号批量洗版)';
        verdictDesc = `检测到全站至少有 ${similarVideos.length} 个不同账号在近期发布高度雷同标题的视频！具有强烈的公关通稿铺量、商战抹黑或MCN矩阵引战嫌疑。`;
      } else if (similarVideos.length >= 1) {
        level = 'warn';
        verdictTitle = '🟡 中度可疑 (存在撞题或跟风炒作)';
        verdictDesc = `发现 ${similarVideos.length} 个雷同标题视频，可能为同行热点撞题、跟风炒作或素材二次搬运。`;
      }

      openMatrixReportModal({
        state: 'done',
        title,
        cleanKeyword,
        currentUp,
        currentBvid,
        level,
        verdictTitle,
        verdictDesc,
        similarVideos
      });

    } catch (err) {
      openMatrixReportModal({
        state: 'error',
        title,
        cleanKeyword,
        currentUp,
        error: err.message
      });
    }
  }

  // 渲染矩阵排查报告模态弹窗
  function openMatrixReportModal(data) {
    let modal = document.getElementById('bili-matrix-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bili-matrix-modal';
      document.body.appendChild(modal);
    }

    if (data.state === 'loading') {
      modal.innerHTML = `
        <div class="bili-modal-content" style="width: 580px;">
          <div class="bili-modal-header">
            <span>🔍 UP主置信度与通稿矩阵排查</span>
            <button class="bili-dash-btn" onclick="document.getElementById('bili-matrix-modal').remove()">✕</button>
          </div>
          <div class="bili-modal-body" style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 32px; margin-bottom: 12px; animation: spin 1s infinite linear;">🔄</div>
            <div style="font-weight: 600; font-size: 15px;">正在全站检索雷同视频与通稿矩阵...</div>
            <div style="color: #888; font-size: 12px; margin-top: 6px;">正在比对标题: "${data.cleanKeyword}"</div>
          </div>
        </div>
      `;
      return;
    }

    if (data.state === 'error') {
      modal.innerHTML = `
        <div class="bili-modal-content" style="width: 580px;">
          <div class="bili-modal-header">
            <span>🔍 UP主置信度与通稿矩阵排查</span>
            <button class="bili-dash-btn" onclick="document.getElementById('bili-matrix-modal').remove()">✕</button>
          </div>
          <div class="bili-modal-body" style="padding: 24px;">
            <div style="color: #f5222d; font-weight: 600; margin-bottom: 8px;">排查请求失败：${data.error}</div>
            <div style="color: #888;">可能触发了B站临时搜索风控或网络波动，请稍后再试。</div>
          </div>
        </div>
      `;
      return;
    }

    // Done 状态渲染
    const badgeBg = data.level === 'danger' ? '#f5222d' : data.level === 'warn' ? '#faad14' : '#52c41a';
    modal.innerHTML = `
      <div class="bili-modal-content" style="width: 640px;">
        <div class="bili-modal-header">
          <span>🔍 UP主置信度与通稿矩阵排查报告</span>
          <button class="bili-dash-btn" onclick="document.getElementById('bili-matrix-modal').remove()">✕</button>
        </div>
        <div class="bili-modal-body">
          <div style="background: #f6f7f8; padding: 12px 14px; border-radius: 8px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">当前视频: ${data.title}</div>
            <div style="color: #61666d; font-size: 12px;">发布者: <b>${data.currentUp}</b> (BV: ${data.currentBvid})</div>
          </div>

          <div style="border-left: 4px solid ${badgeBg}; background: #fafafa; padding: 12px 14px; border-radius: 4px;">
            <div style="font-weight: 700; font-size: 15px; color: ${badgeBg}; margin-bottom: 4px;">${data.verdictTitle}</div>
            <div style="color: #555; line-height: 1.5;">${data.verdictDesc}</div>
          </div>

          <div class="bili-setting-group">
            <div class="bili-setting-title">全站雷同标题与疑似矩阵视频清单 (${data.similarVideos.length})</div>
            ${data.similarVideos.length === 0 ? `
              <div style="color: #52c41a; padding: 12px; text-align: center;">✅ 全站暂未发现其他同质化雷同通稿视频</div>
            ` : `
              <div class="bili-rule-list" style="max-height: 240px; padding: 0;">
                ${data.similarVideos.map(v => `
                  <div style="padding: 10px 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1; margin-right: 12px;">
                      <a href="https://www.bilibili.com/video/${v.bvid}" target="_blank" style="color: #00AEEC; font-weight: 500; text-decoration: none; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">
                        ${v.title}
                      </a>
                      <div style="font-size: 11px; color: #888; margin-top: 4px;">
                        UP主: <b>${v.author}</b> | 发布: ${v.pubdate} | 播放: ${v.play}
                      </div>
                    </div>
                    <span style="background: #fff1f0; color: #cf1322; border: 1px solid #ffa39e; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap;">
                      雷同度 ${v.similarity}%
                    </span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
        <div class="bili-modal-footer">
          <button class="bili-btn-primary" onclick="document.getElementById('bili-matrix-modal').remove()">关闭</button>
        </div>
      </div>
    `;
  }

  // ==========================================
  // 8. UI 交互看板与评论区 DOM 回退解析
  // ==========================================

  const STYLES = `
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    #bili-detector-dashboard {
      position: fixed;
      bottom: 80px;
      right: 25px;
      z-index: 999999;
      background: #ffffff;
      border: 1px solid #e3e5e7;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      color: #18191c;
      width: 280px;
      transition: all 0.3s ease;
      overflow: hidden;
    }
    #bili-detector-dashboard.minimized {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
    }
    #bili-detector-dashboard.minimized .bili-dash-body,
    #bili-detector-dashboard.minimized .bili-dash-header span {
      display: none;
    }
    #bili-detector-dashboard.minimized .bili-dash-header {
      padding: 0;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #00AEEC;
      color: #ffffff;
      border-radius: 50%;
    }
    .bili-dash-header {
      padding: 10px 14px;
      background: #f6f7f8;
      border-bottom: 1px solid #e3e5e7;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 600;
    }
    .bili-dash-header .dash-title {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #00AEEC;
    }
    .bili-dash-controls {
      display: flex;
      gap: 8px;
    }
    .bili-dash-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 13px;
      color: #61666d;
      padding: 2px 4px;
      border-radius: 4px;
    }
    .bili-dash-btn:hover {
      background: #e3e5e7;
      color: #18191c;
    }
    .bili-dash-body {
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bili-stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }
    .bili-stat-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      color: #fff;
    }
    .bili-stat-badge.safe { background: #52c41a; }
    .bili-stat-badge.warn { background: #faad14; }
    .bili-stat-badge.danger { background: #f5222d; }
    .bili-filter-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px dashed #e3e5e7;
      padding-top: 8px;
      margin-top: 4px;
      font-size: 12px;
      color: #61666d;
    }

    /* 评论行角标 */
    .bili-traffic-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 6px;
      margin-left: 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      vertical-align: middle;
      border: 1px solid transparent;
      user-select: none;
      position: relative;
    }
    .bili-traffic-tag.danger {
      background: #fff1f0;
      color: #cf1322;
      border-color: #ffa39e;
    }
    .bili-traffic-tag.warn {
      background: #fffbe6;
      color: #d48806;
      border-color: #ffe58f;
    }
    .bili-traffic-tag.cluster {
      background: #e6f7ff;
      color: #096dd9;
      border-color: #91d5ff;
    }

    .bili-reply-folded {
      opacity: 0.35;
      transition: opacity 0.2s;
    }
    .bili-reply-folded:hover {
      opacity: 0.85;
    }

    /* 弹窗通用样式 */
    #bili-detector-modal, #bili-matrix-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.45);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bili-modal-content {
      background: #fff;
      width: 520px;
      max-width: 92vw;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      max-height: 85vh;
    }
    .bili-modal-header {
      padding: 16px 20px;
      background: #f6f7f8;
      border-bottom: 1px solid #e3e5e7;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      font-size: 15px;
    }
    .bili-modal-body {
      padding: 18px 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-size: 13px;
    }
    .bili-setting-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bili-setting-title {
      font-weight: 600;
      color: #18191c;
      border-left: 3px solid #00AEEC;
      padding-left: 6px;
    }
    .bili-rule-list {
      max-height: 140px;
      overflow-y: auto;
      border: 1px solid #e3e5e7;
      border-radius: 6px;
      padding: 6px;
    }
    .bili-rule-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 6px;
      background: #f6f7f8;
      border-radius: 4px;
      margin-bottom: 4px;
    }
    .bili-modal-footer {
      padding: 12px 20px;
      background: #f6f7f8;
      border-top: 1px solid #e3e5e7;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .bili-btn-primary {
      background: #00AEEC;
      color: #fff;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }
    .bili-btn-primary:hover { background: #009cd3; }
    .bili-btn-default {
      background: #fff;
      color: #61666d;
      border: 1px solid #e3e5e7;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
    }
    .bili-btn-default:hover { background: #f6f7f8; }
    .bili-btn-action {
      background: #fff0f6;
      color: #eb2f96;
      border: 1px solid #ffadd2;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      width: 100%;
      text-align: center;
    }
    .bili-btn-action:hover {
      background: #eb2f96;
      color: #fff;
    }
  `;

  function injectStyles() {
    if (document.getElementById('bili-detector-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'bili-detector-styles';
    styleEl.textContent = STYLES;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  function renderDashboard() {
    if (document.getElementById('bili-detector-dashboard')) return;
    injectStyles();

    const dash = document.createElement('div');
    dash.id = 'bili-detector-dashboard';
    dash.innerHTML = `
      <div class="bili-dash-header">
        <div class="dash-title">
          <span>🛡️</span>
          <span>黑流量检测器</span>
        </div>
        <div class="bili-dash-controls">
          <button class="bili-dash-btn" id="bili-btn-settings" title="规则设置">⚙️</button>
          <button class="bili-dash-btn" id="bili-btn-minimize" title="最小化">−</button>
        </div>
      </div>
      <div class="bili-dash-body">
        <div class="bili-stat-row">
          <span>已捕获评论:</span>
          <strong id="bili-stat-total">0</strong>
        </div>
        <div class="bili-stat-row">
          <span>黑流量疑似率:</span>
          <span class="bili-stat-badge safe" id="bili-stat-ratio">0.0% (正常)</span>
        </div>
        <div class="bili-stat-row" style="font-size: 11px; color: #888;">
          <span>🌐 涉华: <b id="cnt-china">0</b></span>
          <span>🎮 涉米: <b id="cnt-mihoyo">0</b></span>
          <span>📱 手机: <b id="cnt-phone">0</b></span>
        </div>
        <div class="bili-stat-row" style="font-size: 11px; color: #888;">
          <span>🤖 模板水军聚类: <b id="cnt-cluster">0</b> 组</span>
        </div>

        <button class="bili-btn-action" id="bili-btn-check-up">
          🔍 排查UP主与通稿矩阵
        </button>

        <div class="bili-filter-toggle">
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
            <input type="checkbox" id="bili-chk-fold"> 自动淡化/折叠可疑评论
          </label>
        </div>
      </div>
    `;

    document.body.appendChild(dash);

    const btnMin = dash.querySelector('#bili-btn-minimize');
    btnMin.addEventListener('click', (e) => {
      e.stopPropagation();
      dash.classList.toggle('minimized');
      btnMin.textContent = dash.classList.contains('minimized') ? '🛡️' : '−';
    });

    dash.addEventListener('click', () => {
      if (dash.classList.contains('minimized')) {
        dash.classList.remove('minimized');
        btnMin.textContent = '−';
      }
    });

    dash.querySelector('#bili-btn-settings').addEventListener('click', (e) => {
      e.stopPropagation();
      openSettingsModal();
    });

    dash.querySelector('#bili-btn-check-up').addEventListener('click', (e) => {
      e.stopPropagation();
      checkUpAndMatrixCredibility();
    });

    const chkFold = dash.querySelector('#bili-chk-fold');
    chkFold.checked = configMgr.get().foldSuspects;
    chkFold.addEventListener('change', () => {
      configMgr.update({ foldSuspects: chkFold.checked });
      scheduleDOMScan();
    });
  }

  function updateDashboard() {
    renderDashboard();
    const totalEl = document.getElementById('bili-stat-total');
    const ratioEl = document.getElementById('bili-stat-ratio');
    if (!totalEl || !ratioEl) return;

    let total = 0;
    let suspectCount = 0;
    let countChina = 0;
    let countMihoyo = 0;
    let countPhone = 0;

    for (const [rpid, reply] of replyStore.replies.entries()) {
      total++;
      const result = detector.analyze(reply);
      if (result.isSuspect) {
        suspectCount++;
        if (result.categories.includes('anti_china')) countChina++;
        if (result.categories.includes('anti_mihoyo')) countMihoyo++;
        if (result.categories.includes('smartphone_rivalry')) countPhone++;
      }
    }

    totalEl.textContent = String(total);
    document.getElementById('cnt-china').textContent = String(countChina);
    document.getElementById('cnt-mihoyo').textContent = String(countMihoyo);
    document.getElementById('cnt-phone').textContent = String(countPhone);
    document.getElementById('cnt-cluster').textContent = String(replyStore.clusters.filter(c => c.rpids.length >= 3).length);

    if (total === 0) {
      ratioEl.textContent = '0.0% (等待中)';
      ratioEl.className = 'bili-stat-badge safe';
    } else {
      const ratio = (suspectCount / total) * 100;
      ratioEl.textContent = `${ratio.toFixed(1)}% (${suspectCount}条)`;
      if (ratio > 25) {
        ratioEl.className = 'bili-stat-badge danger';
      } else if (ratio > 10) {
        ratioEl.className = 'bili-stat-badge warn';
      } else {
        ratioEl.className = 'bili-stat-badge safe';
      }
    }
  }

  // ==========================================
  // 9. DOM 观察与主动文本解析回退 (确保绝不显示 0%)
  // ==========================================

  let scanTimer = null;
  function scheduleDOMScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAndTagComments, 200);
  }

  // 从 DOM 节点深度提取评论要素（穿透 Shadow DOM 与普通节点）
  function extractCommentFromNode(node) {
    const root = node.shadowRoot || node;
    let rpid = node.getAttribute('data-id') || node.getAttribute('data-rpid') || node.id;
    if (!rpid) {
      const sub = root.querySelector('[data-id], [data-rpid]');
      if (sub) rpid = sub.getAttribute('data-id') || sub.getAttribute('data-rpid');
    }

    const userEl = root.querySelector('.user-name, #user-name, .name, [data-user-id]');
    const contentEl = root.querySelector('.reply-content, #content, .text, .root-reply-content');
    const uname = userEl ? userEl.innerText.trim() : '';
    let text = contentEl ? contentEl.innerText.trim() : '';

    // 如果未定位到特定 contentEl，降级从 innerText 提取
    if (!text && node.innerText) {
      const lines = node.innerText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        text = lines.slice(1).join(' ');
      }
    }

    return {
      rpid: rpid ? String(rpid) : null,
      userEl,
      contentEl,
      uname,
      text
    };
  }

  function scanAndTagComments() {
    const cfg = configMgr.get();
    if (!cfg.enabled) return;

    // 适配所有已知 B 站评论容器
    const commentNodes = document.querySelectorAll(`
      bili-comment-thread-renderer,
      bili-comment-renderer,
      bili-comment-reply-renderer,
      .reply-item,
      .sub-reply-item
    `);

    let newFound = false;

    commentNodes.forEach(node => {
      const { rpid, userEl, contentEl, uname, text } = extractCommentFromNode(node);
      if (!text) return;

      // 寻找内存中已有的评论对象
      let replyData = null;
      if (rpid && replyStore.replies.has(rpid)) {
        replyData = replyStore.replies.get(rpid);
      } else {
        // 主动兜底回退：如果网络拦截未覆盖，直接将 DOM 中的评论文本转换为内存对象！
        const synthId = rpid || 'synth_' + calcMD5(uname + '_' + text).slice(0, 16);
        replyData = {
          rpid: synthId,
          mid: 0,
          uname: uname || '路人用户',
          avatar: '',
          level: 3,
          message: text,
          device: '',
          location: '',
          like: 0,
          rcount: 0,
          ctime: Math.round(Date.now() / 1000)
        };
        replyStore.addReply(replyData);
        newFound = true;
      }

      if (!replyData) return;

      const analysis = detector.analyze(replyData);
      const root = node.shadowRoot || node;
      const targetHeader = userEl || root.querySelector('.user-info') || root;

      // 移除已存在的标签
      const oldTag = root.querySelector('.bili-traffic-tag');
      if (oldTag) oldTag.remove();

      if (analysis.isSuspect) {
        const tag = document.createElement('span');
        let tagClass = 'warn';
        let mainTagText = '⚠️ 疑似黑流量';

        if (analysis.categories.includes('anti_china')) {
          tagClass = 'danger';
          mainTagText = '🌐 涉华阴阳/逆民';
        } else if (analysis.categories.includes('anti_mihoyo')) {
          tagClass = 'danger';
          mainTagText = '🎮 涉米引战';
        } else if (analysis.categories.includes('smartphone_rivalry')) {
          tagClass = 'warn';
          mainTagText = '📱 手机圈黑公关';
        } else if (analysis.reasons.some(r => r.includes('模板文案聚类'))) {
          tagClass = 'cluster';
          mainTagText = '🤖 模板文案水军';
        }

        tag.className = `bili-traffic-tag ${tagClass}`;
        tag.textContent = `${mainTagText} (${analysis.score}分)`;
        tag.title = `【判定依据】\n` + analysis.reasons.join('\n');

        tag.addEventListener('click', (e) => {
          e.stopPropagation();
          alert(`【黑流量检测详情】\n账号: ${replyData.uname} (Lv${replyData.level})\n综合风险分: ${analysis.score}\n\n命中规则:\n${analysis.reasons.join('\n')}`);
        });

        if (targetHeader && targetHeader.parentNode) {
          targetHeader.parentNode.insertBefore(tag, targetHeader.nextSibling);
        }

        if (cfg.foldSuspects && analysis.score >= cfg.foldThreshold) {
          node.classList.add('bili-reply-folded');
        } else {
          node.classList.remove('bili-reply-folded');
        }
      } else {
        node.classList.remove('bili-reply-folded');
      }
    });

    if (newFound) {
      updateDashboard();
    }
  }

  // 监听 DOM 树变化
  const domObserver = new MutationObserver(() => {
    scheduleDOMScan();
  });

  domObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // ==========================================
  // 10. 规则设置模态窗口
  // ==========================================

  function openSettingsModal() {
    if (document.getElementById('bili-detector-modal')) return;
    const cfg = configMgr.get();

    const modal = document.createElement('div');
    modal.id = 'bili-detector-modal';
    modal.innerHTML = `
      <div class="bili-modal-content">
        <div class="bili-modal-header">
          <span>⚙️ B站黑流量与水军检测 - 规则配置</span>
          <button class="bili-dash-btn" id="bili-modal-close" style="font-size:16px;">✕</button>
        </div>
        <div class="bili-modal-body">
          <div class="bili-setting-group">
            <div class="bili-setting-title">检测模块开关</div>
            <label style="display:flex;align-items:center;gap:6px;">
              <input type="checkbox" id="chk-mod-china" ${cfg.modules.anti_china ? 'checked' : ''}>
              <b>🌐 反华 / 反中 / 逆民与阴阳怪气检测</b>
            </label>
            <label style="display:flex;align-items:center;gap:6px;">
              <input type="checkbox" id="chk-mod-mihoyo" ${cfg.modules.anti_mihoyo ? 'checked' : ''}>
              <b>🎮 二次元 / 反米哈游黑流量与派系恶臭引战</b>
            </label>
            <label style="display:flex;align-items:center;gap:6px;">
              <input type="checkbox" id="chk-mod-phone" ${cfg.modules.smartphone_rivalry ? 'checked' : ''}>
              <b>📱 手机数码圈商战黑公关与发帖设备冲突比对</b>
            </label>
            <label style="display:flex;align-items:center;gap:6px;">
              <input type="checkbox" id="chk-mod-cluster" ${cfg.modules.text_clustering ? 'checked' : ''}>
              <b>🤖 跨账号 Shingle 文本模板指纹聚类 (揪出通稿工作室)</b>
            </label>
          </div>

          <div class="bili-setting-group">
            <div class="bili-setting-title">净化与折叠行为</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span>可疑分数折叠阈值:</span>
              <input type="number" id="inp-threshold" value="${cfg.foldThreshold}" min="30" max="100" style="width:60px;padding:3px 6px;border:1px solid #ccc;border-radius:4px;">
              <span style="color:#888;font-size:12px;">(达到此分数的评论自动淡化折叠)</span>
            </div>
          </div>

          <div class="bili-setting-group">
            <div class="bili-setting-title">自定义黑名单规则 / 关键词</div>
            <div class="bili-rule-list" id="custom-rule-container">
              ${(cfg.customRules || []).map((r, idx) => `
                <div class="bili-rule-item">
                  <span><b>${r.name || r.pattern}</b> (${r.isRegex ? '正则' : '关键词'}, +${r.score || 40}分)</span>
                  <button class="bili-dash-btn btn-del-rule" data-idx="${idx}" style="color:#f5222d;">删除</button>
                </div>
              `).join('') || '<div style="color:#888;padding:6px;">暂无自定义规则</div>'}
            </div>
            <div style="display:flex;gap:6px;margin-top:4px;">
              <input type="text" id="inp-new-pattern" placeholder="输入关键词或正则表达式" style="flex:1;padding:4px 8px;border:1px solid #ccc;border-radius:4px;">
              <label style="display:flex;align-items:center;gap:2px;font-size:12px;">
                <input type="checkbox" id="chk-is-regex"> 正则
              </label>
              <button class="bili-btn-default" id="btn-add-rule">添加</button>
            </div>
          </div>
        </div>
        <div class="bili-modal-footer">
          <button class="bili-btn-default" id="btn-reset-defaults">恢复默认配置</button>
          <button class="bili-btn-primary" id="btn-save-settings">保存生效</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#bili-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('#btn-add-rule').addEventListener('click', () => {
      const pattern = modal.querySelector('#inp-new-pattern').value.trim();
      const isRegex = modal.querySelector('#chk-is-regex').checked;
      if (!pattern) return;

      const rules = cfg.customRules || [];
      rules.push({ pattern, name: pattern, isRegex, score: 45 });
      configMgr.update({ customRules: rules });
      closeModal();
      openSettingsModal();
    });

    modal.querySelectorAll('.btn-del-rule').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        const rules = cfg.customRules || [];
        rules.splice(idx, 1);
        configMgr.update({ customRules: rules });
        closeModal();
        openSettingsModal();
      });
    });

    modal.querySelector('#btn-save-settings').addEventListener('click', () => {
      const threshold = parseInt(modal.querySelector('#inp-threshold').value) || 60;
      configMgr.update({
        foldThreshold: threshold,
        modules: {
          anti_china: modal.querySelector('#chk-mod-china').checked,
          anti_mihoyo: modal.querySelector('#chk-mod-mihoyo').checked,
          smartphone_rivalry: modal.querySelector('#chk-mod-phone').checked,
          text_clustering: modal.querySelector('#chk-mod-cluster').checked
        }
      });
      closeModal();
      updateDashboard();
      scheduleDOMScan();
    });

    modal.querySelector('#btn-reset-defaults').addEventListener('click', () => {
      if (confirm('确认恢复默认检测规则与配置？')) {
        configMgr.update(DEFAULT_CONFIG);
        closeModal();
        updateDashboard();
        scheduleDOMScan();
      }
    });
  }

  // 注册油猴菜单指令
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('⚙️ 打开黑流量检测设置', openSettingsModal);
    GM_registerMenuCommand('🔍 排查当前UP主与通稿矩阵', checkUpAndMatrixCredibility);
    GM_registerMenuCommand('🔄 重新扫描当前评论区', () => {
      updateDashboard();
      scheduleDOMScan();
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
    updateDashboard();
    scheduleDOMScan();
  });
})();
