/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule setTextContent
 */

'use strict';

/**
 * ExecutionEnvironment模块的源码
 * @param {*} _dereq_ 
 * @param {*} module 
 * @param {*} exports 
 */
function myExecutionEnvironment(_dereq_, module, exports) {
      /**
       * Copyright (c) 2013-present, Facebook, Inc.
       * All rights reserved.
       *
       * This source code is licensed under the BSD-style license found in the
       * LICENSE file in the root directory of this source tree. An additional grant
       * of patent rights can be found in the PATENTS file in the same directory.
       *
       */

       'use strict';

       // 是否不是在服务器上
       var canUseDOM = !!(typeof window !== 'undefined' && window.document && window.document.createElement);
 
       /**
        * Simple, lightweight module assisting with the detection and context of
        * Worker. Helps avoid circular dependencies and allows code to reason about
        * whether or not they are in a Worker, even if they never include the main
        * `ReactWorker` dependency.
        */
       var ExecutionEnvironment = {
 
         canUseDOM: canUseDOM,
 
         canUseWorkers: typeof Worker !== 'undefined',
 
         canUseEventListeners: canUseDOM && !!(window.addEventListener || window.attachEvent),
 
         canUseViewport: canUseDOM && !!window.screen,
 
         isInWorker: !canUseDOM // For now, this is true - might change in the future.
 
       };
 
       module.exports = ExecutionEnvironment;
}





var ExecutionEnvironment = require('ExecutionEnvironment');
var escapeTextContentForBrowser = require('escapeTextContentForBrowser');
var setInnerHTML = require('setInnerHTML');

/**
 * 设置文本
 * @param {DOMElement} node 标签
 * @param {string} text 文本
 * @internal
 */
var setTextContent = function(node, text) {
  node.textContent = text;  // 将文本设置到节点的textContent属性上
};

// 判断是否不是在服务器上执行的
if (ExecutionEnvironment.canUseDOM) {
  
  // 判断该节点的所有下级中是否没有文本节点
  if (!('textContent' in document.documentElement)) {  
    setTextContent = function(node, text) {
      setInnerHTML(node, escapeTextContentForBrowser(text));
    };
  }
}

module.exports = setTextContent;
