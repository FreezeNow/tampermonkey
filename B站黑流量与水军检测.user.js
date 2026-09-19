// ==UserScript==
// @name         B站黑流量与水军检测
// @namespace    FreezeNowBilibiliBlackTrafficDetector
// @version      1.0.0
// @description  精准识别B站评论区中的反华/逆民/阴阳怪气、反米哈游极端黑粉、手机圈商战互黑等黑流量与水军模板，支持分类折叠、设备交叉比对与自定义规则库
// @author       FreezeNow
// @match        *://www.bilibili.com/video/*
// @match        *://www.bilibili.com/list/*
// @match        *://www.bilibili.com/bangumi/play/*
// @icon         https://www.bilibili.com/favicon.ico
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
  // 2. 本地配置持久化与管理器
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
      this.clusters = [];       // [{ rootRpid, rpids: [], textSample, keywords }]
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

    // Jaccard 相似度计算
    calcJaccard(setA, setB) {
      if (!setA.size || !setB.size) return 0;
      let intersection = 0;
      for (const item of setA) {
        if (setB.has(item)) intersection++;
      }
      const union = setA.size + setB.size - intersection;
      return union === 0 ? 0 : intersection / union;
    }

    // 增量聚类比对
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
        // 创建新潜在族群
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

        // 关键词匹配
        for (const kw of dict.keywords) {
          if (msg.toLowerCase().includes(kw.toLowerCase())) {
            categoryHits.push(kw);
          }
        }

        // 正则模式匹配
        for (const reg of dict.regexPatterns) {
          if (reg.test(msg)) {
            categoryHits.push('正则:' + reg.source.slice(0, 15));
          }
        }

        if (categoryHits.length > 0) {
          matchedCategories.add(dict.category);
          // 去重
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

      // 4. 手机圈特有机型与言论冲突交叉校验 (Device Cross-check)
      if (cfg.modules.smartphone_rivalry && device) {
        const isXiaomiDevice = /xiaomi|redmi|k\d0/i.test(device);
        const isHuaweiDevice = /huawei|honor|mate|p\d0|nova/i.test(device);
        const isAppleDevice = /iphone|ipad/i.test(device);

        // 如果手持竞品设备，并在评论中发表严重攻击贬损言论
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

      // 6. 账号资产维度微调 (中高级养号水军判定)
      const level = reply.level ?? 0;
      const fansDetail = reply.fans_detail;
      const isDefaultAvatar = !reply.avatar || reply.avatar.includes('noface');

      if (level <= 2 && score >= 30) {
        score += 15;
        reasons.push(`账号等级极低 (Lv${level}, +15)`);
      } else if (level >= 4 && !fansDetail && !reply.sign && score >= 30) {
        // Lv4-5 养号账号：无粉丝牌、无签名、无装扮
        score += 10;
        reasons.push(`养号高危特征 (Lv${level}但零粉丝牌零签名, +10)`);
      }

      if (isDefaultAvatar && score >= 20) {
        score += 10;
        reasons.push('默认无头像 (+10)');
      }

      // 7. 白名单扣分/路人保护 (避免误伤真实活跃用户)
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
  // 5. 原生网络请求拦截 (Hook fetch & XHR)
  // ==========================================

  function parseReplyItem(item) {
    if (!item) return null;
    return {
      rpid: String(item.rpid),
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
      // 子评论
      if (Array.isArray(raw.replies)) {
        raw.replies.forEach(subRaw => {
          const subParsed = parseReplyItem(subRaw);
          if (subParsed) {
            replyStore.addReply(subParsed);
          }
        });
      }
    });

    // 触发 UI 看板与标记刷新
    updateDashboard();
    scheduleDOMScan();
  }

  function hookNetwork() {
    // 1. Hook fetch
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
        if (url && (url.includes('/x/v2/reply') || url.includes('/x/v2/reply/wbi/main') || url.includes('/x/v2/reply/reply'))) {
          const clone = response.clone();
          clone.json().then(handleReplyData).catch(() => {});
        }
      } catch (err) {}
      return response;
    };

    // 2. Hook XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._url = url;
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener('load', function () {
        try {
          if (this._url && (this._url.includes('/x/v2/reply') || this._url.includes('/x/v2/reply/wbi/main') || this._url.includes('/x/v2/reply/reply'))) {
            const data = JSON.parse(this.responseText);
            handleReplyData(data);
          }
        } catch (e) {}
      });
      return originalSend.apply(this, args);
    };
  }

  hookNetwork();

  // ==========================================
  // 6. UI 交互看板与评论区元素渲染
  // ==========================================

  const STYLES = `
    /* 黑流量检测器悬浮看板 */
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
    .bili-filter-toggle input {
      cursor: pointer;
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

    /* 折叠状态样式 */
    .bili-reply-folded {
      opacity: 0.35;
      transition: opacity 0.2s;
    }
    .bili-reply-folded:hover {
      opacity: 0.85;
    }

    /* 设置模态窗口 */
    #bili-detector-modal {
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
      max-width: 90vw;
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
    .bili-btn-primary:hover {
      background: #009cd3;
    }
    .bili-btn-default {
      background: #fff;
      color: #61666d;
      border: 1px solid #e3e5e7;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
    }
    .bili-btn-default:hover {
      background: #f6f7f8;
    }
  `;

  function injectStyles() {
    if (document.getElementById('bili-detector-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'bili-detector-styles';
    styleEl.textContent = STYLES;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  // 渲染悬浮看板
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
        <div class="bili-filter-toggle">
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
            <input type="checkbox" id="bili-chk-fold"> 自动淡化/折叠可疑评论
          </label>
        </div>
      </div>
    `;

    document.body.appendChild(dash);

    // 绑定事件
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

    const chkFold = dash.querySelector('#bili-chk-fold');
    chkFold.checked = configMgr.get().foldSuspects;
    chkFold.addEventListener('change', () => {
      configMgr.update({ foldSuspects: chkFold.checked });
      scheduleDOMScan();
    });
  }

  // 更新看板统计数据
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
      ratioEl.textContent = '0.0% (正常)';
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
  // 7. 评论区 DOM 观察与无缝标记注入
  // ==========================================

  let scanTimer = null;
  function scheduleDOMScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAndTagComments, 200);
  }

  // 获取评论节点对应的 rpid 与 text
  function findCommentDetails(node) {
    // 兼容新版 Web Components 与旧版 DOM 树
    let rpid = node.getAttribute('data-id') || node.getAttribute('data-rpid') || node.id;
    if (!rpid) {
      const sub = node.querySelector('[data-id], [data-rpid]');
      if (sub) rpid = sub.getAttribute('data-id') || sub.getAttribute('data-rpid');
    }

    // 匹配用户名或文本
    const userEl = node.querySelector('.user-name, #user-name, .name, [data-user-id]');
    const contentEl = node.querySelector('.reply-content, #content, .text, .root-reply-content');
    return {
      rpid: rpid ? String(rpid) : null,
      userEl,
      contentEl,
      text: contentEl ? contentEl.innerText.trim() : ''
    };
  }

  function scanAndTagComments() {
    const cfg = configMgr.get();
    if (!cfg.enabled) return;

    // 匹配主流 B 站评论节点：
    // 新版 WebComponent: bili-comment-renderer, bili-comment-reply-renderer
    // 经典版: .reply-item, .sub-reply-item
    const candidates = document.querySelectorAll(`
      bili-comment-renderer,
      bili-comment-reply-renderer,
      .reply-item,
      .sub-reply-item
    `);

    candidates.forEach(node => {
      const { rpid, userEl, contentEl, text } = findCommentDetails(node);

      // 寻找对应的内存对象
      let replyData = null;
      if (rpid && replyStore.replies.has(rpid)) {
        replyData = replyStore.replies.get(rpid);
      } else if (text) {
        // 降级：若未获得直接 rpid，通过文本片段定位
        for (const [id, r] of replyStore.replies.entries()) {
          if (r.message && (r.message === text || text.includes(r.message.slice(0, 20)))) {
            replyData = r;
            break;
          }
        }
      }

      if (!replyData) return;

      const analysis = detector.analyze(replyData);
      const targetHeader = userEl || node.querySelector('.user-info') || node;

      // 移除旧标签
      const oldTag = node.querySelector('.bili-traffic-tag');
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

        // 点击展开详情提示
        tag.addEventListener('click', (e) => {
          e.stopPropagation();
          alert(`【黑流量检测详情】\n账号: ${replyData.uname} (Lv${replyData.level})\n综合危险分: ${analysis.score}\n\n命中规则:\n${analysis.reasons.join('\n')}`);
        });

        if (targetHeader && targetHeader.parentNode) {
          targetHeader.parentNode.insertBefore(tag, targetHeader.nextSibling);
        }

        // 自动折叠处理
        if (cfg.foldSuspects && analysis.score >= cfg.foldThreshold) {
          node.classList.add('bili-reply-folded');
        } else {
          node.classList.remove('bili-reply-folded');
        }
      } else {
        node.classList.remove('bili-reply-folded');
      }
    });
  }

  // 监听 DOM 变化持续处理分页加载的评论
  const domObserver = new MutationObserver(() => {
    scheduleDOMScan();
  });

  domObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // ==========================================
  // 8. 规则设置与自定义词库弹窗面板
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

    // 事件监听
    const closeModal = () => modal.remove();
    modal.querySelector('#bili-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // 添加自定义规则
    modal.querySelector('#btn-add-rule').addEventListener('click', () => {
      const pattern = modal.querySelector('#inp-new-pattern').value.trim();
      const isRegex = modal.querySelector('#chk-is-regex').checked;
      if (!pattern) return;

      const rules = cfg.customRules || [];
      rules.push({
        pattern,
        name: pattern,
        isRegex,
        score: 45
      });
      configMgr.update({ customRules: rules });
      closeModal();
      openSettingsModal();
    });

    // 删除规则
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

    // 保存配置
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

    // 恢复默认
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
    GM_registerMenuCommand('🔄 重新扫描当前评论区', () => {
      updateDashboard();
      scheduleDOMScan();
    });
  }

  // 页面加载完成后初次初始化看板
  window.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
    updateDashboard();
  });
})();
